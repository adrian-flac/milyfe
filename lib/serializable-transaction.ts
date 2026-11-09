import { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";

const maxAttempts = 3;

export async function runSerializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      const isPrismaConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      // The PostgreSQL adapter can report a conflict directly when COMMIT fails.
      const cause = error instanceof Error ? error.cause : undefined;
      const isCommitConflict = typeof cause === "object" && cause !== null
        && "kind" in cause && cause.kind === "TransactionWriteConflict";
      if (attempt >= maxAttempts || (!isPrismaConflict && !isCommitConflict)) throw error;
    }
  }
}
