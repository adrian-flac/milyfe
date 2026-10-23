import { NextResponse } from "next/server";
import { dayFromKey, getLocalUser } from "../../../lib/life-data";
import { prisma } from "../../../lib/prisma";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { title, date, projectId } = body as Record<string, unknown>;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 140) throw new Error("Escribe un evento de máximo 140 caracteres.");
    if (typeof date !== "string") throw new Error("Fecha inválida.");

    const user = await getLocalUser();
    const safeProjectId = typeof projectId === "string" && projectId ? projectId : null;
    if (safeProjectId) {
      const project = await prisma.project.findFirst({ where: { id: safeProjectId, userId: user.id } });
      if (!project) throw new Error("Proyecto inválido.");
    }

    const startsAt = dayFromKey(date);
    await prisma.calendarEvent.create({
      data: { userId: user.id, projectId: safeProjectId, title: title.trim(), startsAt, endsAt: startsAt, allDay: true },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el evento." }, { status: 400 });
  }
}
