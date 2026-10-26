import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../lib/api-error";
import { addUtcMonths, dayFromKey, dayKey } from "../../../lib/dates";
import { canUnlockHabitSlot, lastCompletedMonthStart } from "../../../lib/habit-progress";
import { getCurrentUser } from "../../../lib/current-user";
import { prisma } from "../../../lib/prisma";

const frequencies = ["DIARIA", "SEMANAL"] as const;

function readHabitInput(body: Record<string, unknown>) {
  const { title, detail, projectId, frequency = "DIARIA", scheduledDays } = body;
  if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 100) throw new RequestValidationError("El hábito debe tener entre 2 y 100 caracteres.");
  if (detail !== undefined && detail !== null && typeof detail !== "string") throw new RequestValidationError("Detalle inválido.");
  if (projectId !== undefined && projectId !== null && typeof projectId !== "string") throw new RequestValidationError("Proyecto inválido.");
  if (!frequencies.includes(frequency as (typeof frequencies)[number])) throw new RequestValidationError("Frecuencia inválida.");
  if (scheduledDays !== undefined && (!Array.isArray(scheduledDays) || scheduledDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new RequestValidationError("Días programados inválidos.");
  const days = frequency === "DIARIA" ? [0, 1, 2, 3, 4, 5, 6] : [...new Set((scheduledDays as number[] | undefined) ?? [])].sort((a, b) => a - b);
  if (frequency === "SEMANAL" && days.length === 0) throw new RequestValidationError("Elige al menos un día semanal.");
  return { title: title.trim(), detail: typeof detail === "string" && detail.trim() ? detail.trim() : null, projectId: typeof projectId === "string" && projectId ? projectId : null, frequency: frequency as (typeof frequencies)[number], scheduledDays: days };
}

async function findHabitUnlock(userId: string) {
  const today = dayFromKey(dayKey(new Date()));
  const currentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12));
  const habits = await prisma.habit.findMany({
    where: { userId, active: true },
    include: { entries: { where: { completed: true, date: { gte: addUtcMonths(currentMonth, -24) } }, select: { date: true, completed: true } } },
  });
  if (habits.length < 3) return null;
  if (habits.length >= 4) throw new RequestValidationError("Ya tienes el máximo de 4 hábitos activos.");
  const habit = habits.find((item) => canUnlockHabitSlot(item, item.entries, today, item.lastUnlockedAt));
  if (!habit) throw new RequestValidationError("Completa tres meses consecutivos en verde para desbloquear un cuarto hábito.");
  return { habitId: habit.id, unlockedAt: lastCompletedMonthStart(today) };
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const input = readHabitInput(body as Record<string, unknown>);
    const user = await getCurrentUser();
    const unlock = await findHabitUnlock(user.id);
    if (input.projectId) {
      const project = await prisma.project.findFirst({ where: { id: input.projectId, userId: user.id, status: "ACTIVO" } });
      if (!project) throw new RequestValidationError("Proyecto inválido.");
    }
    const habit = await prisma.habit.create({ data: { userId: user.id, ...input } });
    if (unlock) await prisma.habit.update({ where: { id: unlock.habitId }, data: { lastUnlockedAt: unlock.unlockedAt } });
    return NextResponse.json({ habit }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo crear el hábito.");
  }
}
