import { NextResponse } from "next/server";
import { dayFromKey } from "../../../lib/life-data";
import { getCurrentUser } from "../../../lib/current-user";
import { prisma } from "../../../lib/prisma";

function optionalInteger(value: unknown, field: string, maximum: number) {
  if (value === undefined || value === null || value === "") return null;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > maximum) throw new Error(`${field} debe ser un número entre 0 y ${maximum}.`);
  return value as number;
}

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { date, steps, sleepHours, workoutDone, readingPages } = body as Record<string, unknown>;
    if (typeof date !== "string") throw new Error("Fecha inválida.");
    if (sleepHours !== undefined && sleepHours !== null && sleepHours !== "" && (typeof sleepHours !== "number" || !Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 24)) {
      throw new Error("Las horas de sueño deben estar entre 0 y 24.");
    }
    if (workoutDone !== undefined && typeof workoutDone !== "boolean") throw new Error("El estado de entrenamiento no es válido.");

    const user = await getCurrentUser();
    const metricDate = dayFromKey(date);
    const data = {
      steps: optionalInteger(steps, "Los pasos", 100000),
      sleepHours: sleepHours === undefined || sleepHours === null || sleepHours === "" ? null : sleepHours as number,
      workoutDone: workoutDone === undefined ? false : workoutDone,
      readingPages: optionalInteger(readingPages, "Las páginas leídas", 10000),
    };
    await prisma.healthMetric.upsert({
      where: { userId_date: { userId: user.id, date: metricDate } },
      create: { userId: user.id, date: metricDate, ...data },
      update: data,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron guardar las métricas de salud." }, { status: 400 });
  }
}
