-- DropIndex
DROP INDEX "CompensationEntry_submitterId_companyId_roleNormalized_leve_idx";

-- CreateIndex
CREATE UNIQUE INDEX "CompensationEntry_submitterId_companyId_roleNormalized_leve_key" ON "CompensationEntry"("submitterId", "companyId", "roleNormalized", "level", "city", "state", "country", "annualBaseSalary", "currency");
