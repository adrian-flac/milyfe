import { NextResponse } from "next/server";
import { dayFromKey } from "../../../lib/life-data";
import { getCurrentUser } from "../../../lib/current-user";
import { prisma } from "../../../lib/prisma";

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { month, learning } = body as Record<string, unknown>;
    if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Mes inválido.");
    if (learning !== undefined && learning !== null && (typeof learning !== "string" || learning.length > 2000)) throw new Error("El aprendizaje no puede superar 2000 caracteres.");
    const user = await getCurrentUser();
    const date = dayFromKey(`${month}-01`);
    await prisma.monthlyReflection.upsert({
      where: { userId_month: { userId: user.id, month: date } },
      create: { userId: user.id, month: date, learning: typeof learning === "string" && learning.trim() ? learning.trim() : null },
      update: { learning: typeof learning === "string" && learning.trim() ? learning.trim() : null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el aprendizaje." }, { status: 400 });
  }
}
