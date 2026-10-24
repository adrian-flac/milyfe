import { NextResponse } from "next/server";
import { getDashboard } from "../../../lib/life-data";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Falta la fecha." }, { status: 400 });

  try {
    return NextResponse.json(await getDashboard(date));
  } catch (error) {
    console.error("No se pudo cargar el panel", error);
    return NextResponse.json({ error: "No se pudo cargar el panel." }, { status: 500 });
  }
}
