import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { requireUser } from "~/lib/auth";
import { getDB, type Word } from "~/lib/db";
import { useUser } from "~/routes/layout";
import { percent } from "~/lib/scheduler";

export const useAllWords = routeLoader$(async (ev) => {
  const { results } = await getDB(ev)
    .prepare("SELECT * FROM words ORDER BY en COLLATE NOCASE")
    .all<Word>();
  return results;
});

// Gli input dei form arrivano come stringhe: z.coerce.number() li converte
const id = z.coerce.number().int().positive();

export const useUpdateWord = routeAction$(
  async ({ id, en, it }, ev) => {
    await requireUser(ev);
    await getDB(ev).prepare("UPDATE words SET en = ?, it = ? WHERE id = ?").bind(en, it, id).run();
  },
  zod$({ id, en: z.string().trim().min(1), it: z.string().trim().min(1) }),
);

export const useSetVisible = routeAction$(
  async ({ id, visible }, ev) => {
    await requireUser(ev);
    await getDB(ev).prepare("UPDATE words SET visible = ? WHERE id = ?").bind(visible, id).run();
  },
  zod$({ id, visible: z.coerce.number().int().min(0).max(1) }),
);

export const useDeleteWord = routeAction$(
  async ({ id }, ev) => {
    await requireUser(ev);
    await getDB(ev).prepare("DELETE FROM words WHERE id = ?").bind(id).run();
  },
  zod$({ id }),
);

export default component$(() => {
  const words = useAllWords();
  const user = useUser();
  const query = useSignal("");

  // Come useMemo: si ricalcola solo quando cambiano words o query
  const filtered = useComputed$(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return words.value;
    return words.value.filter(
      (w) => w.en.toLowerCase().includes(q) || w.it.toLowerCase().includes(q),
    );
  });

  const totals = useComputed$(() => {
    const list = words.value;
    const shown = list.reduce((s, w) => s + w.shown, 0);
    const correct = list.reduce((s, w) => s + w.correct, 0);
    return {
      all: list.length,
      visible: list.filter((w) => w.visible).length,
      rate: percent({ shown, correct }),
    };
  });

  return (
    <section class="words">
      <div class="words-head">
        <h1>Parole</h1>
        <p class="count">
          {totals.value.all} in tutto · {totals.value.visible} visibili · {totals.value.rate} indovinate
        </p>
      </div>

      <input
        id="search"
        class="search"
        type="search"
        placeholder="Cerca in inglese o italiano"
        bind:value={query}
      />

      {filtered.value.length === 0 ? (
        <p class="muted">
          {words.value.length === 0
            ? "Ancora nessuna parola. Usa + Aggiungi in alto."
            : "Nessuna parola corrisponde alla ricerca."}
        </p>
      ) : (
        <ul class="word-list">
          {filtered.value.map((w) => (
            <WordRow key={w.id} word={w} canEdit={!!user.value} />
          ))}
        </ul>
      )}
    </section>
  );
});

/** Una riga: modalità lettura, modifica o conferma eliminazione */
const WordRow = component$<{ word: Word; canEdit: boolean }>(({ word, canEdit }) => {
  const mode = useSignal<"view" | "edit" | "delete">("view");
  const update = useUpdateWord();
  const setVisible = useSetVisible();
  const del = useDeleteWord();

  if (canEdit && mode.value === "edit") {
    return (
      <li class="word-row editing">
        <Form action={update} class="edit-form" onSubmitCompleted$={() => (mode.value = "view")}>
          <input type="hidden" name="id" value={word.id} />
          <label>
            <span>Inglese</span>
            <input id={`en-${word.id}`} name="en" value={word.en} required />
          </label>
          <label>
            <span>Italiano</span>
            <input id={`it-${word.id}`} name="it" value={word.it} required />
          </label>
          <div class="row-actions">
            <button type="button" class="btn btn-ghost" onClick$={() => (mode.value = "view")}>
              Annulla
            </button>
            <button type="submit" class="btn btn-primary">
              Salva
            </button>
          </div>
        </Form>
      </li>
    );
  }

  return (
    <li class={["word-row", { hidden: !word.visible }]}>
      <div class="pair">
        <span class="en">{word.en}</span>
        <span class="it">{word.it}</span>
      </div>
      <div class="stats">
        <span>mostrata {word.shown}</span>
        <span>indovinata {word.correct}</span>
        <span class="rate">{percent(word)}</span>
      </div>

      {!canEdit ? null : mode.value === "delete" ? (
        <div class="row-actions confirm">
          <span>Eliminare “{word.en}”?</span>
          <button class="btn btn-ghost" onClick$={() => (mode.value = "view")}>
            Annulla
          </button>
          <Form action={del}>
            <input type="hidden" name="id" value={word.id} />
            <button type="submit" class="btn btn-danger">
              Elimina
            </button>
          </Form>
        </div>
      ) : (
        <div class="row-actions">
          <Form action={setVisible} class="inline">
            <input type="hidden" name="id" value={word.id} />
            <input type="hidden" name="visible" value={word.visible ? 0 : 1} />
            <button
              type="submit"
              class="switch"
              role="switch"
              aria-checked={!!word.visible}
              title={word.visible ? "Nascondi dalle carte" : "Mostra nelle carte"}
            >
              <span class="knob" />
              <span class="switch-label">{word.visible ? "Visibile" : "Nascosta"}</span>
            </button>
          </Form>
          <button class="btn btn-ghost" onClick$={() => (mode.value = "edit")}>
            Modifica
          </button>
          <button class="btn btn-ghost danger-text" onClick$={() => (mode.value = "delete")}>
            Elimina
          </button>
        </div>
      )}
    </li>
  );
});

export const head: DocumentHead = {
  title: "Parole · Vocaboli",
};
