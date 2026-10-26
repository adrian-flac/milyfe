import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../../lib/api-error";
import { dayFromKey } from "../../../../lib/life-data";
import { getCurrentUser } from "../../../../lib/current-user";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const { ids, date } = body as Record<string, unknown>;
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) throw new RequestValidationError("Orden inválido.");
    if (typeof date !== "string") throw new RequestValidationError("Fecha inválida.");

    const user = await getCurrentUser();
    const scheduledDate = dayFromKey(date);
    const actions = await prisma.action.findMany({ where: { userId: user.id, scheduledDate }, select: { id: true } });
    if (actions.length !== ids.length || actions.some((action) => !ids.includes(action.id))) throw new RequestValidationError("Las acciones no coinciden con el día seleccionado.");

    await prisma.$transaction(ids.map((id, index) => prisma.action.update({ where: { id }, data: { sortOrder: index + 1 } })));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo reordenar las acciones.");
  }
}
