import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/current-user";
import { prisma } from "../../../../lib/prisma";

const noteTypes = ["ACCION", "NOTA", "EMOCION", "EVENTO"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { type, content } = body as Record<string, unknown>;
    if (type !== undefined && !noteTypes.includes(type as (typeof noteTypes)[number])) throw new Error("Tipo de nota inválido.");
    if (content !== undefined && (typeof content !== "string" || content.trim().length < 1 || content.trim().length > 1000)) throw new Error("La nota debe tener entre 1 y 1000 caracteres.");
    const user = await getCurrentUser();
    const note = await prisma.note.findFirst({ where: { id, userId: user.id } });
    if (!note) return NextResponse.json({ error: "Nota no encontrada." }, { status: 404 });
    await prisma.note.update({ where: { id }, data: { ...(type !== undefined ? { type: type as (typeof noteTypes)[number] } : {}), ...(typeof content === "string" ? { content: content.trim() } : {}) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la nota." }, { status: 400 });
  }
}
