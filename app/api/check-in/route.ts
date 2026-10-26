import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../lib/api-error";
import { dayFromKey } from "../../../lib/life-data";
import { getCurrentUser } from "../../../lib/current-user";
import { prisma } from "../../../lib/prisma";

const feelings = ["EXCELENTE", "BIEN", "NEUTRAL", "BAJO", "MAL"] as const;

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const { date, energy, friction, motivation, feeling, note } = body as Record<string, unknown>;
    if (typeof date !== "string") throw new RequestValidationError("Fecha inválida.");
    for (const value of [energy, friction, motivation]) {
      if (value !== undefined && (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5)) throw new RequestValidationError("Las métricas deben estar entre 1 y 5.");
    }
    if (feeling !== undefined && !feelings.includes(feeling as (typeof feelings)[number])) throw new RequestValidationError("Sensación inválida.");
    if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 1000)) throw new RequestValidationError("La nota no puede superar 1000 caracteres.");

    const user = await getCurrentUser();
    const data = {
      ...(energy !== undefined ? { energy: energy as number } : {}),
      ...(friction !== undefined ? { friction: friction as number } : {}),
      ...(motivation !== undefined ? { motivation: motivation as number } : {}),
      ...(feeling !== undefined ? { feeling: feeling as (typeof feelings)[number] } : {}),
      ...(note !== undefined ? { note: typeof note === "string" && note.trim() ? note.trim() : null } : {}),
    };
    await prisma.dailyCheckIn.upsert({
      where: { userId_date: { userId: user.id, date: dayFromKey(date) } },
      create: { userId: user.id, date: dayFromKey(date), ...data },
      update: data,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "No se pudo guardar el check-in.");
  }
}
