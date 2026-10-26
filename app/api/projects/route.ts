import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/current-user";
import { prisma } from "../../../lib/prisma";

const domains = ["SALUD", "TRABAJO", "PERSONAL"] as const;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { title, domain, description } = body as Record<string, unknown>;
    if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 100) throw new Error("El proyecto debe tener entre 2 y 100 caracteres.");
    if (!domains.includes(domain as (typeof domains)[number])) throw new Error("Dominio inválido.");
    if (description !== undefined && (typeof description !== "string" || description.length > 500)) throw new Error("La descripción no puede exceder 500 caracteres.");

    const user = await getCurrentUser();
    const project = await prisma.project.create({
      data: { userId: user.id, title: title.trim(), domain: domain as (typeof domains)[number], description: typeof description === "string" ? description.trim() || null : null },
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el proyecto." }, { status: 400 });
  }
}
