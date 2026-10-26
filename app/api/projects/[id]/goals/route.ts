import { NextResponse } from "next/server";
import { dayFromKey } from "../../../../../lib/life-data";
import { getCurrentUser } from "../../../../../lib/current-user";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { title, description, targetDate } = body as Record<string, unknown>;
    if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 140) throw new Error("El objetivo debe tener entre 2 y 140 caracteres.");
    if (description !== undefined && (typeof description !== "string" || description.length > 500)) throw new Error("La descripción no puede exceder 500 caracteres.");
    if (targetDate !== undefined && targetDate !== null && targetDate !== "" && typeof targetDate !== "string") throw new Error("Fecha inválida.");

    const user = await getCurrentUser();
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    const goal = await prisma.goal.create({
      data: { userId: user.id, projectId, title: title.trim(), description: typeof description === "string" ? description.trim() || null : null, targetDate: typeof targetDate === "string" && targetDate ? dayFromKey(targetDate) : null },
    });
    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el objetivo." }, { status: 400 });
  }
}
