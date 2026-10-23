import { NextResponse } from "next/server";
import { dayFromKey, getLocalUser } from "../../../lib/life-data";
import { prisma } from "../../../lib/prisma";

const actionTypes = ["CLAVE", "DECISION"] as const;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { title, type, date, projectId } = body as Record<string, unknown>;

    if (typeof title !== "string" || !title.trim() || title.trim().length > 140) throw new Error("Escribe una acción de máximo 140 caracteres.");
    if (typeof date !== "string") throw new Error("Fecha inválida.");
    if (!actionTypes.includes(type as (typeof actionTypes)[number])) throw new Error("Tipo de acción inválido.");

    const user = await getLocalUser();
    const scheduledDate = dayFromKey(date);
    const existing = await prisma.action.count({ where: { userId: user.id, scheduledDate } });
    if (existing >= 6) throw new Error("Solo puedes tener seis acciones para este día.");

    const safeProjectId = typeof projectId === "string" && projectId ? projectId : null;
    if (safeProjectId) {
      const project = await prisma.project.findFirst({ where: { id: safeProjectId, userId: user.id } });
      if (!project) throw new Error("Proyecto inválido.");
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la acción." }, { status: 400 });
  }
}
