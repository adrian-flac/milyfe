import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../../lib/api-error";
import { dayFromKey } from "../../../../lib/life-data";
import { getCurrentUser } from "../../../../lib/current-user";
import { prisma } from "../../../../lib/prisma";

const statuses = ["ACTIVO", "ALCANZADO", "ABANDONADO"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const { title, description, targetDate, status } = body as Record<string, unknown>;
    if (title !== undefined && (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 140)) throw new RequestValidationError("El objetivo debe tener entre 2 y 140 caracteres.");
    if (description !== undefined && (typeof description !== "string" || description.length > 500)) throw new RequestValidationError("La descripción no puede exceder 500 caracteres.");
    if (targetDate !== undefined && targetDate !== null && targetDate !== "" && typeof targetDate !== "string") throw new RequestValidationError("Fecha inválida.");
    if (status !== undefined && !statuses.includes(status as (typeof statuses)[number])) throw new RequestValidationError("Estado inválido.");

    const user = await getCurrentUser();
    const goal = await prisma.goal.findFirst({ where: { id, userId: user.id } });
    if (!goal) return NextResponse.json({ error: "Objetivo no encontrado." }, { status: 404 });
    const safeStatus = status as (typeof statuses)[number] | undefined;
    await prisma.goal.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: (title as string).trim() } : {}),
        ...(description !== undefined ? { description: (description as string).trim() || null } : {}),
        ...(targetDate !== undefined ? { targetDate: typeof targetDate === "string" && targetDate ? dayFromKey(targetDate) : null } : {}),
        ...(safeStatus ? { status: safeStatus, achievedAt: safeStatus === "ALCANZADO" ? new Date() : null } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo actualizar el objetivo.");
  }
}
