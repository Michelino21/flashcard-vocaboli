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
migrations/                             schema: words (0001), users (0002)
scripts/new-user.mjs                    crea un utente (vedi Login)
seed.sql                                8 parole di esempio (facoltative)
wrangler.jsonc                          config del Worker + binding D1 "DB"
src/lib/db.ts                           tipo Word e getDB()
src/lib/scheduler.ts                    estrazione pesata delle carte
src/lib/auth.ts                         password, cookie di sessione, requireUser()
src/routes/login/index.tsx              pagina di accesso
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

## Login

Chiunque può vedere le carte e l'elenco delle parole. Solo chi ha fatto il login può segnare le risposte, aggiungere, modificare, nascondere ed eliminare parole.

- Gli utenti stanno nella tabella `users` (`id`, `username`, `password`). Non c'è registrazione: si creano da terminale, e la password si digita senza che compaia a schermo.
  ```bash
  npm run user:add:local -- nome   # D1 locale
  npm run user:add -- nome         # D1 remoto
  ```
  Rilanciarlo con lo stesso nome cambia la password. Per eliminare un utente: `npx wrangler d1 execute vocaboli --remote --command "DELETE FROM users WHERE username='nome'"`.
- La sessione è un cookie firmato (30 giorni), senza tabella delle sessioni. La chiave è il secret `SESSION_SECRET`:
  - in locale sta in `.dev.vars` (non committato): `SESSION_SECRET=<una stringa casuale lunga>`;
  - in produzione: `openssl rand -base64 32 | npx wrangler secret put SESSION_SECRET`.
  Cambiare il secret fa uscire tutti. Eliminare un utente dal DB chiude subito le sue sessioni.
- Le password sono salvate con PBKDF2-SHA256, 50000 iterazioni (il Worker ne accetta al massimo 100000 e sul piano gratuito ha circa 10 ms di CPU per richiesta).
- Non c'è un limite ai tentativi di accesso.

## Da sapere

- Il file `src/entry.cloudflare-pages.tsx` si chiama così anche se usiamo i Workers, perché l'adapter di Qwik è lo stesso. Non va rinominato.
- Per modificare lo schema crea `migrations/0002_….sql` e rilancia `db:migrate:local` / `db:migrate`. Non modificare la 0001 già applicata.

Per capire Qwik partendo da React: [qwikguide.md](./qwikguide.md).
