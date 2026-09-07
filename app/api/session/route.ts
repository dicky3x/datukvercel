import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const auth = await getSession();
  return NextResponse.json({ auth });
}
