"""
ProcureAI — Anomaly Detection Engine

Двухуровневая архитектура:
  Layer 1 — Rule Engine:  детерминированные флаги по пороговым значениям
  Layer 2 — ML (IsolationForest): выявление многомерных аномалий
  Layer 3 — Risk Score:   взвешенная комбинация обоих уровней [0–100]

Isolation Forest выбран потому, что:
  — не требует разметки (unsupervised)
  — хорошо обобщается на новые схемы мошенничества
  — нативно поддерживает объяснение через feature contributions
"""

import numpy as np
import pandas as pd
import pickle
import os
import tempfile
from threading import RLock
from typing import Dict, List, Any, Tuple
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from dataset import generate_tenders, FEATURE_COLUMNS, FLAG_LABELS

MODEL_PATH = os.getenv("MODEL_PATH", os.path.join(tempfile.gettempdir(), "procureai-kz", "model.pkl"))
_detector_lock = RLock()

# ── Пороговые правила (Rule Engine) ──────────────────────────────────────────
RULES = [
    {
        "id": "R1",
        "code": "A1",
        "label": "Единственная заявка",
        "description": "Подана только одна заявка — возможная аффилированность или ограничение конкуренции",
        "check": lambda r: r.get("bid_count", 99) == 1,
        "weight": 20,
    },
    {
        "id": "R2",
        "code": "A2",
        "label": "Завышение начальной цены",
        "description": "Начальная цена превышает рыночный ориентир более чем на 30%",
        "check": lambda r: r.get("price_markup_pct", 0) > 30,
        "weight": 25,
    },
    {
        "id": "R3",
        "code": "A3",
        "label": "Сжатые сроки подачи",
        "description": "Срок приёма заявок менее 5 рабочих дней — ограничивает доступ участников",
        "check": lambda r: r.get("submission_days", 99) < 5,
        "weight": 18,
    },
    {
        "id": "R4",
        "code": "A4",
        "label": "Повторяющийся победитель",
        "description": "Один и тот же поставщик побеждает у данного заказчика без конкурса",
        "check": lambda r: bool(r.get("repeat_winner", 0)),
        "weight": 22,
    },
    {
        "id": "R5",
        "code": "A5",
        "label": "Дробление лота",
        "description": "Необычно большое число лотов — признак разбивки крупного контракта для обхода порогов",
        "check": lambda r: r.get("lot_count", 1) >= 8,
        "weight": 15,
    },
    {
        "id": "R6",
        "code": "A6",
        "label": "ТЗ под конкретного поставщика",
        "description": "Технические требования содержат признаки заточенности под одного исполнителя",
        "check": lambda r: bool(r.get("spec_tailored", 0)),
        "weight": 20,
    },
]

TOTAL_RULE_WEIGHT = sum(r["weight"] for r in RULES)  # 120 → нормируем к 60


