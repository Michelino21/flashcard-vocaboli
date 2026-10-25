# Qwik per chi viene da React

Concetti chiave, con esempi presi da questo progetto. Versione usata: Qwik 1.20 (stabile).

## 1. L'idea di fondo: resumability, non hydration

React manda l'HTML e poi riesegue **tutti** i componenti nel browser per "agganciare" gli eventi (hydration).
Qwik manda l'HTML **più lo stato serializzato** (lo vedi in `<script type="qwik/json">`) e non esegue nulla al caricamento. Il JS di un handler si scarica ed esegue solo quando lo usi, per esempio al primo click su "Gira la carta".

Conseguenze pratiche:
- Il corpo di un componente gira di solito **sul server**. Nel browser riparte solo se cambia uno stato che usa.
- Tutto ciò che passa dal server al client deve essere **serializzabile**: dati, signal, store, Date, URL… ma niente classi custom, funzioni normali o nodi DOM.

## 2. Il `$` è un confine di caricamento

Ogni cosa che finisce con `$` (`component$`, `onClick$`, `useTask$`, `$()`) è un punto in cui l'optimizer taglia il codice in un file separato che si carica a richiesta.

```tsx
export default component$(() => { … })        // al posto di function Component()
<button onClick$={() => (state.flipped = true)}> // al posto di onClick
const next = $(() => { … })                    // funzione che puoi passare/salvare
```

**La regola che ti farà inciampare:** una closure dentro `$` può usare solo valori serializzabili (signal, store, primitivi) oppure cose importabili (funzioni a livello di modulo).

```tsx
// ❌ errore: funzione locale catturata dentro $()
const chooseDir = (m) => …;
const next = $(() => chooseDir(mode.value));

// ✅ funzione a livello di modulo (vedi src/routes/index.tsx)
function chooseDir(m: Mode): Dir { … }
```

## 3. Stato

| React | Qwik | Note |
|---|---|---|
| `useState(0)` | `useSignal(0)` | leggi e scrivi `sig.value`, non c'è setter |
| `useState({…})` / `useReducer` | `useStore({…})` | reattivo in profondità: muti direttamente `state.session.ok++` |
| `useMemo(fn, deps)` | `useComputed$(fn)` | niente array di dipendenze, le traccia da solo |
| `useRef()` sul DOM | `useSignal<HTMLElement>()` + `ref={sig}` | |
| `useContext` | `createContextId` / `useContextProvider` / `useContext` | stessa idea |

La reattività è fine: cambiando `state.flipped` si aggiorna solo la parte di DOM che lo legge, non tutto il componente. Niente stale closures e niente `useCallback`.

## 4. Effetti

- **`useTask$`**: gira prima del render, **sia sul server sia sul client**. Le dipendenze si dichiarano con `track()`:
  ```tsx
  useTask$(({ track }) => {
    const fresh = track(() => words.value);   // riparte quando cambia il loader
    state.list = fresh.map((w) => ({ ...w }));
  });
  ```
  Ritorna una funzione di cleanup, come `useEffect`.
- **`useVisibleTask$`**: gira solo nel browser, quando il componente diventa visibile. È l'equivalente di `useEffect` per toccare il DOM, `window` o `localStorage`. Usalo con parsimonia, perché forza il download di JS all'avvio.
- Nel corpo del componente **non usare `window`/`document`**, perché gira sul server. Se serve, usa `isBrowser` da `@builder.io/qwik/build`.

## 5. JSX: differenze che noterai subito

- `class`, non `className`. Accetta anche array/oggetti: `class={["card", { flipped: state.flipped }]}`.
- Gli eventi hanno il `$`: `onClick$`, `onInput$`, `onSubmit$`.
- Gli handler sono asincroni (si caricano al volo), quindi `e.preventDefault()` arriva tardi. Si dichiara nell'attributo: `<a preventdefault:click onClick$={…}>`.
- Two-way binding: `<input bind:value={query} />` (vedi pagina Parole).
- I figli si passano con `<Slot />` al posto di `props.children` (vedi `layout.tsx`).
- `key` nelle liste come in React.

## 6. Dati e server (Qwik City ≈ Next/Remix)

Il codice dentro questi tre blocchi **non arriva mai al browser**, quindi è qui che si usa il database.

**`routeLoader$`**: legge i dati prima del render (come il `loader` di Remix). Va esportato da `index.tsx` o `layout.tsx`.
```tsx
export const useWords = routeLoader$(async (ev) => getDB(ev).prepare("SELECT …").all());
// nel componente:
const words = useWords();   // words.value
```

**`routeAction$` + `<Form>`**: le mutazioni. Funziona anche con JS disattivato. Dopo il submit, **ricarica da sola i loader**: per questo una parola aggiunta compare subito. La validazione si fa con `zod$`.
```tsx
export const useDeleteWord = routeAction$(async ({ id }, ev) => { … }, zod$({ id: z.coerce.number() }));
<Form action={del}> <input type="hidden" name="id" value={word.id} /> … </Form>
```
`action.isRunning`, `action.value?.fieldErrors` e `onSubmitCompleted$` coprono stato di caricamento ed errori.

**`server$`**: RPC, cioè una funzione server che chiami dal browser come una normale `async`. Non ricarica i loader, e qui serve proprio questo: salvare una risposta senza ridisegnare la pagina. Dentro, `this` è la request (con `this.platform.env.DB`).
```tsx
const recordAnswer = server$(async function (id: number, ok: boolean) { await getDB(this)… });
```

**Su Cloudflare** i binding (D1, KV, R2, variabili) stanno in `ev.platform.env`, oppure in `this.platform.env` dentro `server$`.

## 7. Routing

- È basato sui file: `src/routes/index.tsx` → `/`, `src/routes/parole/index.tsx` → `/parole/`. Parametri con `[id]/index.tsx` e `useLocation().params.id`.
- `layout.tsx` avvolge le pagine figlie tramite `<Slot />`.
- Per i link si usa `<Link href>`, la navigazione da codice si fa con `useNavigate()`, l'URL corrente con `useLocation()`.
- Middleware: esporta `onRequest` / `onGet` / `onPost` da una route (qui `layout.tsx` imposta `Cache-Control: no-store`).
- Titolo e meta: `export const head: DocumentHead = { title: "…" }`.

## 8. Regole che valgono come in React

- Gli hook `use…` stanno in cima al componente, mai dentro `if` o cicli. Un `return` anticipato **dopo** gli hook va bene.
- I componenti sono funzioni pure del loro stato.

## 9. Cose utili

- `npm run qwik add`: integrazioni pronte (Tailwind, adapter, auth…).
- Librerie React: puoi riusarle con `qwikify$` da `@builder.io/qwik-react`, ma perdi i vantaggi di Qwik. Va bene come ponte, non come base.
- Per un oggetto non serializzabile (istanza di una libreria, ecc.) dentro uno store, usa `noSerialize(obj)`. Esisterà solo nel browser.
- In `.vscode/` trovi snippet Qwik pronti (scrivi `qcomponent$`, `quseSignal`, `qloader$`… in un file .tsx) e l’estensione consigliata.
- **Qwik 2** è in release candidate: i pacchetti cambiano nome (`@qwik.dev/core`, `@qwik.dev/router`) ma i concetti qui sopra restano gli stessi.

Documentazione: https://qwik.dev/docs/
