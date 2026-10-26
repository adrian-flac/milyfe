const MAX_JSON_BODY_BYTES = 32 * 1024;

type RequestLike = Pick<Request, "headers" | "method" | "url">;

export type MutationRequestError = {
  message: string;
  status: 403 | 413 | 415;
};

function requestOrigin(request: RequestLike) {
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

function normalizedOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Validates the browser-only contract for state-changing JSON endpoints.
 * Authentication routes use Auth.js' own CSRF handling and are excluded by
 * the proxy before this helper is called.
 */
export function getMutationRequestError(request: RequestLike): MutationRequestError | null {
  const origin = request.headers.get("origin");
  const expectedOrigin = requestOrigin(request);

  if (!origin || !expectedOrigin || normalizedOrigin(origin) !== expectedOrigin) {
    return { status: 403, message: "La solicitud debe provenir de esta aplicación." };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const byteLength = Number(contentLength);
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
      return { status: 413, message: "El tamaño de la solicitud no es válido." };
    }
    if (byteLength > MAX_JSON_BODY_BYTES) {
      return { status: 413, message: "La solicitud supera el tamaño permitido." };
    }
  }

  if (request.method !== "DELETE") {
    const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType !== "application/json") {
      return { status: 415, message: "Las solicitudes que modifican datos deben usar JSON." };
    }
  }

  return null;
}
