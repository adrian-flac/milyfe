import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../../lib/api-error";
import { dayFromKey } from "../../../../lib/dates";
import { findHabitUnlock } from "../../../../lib/habit-capacity";
import { getCurrentUser } from "../../../../lib/current-user";
import { runSerializableTransaction } from "../../../../lib/serializable-transaction";

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const input = body as Record<string, unknown>;

    const user = await getCurrentUser();
    return await runSerializableTransaction(async (tx) => {
      const habit = await tx.habit.findFirst({ where: { id, userId: user.id } });
      if (!habit) return NextResponse.json({ error: "Hábito no encontrado." }, { status: 404 });

      if ("date" in input || "completed" in input) {
        const { date, completed } = input;
        if (!habit.active) throw new RequestValidationError("Reactiva el hábito antes de registrar avances.");
        if (typeof date !== "string" || typeof completed !== "boolean") throw new RequestValidationError("Datos de hábito inválidos.");

        const entryDate = dayFromKey(date);
        if (entryDate < habit.startedAt) throw new RequestValidationError("No puedes registrar un hábito antes de su inicio.");
        if (habit.frequency === "SEMANAL" && !habit.scheduledDays.includes(entryDate.getUTCDay())) throw new RequestValidationError("Este hábito no está programado para ese día.");
        await tx.habitEntry.upsert({
          where: { habitId_date: { habitId: habit.id, date: entryDate } },
          create: { habitId: habit.id, userId: user.id, date: entryDate, completed, completedAt: completed ? new Date() : null },
          update: { completed, completedAt: completed ? new Date() : null },
        });
        return NextResponse.json({ ok: true });
      }

      const meta = readHabitInput(input);
      const safeProjectId = typeof meta.projectId === "string" && meta.projectId ? meta.projectId : null;
      if (meta.projectId !== undefined && safeProjectId) {
        const project = await tx.project.findFirst({ where: { id: safeProjectId, userId: user.id, status: "ACTIVO" } });
        if (!project) throw new RequestValidationError("Proyecto inválido.");
      }
      const unlock = meta.active && !habit.active ? await findHabitUnlock(tx, user.id) : null;
      await tx.habit.update({
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
      if (unlock) await tx.habit.update({ where: { id: unlock.habitId }, data: { lastUnlockedAt: unlock.unlockedAt } });

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo actualizar el hábito.");
  }
}
