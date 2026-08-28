import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { normalizeCompanyName, normalizeRole } from "@/utils/normalize";
import {
  annualizeBaseSalary,
  calculateTotalCompensation,
} from "@/utils/salary";
import type { ValidatedCompensationPayload } from "@/validators/compensation.validator";

export type CompensationSummary = {
  id: string;
  company: string;
  role: string;
  level: ValidatedCompensationPayload["level"];
  annualBaseSalary: number;
  annualBonus: number;
  annualStock: number;
  totalCompensation: number;
  currency: ValidatedCompensationPayload["currency"];
};

export type CreateCompensationResult =
  | {
      status: "created";
      anonymousId: string;
      compensation: CompensationSummary;
    }
  | {
      status: "duplicate";
      anonymousId: string;
    };

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function createCompensationEntry(
  input: ValidatedCompensationPayload,
  existingAnonymousId?: string,
): Promise<CreateCompensationResult> {
  const anonymousId = existingAnonymousId ?? randomUUID();
  const companyNormalized = normalizeCompanyName(input.company);
  const roleNormalized = normalizeRole(input.role);
  const baseSalarySubmitted = new Prisma.Decimal(input.baseSalary);
  const annualBaseSalary = annualizeBaseSalary(baseSalarySubmitted, input.salaryPeriod);
  const annualBonus = new Prisma.Decimal(input.bonus);
  const annualStock = new Prisma.Decimal(input.stock);
  const totalCompensation = calculateTotalCompensation(
    annualBaseSalary,
    annualBonus,
    annualStock,
  );

  try {
    return await prisma.$transaction(async (tx) => {
      const submitter = await tx.anonymousSubmitter.upsert({
        where: { anonymousId },
        create: { anonymousId },
        update: { lastSeenAt: new Date() },
      });

      const company = await tx.company.upsert({
        where: { nameNormalized: companyNormalized },
        create: {
          nameRaw: input.company,
          nameNormalized: companyNormalized,
        },
        update: {},
      });

      const existingEntry = await tx.compensationEntry.findFirst({
        where: {
          submitterId: submitter.id,
          companyId: company.id,
          roleNormalized,
          level: input.level,
          city: input.city,
          state: input.state,
          country: input.country,
          annualBaseSalary,
          currency: input.currency,
        },
        select: { id: true },
      });

      if (existingEntry) {
        return { status: "duplicate", anonymousId };
      }

      const entry = await tx.compensationEntry.create({
        data: {
          companyId: company.id,
          submitterId: submitter.id,
          roleRaw: input.role,
          roleNormalized,
          level: input.level,
          city: input.city,
          state: input.state,
          country: input.country,
          currency: input.currency,
          salaryPeriod: input.salaryPeriod,
          baseSalarySubmitted,
          annualBaseSalary,
          annualBonus,
          annualStock,
          totalCompensation,
          yearsOfExperience: new Prisma.Decimal(input.yearsOfExperience),
        },
      });

      return {
        status: "created",
        anonymousId,
        compensation: {
          id: entry.id,
          company: company.nameRaw,
          role: entry.roleRaw,
          level: entry.level,
          annualBaseSalary: entry.annualBaseSalary.toNumber(),
          annualBonus: entry.annualBonus.toNumber(),
          annualStock: entry.annualStock.toNumber(),
          totalCompensation: entry.totalCompensation.toNumber(),
          currency: entry.currency,
        },
      };
    });
  } catch (error) {
    // The pre-insert lookup gives a friendly normal-case result. The database
    // unique constraint remains the final guard when equivalent requests race.
    if (isUniqueConstraintError(error)) {
      return { status: "duplicate", anonymousId };
    }

    throw error;
  }
}
