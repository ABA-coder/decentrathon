"""
ProcureAI KZ — API Routes

Endpoints:
  POST /analyze          — анализ одного тендера (+ Gemini объяснение)
  GET  /tenders          — список тендеров с риск-скорами (пагинация, фильтры)
  GET  /tenders/{id}     — детальный анализ конкретного тендера
  GET  /stats            — агрегированная статистика по датасету
  POST /train            — переобучение ML-модели
  GET  /rules            — список активных правил детекции
  GET  /demo             — демо-тендер для UI
"""

import os
import secrets
from functools import lru_cache
from fastapi import APIRouter, HTTPException, Query, Header
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
import pandas as pd

from detector import get_detector, _detector_lock
from explainer import generate_explanation
from dataset import generate_tenders

router = APIRouter()

# ── Кэш датасета (в production — БД) ─────────────────────────────────────────
_dataset_cache: pd.DataFrame = None


def _get_dataset() -> pd.DataFrame:
    global _dataset_cache
    if _dataset_cache is None:
        _dataset_cache = generate_tenders(n=250, seed=42)
    return _dataset_cache


@lru_cache(maxsize=1)
def _ranked_dataset() -> pd.DataFrame:
    with _detector_lock:
        return get_detector().analyze_batch(_get_dataset())


# ── Pydantic Models ───────────────────────────────────────────────────────────

class TenderInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, str_strip_whitespace=True)
    tender_id: str = Field(default="MANUAL-001")
    title: str = Field(..., min_length=1, max_length=2000, description="Предмет тендера")
    category: str = Field(default="Прочее")
    customer_org: str = Field(..., min_length=1, max_length=500, description="Организация-заказчик")
    region: str = Field(default="Астана")
    initial_price_kzt: float = Field(..., gt=0, description="Начальная цена (тенге)")
    bid_count: int = Field(..., ge=1, description="Количество поданных заявок")
    winner_name: str = Field(default="Неизвестно")
    submission_days: int = Field(..., ge=1, description="Срок приёма заявок (дни)")
    repeat_winner: int = Field(default=0, ge=0, le=1)
    lot_count: int = Field(default=1, ge=1)
    spec_tailored: int = Field(default=0, ge=0, le=1)
    contract_duration_days: int = Field(default=180, ge=1)
    price_markup_pct: float = Field(default=0.0)
    with_gpt_explanation: bool = Field(default=True)


class TriggeredRule(BaseModel):
    rule_id: str
    code: str
    label: str
    description: str
    weight: int


class FeatureContribution(BaseModel):
    feature: str
    label: str
    z_score: float
    direction: str


class AnalysisResponse(BaseModel):
    tender_id: str
    title: str
    customer_org: str
    risk_score: float
    risk_level: str
    rule_score: float
    ml_score: float
    ml_anomaly: bool
    flags_count: int
    triggered_rules: List[TriggeredRule]
    feature_contributions: List[FeatureContribution]
    gpt_explanation: Optional[Dict[str, Any]] = None
    disclaimer: str = (
        "⚠ Данный анализ является инструментом поддержки принятия решений. "
        "Окончательное заключение принимается уполномоченным аудитором."
    )


class TenderListItem(BaseModel):
    tender_id: str
    title: str
    customer_org: str
    region: str
    category: str
    initial_price_kzt: float
    bid_count: int
    risk_score: float
    risk_level: str
    flags_count: int
    ml_anomaly: bool


class TenderListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[TenderListItem]
    disclaimer: str = (
        "Риск-скоры рассчитаны автоматически. Требуют верификации аудитором перед принятием решений."
    )


class StatsResponse(BaseModel):
    total_tenders: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    total_value_kzt: float
    anomaly_rate_pct: float
    top_flagged_category: str
    top_flagged_org: str
    category_counts: Dict[str, int] = Field(default_factory=dict)
    org_counts: Dict[str, int] = Field(default_factory=dict)
    region_counts: Dict[str, int] = Field(default_factory=dict)
    data_source: str = "synthetic"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=AnalysisResponse)
def analyze_tender(body: TenderInput):
    """
    Полный анализ тендера: правила + ML + Gemini объяснение.
    
    Возвращает риск-скор [0-100], список сработавших флагов,
    вклады признаков и (опционально) аудиторский нарратив от Gemini.
    """
    detector = get_detector()
    tender_dict = body.model_dump(exclude={"with_gpt_explanation"})
    tender_dict["single_bid"] = int(body.bid_count == 1)

    analysis = detector.analyze(tender_dict)

    gpt_explanation = None
    if body.with_gpt_explanation:
        try:
            gpt_explanation = generate_explanation(tender_dict, analysis)
        except Exception:
            gpt_explanation = None

    return AnalysisResponse(
        tender_id=body.tender_id,
        title=body.title,
        customer_org=body.customer_org,
        **{k: v for k, v in analysis.items()},
        gpt_explanation=gpt_explanation,
    )


