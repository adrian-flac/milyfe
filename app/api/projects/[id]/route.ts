import { NextResponse } from "next/server";
import { apiErrorResponse, RequestValidationError } from "../../../../lib/api-error";
import { getCurrentUser } from "../../../../lib/current-user";
import { prisma } from "../../../../lib/prisma";

const domains = ["SALUD", "TRABAJO", "PERSONAL"] as const;
const statuses = ["ACTIVO", "COMPLETADO", "ARCHIVADO"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RequestValidationError("Solicitud inválida.");
    const { title, domain, description, status } = body as Record<string, unknown>;
    if (title !== undefined && (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 100)) throw new RequestValidationError("El proyecto debe tener entre 2 y 100 caracteres.");
    if (domain !== undefined && !domains.includes(domain as (typeof domains)[number])) throw new RequestValidationError("Dominio inválido.");
    if (description !== undefined && (typeof description !== "string" || description.length > 500)) throw new RequestValidationError("La descripción no puede exceder 500 caracteres.");
    if (status !== undefined && !statuses.includes(status as (typeof statuses)[number])) throw new RequestValidationError("Estado inválido.");

    const user = await getCurrentUser();
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
    return apiErrorResponse(error, "No se pudo actualizar el proyecto.");
  }
}
