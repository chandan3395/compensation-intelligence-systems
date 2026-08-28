import { NextRequest, NextResponse } from "next/server";

import {
  createCompensationEntry,
  searchCompensationEntries,
} from "@/services/compensation.service";
import { errorResponse, successResponse } from "@/utils/response";
import { validateCompensationPayload } from "@/validators/compensation.validator";
import { validateCompensationSearchQuery } from "@/validators/query.validator";

const ANONYMOUS_ID_COOKIE = "anonymous_submitter_id";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function setAnonymousIdCookie(response: NextResponse, anonymousId: string) {
  response.cookies.set({
    name: ANONYMOUS_ID_COOKIE,
    value: anonymousId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "Invalid compensation data."),
      { status: 400 },
    );
  }

  const validation = validateCompensationPayload(body);
  if (!validation.ok) {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "Invalid compensation data."),
      { status: 400 },
    );
  }

  const cookieAnonymousId = request.cookies.get(ANONYMOUS_ID_COOKIE)?.value;

  try {
    const result = await createCompensationEntry(
      validation.data,
      cookieAnonymousId,
    );

    if (result.status === "duplicate") {
      const response = NextResponse.json(
        errorResponse(
          "DUPLICATE_SUBMISSION",
          "This compensation identity has already been submitted by this user.",
        ),
        { status: 409 },
      );

      if (!cookieAnonymousId) {
        setAnonymousIdCookie(response, result.anonymousId);
      }

      return response;
    }

    const response = NextResponse.json(successResponse(result.compensation), {
      status: 201,
    });

    if (!cookieAnonymousId) {
      setAnonymousIdCookie(response, result.anonymousId);
    }

    return response;
  } catch (error) {
    console.error("Failed to create compensation entry", error);

    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Unable to create compensation entry."),
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const validation = validateCompensationSearchQuery(request.nextUrl.searchParams);

  if (!validation.ok) {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "Invalid compensation query."),
      { status: 400 },
    );
  }

  try {
    const result = await searchCompensationEntries(validation.data);

    return NextResponse.json({
      ...successResponse(result.entries),
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Failed to search compensation entries", error);

    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Unable to search compensation entries."),
      { status: 500 },
    );
  }
}
