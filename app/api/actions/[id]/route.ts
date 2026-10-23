import { NextResponse } from "next/server";
import { getLocalUser } from "../../../../lib/life-data";
import { prisma } from "../../../../lib/prisma";

const statuses = ["PENDIENTE", "COMPLETADA", "POSPUESTA"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : null;
    if (!statuses.includes(status as (typeof statuses)[number])) throw new Error("Estado inválido.");

    const user = await getLocalUser();
    const action = await prisma.action.findFirst({ where: { id, userId: user.id } });
    if (!action) return NextResponse.json({ error: "Acción no encontrada." }, { status: 404 });

    await prisma.action.update({
      where: { id },
      data: {
        status: status as (typeof statuses)[number],
        completedAt: status === "COMPLETADA" ? new Date() : null,
        postponedFrom: status === "POSPUESTA" ? action.scheduledDate : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la acción." }, { status: 400 });
  }
}
