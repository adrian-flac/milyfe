import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { clearAuthFailures, isAuthAttemptAllowed, recordAuthFailure } from "./lib/auth-rate-limit";
import { prisma } from "./lib/prisma";

type SessionVersionCarrier = { sessionVersion?: unknown };

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export const { handlers, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      name: "Correo y contraseña",
      credentials: {
        email: { label: "Correo", type: "email", placeholder: "tu@correo.com" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? normalizeEmail(credentials.email) : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password || password.length > 128) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true, sessionVersion: true },
        });
        if (!user?.passwordHash) return null;
        if (!(await isAuthAttemptAllowed("login", email))) return null;
        if (!(await compare(password, user.passwordHash))) {
          await recordAuthFailure("login", email);
          return null;
        }
        await clearAuthFailures("login", email);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      const sessionVersion = (user as SessionVersionCarrier | undefined)?.sessionVersion;
      if (typeof sessionVersion === "number" && Number.isInteger(sessionVersion)) token.sessionVersion = sessionVersion;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.sub === "string" && typeof token.sessionVersion === "number") {
        const sessionUser = session.user as typeof session.user & { id?: string; sessionVersion?: number };
        sessionUser.id = token.sub;
        sessionUser.sessionVersion = token.sessionVersion;
      }
      return session;
    },
  },
});
