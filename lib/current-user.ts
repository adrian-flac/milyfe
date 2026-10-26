import { auth } from "../auth";
import { prisma } from "./prisma";

export class AuthenticationError extends Error {
  constructor() {
    super("Inicia sesión para acceder a tu espacio.");
  }
}

export async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new AuthenticationError();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthenticationError();
  return user;
}
