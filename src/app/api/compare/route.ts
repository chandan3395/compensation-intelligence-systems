import { NextRequest, NextResponse } from "next/server";

import { compareCompanyCompensation } from "@/services/comparison.service";
import { errorResponse, successResponse } from "@/utils/response";
import { validateCompanyComparisonQuery } from "@/validators/query.validator";

export async function GET(request: NextRequest) {
  const validation = validateCompanyComparisonQuery(request.nextUrl.searchParams);

  if (!validation.ok) {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "Invalid company comparison query."),
      { status: 400 },
    );
  }

  try {
    const result = await compareCompanyCompensation(validation.data);

    if (result.status === "not_found") {
      return NextResponse.json(
        errorResponse("NO_MATCHING_RECORDS", "No matching compensation records found."),
        { status: 404 },
      );
    }

    return NextResponse.json(successResponse(result.data));
  } catch (error) {
    // A comparison failure must not leak Prisma internals to clients.
    console.error("Failed to compare company compensation", error);

    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Unable to compare company compensation."),
      { status: 500 },
    );
  }
}
