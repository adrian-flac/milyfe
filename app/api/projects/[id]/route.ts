import { NextResponse } from "next/server";
import { getLocalUser } from "../../../../lib/life-data";
import { prisma } from "../../../../lib/prisma";

const domains = ["SALUD", "TRABAJO", "PERSONAL"] as const;
const statuses = ["ACTIVO", "COMPLETADO", "ARCHIVADO"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { title, domain, description, status } = body as Record<string, unknown>;
    if (title !== undefined && (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 100)) throw new Error("El proyecto debe tener entre 2 y 100 caracteres.");
    if (domain !== undefined && !domains.includes(domain as (typeof domains)[number])) throw new Error("Dominio inválido.");
    if (description !== undefined && (typeof description !== "string" || description.length > 500)) throw new Error("La descripción no puede exceder 500 caracteres.");
    if (status !== undefined && !statuses.includes(status as (typeof statuses)[number])) throw new Error("Estado inválido.");

    const user = await getLocalUser();
    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });

    await prisma.project.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: (title as string).trim() } : {}),
        ...(domain !== undefined ? { domain: domain as (typeof domains)[number] } : {}),
        ...(description !== undefined ? { description: (description as string).trim() || null } : {}),
        ...(status !== undefined ? { status: status as (typeof statuses)[number] } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el proyecto." }, { status: 400 });
  }
}
