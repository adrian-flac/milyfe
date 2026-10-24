import { NextResponse } from "next/server";
import { dayFromKey, getLocalUser } from "../../../../lib/life-data";
import { prisma } from "../../../../lib/prisma";

const frequencies = ["DIARIA", "SEMANAL"] as const;

function readHabitInput(body: Record<string, unknown>) {
  const { title, detail, projectId, frequency, scheduledDays, active } = body;
  if (title !== undefined && (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 100)) throw new Error("El hábito debe tener entre 2 y 100 caracteres.");
  if (detail !== undefined && detail !== null && typeof detail !== "string") throw new Error("Detalle inválido.");
  if (projectId !== undefined && projectId !== null && typeof projectId !== "string") throw new Error("Proyecto inválido.");
  if (frequency !== undefined && !frequencies.includes(frequency as (typeof frequencies)[number])) throw new Error("Frecuencia inválida.");
  if (scheduledDays !== undefined && (!Array.isArray(scheduledDays) || scheduledDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new Error("Días programados inválidos.");
  if (active !== undefined && typeof active !== "boolean") throw new Error("Estado inválido.");
  const resolvedFrequency = frequency as (typeof frequencies)[number] | undefined;
  const days = resolvedFrequency === "DIARIA" ? [0, 1, 2, 3, 4, 5, 6] : scheduledDays === undefined ? undefined : [...new Set(scheduledDays as number[])].sort((a, b) => a - b);
  if (resolvedFrequency === "SEMANAL" && (!days || days.length === 0)) throw new Error("Elige al menos un día semanal.");
  return { title, detail, projectId, frequency: resolvedFrequency, scheduledDays: days, active };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const input = body as Record<string, unknown>;

    const user = await getLocalUser();
    const habit = await prisma.habit.findFirst({ where: { id, userId: user.id } });
    if (!habit) return NextResponse.json({ error: "Hábito no encontrado." }, { status: 404 });

    if ("date" in input || "completed" in input) {
      const { date, completed } = input;
      if (!habit.active) throw new Error("Reactiva el hábito antes de registrar avances.");
      if (typeof date !== "string" || typeof completed !== "boolean") throw new Error("Datos de hábito inválidos.");

      const entryDate = dayFromKey(date);
      if (entryDate < habit.startedAt) throw new Error("No puedes registrar un hábito antes de su inicio.");
      if (habit.frequency === "SEMANAL" && !habit.scheduledDays.includes(entryDate.getUTCDay())) throw new Error("Este hábito no está programado para ese día.");
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
      if (!project) throw new Error("Proyecto inválido.");
    }
    if (meta.active && !habit.active) {
      const activeCount = await prisma.habit.count({ where: { userId: user.id, active: true } });
      if (activeCount >= 3) throw new Error("Puedes mantener hasta 3 hábitos activos.");
    }
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el hábito." }, { status: 400 });
  }
}
