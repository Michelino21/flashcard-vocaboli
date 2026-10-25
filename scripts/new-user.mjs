// Crea (o aggiorna la password di) un utente nel D1.
//   npm run user:add:local -- nome     (database locale)
//   npm run user:add -- nome           (database remoto)
// La password si digita nel terminale, senza che compaia a schermo.
import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";

// Formato letto da src/lib/auth.ts. Il Worker accetta al massimo 100000 iterazioni
// e sul piano gratuito ha ~10 ms di CPU a richiesta: 50000 ci sta con margine.
const ITERATIONS = 50_000;

const remote = process.argv.includes("--remote");
if (!remote && !process.argv.includes("--local")) {
  console.error("Specifica --local oppure --remote.");
  process.exit(1);
}
const username = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!username || !/^[A-Za-z0-9_.-]{1,32}$/.test(username)) {
  console.error("Uso: node scripts/new-user.mjs <nome> --local|--remote");
  console.error("Il nome può avere solo lettere, numeri, . _ - (max 32).");
  process.exit(1);
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\u007f") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await askHidden("Password: ");
if (password.length < 8) {
  console.error("Usa almeno 8 caratteri.");
  process.exit(1);
}
if (password !== (await askHidden("Ripeti la password: "))) {
  console.error("Le password non coincidono.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
const stored = `pbkdf2$${ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;

// nome e hash contengono solo caratteri sicuri (controllato sopra / base64)
const sql =
  `INSERT INTO users (username, password) VALUES ('${username}', '${stored}') ` +
  `ON CONFLICT(username) DO UPDATE SET password = excluded.password`;

execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "vocaboli", remote ? "--remote" : "--local", "--command", sql],
  { stdio: "inherit" },
);
console.log(`Utente "${username}" salvato (${remote ? "remoto" : "locale"}).`);
