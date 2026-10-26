import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../../lib/api-error";
import { dayFromKey } from "../../../../lib/life-data";
import { getCurrentUser } from "../../../../lib/current-user";
import { prisma } from "../../../../lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const { title, date, projectId } = body as Record<string, unknown>;
    if (title !== undefined && (typeof title !== "string" || !title.trim() || title.trim().length > 140)) throw new RequestValidationError("Escribe un evento de máximo 140 caracteres.");
    if (date !== undefined && typeof date !== "string") throw new RequestValidationError("Fecha inválida.");
    if (projectId !== undefined && projectId !== null && typeof projectId !== "string") throw new RequestValidationError("Proyecto inválido.");

    const user = await getCurrentUser();
    const event = await prisma.calendarEvent.findFirst({ where: { id, userId: user.id } });
    if (!event) return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
    const safeProjectId = typeof projectId === "string" && projectId ? projectId : null;
    if (projectId !== undefined && safeProjectId) {
      const project = await prisma.project.findFirst({ where: { id: safeProjectId, userId: user.id } });
      if (!project) throw new RequestValidationError("Proyecto inválido.");
    }
    const eventDate = date === undefined ? null : dayFromKey(date);
    await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(projectId !== undefined ? { projectId: safeProjectId } : {}),
        ...(eventDate ? { startsAt: eventDate, endsAt: eventDate } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo actualizar el evento.");
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const result = await prisma.calendarEvent.deleteMany({ where: { id, userId: user.id } });
    if (!result.count) return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo eliminar el evento.");
  }
}
