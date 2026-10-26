import { NextResponse } from "next/server";
import { dayFromKey } from "../../../../lib/life-data";
import { getCurrentUser } from "../../../../lib/current-user";
import { prisma } from "../../../../lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { title, targetDate, completed, goalId } = body as Record<string, unknown>;
    if (title !== undefined && (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 140)) throw new Error("El hito debe tener entre 2 y 140 caracteres.");
    if (targetDate !== undefined && targetDate !== null && targetDate !== "" && typeof targetDate !== "string") throw new Error("Fecha inválida.");
    if (completed !== undefined && typeof completed !== "boolean") throw new Error("Estado inválido.");
    if (goalId !== undefined && goalId !== null && typeof goalId !== "string") throw new Error("Objetivo inválido.");

    const user = await getCurrentUser();
    const milestone = await prisma.milestone.findFirst({ where: { id, project: { userId: user.id } } });
    if (!milestone) return NextResponse.json({ error: "Hito no encontrado." }, { status: 404 });
    const safeGoalId = typeof goalId === "string" && goalId ? goalId : null;
    if (goalId !== undefined && safeGoalId) {
      const goal = await prisma.goal.findFirst({ where: { id: safeGoalId, projectId: milestone.projectId, userId: user.id } });
      if (!goal) throw new Error("Objetivo inválido.");
    }
    await prisma.milestone.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: (title as string).trim() } : {}),
        ...(targetDate !== undefined ? { targetDate: typeof targetDate === "string" && targetDate ? dayFromKey(targetDate) : null } : {}),
        ...(completed !== undefined ? { achievedAt: completed ? new Date() : null } : {}),
        ...(goalId !== undefined ? { goalId: safeGoalId } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el hito." }, { status: 400 });
  }
}
