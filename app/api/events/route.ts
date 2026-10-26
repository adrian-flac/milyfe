import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../lib/api-error";
import { dayFromKey } from "../../../lib/life-data";
import { getCurrentUser } from "../../../lib/current-user";
import { prisma } from "../../../lib/prisma";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const { title, date, projectId } = body as Record<string, unknown>;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 140) throw new RequestValidationError("Escribe un evento de máximo 140 caracteres.");
    if (typeof date !== "string") throw new RequestValidationError("Fecha inválida.");

    const user = await getCurrentUser();
    const safeProjectId = typeof projectId === "string" && projectId ? projectId : null;
    if (safeProjectId) {
      const project = await prisma.project.findFirst({ where: { id: safeProjectId, userId: user.id } });
      if (!project) throw new RequestValidationError("Proyecto inválido.");
    }

    const startsAt = dayFromKey(date);
    await prisma.calendarEvent.create({
      data: { userId: user.id, projectId: safeProjectId, title: title.trim(), startsAt, endsAt: startsAt, allDay: true },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo crear el evento.");
  }
}
