import { Prisma, SalaryPeriod } from "@prisma/client";

type DecimalInput = Prisma.Decimal.Value;

export function annualizeBaseSalary(
  baseSalary: DecimalInput,
  salaryPeriod: SalaryPeriod,
): Prisma.Decimal {

  // Decimal avoids introducing binary floating-point rounding while preparing values for Decimal columns
  // used in many places
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
  
  // Bonus and stock are already annual values, unlike a monthly submitted base salary.
  return new Prisma.Decimal(annualBaseSalary)
    .add(annualBonus)
    .add(annualStock);
}