@router.get("/tenders", response_model=TenderListResponse)
def list_tenders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=250),
    risk_level: Optional[str] = Query(None, description="КРИТИЧЕСКИЙ|ВЫСОКИЙ|СРЕДНИЙ|НИЗКИЙ"),
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    min_score: float = Query(0, ge=0, le=100),
):
    """
    Список всех тендеров с риск-скорами. Поддерживает фильтрацию и пагинацию.
    """
    ranked = _ranked_dataset()

    # Filters
    if risk_level:
        ranked = ranked[ranked["risk_level"] == risk_level.upper()]
    if region:
        ranked = ranked[ranked["region"].str.contains(region, case=False, na=False, regex=False)]
    if category:
        ranked = ranked[ranked["category"].str.contains(category, case=False, na=False, regex=False)]
    ranked = ranked[ranked["risk_score"] >= min_score]

    total = len(ranked)
    start = (page - 1) * page_size
    page_df = ranked.iloc[start: start + page_size]

    items = [
        TenderListItem(
            tender_id=str(row["tender_id"]),
            title=str(row["title"]),
            customer_org=str(row["customer_org"]),
            region=str(row["region"]),
            category=str(row["category"]),
            initial_price_kzt=float(row["initial_price_kzt"]),
            bid_count=int(row["bid_count"]),
            risk_score=float(row["risk_score"]),
            risk_level=str(row["risk_level"]),
            flags_count=int(row["flags_count"]),
            ml_anomaly=bool(row["ml_anomaly"]),
        )
        for _, row in page_df.iterrows()
    ]

    return TenderListResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/tenders/{tender_id}")
def get_tender(tender_id: str, with_gpt: bool = Query(False)):
    """Детальный анализ конкретного тендера по ID."""
    df = _get_dataset()
    row = df[df["tender_id"] == tender_id]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"Тендер {tender_id} не найден")

    tender_dict = row.iloc[0].to_dict()
    detector = get_detector()
    analysis = detector.analyze(tender_dict)

    gpt = None
    if with_gpt:
        try:
            gpt = generate_explanation(tender_dict, analysis)
        except Exception:
            pass

    return {
        "tender": tender_dict,
        "analysis": analysis,
        "gpt_explanation": gpt,
        "disclaimer": "Анализ сформирован автоматически. Требует верификации аудитором.",
    }


@router.get("/stats", response_model=StatsResponse)
def get_stats():
    """Агрегированная статистика по всему датасету тендеров."""
    ranked = _ranked_dataset()

    levels = ranked["risk_level"].value_counts().to_dict()
    anomaly_rate = ranked["ml_anomaly"].mean() * 100
    top_cat = ranked[ranked["risk_level"].isin(["КРИТИЧЕСКИЙ", "ВЫСОКИЙ"])]["category"].mode()
    top_org = ranked[ranked["risk_level"].isin(["КРИТИЧЕСКИЙ", "ВЫСОКИЙ"])]["customer_org"].mode()
    flagged = ranked[ranked["risk_level"].isin(["КРИТИЧЕСКИЙ", "ВЫСОКИЙ"])]

    return StatsResponse(
        total_tenders=len(ranked),
        critical_count=int(levels.get("КРИТИЧЕСКИЙ", 0)),
        high_count=int(levels.get("ВЫСОКИЙ", 0)),
        medium_count=int(levels.get("СРЕДНИЙ", 0)),
        low_count=int(levels.get("НИЗКИЙ", 0)),
        total_value_kzt=float(ranked["initial_price_kzt"].sum()),
        anomaly_rate_pct=round(float(anomaly_rate), 1),
        top_flagged_category=str(top_cat.iloc[0]) if len(top_cat) else "—",
        top_flagged_org=str(top_org.iloc[0]) if len(top_org) else "—",
        category_counts={str(k): int(v) for k, v in flagged["category"].value_counts().items()},
        org_counts={str(k): int(v) for k, v in flagged["customer_org"].value_counts().items()},
        region_counts={str(k): int(v) for k, v in flagged["region"].value_counts().items()},
    )


@router.post("/train")
def retrain(x_admin_key: Optional[str] = Header(default=None)):
    """Переобучение ML-модели на свежем датасете."""
    if os.getenv("VERCEL") == "1":
        raise HTTPException(status_code=503, detail="В этом окружении используется базовая модель")
    expected = os.getenv("ADMIN_API_KEY")
    if not expected:
        raise HTTPException(status_code=503, detail="Переобучение отключено: настройте ADMIN_API_KEY на сервере")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, expected):
        raise HTTPException(status_code=403, detail="Для переобучения нужен ключ администратора")
    import detector as detector_module
    with _detector_lock:
        replacement = detector_module.ProcurementAnomalyDetector()
        metrics = replacement.train(generate_tenders(n=600, seed=99))
        detector_module._detector = replacement
        _ranked_dataset.cache_clear()
    return {"status": "trained", "metrics": metrics}


@router.get("/rules")
async def list_rules():
    """Список всех активных правил детекции аномалий."""
    from detector import RULES
    return {
        "rules": [
            {
                "id": r["id"],
                "code": r["code"],
                "label": r["label"],
                "description": r["description"],
                "weight": r["weight"],
            }
            for r in RULES
        ],
        "total_weight": sum(r["weight"] for r in RULES),
        "note": "Правила применяются параллельно с ML-моделью (Isolation Forest).",
    }


@router.get("/demo")
async def demo_tender():
    """Демо-тендер с высоким риском для тестирования UI."""
    return {
        "tender_id": "KZ-2025-DEMO-001",
        "title": "Строительные работы: капитальный ремонт объектов образования (Астана)",
        "category": "Строительные работы",
        "customer_org": "Управление образования г. Астана",
        "region": "Астана",
        "initial_price_kzt": 485_000_000,
        "bid_count": 1,
        "winner_name": "ТОО «МегаСтрой KZ»",
        "submission_days": 3,
        "repeat_winner": 1,
        "lot_count": 12,
        "spec_tailored": 1,
        "contract_duration_days": 180,
        "price_markup_pct": 62.0,
        "with_gpt_explanation": True,
    }
