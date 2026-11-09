import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../lib/api-error";
import { findHabitUnlock } from "../../../lib/habit-capacity";
import { getCurrentUser } from "../../../lib/current-user";
import { runSerializableTransaction } from "../../../lib/serializable-transaction";

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

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const input = readHabitInput(body as Record<string, unknown>);
    const user = await getCurrentUser();
    const habit = await runSerializableTransaction(async (tx) => {
      const unlock = await findHabitUnlock(tx, user.id);
      if (input.projectId) {
        const project = await tx.project.findFirst({ where: { id: input.projectId, userId: user.id, status: "ACTIVO" } });
        if (!project) throw new RequestValidationError("Proyecto inválido.");
      }
      const habit = await tx.habit.create({ data: { userId: user.id, ...input } });
      if (unlock) await tx.habit.update({ where: { id: unlock.habitId }, data: { lastUnlockedAt: unlock.unlockedAt } });
      return habit;
    });
    return NextResponse.json({ habit }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo crear el hábito.");
  }
}
