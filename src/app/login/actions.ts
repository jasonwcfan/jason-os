"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

const SIX_MONTHS = 60 * 60 * 24 * 180;

export type LoginState = { error: string | null };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/crm");
  const next = nextRaw.startsWith("/") ? nextRaw : "/crm";

  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) {
    return { error: "Incorrect password" };
  }

  const store = await cookies();
  store.set(AUTH_COOKIE, await expectedToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SIX_MONTHS,
  });

  redirect(next);
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/login");
}
