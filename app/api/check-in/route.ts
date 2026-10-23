import { NextResponse } from "next/server";
import { dayFromKey, getLocalUser } from "../../../lib/life-data";
import { prisma } from "../../../lib/prisma";

const feelings = ["EXCELENTE", "BIEN", "NEUTRAL", "BAJO", "MAL"] as const;

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { date, energy, friction, motivation, feeling } = body as Record<string, unknown>;
    if (typeof date !== "string") throw new Error("Fecha inválida.");
    for (const value of [energy, friction, motivation]) {
      if (value !== undefined && (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5)) throw new Error("Las métricas deben estar entre 1 y 5.");
    }
    if (feeling !== undefined && !feelings.includes(feeling as (typeof feelings)[number])) throw new Error("Sensación inválida.");

    const user = await getLocalUser();
    const data = {
      ...(energy !== undefined ? { energy: energy as number } : {}),
      ...(friction !== undefined ? { friction: friction as number } : {}),
      ...(motivation !== undefined ? { motivation: motivation as number } : {}),
      ...(feeling !== undefined ? { feeling: feeling as (typeof feelings)[number] } : {}),
    };
    await prisma.dailyCheckIn.upsert({
      where: { userId_date: { userId: user.id, date: dayFromKey(date) } },
      create: { userId: user.id, date: dayFromKey(date), ...data },
      update: data,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el check-in." }, { status: 400 });
  }
}
