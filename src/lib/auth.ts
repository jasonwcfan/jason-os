// Tiny password gate. There's exactly one user (you), so instead of a
// full auth system we set a signed cookie when the right password is
// entered, and the edge middleware checks it on every request.
//
// The cookie value is an HMAC over a constant, keyed by AUTH_SECRET — so
// the cookie can't be forged without the secret, and the password itself
// is never stored in the cookie. Uses Web Crypto so it runs on the edge.

export const AUTH_COOKIE = "jos_auth";
const AUTH_PAYLOAD = "jason-os-authed-v1";

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedToken(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET environment variable.");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(AUTH_PAYLOAD));
  return toHex(sig);
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const expected = await expectedToken();
    // constant-time-ish compare
    if (token.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < token.length; i++) {
      diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
