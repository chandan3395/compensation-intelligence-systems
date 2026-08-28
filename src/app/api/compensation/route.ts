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
  // The browser carries this anonymous identity; HTTP-only keeps it unavailable to client-side JavaScript.
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
    // Invalid JSON is intentionally reported as the same client-safe validation failure as an invalid payload.
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
        // A first request can still race into a duplicate result, so establish its identity consistently.
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
    // Log server detail privately; clients only receive a stable application-level error.
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
    // Do not expose database/query details in the public API response.
    console.error("Failed to search compensation entries", error);

    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Unable to search compensation entries."),
      { status: 500 },
    );
  }
}
