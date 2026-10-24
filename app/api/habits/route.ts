import { NextResponse } from "next/server";
import { getLocalUser } from "../../../lib/life-data";
import { prisma } from "../../../lib/prisma";

const frequencies = ["DIARIA", "SEMANAL"] as const;

function readHabitInput(body: Record<string, unknown>) {
  const { title, detail, projectId, frequency = "DIARIA", scheduledDays } = body;
  if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 100) throw new Error("El hábito debe tener entre 2 y 100 caracteres.");
  if (detail !== undefined && detail !== null && typeof detail !== "string") throw new Error("Detalle inválido.");
  if (projectId !== undefined && projectId !== null && typeof projectId !== "string") throw new Error("Proyecto inválido.");
  if (!frequencies.includes(frequency as (typeof frequencies)[number])) throw new Error("Frecuencia inválida.");
  if (scheduledDays !== undefined && (!Array.isArray(scheduledDays) || scheduledDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new Error("Días programados inválidos.");
  const days = frequency === "DIARIA" ? [0, 1, 2, 3, 4, 5, 6] : [...new Set((scheduledDays as number[] | undefined) ?? [])].sort((a, b) => a - b);
  if (frequency === "SEMANAL" && days.length === 0) throw new Error("Elige al menos un día semanal.");
  return { title: title.trim(), detail: typeof detail === "string" && detail.trim() ? detail.trim() : null, projectId: typeof projectId === "string" && projectId ? projectId : null, frequency: frequency as (typeof frequencies)[number], scheduledDays: days };
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const input = readHabitInput(body as Record<string, unknown>);
    const user = await getLocalUser();
    const activeCount = await prisma.habit.count({ where: { userId: user.id, active: true } });
    if (activeCount >= 3) throw new Error("Puedes mantener hasta 3 hábitos activos. Archiva uno antes de añadir otro.");
    if (input.projectId) {
      const project = await prisma.project.findFirst({ where: { id: input.projectId, userId: user.id, status: "ACTIVO" } });
      if (!project) throw new Error("Proyecto inválido.");
    }
    const habit = await prisma.habit.create({ data: { userId: user.id, ...input } });
    return NextResponse.json({ habit }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el hábito." }, { status: 400 });
  }
}
