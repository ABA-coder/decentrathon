# ProcureAI KZ — Full-Stack Application

AI-powered procurement anomaly detection system for Kazakhstan government tenders.

## Architecture

```
procureai/
├── backend/                   # Node.js + Express + Prisma
│   ├── prisma/
│   │   └── schema.prisma      # PostgreSQL schema (User, Lot, AnalysisResult, SavedCalculation)
│   ├── src/
│   │   ├── index.js           # Express entry point
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT authenticate + authorize
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.js        # POST /api/auth/login|register, GET /api/auth/me
│   │   │   ├── dashboard.js   # GET  /api/dashboard
│   │   │   ├── lots.js        # GET  /api/lots, GET /api/lots/:id, PATCH /api/lots/:id
│   │   │   ├── analyze.js     # POST /api/analyze
│   │   │   └── calculator.js  # POST /api/calculator/compute|save, GET|DELETE /api/calculator
│   │   ├── utils/
│   │   │   ├── scoring.js     # Rule Engine + ML scoring logic
│   │   │   └── taxCalculator.js # VAT 12% / Simplified 3% calculation
│   │   └── prisma/
│   │       └── seed.js        # Demo data: 60 lots + admin/auditor users
│   └── package.json
│
└── frontend/                  # React + Vite + Tailwind CSS
    ├── src/
    │   ├── App.jsx            # Router + protected routes
    │   ├── context/
    │   │   ├── AuthContext.jsx # JWT state, login/logout
    │   │   └── ToastContext.jsx
    │   ├── lib/
    │   │   ├── api.js          # Axios instance + typed API helpers
    │   │   └── format.js       # fmtMoney, scoreColor, etc.
    │   └── components/
    │       ├── ui/index.jsx    # Shared UI: Badge, Button, Card, KpiCard, ScoreBar…
    │       ├── layout/
    │       │   └── AppLayout.jsx  # Sidebar + topbar shell
    │       └── pages/
    │           ├── LoginPage.jsx
    │           ├── DashboardPage.jsx
    │           ├── LotsPage.jsx
    │           ├── AnalyzePage.jsx
    │           └── CabinetPage.jsx
    └── package.json
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally

### 1. Backend setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET

# Set up database
npx prisma generate
npx prisma migrate dev --name init
node src/prisma/seed.js

# Start dev server
npm run dev
# → http://localhost:4000
# → API docs: http://localhost:4000/health
```

### 2. Frontend setup

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Demo credentials
| Role    | Email                   | Password   |
|---------|-------------------------|------------|
| Admin   | admin@procureai.kz      | admin123   |
| Auditor | auditor@kkson.kz        | auditor123 |

## API Endpoints

| Method | Path                      | Description                              |
|--------|---------------------------|------------------------------------------|
| POST   | /api/auth/login           | Sign in → JWT token                      |
| POST   | /api/auth/register        | Create account                           |
| GET    | /api/auth/me              | Current user profile                     |
| GET    | /api/dashboard            | KPIs + top-risk lots + chart data        |
| GET    | /api/lots                 | Paginated lot list with filters          |
| GET    | /api/lots/:id             | Lot detail + analysis result             |
| PATCH  | /api/lots/:id             | Update status / auditor comment          |
| POST   | /api/analyze              | Run risk analysis (Rule Engine + ML)     |
| POST   | /api/calculator/compute   | Compute margin (stateless)               |
| POST   | /api/calculator/save      | Save calculation to DB                   |
| GET    | /api/calculator           | List user's saved calculations           |
| DELETE | /api/calculator/:id       | Delete a saved calculation               |

## Risk Scoring

```
Risk Score = 0.55 × Rule Score + 0.45 × ML Score   [0–100]
```

| Code | Flag              | Trigger              | Weight |
|------|-------------------|----------------------|--------|
| A1   | Single bid        | bidCount == 1        | 20     |
| A2   | Price inflation   | markup > 30%         | 25     |
| A3   | Tight deadline    | submissionDays < 5   | 18     |
| A4   | Repeat winner     | repeatWinner == true | 22     |
| A5   | Lot splitting     | lotCount >= 8        | 15     |
| A6   | Tailored spec     | specTailored == true | 20     |

## Tax Calculation

| Regime     | Rate | Formula                                        |
|------------|------|------------------------------------------------|
| Simplified | 3%   | netProfit = (smeta − purchase) × qty × 0.97   |
| VAT        | 12%  | netProfit = (smeta − purchase) × qty × 0.88   |
