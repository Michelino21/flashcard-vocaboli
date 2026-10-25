/**
 * Accesso al database D1 (SQLite su Cloudflare).
 * Il binding "DB" è definito in wrangler.jsonc.
 */

export interface Word {
  id: number;
  en: string;
  it: string;
  shown: number;
  correct: number;
  visible: 0 | 1;
}

/** Accetta qualsiasi oggetto con `platform` (RequestEvent, `this` dentro server$...) */
export function getDB(ev: { platform: QwikCityPlatform }): D1Database {
  const db = (ev.platform.env as Env | undefined)?.DB;
  if (!db) {
    throw new Error(
      "Binding D1 'DB' non trovato: controlla wrangler.jsonc e riavvia il server.",
    );
  }
  return db;
}
