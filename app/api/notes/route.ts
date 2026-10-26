import { NextResponse } from "next/server";
import { dayFromKey } from "../../../lib/life-data";
import { getCurrentUser } from "../../../lib/current-user";
import { prisma } from "../../../lib/prisma";

const noteTypes = ["ACCION", "NOTA", "EMOCION", "EVENTO"] as const;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { date, type = "NOTA", content } = body as Record<string, unknown>;
    if (typeof date !== "string") throw new Error("Fecha inválida.");
    if (!noteTypes.includes(type as (typeof noteTypes)[number])) throw new Error("Tipo de nota inválido.");
    if (typeof content !== "string" || content.trim().length < 1 || content.trim().length > 1000) throw new Error("La nota debe tener entre 1 y 1000 caracteres.");
    const user = await getCurrentUser();
    const note = await prisma.note.create({ data: { userId: user.id, date: dayFromKey(date), type: type as (typeof noteTypes)[number], content: content.trim() } });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la nota." }, { status: 400 });
  }
}
