import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { normalizeCompanyName, normalizeRole } from "@/utils/normalize";
import {
  annualizeBaseSalary,
  calculateTotalCompensation,
} from "@/utils/salary";
import type { ValidatedCompensationPayload } from "@/validators/compensation.validator";
import type { ValidatedCompensationSearchQuery } from "@/validators/query.validator";

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

export type CompensationSearchEntry = {
  id: string;
  company: string;
  role: string;
  level: ValidatedCompensationPayload["level"];
  city: string;
  state: string;
  country: string;
  currency: ValidatedCompensationPayload["currency"];
  annualBaseSalary: number;
  annualBonus: number;
  annualStock: number;
  totalCompensation: number;
  yearsOfExperience: number;
};

export type CompensationSearchResult = {
  entries: CompensationSearchEntry[];
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
  };
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

// Creates a record from validated input and returns a domain result instead of leaking Prisma errors to the route.
export async function createCompensationEntry(
  input: ValidatedCompensationPayload,
  existingAnonymousId?: string,
): Promise<CreateCompensationResult> {
  // Never accept an identifier from the request body; a missing browser identifier starts a new anonymous identity.
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
    // Submitter/company resolution and entry creation must commit together so a failed entry cannot leave half-written state.
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
        // Avoid attempting a known duplicate in the common sequential-request case.
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

    // The pre-insert lookup gives a friendly normal-case result. 
    // The database unique constraint remains the final guard when equivalent requests race. [In the schema.prisma]
    if (isUniqueConstraintError(error)) {
      return { status: "duplicate", anonymousId };
    }

    throw error;
  }
}

// Builds the canonical Prisma filters, sorts, and offset page for the public search endpoint

export async function searchCompensationEntries(
  query: ValidatedCompensationSearchQuery,
): Promise<CompensationSearchResult> {

  // Query against canonical identities so filter behavior matches ingestion and duplicate matching
  const where: Prisma.CompensationEntryWhereInput = {
    level: query.level,
    city: query.city,
    state: query.state,
    country: query.country,
    currency: query.currency,
    roleNormalized: query.role ? normalizeRole(query.role) : undefined,
    company: query.company
      ? { nameNormalized: normalizeCompanyName(query.company) }
      : undefined,
    annualBaseSalary:
      query.minBaseSalary !== undefined || query.maxBaseSalary !== undefined
        ? {
            gte:
              query.minBaseSalary !== undefined
                ? new Prisma.Decimal(query.minBaseSalary)
                : undefined,
            lte:
              query.maxBaseSalary !== undefined
                ? new Prisma.Decimal(query.maxBaseSalary)
                : undefined,
          }
        : undefined,
    yearsOfExperience:
      query.minExperience !== undefined || query.maxExperience !== undefined
        ? {
            gte:
              query.minExperience !== undefined
                ? new Prisma.Decimal(query.minExperience)
                : undefined,
            lte:
              query.maxExperience !== undefined
                ? new Prisma.Decimal(query.maxExperience)
                : undefined,
          }
        : undefined,
  };

  // Default to the most recently created entries when the caller does not request a sort
  const sortBy = query.sortBy ?? "createdAt";
  const order = query.order ?? "desc";
  const orderBy: Prisma.CompensationEntryOrderByWithRelationInput = {
    [sortBy]: order,
  };

  // Offset pagination skips all complete earlier pages
  // cursor pagination is not needed at this point of time
  const skip = (query.page - 1) * query.limit;

  // Group the page query and count as one database operation for the same filtering request
  const [entries, totalRecords] = await prisma.$transaction([
    prisma.compensationEntry.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
      select: {
        id: true,
        roleRaw: true,
        level: true,
        city: true,
        state: true,
        country: true,
        currency: true,
        annualBaseSalary: true,
        annualBonus: true,
        annualStock: true,
        totalCompensation: true,
        yearsOfExperience: true,
        company: { select: { nameRaw: true } },
      },
    }),
    prisma.compensationEntry.count({ where }),
  ]);

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      company: entry.company.nameRaw,
      role: entry.roleRaw,
      level: entry.level,
      city: entry.city,
      state: entry.state,
      country: entry.country,
      currency: entry.currency,
      annualBaseSalary: entry.annualBaseSalary.toNumber(),
      annualBonus: entry.annualBonus.toNumber(),
      annualStock: entry.annualStock.toNumber(),
      totalCompensation: entry.totalCompensation.toNumber(),
      yearsOfExperience: entry.yearsOfExperience.toNumber(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / query.limit),
    },
  };
}
