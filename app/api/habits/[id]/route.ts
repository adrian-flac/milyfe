import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../../lib/api-error";
import { addUtcMonths, dayFromKey, dayKey } from "../../../../lib/dates";
import { canUnlockHabitSlot, lastCompletedMonthStart } from "../../../../lib/habit-progress";
import { getCurrentUser } from "../../../../lib/current-user";
import { prisma } from "../../../../lib/prisma";

const frequencies = ["DIARIA", "SEMANAL"] as const;

function readHabitInput(body: Record<string, unknown>) {
  const { title, detail, projectId, frequency, scheduledDays, active } = body;
  if (title !== undefined && (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 100)) throw new RequestValidationError("El hábito debe tener entre 2 y 100 caracteres.");
  if (detail !== undefined && detail !== null && typeof detail !== "string") throw new RequestValidationError("Detalle inválido.");
  if (projectId !== undefined && projectId !== null && typeof projectId !== "string") throw new RequestValidationError("Proyecto inválido.");
  if (frequency !== undefined && !frequencies.includes(frequency as (typeof frequencies)[number])) throw new RequestValidationError("Frecuencia inválida.");
  if (scheduledDays !== undefined && (!Array.isArray(scheduledDays) || scheduledDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new RequestValidationError("Días programados inválidos.");
  if (active !== undefined && typeof active !== "boolean") throw new RequestValidationError("Estado inválido.");
  const resolvedFrequency = frequency as (typeof frequencies)[number] | undefined;
  const days = resolvedFrequency === "DIARIA" ? [0, 1, 2, 3, 4, 5, 6] : scheduledDays === undefined ? undefined : [...new Set(scheduledDays as number[])].sort((a, b) => a - b);
  if (resolvedFrequency === "SEMANAL" && (!days || days.length === 0)) throw new RequestValidationError("Elige al menos un día semanal.");
  return { title, detail, projectId, frequency: resolvedFrequency, scheduledDays: days, active };
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const input = body as Record<string, unknown>;

    const user = await getCurrentUser();
    const habit = await prisma.habit.findFirst({ where: { id, userId: user.id } });
    if (!habit) return NextResponse.json({ error: "Hábito no encontrado." }, { status: 404 });

    if ("date" in input || "completed" in input) {
      const { date, completed } = input;
      if (!habit.active) throw new RequestValidationError("Reactiva el hábito antes de registrar avances.");
      if (typeof date !== "string" || typeof completed !== "boolean") throw new RequestValidationError("Datos de hábito inválidos.");

      const entryDate = dayFromKey(date);
      if (entryDate < habit.startedAt) throw new RequestValidationError("No puedes registrar un hábito antes de su inicio.");
      if (habit.frequency === "SEMANAL" && !habit.scheduledDays.includes(entryDate.getUTCDay())) throw new RequestValidationError("Este hábito no está programado para ese día.");
      await prisma.habitEntry.upsert({
        where: { habitId_date: { habitId: habit.id, date: entryDate } },
        create: { habitId: habit.id, userId: user.id, date: entryDate, completed, completedAt: completed ? new Date() : null },
        update: { completed, completedAt: completed ? new Date() : null },
      });
      return NextResponse.json({ ok: true });
    }

    const meta = readHabitInput(input);
    const safeProjectId = typeof meta.projectId === "string" && meta.projectId ? meta.projectId : null;
    if (meta.projectId !== undefined && safeProjectId) {
      const project = await prisma.project.findFirst({ where: { id: safeProjectId, userId: user.id, status: "ACTIVO" } });
      if (!project) throw new RequestValidationError("Proyecto inválido.");
    }
    const unlock = meta.active && !habit.active ? await findHabitUnlock(user.id) : null;
    await prisma.habit.update({
      where: { id },
      data: {
        ...(typeof meta.title === "string" ? { title: meta.title.trim() } : {}),
        ...(meta.detail !== undefined ? { detail: typeof meta.detail === "string" && meta.detail.trim() ? meta.detail.trim() : null } : {}),
        ...(meta.projectId !== undefined ? { projectId: safeProjectId } : {}),
        ...(meta.frequency !== undefined ? { frequency: meta.frequency } : {}),
        ...(meta.scheduledDays !== undefined ? { scheduledDays: meta.scheduledDays } : {}),
        ...(meta.active !== undefined ? { active: meta.active, archivedAt: meta.active ? null : new Date() } : {}),
      },
    });
    if (unlock) await prisma.habit.update({ where: { id: unlock.habitId }, data: { lastUnlockedAt: unlock.unlockedAt } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo actualizar el hábito.");
  }
}
