import { NextRequest, NextResponse } from "next/server";

import { getCompanyCompensationAggregation } from "@/services/aggregation.service";
import { errorResponse, successResponse } from "@/utils/response";
import { validateCompanyAggregationQuery } from "@/validators/query.validator";

type RouteContext = {
  params: Promise<{ company: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const validation = validateCompanyAggregationQuery(request.nextUrl.searchParams);

  if (!validation.ok) {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "Invalid company aggregation query."),
      { status: 400 },
    );
  }

  try {
    const { company } = await params;
    const result = await getCompanyCompensationAggregation(
      company,
      validation.data,
    );

    if (result.status === "not_found") {
      return NextResponse.json(
        errorResponse("NO_MATCHING_RECORDS", "No matching compensation records found."),
        { status: 404 },
      );
    }

    return NextResponse.json(successResponse(result.data));
  } catch (error) {
    // Keep operational detail in server logs and preserve the common API error envelope.
    console.error("Failed to aggregate company compensation", error);

    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Unable to aggregate company compensation."),
      { status: 500 },
    );
  }
}
