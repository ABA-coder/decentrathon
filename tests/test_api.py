import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    # A new disposable model; never reads or replaces the application model.
    os.environ["MODEL_PATH"] = str(tmp_path_factory.mktemp("model") / "test-model.pkl")
    os.environ.pop("OPENAI_API_KEY", None)
    os.environ.pop("ADMIN_API_KEY", None)
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as api:
        yield api


def test_home_and_health_without_secrets(client):
    assert client.get("/").status_code == 200
    assert "ProcureAI KZ" in client.get("/").text
    health = client.get("/health").json()
    assert health["status"] == "ok"
    assert health["gpt_configured"] is False
    assert health["data_source"] == "synthetic"


def test_entire_registry_statistics_and_detail_agree(client):
    response = client.get("/api/v1/tenders?page_size=250")
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert len(items) == 250
    assert items == sorted(items, key=lambda item: item["risk_score"], reverse=True)
    stats = client.get("/api/v1/stats").json()
    assert stats["total_tenders"] == len(items)
    assert sum(stats[key] for key in ("critical_count", "high_count", "medium_count", "low_count")) == 250
    assert sum(stats["category_counts"].values()) == stats["critical_count"] + stats["high_count"]
    for item in items[:3]:
        response = client.get("/api/v1/tenders/" + item["tender_id"])
        assert response.status_code == 200, response.text
        detail = response.json()
        assert detail["analysis"]["risk_score"] == item["risk_score"]
        assert isinstance(detail["analysis"]["ml_anomaly"], bool)
        assert detail["tender"]["submission_days"] > 0


def test_filters_and_unknown_tender(client):
    response = client.get("/api/v1/tenders?region=Алматы&page_size=250&min_score=20")
    assert response.status_code == 200
    assert all(item["region"] == "Алматы" and item["risk_score"] >= 20 for item in response.json()["items"])
    assert client.get("/api/v1/tenders/not-a-tender").status_code == 404
    assert client.get("/api/v1/tenders?region=[").status_code == 200


def test_real_ml_analysis_and_missing_gpt_key(client):
    tender = client.get("/api/v1/demo").json()
    response = client.post("/api/v1/analyze", json=tender)
    assert response.status_code == 200, response.text
    analysis = response.json()
    assert analysis["flags_count"] == 6
    assert len(analysis["feature_contributions"]) == 9
    assert 0 <= analysis["risk_score"] <= 100
    assert analysis["gpt_explanation"]["source"] == "fallback"
    assert "OPENAI_API_KEY" in analysis["gpt_explanation"]["data_gaps"]
    tender["with_gpt_explanation"] = False
    assert client.post("/api/v1/analyze", json=tender).json()["gpt_explanation"] is None


@pytest.mark.parametrize("field,value", [("initial_price_kzt", 0), ("bid_count", 0), ("submission_days", -1), ("title", "   ")])
def test_invalid_input_is_rejected(client, field, value):
    tender = client.get("/api/v1/demo").json()
    tender[field] = value
    assert client.post("/api/v1/analyze", json=tender).status_code == 422


def test_training_requires_admin_key_without_training(client, monkeypatch):
    import detector
    train = Mock(side_effect=AssertionError("Training must not execute in this access test"))
    monkeypatch.setattr(detector.ProcurementAnomalyDetector, "train", train)
    assert client.post("/api/v1/train").status_code == 503
    monkeypatch.setenv("ADMIN_API_KEY", "test-admin-only")
    assert client.post("/api/v1/train").status_code == 403
    assert client.post("/api/v1/train", headers={"X-Admin-Key": "wrong"}).status_code == 403
    train.assert_not_called()


def test_gpt_prompt_and_response_contract(client, monkeypatch):
    import explainer
    from detector import get_detector
    tender = client.get("/api/v1/demo").json()
    analysis = get_detector().analyze(tender)
    explanation = {
        "verdict_summary": "Тестовый ответ", "risk_rationale": "Тест",
        "flag_analysis": [{"code": "A1", "explanation": "Одна заявка"}],
        "recommended_actions": ["Проверить данные"], "data_gaps": "Реестр цен",
        "disclaimer": "Решение принимает аудитор",
    }
    create = Mock(return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(explanation)))]))
    monkeypatch.setenv("OPENAI_API_KEY", "test-value-not-a-real-key")
    monkeypatch.setattr(explainer, "get_client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))))
    result = explainer.generate_explanation(tender, analysis)
    assert result["source"] == "openai"
    assert tender["title"] in create.call_args.kwargs["messages"][1]["content"]
    assert "{ml_label}" not in create.call_args.kwargs["messages"][1]["content"]
    create.side_effect = RuntimeError("private provider failure")
    result = explainer.generate_explanation(tender, analysis)
    assert result["source"] == "fallback"
    assert "private provider failure" not in json.dumps(result)
