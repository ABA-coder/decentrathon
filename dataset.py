"""
Синтетический датасет тендеров госзакупок Казахстана.
В production: подключение к goszakup.gov.kz API (открытые данные).

Структура воспроизводит реальные поля портала Госзакупок РК.
"""

import numpy as np
import pandas as pd
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any

CUSTOMER_ORGS = [
    "Министерство здравоохранения РК", "Министерство образования РК",
    "Акимат г. Алматы", "Акимат г. Астаны", "Акимат Карагандинской области",
    "МВД РК", "Министерство обороны РК", "Министерство транспорта РК",
    "КазАвтоЖол", "КазМунайГаз", "Самрук-Казына", "НК «Астана ЭКСПО»",
    "Управление здравоохранения ВКО", "Казахстан Темир Жолы",
    "Акимат Туркестанской области", "Управление образования СКО",
]

CATEGORIES = [
    "Строительные работы", "IT-услуги и ПО", "Медицинское оборудование",
    "Продукты питания", "Офисные товары", "Транспортные услуги",
    "Консультационные услуги", "Охранные услуги", "Коммунальные услуги",
    "Дорожный ремонт", "Мебель и инвентарь", "Фармацевтика",
]

SUPPLIERS = [f"ТОО «{name}»" for name in [
    "АлтынСтрой", "КазТехСервис", "НурСнаб", "БерекеПром", "ДаламСтрой",
    "АстанаТрейд", "ЖарықСервис", "АлатауГрупп", "КазМедТех", "СтепноеСнабжение",
    "АкжолКонсалт", "НурлыЖолСтрой", "МегаСтрой KZ", "ОмегаСервис",
    "ПрайметехКЗ", "ИнфраСтрой", "УниверсалСнаб", "КомплектПром",
    "АтлантТехноСервис", "ЕвразияТрейд", "СтройПодряд", "ДиджиталКЗ",
    "БиОмегаФарм", "ТехноАлем", "НовыйСвет KZ",
]]

REGIONS = [
    "Астана", "Алматы", "Шымкент", "Актобе", "Тараз",
    "Павлодар", "Усть-Каменогорск", "Семей", "Атырау", "Кызылорда",
]


def _days_before(base: datetime, lo: int, hi: int) -> datetime:
    return base - timedelta(days=random.randint(lo, hi))


def generate_tenders(n: int = 200, seed: int = 42) -> pd.DataFrame:
    """
    Генерирует датасет тендеров с реалистичными аномалиями.

    Типы аномалий, закодированных в данных:
      A1 — Одна заявка (монопольный тендер)
      A2 — Цена значительно выше рыночной
      A3 — Слишком короткий срок подачи заявок (< 5 дней)
      A4 — Победитель совпадает с предыдущими тендерами того же заказчика
      A5 — Сильное разделение крупного лота на мелкие (дробление)
      A6 — Технические требования написаны под конкретного поставщика
    """
    np.random.seed(seed)
    random.seed(seed)

    now = datetime(2025, 3, 1)
    records = []

    for i in range(n):
        category = random.choice(CATEGORIES)
        customer = random.choice(CUSTOMER_ORGS)
        region = random.choice(REGIONS)

        # Base price — lognormal, реалистичный диапазон тендеров РК
        base_price = np.random.lognormal(mean=15.5, sigma=1.6)  # ~2 млн тг медиана

        # Publication date
        pub_date = _days_before(now, 10, 365)

        # Anomaly injection — некоторые тендеры «зашиты» с красными флагами
        inject_a1 = random.random() < 0.22   # одна заявка
        inject_a2 = random.random() < 0.18   # завышенная цена
        inject_a3 = random.random() < 0.20   # короткий срок
        inject_a4 = random.random() < 0.15   # повторный победитель
        inject_a5 = random.random() < 0.12   # дробление лота
        inject_a6 = random.random() < 0.14   # заточенное ТЗ

        # Bid count
        if inject_a1:
            bid_count = 1
        elif inject_a5:
            bid_count = random.randint(1, 2)
        else:
            bid_count = random.randint(2, 12)

        # Price markup
        price_markup_pct = 0.0
        if inject_a2:
            price_markup_pct = round(random.uniform(35, 180), 1)
            actual_price = base_price * (1 + price_markup_pct / 100)
        else:
            price_markup_pct = round(random.uniform(-10, 20), 1)
            actual_price = base_price * (1 + price_markup_pct / 100)

        # Submission window (days)
        if inject_a3:
            submission_days = random.randint(1, 4)
        else:
            submission_days = random.randint(10, 45)

        # Repeated winner
        winner = random.choice(SUPPLIERS)
        repeat_winner = inject_a4

        # Lot splitting
        lot_count = random.randint(8, 25) if inject_a5 else random.randint(1, 4)

        # Tailored spec
        spec_tailored = inject_a6

        # Contract duration
        contract_days = random.randint(30, 730)

        records.append({
            "tender_id": f"KZ-{2024 if pub_date.year < 2025 else 2025}-{i+1:05d}",
            "title": f"{category}: {random.choice(['поставка', 'оказание услуг', 'выполнение работ'])} ({region})",
            "category": category,
            "customer_org": customer,
            "region": region,
            "published_date": pub_date.strftime("%Y-%m-%d"),
            "submission_days": submission_days,
            "initial_price_kzt": round(actual_price, 0),
            "bid_count": bid_count,
            "winner_name": winner,
            "repeat_winner": int(repeat_winner),
            "price_markup_pct": price_markup_pct,
            "lot_count": lot_count,
            "spec_tailored": int(spec_tailored),
            "contract_duration_days": contract_days,
            "single_bid": int(bid_count == 1),
            # Ground-truth flags for training / evaluation
            "_flag_a1_single_bid": int(inject_a1),
            "_flag_a2_price_inflation": int(inject_a2),
            "_flag_a3_short_deadline": int(inject_a3),
            "_flag_a4_repeat_winner": int(inject_a4),
            "_flag_a5_lot_splitting": int(inject_a5),
            "_flag_a6_tailored_spec": int(inject_a6),
        })

    df = pd.DataFrame(records)
    df["anomaly_count"] = (
        df["_flag_a1_single_bid"] + df["_flag_a2_price_inflation"] +
        df["_flag_a3_short_deadline"] + df["_flag_a4_repeat_winner"] +
        df["_flag_a5_lot_splitting"] + df["_flag_a6_tailored_spec"]
    )
    return df


# Canonical feature columns used by the ML model
FEATURE_COLUMNS = [
    "bid_count", "single_bid", "price_markup_pct", "submission_days",
    "repeat_winner", "lot_count", "spec_tailored", "contract_duration_days",
    "initial_price_kzt",
]

FLAG_LABELS = {
    "single_bid":        ("A1", "Единственная заявка"),
    "price_markup_pct":  ("A2", "Завышение цены"),
    "submission_days":   ("A3", "Короткий срок подачи"),
    "repeat_winner":     ("A4", "Повторяющийся победитель"),
    "lot_count":         ("A5", "Дробление лота"),
    "spec_tailored":     ("A6", "ТЗ под конкретного поставщика"),
}