class ProcurementAnomalyDetector:
    """
    Двухуровневый детектор аномалий госзакупок.

    Risk Score = 0.5 × rule_score + 0.5 × ml_score  →  [0, 100]

    rule_score: взвешенная доля сработавших правил (0–100)
    ml_score:   IsolationForest anomaly score (0–100, выше = подозрительнее)
    """

    def __init__(self):
        self.model: IsolationForest = None
        self.scaler: StandardScaler = None
        self.is_trained = False

    # ── Training ──────────────────────────────────────────────────────────────

    def train(self, df: pd.DataFrame = None) -> Dict[str, Any]:
        if df is None:
            df = generate_tenders(n=500, seed=42)

        X = df[FEATURE_COLUMNS].fillna(0).values

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.15,  # ожидаем ~15% аномальных тендеров
            random_state=42,
            n_jobs=1,
        )
        self.model.fit(X_scaled)
        self.is_trained = True

        # Оцениваем на датасете
        scores = self.model.decision_function(X_scaled)
        anomaly_rate = (self.model.predict(X_scaled) == -1).mean()

        self._save()
        return {
            "train_samples": len(df),
            "anomaly_rate_pct": round(float(anomaly_rate) * 100, 1),
            "model": "IsolationForest",
            "features": FEATURE_COLUMNS,
        }

    # ── Single tender analysis ─────────────────────────────────────────────────

    def analyze(self, tender: Dict[str, Any]) -> Dict[str, Any]:
        """
        Полный анализ одного тендера.

        Returns:
            risk_score:     float [0-100]
            risk_level:     str
            triggered_rules: список сработавших правил с объяснением
            ml_anomaly:     bool
            ml_score_raw:   float
            feature_contributions: список вкладов признаков
        """
        if not self.is_trained:
            self._load_or_train()

        # 1. Rule engine
        triggered = []
        rule_weighted_sum = 0
        for rule in RULES:
            fired = rule["check"](tender)
            if fired:
                triggered.append({
                    "rule_id": rule["id"],
                    "code": rule["code"],
                    "label": rule["label"],
                    "description": rule["description"],
                    "weight": rule["weight"],
                })
                rule_weighted_sum += rule["weight"]

        rule_score = min(100.0, (rule_weighted_sum / TOTAL_RULE_WEIGHT) * 100 * 1.6)

        # 2. ML score
        feat = np.array([[tender.get(f, 0) for f in FEATURE_COLUMNS]], dtype=float)
        feat_scaled = self.scaler.transform(feat)
        raw_decision = float(self.model.decision_function(feat_scaled)[0])
        ml_label = self.model.predict(feat_scaled)[0]

        # decision_function: negative = anomaly, positive = normal
        # Инвертируем и нормируем в [0, 100]
        ml_score = float(np.clip((-raw_decision + 0.5) * 80, 0, 100))
        ml_anomaly = bool(ml_label == -1)

        # 3. Feature contributions (знак deviation от среднего)
        feature_contributions = self._feature_contributions(feat_scaled[0])

        # 4. Combined risk score
        risk_score = round(0.55 * rule_score + 0.45 * ml_score, 1)
        risk_level = self._risk_level(risk_score)

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "rule_score": round(rule_score, 1),
            "ml_score": round(ml_score, 1),
            "ml_anomaly": ml_anomaly,
            "triggered_rules": triggered,
            "feature_contributions": feature_contributions,
            "flags_count": len(triggered),
        }

    # ── Batch scoring ─────────────────────────────────────────────────────────

    def analyze_batch(self, df: pd.DataFrame) -> pd.DataFrame:
        if not self.is_trained:
            self._load_or_train()

        features = self.scaler.transform(df[FEATURE_COLUMNS].fillna(0).values)
        ml_scores = np.clip((-self.model.decision_function(features) + 0.5) * 80, 0, 100)
        anomalies = self.model.predict(features) == -1
        results = []
        for index, row in enumerate(df.to_dict("records")):
            fired = [rule for rule in RULES if rule["check"](row)]
            rule_score = min(100.0, sum(rule["weight"] for rule in fired) / TOTAL_RULE_WEIGHT * 160)
            risk_score = round(0.55 * rule_score + 0.45 * float(ml_scores[index]), 1)
            results.append({
                "tender_id": row["tender_id"],
                "risk_score": risk_score,
                "risk_level": self._risk_level(risk_score),
                "flags_count": len(fired),
                "ml_anomaly": bool(anomalies[index]),
            })

        result_df = pd.DataFrame(results)
        merged = df.merge(result_df, on="tender_id", how="left")
        return merged.sort_values("risk_score", ascending=False)

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _feature_contributions(self, feat_scaled: np.ndarray) -> List[Dict]:
        """Deviation от среднего как прокси вклада признака."""
        contributions = []
        for i, col in enumerate(FEATURE_COLUMNS):
            deviation = float(feat_scaled[i])  # z-score
            contributions.append({
                "feature": col,
                "label": FLAG_LABELS.get(col, (col, col))[1] if col in FLAG_LABELS else col,
                "z_score": round(deviation, 2),
                "direction": "высокий" if deviation > 0.5 else ("низкий" if deviation < -0.5 else "норма"),
            })
        return sorted(contributions, key=lambda x: abs(x["z_score"]), reverse=True)

    def _risk_level(self, score: float) -> str:
        if score >= 70:
            return "КРИТИЧЕСКИЙ"
        elif score >= 45:
            return "ВЫСОКИЙ"
        elif score >= 20:
            return "СРЕДНИЙ"
        return "НИЗКИЙ"

    def _save(self):
        os.makedirs(os.path.dirname(os.path.abspath(MODEL_PATH)), exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump({"model": self.model, "scaler": self.scaler}, f)
        self.is_trained = True

    def _load_or_train(self):
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "rb") as f:
                    d = pickle.load(f)
                    self.model = d["model"]
                    self.scaler = d["scaler"]
                    self.is_trained = True
            except (OSError, EOFError, pickle.UnpicklingError, AttributeError, KeyError, ValueError):
                self.train()
        else:
            self.train()


# ── Singleton ─────────────────────────────────────────────────────────────────
_detector: ProcurementAnomalyDetector = None


def get_detector() -> ProcurementAnomalyDetector:
    global _detector
    with _detector_lock:
        if _detector is None:
            detector = ProcurementAnomalyDetector()
            detector._load_or_train()
            _detector = detector
        return _detector
