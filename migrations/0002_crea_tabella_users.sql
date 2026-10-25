-- Utenti che possono modificare i dati. Si creano a mano: npm run user:add -- nome
CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  username  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password  TEXT NOT NULL               -- hash pbkdf2$iterazioni$salt$hash, mai in chiaro
);
