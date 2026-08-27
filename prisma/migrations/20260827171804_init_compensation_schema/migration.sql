-- CreateEnum
CREATE TYPE "Level" AS ENUM ('INTERN', 'L1', 'L2', 'L3', 'SENIOR', 'STAFF', 'PRINCIPAL');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('INR', 'USD');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "nameRaw" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousSubmitter" (
    "id" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousSubmitter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "roleRaw" TEXT NOT NULL,
    "roleNormalized" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "salaryPeriod" "SalaryPeriod" NOT NULL,
    "baseSalarySubmitted" DECIMAL(14,2) NOT NULL,
    "annualBaseSalary" DECIMAL(14,2) NOT NULL,
    "annualBonus" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "annualStock" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCompensation" DECIMAL(14,2) NOT NULL,
    "yearsOfExperience" DECIMAL(4,1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompensationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_nameNormalized_key" ON "Company"("nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousSubmitter_anonymousId_key" ON "AnonymousSubmitter"("anonymousId");

-- CreateIndex
CREATE INDEX "CompensationEntry_companyId_idx" ON "CompensationEntry"("companyId");

-- CreateIndex
CREATE INDEX "CompensationEntry_roleNormalized_idx" ON "CompensationEntry"("roleNormalized");

-- CreateIndex
CREATE INDEX "CompensationEntry_level_idx" ON "CompensationEntry"("level");

-- CreateIndex
CREATE INDEX "CompensationEntry_city_idx" ON "CompensationEntry"("city");

-- CreateIndex
CREATE INDEX "CompensationEntry_state_idx" ON "CompensationEntry"("state");

-- CreateIndex
CREATE INDEX "CompensationEntry_country_idx" ON "CompensationEntry"("country");

-- CreateIndex
CREATE INDEX "CompensationEntry_currency_idx" ON "CompensationEntry"("currency");

-- CreateIndex
CREATE INDEX "CompensationEntry_createdAt_idx" ON "CompensationEntry"("createdAt");

-- CreateIndex
CREATE INDEX "CompensationEntry_submitterId_companyId_roleNormalized_leve_idx" ON "CompensationEntry"("submitterId", "companyId", "roleNormalized", "level", "city", "state", "country", "annualBaseSalary", "currency", "createdAt");

-- AddForeignKey
ALTER TABLE "CompensationEntry" ADD CONSTRAINT "CompensationEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationEntry" ADD CONSTRAINT "CompensationEntry_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "AnonymousSubmitter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
