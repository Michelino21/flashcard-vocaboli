/**
 * Login minimale: tabella `users` + cookie di sessione firmato (HMAC).
 * Non c'è una tabella delle sessioni: il cookie contiene `idUtente.scadenza.firma`
 * e la firma si controlla con SESSION_SECRET (secret del Worker, vedi README).
 * Gli utenti si creano a mano con `npm run user:add`.
 */
import type { RequestEventBase, RequestEventCommon } from "@builder.io/qwik-city";
import { getDB } from "~/lib/db";

export interface User {
  id: number;
  username: string;
}

type AuthEvent = RequestEventBase<QwikCityPlatform>;

const COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 giorni
const USER_KEY = "auth:user";
// Il Worker rifiuta PBKDF2 sopra 100000 iterazioni. Il valore usato vero sta
// dentro ogni hash (scripts/new-user.mjs), questo serve solo per il confronto finto.
const DUMMY_ITERATIONS = 50_000;

const enc = new TextEncoder();

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64Url = (b: Uint8Array) => toB64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64Url = (s: string) => fromB64(s.replace(/-/g, "+").replace(/_/g, "/"));

// ---- password -------------------------------------------------------------

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** `stored` ha il formato `pbkdf2$iterazioni$salt$hash` (base64), vedi scripts/new-user.mjs */
async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored?.split("$") ?? [];
  const iterations = Number(iter);
  if (scheme !== "pbkdf2" || !(iterations >= 1 && iterations <= 100_000) || !salt || !hash) {
    // utente inesistente o hash malformato: faccio comunque il calcolo,
    // così il tempo di risposta non rivela quali utenti esistono
    await derive(password, new Uint8Array(16), DUMMY_ITERATIONS);
    return false;
  }
  const expected = fromB64(hash);
  const actual = await derive(password, fromB64(salt), iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** Controlla utente e password: restituisce l'utente oppure null */
export async function authenticate(
  ev: AuthEvent,
  username: string,
  password: string,
): Promise<User | null> {
  const row = await getDB(ev)
    .prepare("SELECT id, username, password FROM users WHERE username = ?")
    .bind(username)
    .first<{ id: number; username: string; password: string }>();
  const ok = await verifyPassword(password, row?.password);
  return row && ok ? { id: row.id, username: row.username } : null;
}

// ---- sessione -------------------------------------------------------------

function hmacKey(ev: AuthEvent, usage: "sign" | "verify") {
  const secret = (ev.platform.env as { SESSION_SECRET?: string } | undefined)?.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET mancante o troppo corto: vedi la sezione Login nel README.",
    );
  }
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    usage,
  ]);
}

export async function createSession(ev: AuthEvent, user: User) {
  const payload = `${user.id}.${Math.floor(Date.now() / 1000) + MAX_AGE}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(ev, "sign"), enc.encode(payload));
  ev.cookie.set(COOKIE, `${payload}.${toB64Url(new Uint8Array(sig))}`, {
    httpOnly: true,
    secure: ev.url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  ev.sharedMap.set(USER_KEY, user);
}

export function clearSession(ev: AuthEvent) {
  ev.cookie.delete(COOKIE, { path: "/" });
  // dopo un'action Qwik City ricarica i loader nella stessa richiesta
  ev.sharedMap.set(USER_KEY, null);
}

/** L'utente della richiesta (dal cookie), oppure null. Calcolato una volta sola per richiesta. */
export async function getUser(ev: AuthEvent): Promise<User | null> {
  if (ev.sharedMap.has(USER_KEY)) return ev.sharedMap.get(USER_KEY);
  let user: User | null = null;
  const parts = ev.cookie.get(COOKIE)?.value.split(".");
  if (parts?.length === 3) {
    const [id, exp, sig] = parts;
    let valid = false;
    try {
      valid = await crypto.subtle.verify(
        "HMAC",
        await hmacKey(ev, "verify"),
        fromB64Url(sig),
        enc.encode(`${id}.${exp}`),
      );
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("SESSION_SECRET")) throw e;
      // firma non decodificabile: cookie manomesso
    }
    if (valid && Number(exp) > Date.now() / 1000) {
      // controllo anche che l'utente esista ancora: cancellarlo dal DB chiude la sessione
      user = await getDB(ev)
        .prepare("SELECT id, username FROM users WHERE id = ?")
        .bind(Number(id))
        .first<User>();
    }
  }
  ev.sharedMap.set(USER_KEY, user);
  return user;
}

/** Da usare in ogni action che scrive: senza login risponde 401 */
export async function requireUser(ev: AuthEvent): Promise<User> {
  const user = await getUser(ev);
  if (!user) {
    // dentro server$ `this` non ha error(): lì basta un'eccezione qualsiasi
    const msg = "Devi accedere per farlo";
    throw "error" in ev ? (ev as RequestEventCommon<QwikCityPlatform>).error(401, msg) : new Error(msg);
  }
  return user;
}
