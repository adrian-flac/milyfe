import { NextResponse } from "next/server";
import { dayFromKey, getLocalUser } from "../../../../lib/life-data";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { ids, date } = body as Record<string, unknown>;
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) throw new Error("Orden inválido.");
    if (typeof date !== "string") throw new Error("Fecha inválida.");

    const user = await getLocalUser();
    const scheduledDate = dayFromKey(date);
    const actions = await prisma.action.findMany({ where: { userId: user.id, scheduledDate }, select: { id: true } });
    if (actions.length !== ids.length || actions.some((action) => !ids.includes(action.id))) throw new Error("Las acciones no coinciden con el día seleccionado.");

    await prisma.$transaction(ids.map((id, index) => prisma.action.update({ where: { id }, data: { sortOrder: index + 1 } })));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reordenar las acciones." }, { status: 400 });
  }
}
