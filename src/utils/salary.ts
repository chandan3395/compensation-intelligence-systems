import { Prisma, SalaryPeriod } from "@prisma/client";

type DecimalInput = Prisma.Decimal.Value;

export function annualizeBaseSalary(
  baseSalary: DecimalInput,
  salaryPeriod: SalaryPeriod,
): Prisma.Decimal {
  const submittedSalary = new Prisma.Decimal(baseSalary);

  if (salaryPeriod === SalaryPeriod.MONTHLY) {
    return submittedSalary.mul(12);
  }

  return submittedSalary;
}

export function calculateTotalCompensation(
  annualBaseSalary: DecimalInput,
  annualBonus: DecimalInput,
  annualStock: DecimalInput,
): Prisma.Decimal {
  return new Prisma.Decimal(annualBaseSalary)
    .add(annualBonus)
    .add(annualStock);
}
