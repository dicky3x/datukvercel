import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSatkerKodeSet } from "./data";

export type Auth = { role: "super" | "satker"; kdsatker: number | null };

const COOKIE_NAME = "datuk_session";
const SUPERUSER_USERNAME = process.env.SUPERUSER_USERNAME || "kanwil04";
const SUPERUSER_PASSWORD = process.env.SUPERUSER_PASSWORD || "admin";

function secret(): string {
  // Wajib di-set di environment Vercel untuk produksi (lihat README).
  return process.env.SESSION_SECRET || "dev-only-secret-ganti-di-production";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function encode(auth: Auth): string {
  const payload = JSON.stringify(auth);
  const b64 = Buffer.from(payload, "utf-8").toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

function decode(token: string | undefined): Auth | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = sign(b64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = Buffer.from(b64, "base64url").toString("utf-8");
    return JSON.parse(payload) as Auth;
  } catch {
    return null;
  }
}

/** Sama seperti _cek_login() di common.py: login pakai kode satker sebagai
 * username & password, atau kredensial super user. */
export function checkLogin(username: string, password: string): Auth | null {
  const u = (username || "").trim();
  const p = (password || "").trim();
  if (u === SUPERUSER_USERNAME && p === SUPERUSER_PASSWORD) {
    return { role: "super", kdsatker: null };
  }
  if (u && u === p && /^\d+$/.test(u)) {
    const kdsatker = parseInt(u, 10);
    if (getSatkerKodeSet().has(kdsatker)) {
      return { role: "satker", kdsatker };
    }
  }
  return null;
}

export async function getSession(): Promise<Auth | null> {
  const store = await cookies();
  return decode(store.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(auth: Auth) {
  const store = await cookies();
  store.set(COOKIE_NAME, encode(auth), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 jam
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
