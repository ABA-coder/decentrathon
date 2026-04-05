-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'AUDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('NEW', 'IN_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('SIMPLIFIED', 'VAT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AUDITOR',
    "organization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "customerOrg" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "publishedDate" TIMESTAMP(3),
    "winnerName" TEXT,
    "initialPriceKzt" DOUBLE PRECISION NOT NULL,
    "bidCount" INTEGER NOT NULL DEFAULT 1,
    "submissionDays" INTEGER NOT NULL,
    "repeatWinner" BOOLEAN NOT NULL DEFAULT false,
    "lotCount" INTEGER NOT NULL DEFAULT 1,
    "specTailored" BOOLEAN NOT NULL DEFAULT false,
    "contractDurationDays" INTEGER NOT NULL DEFAULT 180,
    "priceMarkupPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "LotStatus" NOT NULL DEFAULT 'NEW',
    "auditorComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "ruleScore" DOUBLE PRECISION NOT NULL,
    "mlScore" DOUBLE PRECISION NOT NULL,
    "mlAnomaly" BOOLEAN NOT NULL,
    "flagsCount" INTEGER NOT NULL,
    "triggeredRules" JSONB NOT NULL,
    "featureContribs" JSONB NOT NULL,
    "gptExplanation" JSONB,
    "networkFlags" JSONB,
    "priceFlag" JSONB,
    "analyzedById" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_calculations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "priceSmeta" DOUBLE PRECISION NOT NULL,
    "pricePurchase" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "taxRegime" "TaxRegime" NOT NULL,
    "grossProfit" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "marginPct" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lots_lotNumber_key" ON "lots"("lotNumber");

-- CreateIndex
CREATE INDEX "lots_status_idx" ON "lots"("status");

-- CreateIndex
CREATE INDEX "lots_category_idx" ON "lots"("category");

-- CreateIndex
CREATE INDEX "lots_region_idx" ON "lots"("region");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_results_lotId_key" ON "analysis_results"("lotId");

-- CreateIndex
CREATE INDEX "saved_calculations_userId_idx" ON "saved_calculations"("userId");

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_analyzedById_fkey" FOREIGN KEY ("analyzedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_calculations" ADD CONSTRAINT "saved_calculations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
