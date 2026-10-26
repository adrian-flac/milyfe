import { NextResponse } from "next/server";
import { apiErrorResponse } from "../../../lib/api-error";
import { dayFromKey, getDashboard } from "../../../lib/life-data";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Falta la fecha." }, { status: 400 });
  try {
    dayFromKey(date);
  } catch (error) {
    return apiErrorResponse(error, "Fecha inválida.");
  }

  try {
    return NextResponse.json(await getDashboard(date));
  } catch (error) {
    return apiErrorResponse(error, "No se pudo cargar el panel.");
  }
}
