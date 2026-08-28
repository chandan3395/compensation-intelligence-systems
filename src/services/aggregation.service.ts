import { Currency, Level, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeCompanyName, normalizeRole } from "@/utils/normalize";

export type CompensationAggregationFilters = {
  currency: Currency;
  role?: string;
  level?: Level;
  city?: string;
  state?: string;
  country?: string;
};

export type CompanyCompensationAggregation = {
  company: string;
  currency: Currency;
  submissionCount: number;
  averageTotalCompensation: number;
  medianTotalCompensation: number;
  minimumTotalCompensation: number;
  maximumTotalCompensation: number;
  averageBaseSalary: number;
  averageBonus: number;
  averageStock: number;
  levelBreakdown: Array<{
    level: Level;
    averageTotalCompensation: number;
    submissionCount: number;
  }>;
};

export type CompanyAggregationResult =
  | { status: "not_found" }
  | { status: "found"; data: CompanyCompensationAggregation };

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) {
    throw new Error("Expected an aggregate value for matching compensation entries.");
  }

  return value.toNumber();
}

function calculateMedian(sortedValues: Prisma.Decimal[]): Prisma.Decimal {
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex];
  }

  return sortedValues[middleIndex - 1].add(sortedValues[middleIndex]).div(2);
}

export async function getCompanyCompensationAggregation(
  companyName: string,
  query: CompensationAggregationFilters,
): Promise<CompanyAggregationResult> {
  const company = await prisma.company.findUnique({
    where: { nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true, nameRaw: true },
  });

  if (!company) {
    return { status: "not_found" };
  }

  const where: Prisma.CompensationEntryWhereInput = {
    companyId: company.id,
    currency: query.currency,
    roleNormalized: query.role ? normalizeRole(query.role) : undefined,
    level: query.level,
    city: query.city,
    state: query.state,
    country: query.country,
  };

  const [aggregates, totalCompensationValues, levelGroups] =
    await prisma.$transaction([
      prisma.compensationEntry.aggregate({
        where,
        _count: { _all: true },
        _avg: {
          totalCompensation: true,
          annualBaseSalary: true,
          annualBonus: true,
          annualStock: true,
        },
        _min: { totalCompensation: true },
        _max: { totalCompensation: true },
      }),
      prisma.compensationEntry.findMany({
        where,
        select: { totalCompensation: true },
        orderBy: { totalCompensation: "asc" },
      }),
      prisma.compensationEntry.groupBy({
        by: ["level"],
        where,
        _count: { _all: true },
        _avg: { totalCompensation: true },
        orderBy: { level: "asc" },
      }),
    ]);

  if (aggregates._count._all === 0) {
    return { status: "not_found" };
  }

  const medianTotalCompensation = calculateMedian(
    totalCompensationValues.map((entry) => entry.totalCompensation),
  );

  return {
    status: "found",
    data: {
      company: company.nameRaw,
      currency: query.currency,
      submissionCount: aggregates._count._all,
      averageTotalCompensation: decimalToNumber(
        aggregates._avg.totalCompensation,
      ),
      medianTotalCompensation: medianTotalCompensation.toNumber(),
      minimumTotalCompensation: decimalToNumber(
        aggregates._min.totalCompensation,
      ),
      maximumTotalCompensation: decimalToNumber(
        aggregates._max.totalCompensation,
      ),
      averageBaseSalary: decimalToNumber(aggregates._avg.annualBaseSalary),
      averageBonus: decimalToNumber(aggregates._avg.annualBonus),
      averageStock: decimalToNumber(aggregates._avg.annualStock),
      levelBreakdown: levelGroups.map((group) => ({
        level: group.level,
        averageTotalCompensation: decimalToNumber(
          group._avg?.totalCompensation,
        ),
        submissionCount:
          typeof group._count === "object" ? group._count._all ?? 0 : 0,
      })),
    },
  };
}
