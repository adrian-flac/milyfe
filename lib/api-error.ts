import { NextResponse } from "next/server";
import { AuthenticationError } from "./current-user";
import { DateValidationError } from "./dates";

export class RequestValidationError extends Error {}

/**
 * Keeps expected validation feedback useful while preventing database,
 * framework, and configuration details from reaching the browser.
 */
export function apiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof RequestValidationError || error instanceof DateValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  console.error("api_request_failed");
  return NextResponse.json({ error: fallback }, { status: 500 });
}
