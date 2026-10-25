import { component$, Slot, useSignal } from "@builder.io/qwik";
import {
  Form,
  Link,
  routeAction$,
  routeLoader$,
  useLocation,
  z,
  zod$,
  type RequestHandler,
} from "@builder.io/qwik-city";
import { clearSession, getUser, requireUser } from "~/lib/auth";
import { getDB } from "~/lib/db";

/** I dati cambiano a ogni risposta: niente cache sulle pagine */
export const onRequest: RequestHandler = ({ headers }) => {
  headers.set("Cache-Control", "no-store");
};

/** Utente loggato (o null): lo leggono layout e pagine per mostrare/nascondere i comandi di modifica */
export const useUser = routeLoader$((ev) => getUser(ev));

export const useLogout = routeAction$((_, ev) => {
  clearSession(ev);
});

/**
 * Action per aggiungere una parola. Sta nel layout così il form
 * "Aggiungi" funziona da qualsiasi pagina. Dopo il submit Qwik City
 * ricarica da solo i routeLoader$ della pagina, quindi la nuova
 * parola compare subito nelle carte e nell'elenco.
 */
export const useAddWord = routeAction$(
  async ({ en, it }, ev) => {
    await requireUser(ev);
    await getDB(ev)
      .prepare("INSERT INTO words (en, it) VALUES (?, ?)")
      .bind(en, it)
      .run();
    return { added: en };
  },
  zod$({
    en: z.string().trim().min(1, "Scrivi la parola inglese"),
    it: z.string().trim().min(1, "Scrivi la traduzione"),
  }),
);

export default component$(() => {
  const loc = useLocation();
  const addOpen = useSignal(false);
  const add = useAddWord();
  const user = useUser();
  const logout = useLogout();
  const enInput = useSignal<HTMLInputElement>();

  return (
    <div class="shell">
      <header class="topbar">
        <Link href="/" class="brand">
          Vocaboli
        </Link>
        <nav class="tabs" aria-label="Sezioni">
          <Link href="/" aria-current={loc.url.pathname === "/" ? "page" : undefined}>
            Studia
          </Link>
          <Link
            href="/parole/"
            aria-current={loc.url.pathname.startsWith("/parole") ? "page" : undefined}
          >
            Parole
          </Link>
        </nav>
        {user.value ? (
          <>
            <button
              class="btn btn-primary"
              aria-expanded={addOpen.value}
              onClick$={() => {
                addOpen.value = !addOpen.value;
                // aspetta il render e poi metti il cursore sul primo campo
                if (addOpen.value) setTimeout(() => enInput.value?.focus(), 0);
              }}
            >
              {addOpen.value ? "Chiudi" : "+ Aggiungi"}
            </button>
            <Form action={logout}>
              <button class="btn btn-ghost" type="submit" title={`Collegato come ${user.value.username}`}>
                Esci
              </button>
            </Form>
          </>
        ) : (
          !loc.url.pathname.startsWith("/login") && (
            <Link href="/login/" class="btn btn-primary">
              Accedi
            </Link>
          )
        )}
      </header>

      {user.value && addOpen.value && (
        <Form
          action={add}
          class="add-panel"
          spaReset
          onSubmitCompleted$={() => {
            if (!add.value?.failed) enInput.value?.focus();
          }}
        >
          <label>
            <span>Inglese</span>
            <input id="add-en" name="en" ref={enInput} autoComplete="off" autoCapitalize="off" required />
            {add.value?.fieldErrors?.en && <small class="err">{add.value.fieldErrors.en}</small>}
          </label>
          <label>
            <span>Italiano</span>
            <input id="add-it" name="it" autoComplete="off" autoCapitalize="off" required />
            {add.value?.fieldErrors?.it && <small class="err">{add.value.fieldErrors.it}</small>}
          </label>
          <button class="btn btn-primary" type="submit" disabled={add.isRunning}>
            {add.isRunning ? "Salvo…" : "Salva"}
          </button>
          {add.value?.added && !add.isRunning && (
            <p class="ok" role="status">Aggiunta: {add.value.added}</p>
          )}
        </Form>
      )}

      <main>
        <Slot />
      </main>
    </div>
  );
});
