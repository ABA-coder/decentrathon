"""
ProcureAI KZ — ИИ-система анализа госзакупок Казахстана
Decentrathon 5.0 | Open Case | AI for Government

Что решает:
  1. Анализ тендеров на аномалии (ценовые, временны́е, структурные)
  2. Скоринг риска коррупции по каждому тендеру
  3. GPT-4o объясняет каждый флаг на языке аудитора
  4. REST API — инструмент поддержки принятия решений для сотрудников ККСОН/АФМ
"""

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from routes import router

app = FastAPI(
    title="ProcureAI KZ",
    description="AI-powered procurement anomaly detection for Kazakhstan government tenders",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

origins = [value.strip() for value in os.getenv("CORS_ORIGINS", "").split(",") if value.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware, allow_origins=origins,
        allow_methods=["GET", "POST"], allow_headers=["Content-Type", "X-Admin-Key"],
    )

app.include_router(router, prefix="/api/v1")


@app.get("/health")
def health():
    return {
        "status": "ok", "service": "ProcureAI KZ", "version": "1.0.0",
        "gpt_configured": bool(os.getenv("OPENAI_API_KEY")),
        "data_source": "synthetic", "training_enabled": bool(os.getenv("ADMIN_API_KEY")),
    }


@app.get("/", include_in_schema=False)
@app.get("/ProcureAI_KZ.html", include_in_schema=False)
def frontend():
    return FileResponse(Path(__file__).with_name("ProcureAI_KZ.html"))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
