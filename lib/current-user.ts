import { auth } from "../auth";
import { prisma } from "./prisma";

export class AuthenticationError extends Error {
  constructor() {
    super("Inicia sesión para acceder a tu espacio.");
  }
}

export async function getCurrentUser() {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; sessionVersion?: unknown } | undefined;
  const userId = sessionUser?.id;
  const sessionVersion = sessionUser?.sessionVersion;
  if (!userId || typeof sessionVersion !== "number" || !Number.isInteger(sessionVersion)) throw new AuthenticationError();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.sessionVersion !== sessionVersion) throw new AuthenticationError();
  return user;
}
