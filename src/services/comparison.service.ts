import {
  getCompanyCompensationAggregation,
  type CompanyCompensationAggregation,
} from "@/services/aggregation.service";
import type { ValidatedCompanyComparisonQuery } from "@/validators/query.validator";

export type CompanyComparisonEntry = Pick<
  CompanyCompensationAggregation,
  | "company"
  | "currency"
  | "submissionCount"
  | "averageTotalCompensation"
  | "medianTotalCompensation"
  | "averageBaseSalary"
  | "averageBonus"
  | "averageStock"
>;

export type CompanyComparisonResult =
  | { status: "not_found" }
  | { status: "found"; data: CompanyComparisonEntry[] };

export async function compareCompanyCompensation(
  query: ValidatedCompanyComparisonQuery,
): Promise<CompanyComparisonResult> {
  const aggregations = await Promise.all(
    query.companies.map((company) =>
      getCompanyCompensationAggregation(company, query),
    ),
  );

  const data: CompanyComparisonEntry[] = [];

  for (const aggregation of aggregations) {
    if (aggregation.status === "not_found") {
      return { status: "not_found" };
    }

    data.push({
      company: aggregation.data.company,
      currency: aggregation.data.currency,
      submissionCount: aggregation.data.submissionCount,
      averageTotalCompensation: aggregation.data.averageTotalCompensation,
      medianTotalCompensation: aggregation.data.medianTotalCompensation,
      averageBaseSalary: aggregation.data.averageBaseSalary,
      averageBonus: aggregation.data.averageBonus,
      averageStock: aggregation.data.averageStock,
    });
  }

  return { status: "found", data };
}
