# Запуск ProcureAI KZ на Vercel + Gemini

FastAPI обслуживает сайт и API с одного адреса. Isolation Forest считает риск на сервере,
а Gemini объясняет результат. Gemini не обучается и не меняет числовой риск-скор.

## Опубликованная версия

- Сайт: https://procureai-kz-decentrathon.vercel.app
- Vercel: команда `bookingapp2`, проект `procureai-kz-decentrathon`, окружение Production.
- Код опубликован прямой загрузкой файлов. Связь Vercel с GitHub пока не настроена,
  поэтому новые коммиты сами по себе не обновляют сайт. Для автодеплоя нужно подключить
  GitHub-интеграцию Vercel к `ABA-coder/decentrathon` и выбрать ветку с исправлениями.
- `GEMINI_API_KEY` хранится в Vercel как серверный Secret для Production.
  После замены ключа нужен Redeploy; обычный Redeploy повторно публикует текущие файлы.

## Vercel

1. Импортировать GitHub-репозиторий `ABA-coder/decentrathon` в Vercel.
2. Выбрать ветку `main` и корневую папку репозитория.
3. Framework Preset: **FastAPI**. Остальные параметры сборки оставить стандартными.
   Точка входа — `main.py`, версия Python — 3.12 из `.python-version`,
   зависимости устанавливаются из `requirements.txt`.
4. Создать ключ в [Google AI Studio](https://aistudio.google.com/apikey).
   В Vercel → Project → Settings → Environment Variables добавить `GEMINI_API_KEY`
   для Production и Preview. Ключ не добавлять в HTML, Git или публичные переменные.
5. Необязательно задать `GEMINI_MODEL`; по умолчанию `gemini-3.5-flash-lite`.
6. Запустить Deploy/Redeploy. Проверить `/health`, `/api/v1/stats` и анализ тендера.
   После настройки ключа `/health` возвращает `llm_configured: true`.
   Успешный настоящий ответ содержит `gpt_explanation.source: "gemini"`.

Также можно выполнить `npx vercel deploy --prod` из корня проекта после авторизации.

## Настройки

| Переменная | Назначение |
|---|---|
| `GEMINI_API_KEY` | Серверный ключ Google; без него доступны ML и объяснение по правилам |
| `GEMINI_MODEL` | По умолчанию `gemini-3.5-flash-lite` |
| `MODEL_PATH` | Временная папка ОС: `procureai-kz/model.pkl` |
| `ADMIN_API_KEY` | Доступ к административному переобучению вне Vercel |
| `CORS_ORIGINS` | Разрешённые origins через запятую, если интерфейс размещён отдельно |

Vercel запускает приложение как Python Function. При холодном старте экземпляр создаёт
небольшую базовую Isolation Forest на 500 строках с фиксированным seed. Файл кешируется
во временной папке, без записи в read-only исходники. GPU и обучение языковой модели не нужны.
Административное переобучение отключено на Vercel: временные файлы и память не разделяются
между экземплярами. `vercel.json` задаёт до 60 секунд на запрос и исключает тесты из сборки.

## Локально

```sh
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Открыть http://localhost:8000. Документация API: `/docs`.
Настройки из `.env.example` нужно задать в окружении процесса: `.env` автоматически не загружается.
Для Render сохранён альтернативный `render.yaml` с теми же переменными Gemini.

## Проверки

```sh
pip install -r requirements-dev.txt
python -m pytest tests -q
```

Тесты используют отдельную временную ML-модель и подменяют ответы Gemini. Настоящий API-вызов
проверяется после настройки ключа. Библиотека `openai` используется как совместимый
клиент Gemini; запросы направляются в Google, ключ OpenAI не используется.
Имена JSON-полей `with_gpt_explanation`, `gpt_explanation`, `gpt_configured` сохранены для
совместимости существующих клиентов; интерфейс использует Gemini и `llm_configured`.

## Данные и доступ

Реестр содержит 250 синтетических тендеров. ML-расчёты выполняются настоящей серверной
моделью Isolation Forest. Интеграции с goszakup.gov.kz пока нет. При недоступности API
интерфейс показывает ошибку, а не случайные результаты. Объяснение по правилам имеет
`source: "fallback"` и не выдаётся за ответ Gemini.

Обычные API открыты, в том числе запрос объяснения. Посетители расходуют лимит Gemini-ключа
владельца проекта; квоты и оплату настраивают в Google. Ключ остаётся только на сервере.

Документация: [FastAPI на Vercel](https://vercel.com/docs/frameworks/backend/fastapi),
[Gemini API](https://ai.google.dev/gemini-api/docs/openai).
