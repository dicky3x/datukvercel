import { NextRequest, NextResponse } from "next/server";
import { checkLogin, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { username, password } = body as { username?: string; password?: string };
  const auth = checkLogin(username || "", password || "");
  if (!auth) {
    return NextResponse.json(
      { error: "Username atau password salah, atau kode satker tidak ditemukan di data." },
      { status: 401 }
    );
  }
  await setSessionCookie(auth);
  return NextResponse.json({ auth });
}
