"""
GPT-4o Explainability Layer — ProcureAI KZ

Задача: преобразовать цифровые результаты ML-детекции в
аудиторский нарратив на русском языке, понятный сотрудникам
ККСОН, АФМ и Счётного комитета.

Архитектурный принцип: GPT не принимает решений — он объясняет
решения, принятые детерминированными правилами и ML-моделью.
"""

from openai import OpenAI
import json
import os
import logging
from functools import lru_cache
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_client():
    return OpenAI(timeout=20.0, max_retries=1)

SYSTEM_PROMPT = """Ты — аналитическая система поддержки для аудиторов государственных закупок Казахстана.

Твоя задача: на основе результатов автоматического анализа тендера сформировать КРАТКОЕ, СТРУКТУРИРОВАННОЕ заключение для сотрудника контрольного органа (ККСОН, АФМ, Счётный комитет).

СТРОГИЕ ПРАВИЛА:
1. Ты — инструмент поддержки, а НЕ орган принятия решений. Всегда указывай, что финальная оценка остаётся за аудитором.
2. Ссылайся только на факты из предоставленных данных. Не выдумывай цифры.
3. Пиши кратко и по существу. Чиновник занят — максимум 3-4 предложения на раздел.
4. Используй официальный, но читабельный русский язык.
5. Отвечай ТОЛЬКО валидным JSON без markdown-обёртки.

Формат ответа — строго JSON:
{
  "verdict_summary": "1-2 предложения для руководителя",
  "risk_rationale": "Почему модель присвоила этот уровень риска (2-3 предложения)",
  "flag_analysis": [{"code": "A1", "explanation": "..."}],
  "recommended_actions": ["действие 1", "действие 2"],
  "data_gaps": "Каких данных не хватает для полного анализа",
  "disclaimer": "Обязательное предупреждение об ограничениях AI"
}"""

USER_TEMPLATE = """Проанализируй следующий тендер:

ТЕНДЕР: {tender_id}
ПРЕДМЕТ: {title}
ЗАКАЗЧИК: {customer_org}
РЕГИОН: {region}
НАЧАЛЬНАЯ ЦЕНА: {price_str}
СРОК ПОДАЧИ ЗАЯВОК: {submission_days} дн.
КОЛИЧЕСТВО ЗАЯВОК: {bid_count}
ПОБЕДИТЕЛЬ: {winner_name}
КОЛИЧЕСТВО ЛОТОВ: {lot_count}

РЕЗУЛЬТАТЫ АВТОМАТИЧЕСКОГО АНАЛИЗА:
- Итоговый риск-скор: {risk_score}/100
- Уровень риска: {risk_level}
- Сработало правил: {flags_count}
- ML-модель (Isolation Forest) классифицировала как: {ml_label}

СРАБОТАВШИЕ ФЛАГИ:
{flags_text}

TOP-3 АНОМАЛЬНЫХ ПРИЗНАКА (по z-score):
{features_text}

Сформируй аудиторское заключение согласно инструкции."""


