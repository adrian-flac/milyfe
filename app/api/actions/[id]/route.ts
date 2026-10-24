import { NextResponse } from "next/server";
import { dayFromKey, dayKey, getLocalUser } from "../../../../lib/life-data";
import { prisma } from "../../../../lib/prisma";

const statuses = ["PENDIENTE", "COMPLETADA", "POSPUESTA"] as const;
const types = ["CLAVE", "DECISION"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { title, type, status, projectId, date, reason } = body as Record<string, unknown>;
    if (title !== undefined && (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 140)) throw new Error("La acción debe tener entre 2 y 140 caracteres.");
    if (type !== undefined && !types.includes(type as (typeof types)[number])) throw new Error("Tipo de acción inválido.");
    if (status !== undefined && !statuses.includes(status as (typeof statuses)[number])) throw new Error("Estado inválido.");
    if (date !== undefined && typeof date !== "string") throw new Error("Fecha inválida.");
    if (reason !== undefined && (typeof reason !== "string" || reason.length > 200)) throw new Error("El motivo no puede exceder 200 caracteres.");

    const user = await getLocalUser();
    const action = await prisma.action.findFirst({ where: { id, userId: user.id } });
    if (!action) return NextResponse.json({ error: "Acción no encontrada." }, { status: 404 });

    let safeProjectId: string | null | undefined;
    if (projectId !== undefined) {
      safeProjectId = typeof projectId === "string" && projectId ? projectId : null;
      if (safeProjectId) {
        const project = await prisma.project.findFirst({ where: { id: safeProjectId, userId: user.id, status: "ACTIVO" } });
        if (!project) throw new Error("Proyecto inválido o archivado.");
      }
    }

    const nextDate = date === undefined ? action.scheduledDate : dayFromKey(date as string);
    const didReschedule = dayKey(nextDate) !== dayKey(action.scheduledDate);
    if (didReschedule) {
      const count = await prisma.action.count({ where: { userId: user.id, scheduledDate: nextDate, id: { not: id } } });
      if (count >= 6) throw new Error("El nuevo día ya tiene seis acciones.");
    }

    await prisma.$transaction(async (tx) => {
      if (didReschedule) {
        await tx.actionReschedule.create({
          data: { actionId: id, fromDate: action.scheduledDate, toDate: nextDate, reason: typeof reason === "string" ? reason.trim() || null : null },
        });
      }
      await tx.action.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title: (title as string).trim() } : {}),
          ...(type !== undefined ? { type: type as (typeof types)[number] } : {}),
          ...(safeProjectId !== undefined ? { projectId: safeProjectId } : {}),
          ...(didReschedule ? { scheduledDate: nextDate, postponedFrom: action.scheduledDate, status: "PENDIENTE", completedAt: null } : {}),
          ...(status !== undefined && !didReschedule ? { status: status as (typeof statuses)[number], completedAt: status === "COMPLETADA" ? new Date() : null } : {}),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la acción." }, { status: 400 });
  }
}
