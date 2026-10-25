import type { Word } from "./db";

/**
 * Probabilità stimata di indovinare la parola.
 * Il +1/+2 (smoothing di Laplace) fa partire una parola nuova da 0.5
 * invece che da 0 o 100%, così un solo tentativo non pesa troppo.
 */
export function mastery(w: Pick<Word, "shown" | "correct">): number {
  return (w.correct + 1) / (w.shown + 2);
}

/**
 * Peso di estrazione: più la parola è sbagliata, più esce.
 *   nuova (0/0)        → 1.2
 *   sbagliata 3/3      → ~2.8
 *   indovinata 9/10    → ~0.27
 * Il minimo di 0.2 fa sì che anche le parole imparate ogni tanto tornino.
 */
export function weight(w: Pick<Word, "shown" | "correct">): number {
  return 0.2 + 4 * (1 - mastery(w)) ** 2;
}

/** Estrae una parola a caso in base al peso, evitando di ripetere l'ultima. */
export function pickWeighted<T extends Word>(list: T[], lastId?: number): T | undefined {
  const pool = list.length > 1 ? list.filter((w) => w.id !== lastId) : list;
  const total = pool.reduce((sum, w) => sum + weight(w), 0);
  let r = Math.random() * total;
  for (const w of pool) {
    r -= weight(w);
    if (r <= 0) return w;
  }
  return pool[pool.length - 1];
}

/** "60%" oppure "—" se la parola non è mai uscita */
export function percent(w: Pick<Word, "shown" | "correct">): string {
  return w.shown ? `${Math.round((w.correct / w.shown) * 100)}%` : "—";
}