def generate_explanation(
    tender: Dict[str, Any],
    analysis: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Генерирует структурированное GPT-4o объяснение результатов анализа.

    Args:
        tender:   словарь с данными тендера
        analysis: результат ProcurementAnomalyDetector.analyze()

    Returns:
        Словарь с полями verdict_summary, risk_rationale, flag_analysis, и т.д.
    """
    # Форматирование флагов
    if analysis["triggered_rules"]:
        flags_text = "\n".join(
            f"  [{r['code']}] {r['label']}: {r['description']}"
            for r in analysis["triggered_rules"]
        )
    else:
        flags_text = "  Флаги не сработали"

    # Форматирование топ признаков
    features_text = "\n".join(
        f"  {c['label']}: z={c['z_score']} ({c['direction']})"
        for c in analysis["feature_contributions"][:3]
    )

    price = tender.get("initial_price_kzt", 0)
    price_str = _fmt_money(price)

    prompt = USER_TEMPLATE.format(
        tender_id=tender.get("tender_id", "—"),
        title=tender.get("title", "—"),
        customer_org=tender.get("customer_org", "—"),
        region=tender.get("region", "—"),
        price_str=price_str,
        submission_days=tender.get("submission_days", "—"),
        bid_count=tender.get("bid_count", "—"),
        winner_name=tender.get("winner_name", "—"),
        lot_count=tender.get("lot_count", "—"),
        risk_score=analysis["risk_score"],
        risk_level=analysis["risk_level"],
        flags_count=analysis["flags_count"],
        ml_label="АНОМАЛИЯ" if analysis["ml_anomaly"] else "НОРМА",
        flags_text=flags_text,
        features_text=features_text,
    )

    if not os.getenv("OPENAI_API_KEY"):
        return _fallback_explanation(analysis, error="На сервере не настроен OPENAI_API_KEY")

    try:
        response = get_client().chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,       # детерминированность важнее креативности
            max_tokens=900,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content.strip()
        explanation = json.loads(raw)
        if not isinstance(explanation, dict):
            raise ValueError("Expected an explanation object")
        for key in ("verdict_summary", "risk_rationale", "data_gaps", "disclaimer"):
            if not isinstance(explanation.get(key), str):
                raise ValueError("Invalid explanation text")
        if not isinstance(explanation.get("flag_analysis"), list) or not all(
            isinstance(item, dict) and isinstance(item.get("code"), str)
            and isinstance(item.get("explanation"), str) for item in explanation["flag_analysis"]
        ):
            raise ValueError("Invalid flag analysis")
        if not isinstance(explanation.get("recommended_actions"), list) or not all(
            isinstance(item, str) for item in explanation["recommended_actions"]
        ):
            raise ValueError("Invalid recommendations")
        explanation["source"] = "openai"
        explanation["model"] = os.getenv("OPENAI_MODEL", "gpt-4o")

    except json.JSONDecodeError:
        explanation = _fallback_explanation(analysis)
    except Exception as e:
        logger.warning("GPT explanation unavailable: %s", type(e).__name__)
        explanation = _fallback_explanation(analysis, error="Сервис GPT временно недоступен")

    return explanation


def _fallback_explanation(
    analysis: Dict[str, Any],
    error: str = None,
) -> Dict[str, Any]:
    """Структурированный фоллбэк при недоступности GPT."""
    flags = analysis.get("triggered_rules", [])
    return {
        "source": "fallback",
        "verdict_summary": (
            f"Тендер получил риск-скор {analysis['risk_score']}/100 ({analysis['risk_level']}). "
            f"Сработало {len(flags)} аномальных признаков."
        ),
        "risk_rationale": (
            "Оценка сформирована на основе детерминированных правил и модели Isolation Forest. "
            "GPT-объяснение временно недоступно — используйте числовые показатели."
        ),
        "flag_analysis": [
            {"code": f["code"], "explanation": f["description"]}
            for f in flags
        ],
        "recommended_actions": [
            "Запросить у заказчика обоснование начальной цены контракта",
            "Проверить аффилированность победителя с должностными лицами заказчика",
            "Изучить историю тендеров данного заказчика за последние 12 месяцев",
        ],
        "data_gaps": "Данные о реальных рыночных ценах, реестр аффилированных лиц" + (
            f". Ошибка GPT: {error}" if error else ""
        ),
        "disclaimer": (
            "Данный анализ — инструмент поддержки принятия решений. "
            "Окончательное заключение принимается уполномоченным аудитором."
        ),
    }


def _fmt_money(value: float) -> str:
    if value >= 1_000_000_000:
        return f"{value / 1_000_000_000:.2f} млрд тг"
    elif value >= 1_000_000:
        return f"{value / 1_000_000:.1f} млн тг"
    elif value >= 1_000:
        return f"{value / 1_000:.0f} тыс тг"
    return f"{value:.0f} тг"
