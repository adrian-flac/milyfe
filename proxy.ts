import { NextResponse } from "next/server";
import { auth } from "./auth";
import { getMutationRequestError } from "./lib/request-security";

const publicPaths = new Set(["/sign-in"]);
const mutationMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const sessionUser = request.auth?.user as { id?: string; sessionVersion?: unknown } | undefined;
  const isAuthenticated = Boolean(sessionUser?.id && typeof sessionUser.sessionVersion === "number" && Number.isInteger(sessionUser.sessionVersion));

  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  if (pathname.startsWith("/api/") && mutationMethods.has(request.method)) {
    const mutationRequestError = getMutationRequestError(request);
    if (mutationRequestError) {
      return NextResponse.json({ error: mutationRequestError.message }, { status: mutationRequestError.status });
    }
  }

  if (pathname === "/api/register") return NextResponse.next();
  if (publicPaths.has(pathname)) {
    return isAuthenticated ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (isAuthenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Inicia sesión para acceder a tu espacio." }, { status: 401 });
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
