import { $, component$, useSignal, useStore, useTask$ } from "@builder.io/qwik";
import { routeLoader$, server$, type DocumentHead } from "@builder.io/qwik-city";
import { getDB, type Word } from "~/lib/db";
import { percent, pickWeighted } from "~/lib/scheduler";

type Mode = "en" | "it" | "mix";
type Dir = "en" | "it";

/** Gira sul server prima del render: carica solo le parole visibili */
export const useWords = routeLoader$(async (ev) => {
  const { results } = await getDB(ev)
    .prepare("SELECT id, en, it, shown, correct, visible FROM words WHERE visible = 1")
    .all<Word>();
  return results;
});

/**
 * Funzione server chiamata dal browser come una normale funzione async.
 * A differenza di una routeAction$ non ricarica i loader: qui serve solo
 * salvare la risposta, lo stato della pagina lo aggiorniamo noi.
 */
const recordAnswer = server$(async function (id: number, ok: boolean) {
  await getDB(this)
    .prepare("UPDATE words SET shown = shown + 1, correct = correct + ? WHERE id = ?")
    .bind(ok ? 1 : 0, id)
    .run();
});

const FLIP_MS = 550;

// Funzione a livello di modulo: le closure dentro $() possono usarla
// senza doverla serializzare (vedi qwikguide.md, "Le regole di $").
function chooseDir(m: Mode): Dir {
  return m === "mix" ? (Math.random() < 0.5 ? "en" : "it") : m;
}

export default component$(() => {
  const words = useWords();
  const mode = useSignal<Mode>("en");
  const state = useStore({
    list: [] as Word[],
    currentId: -1,
    dir: "en" as Dir,
    flipped: false,
    session: { seen: 0, ok: 0 },
    error: "",
  });

  // Quando il loader cambia (prima visita, oppure dopo "Aggiungi")
  // copio le parole nello store locale e scelgo una carta se serve.
  useTask$(({ track }) => {
    const fresh = track(() => words.value);
    state.list = fresh.map((w) => ({ ...w }));
    if (!state.list.some((w) => w.id === state.currentId)) {
      state.currentId = pickWeighted(state.list)?.id ?? -1;
      state.dir = chooseDir(mode.value);
    }
  });

  const next = $(() => {
    const change = () => {
      state.currentId = pickWeighted(state.list, state.currentId)?.id ?? -1;
      state.dir = chooseDir(mode.value);
    };
    // se la carta è girata, aspetto metà animazione prima di cambiarla
    // così non si vede la soluzione della carta successiva
    if (state.flipped) {
      state.flipped = false;
      setTimeout(change, FLIP_MS / 2);
    } else change();
  });

  const answer = $(async (ok: boolean) => {
    const w = state.list.find((x) => x.id === state.currentId);
    if (!w) return;
    w.shown++;
    if (ok) w.correct++;
    state.session.seen++;
    if (ok) state.session.ok++;
    next();
    try {
      await recordAnswer(w.id, ok);
      state.error = "";
    } catch {
      state.error = "Risposta non salvata: controlla la connessione.";
    }
  });

  const setMode = $((m: Mode) => {
    mode.value = m;
    state.dir = chooseDir(m);
    state.flipped = false;
  });

  const current = state.list.find((w) => w.id === state.currentId);

  if (!current) {
    return (
      <section class="empty">
        <h1>Nessuna carta da studiare</h1>
        <p>
          Aggiungi la prima parola con <strong>+ Aggiungi</strong> in alto, oppure
          rendi visibili quelle nascoste dalla pagina <a href="/parole/">Parole</a>.
        </p>
      </section>
    );
  }

  const front = state.dir === "en" ? current.en : current.it;
  const back = state.dir === "en" ? current.it : current.en;

  return (
    <section class="study">
      <div class="study-head">
        <div class="modes" role="group" aria-label="Direzione">
          {(
            [
              ["en", "EN → IT"],
              ["it", "IT → EN"],
              ["mix", "Misto"],
            ] as const
          ).map(([m, label]) => (
            <button key={m} aria-pressed={mode.value === m} onClick$={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>
        <span class="count">
          {state.session.ok}/{state.session.seen} oggi · {state.list.length} carte
        </span>
      </div>

      <div class="scene">
        <button
          class={["card", { flipped: state.flipped }]}
          aria-label={state.flipped ? "Torna alla domanda" : "Mostra la soluzione"}
          onClick$={() => (state.flipped = !state.flipped)}
        >
          <div class="face front">
            <span class="lang">{state.dir === "en" ? "English" : "Italiano"}</span>
            <span class="hint">tocca per girare</span>
            <span class="word">{front}</span>
          </div>
          <div class="face back">
            <span class="lang">{state.dir === "en" ? "Italiano" : "English"}</span>
            <span class="word">{back}</span>
            <span class="note">
              indovinata {current.correct} su {current.shown} · {percent(current)}
            </span>
          </div>
        </button>
      </div>

      {state.flipped ? (
        <div class="answer">
          <button class="btn btn-miss" onClick$={() => answer(false)}>
            Non la sapevo
          </button>
          <button class="btn btn-hit" onClick$={() => answer(true)}>
            L'ho indovinata
          </button>
        </div>
      ) : (
        <div class="answer">
          <button class="btn btn-ghost" onClick$={next}>
            Salta
          </button>
          <button class="btn btn-primary" onClick$={() => (state.flipped = true)}>
            Gira la carta
          </button>
        </div>
      )}

      {state.error && <p class="err" role="alert">{state.error}</p>}
    </section>
  );
});

export const head: DocumentHead = {
  title: "Studia · Vocaboli",
  meta: [{ name: "description", content: "Flashcard inglese–italiano" }],
};
