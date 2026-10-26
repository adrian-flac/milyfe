import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../../../lib/api-error";
import { dayFromKey } from "../../../../../lib/life-data";
import { getCurrentUser } from "../../../../../lib/current-user";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const { title, goalId, targetDate } = body as Record<string, unknown>;
    if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 140) throw new RequestValidationError("El hito debe tener entre 2 y 140 caracteres.");
    if (targetDate !== undefined && targetDate !== null && targetDate !== "" && typeof targetDate !== "string") throw new RequestValidationError("Fecha inválida.");

    const user = await getCurrentUser();
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    const safeGoalId = typeof goalId === "string" && goalId ? goalId : null;
    if (safeGoalId) {
      const goal = await prisma.goal.findFirst({ where: { id: safeGoalId, projectId, userId: user.id } });
      if (!goal) throw new RequestValidationError("Objetivo inválido.");
    }
    const milestone = await prisma.milestone.create({
      data: { projectId, goalId: safeGoalId, title: title.trim(), targetDate: typeof targetDate === "string" && targetDate ? dayFromKey(targetDate) : null },
    });
    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo crear el hito.");
  }
}
