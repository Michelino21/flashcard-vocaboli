-- Tabella dei vocaboli
CREATE TABLE IF NOT EXISTS words (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  en       TEXT    NOT NULL,              -- parola inglese
  it       TEXT    NOT NULL,              -- traduzione italiana
  shown    INTEGER NOT NULL DEFAULT 0,    -- volte in cui la carta è stata mostrata
  correct  INTEGER NOT NULL DEFAULT 0,    -- volte in cui è stata indovinata
  visible  INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)) -- 1 = compare nelle carte
);
