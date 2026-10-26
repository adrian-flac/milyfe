import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../lib/api-error";
import { dayFromKey } from "../../../lib/life-data";
import { getCurrentUser } from "../../../lib/current-user";
import { prisma } from "../../../lib/prisma";

const actionTypes = ["CLAVE", "DECISION"] as const;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const { title, type, date, projectId } = body as Record<string, unknown>;

    if (typeof title !== "string" || !title.trim() || title.trim().length > 140) throw new RequestValidationError("Escribe una acción de máximo 140 caracteres.");
    if (typeof date !== "string") throw new RequestValidationError("Fecha inválida.");
    if (!actionTypes.includes(type as (typeof actionTypes)[number])) throw new RequestValidationError("Tipo de acción inválido.");

    const user = await getCurrentUser();
    const scheduledDate = dayFromKey(date);
    const existing = await prisma.action.count({ where: { userId: user.id, scheduledDate } });
    if (existing >= 6) throw new RequestValidationError("Solo puedes tener seis acciones para este día.");

    const safeProjectId = typeof projectId === "string" && projectId ? projectId : null;
    if (safeProjectId) {
      const project = await prisma.project.findFirst({ where: { id: safeProjectId, userId: user.id } });
      if (!project) throw new RequestValidationError("Proyecto inválido.");
    }

    await prisma.action.create({
      data: {
        userId: user.id,
        projectId: safeProjectId,
        title: title.trim(),
        type: type as (typeof actionTypes)[number],
        scheduledDate,
        sortOrder: existing + 1,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo crear la acción.");
  }
}
