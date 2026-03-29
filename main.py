"""
ProcureAI KZ — ИИ-система анализа госзакупок Казахстана
Decentrathon 5.0 | Open Case | AI for Government

Что решает:
  1. Анализ тендеров на аномалии (ценовые, временны́е, структурные)
  2. Скоринг риска коррупции по каждому тендеру
  3. GPT-4o объясняет каждый флаг на языке аудитора
  4. REST API — инструмент поддержки принятия решений для сотрудников ККСОН/АФМ
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from api.routes import router

app = FastAPI(
    title="ProcureAI KZ",
    description="AI-powered procurement anomaly detection for Kazakhstan government tenders",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ProcureAI KZ", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
