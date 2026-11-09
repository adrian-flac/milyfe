import type { Prisma } from "../generated/prisma/client";
import { RequestValidationError } from "./api-error";
import { addUtcMonths, dayFromKey, dayKey } from "./dates";
import { canUnlockHabitSlot, lastCompletedMonthStart } from "./habit-progress";

export async function findHabitUnlock(tx: Prisma.TransactionClient, userId: string) {
  const today = dayFromKey(dayKey(new Date()));
  const currentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12));
  const habits = await tx.habit.findMany({
    where: { userId, active: true },
    include: { entries: { where: { completed: true, date: { gte: addUtcMonths(currentMonth, -24) } }, select: { date: true, completed: true } } },
  });
  if (habits.length < 3) return null;
  if (habits.length >= 4) throw new RequestValidationError("Ya tienes el máximo de 4 hábitos activos.");
  const habit = habits.find((item) => canUnlockHabitSlot(item, item.entries, today, item.lastUnlockedAt));
  if (!habit) throw new RequestValidationError("Completa tres meses consecutivos en verde para desbloquear un cuarto hábito.");
  return { habitId: habit.id, unlockedAt: lastCompletedMonthStart(today) };
}
