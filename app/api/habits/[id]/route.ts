import { NextResponse } from "next/server";
import { dayFromKey, getLocalUser } from "../../../../lib/life-data";
import { prisma } from "../../../../lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { date, completed } = body as Record<string, unknown>;
    if (typeof date !== "string" || typeof completed !== "boolean") throw new Error("Datos de hábito inválidos.");

    const user = await getLocalUser();
    const habit = await prisma.habit.findFirst({ where: { id, userId: user.id, active: true } });
    if (!habit) return NextResponse.json({ error: "Hábito no encontrado." }, { status: 404 });

    const entryDate = dayFromKey(date);
    await prisma.habitEntry.upsert({
      where: { habitId_date: { habitId: habit.id, date: entryDate } },
      create: { habitId: habit.id, userId: user.id, date: entryDate, completed, completedAt: completed ? new Date() : null },
      update: { completed, completedAt: completed ? new Date() : null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el hábito." }, { status: 400 });
  }
}
