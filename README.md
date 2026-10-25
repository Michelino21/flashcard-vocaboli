# Flashcard vocaboli

Flashcard inglese ↔ italiano per i vocaboli dei libri che leggo.
Qwik City, gira su Cloudflare Workers, e il database è D1 (SQLite).

## Cosa fa

- **Studia** (`/`): mostra una carta, la tocchi e si gira. Poi rispondi con *L'ho indovinata* o *Non la sapevo*. Puoi scegliere la direzione: EN → IT, IT → EN o Misto.
- **Parole** (`/parole/`): l'elenco completo con le statistiche. Puoi cercare, modificare, eliminare e rendere una parola visibile o nascosta.
- **+ Aggiungi**: un form sempre a portata di mano, in qualsiasi pagina.

Le parole sbagliate escono più spesso. Il peso di estrazione è `0.2 + 4·(1 − p)²`, dove `p = (indovinate+1)/(mostrate+2)`. Una parola nuova vale 1.2, una sempre sbagliata arriva verso 4, una imparata scende verso 0.2 (ma ogni tanto torna). La logica sta in `src/lib/scheduler.ts`.

## Struttura

```
migrations/0001_crea_tabella_words.sql  schema della tabella words
seed.sql                                8 parole di esempio (facoltative)
wrangler.jsonc                          config del Worker + binding D1 "DB"
src/lib/db.ts                           tipo Word e getDB()
src/lib/scheduler.ts                    estrazione pesata delle carte
src/routes/layout.tsx                   barra in alto + action "Aggiungi"
src/routes/index.tsx                    pagina Studia (loader + server$)
src/routes/parole/index.tsx             elenco con modifica/elimina/visibilità
src/global.css                          stile (tema chiaro e scuro)
```

Tabella `words`: `id`, `en`, `it`, `shown`, `correct`, `visible` (0/1).

## Sviluppo in locale

```bash
npm install
npm run db:migrate:local     # crea la tabella nel D1 locale (.wrangler/)
npm run db:seed:local        # facoltativo: parole di esempio
npm run dev                  # http://localhost:5173
```

In `npm run dev` Vite usa il D1 locale grazie a `getPlatformProxy()` di wrangler (vedi `vite.config.ts`). Per provare la build vera del Worker: `npm run build && npm run serve`.

## Pubblicare su Cloudflare

```bash
npx wrangler login
npx wrangler d1 create vocaboli   # copia il database_id in wrangler.jsonc
npm run db:migrate                # crea la tabella sul D1 remoto
npm run deploy                    # build + wrangler deploy
```

Il sito risponde su `https://flashcard-vocaboli.<tuo-account>.workers.dev`. Se cambi i binding in `wrangler.jsonc`, rigenera i tipi con `npm run cf-typegen`.

## Da sapere

- **Non c'è login**: chiunque abbia l'URL può modificare le parole. Per tenerlo privato, proteggilo con Cloudflare Access (Zero Trust → Access → Applications), che è gratis fino a 50 utenti.
- Il file `src/entry.cloudflare-pages.tsx` si chiama così anche se usiamo i Workers, perché l'adapter di Qwik è lo stesso. Non va rinominato.
- Per modificare lo schema crea `migrations/0002_….sql` e rilancia `db:migrate:local` / `db:migrate`. Non modificare la 0001 già applicata.

Per capire Qwik partendo da React: [qwikguide.md](./qwikguide.md).
