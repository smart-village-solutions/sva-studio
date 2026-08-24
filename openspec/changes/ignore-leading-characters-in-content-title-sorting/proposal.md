# Change: Führende Sonderzeichen bei der Inhaltstitel-Sortierung ignorieren

## Why

Inhaltstitel mit führenden Anführungszeichen oder anderen rein dekorativen Zeichen werden derzeit vor alphabetisch gleichlautenden Titeln einsortiert. Dadurch entspricht die Reihenfolge der Inhaltsübersicht nicht der erwarteten alphabetischen Ordnung nach dem lesbaren Titel.

## What Changes

- Die serverseitige Sortierung nach `title` ignoriert ausschließlich führende Leer-, Satz- und Symbolzeichen bis zum ersten Buchstaben oder zur ersten Ziffer.
- Zeichen innerhalb oder am Ende eines Titels bleiben Bestandteil des Vergleichswerts.
- Anzeige, Speicherung und Suche des Titels bleiben unverändert.
- Die bestehende globale Reihenfolge `Berechtigungsumfang → Filterung → Sortierung → Pagination` sowie `ID asc` als stabiler Tie-Breaker bleiben erhalten.
- Andere Textspalten und Sortierfelder bleiben unverändert.

## Impact

- Affected specs: `content-management`
- Affected code: `packages/auth-runtime/src/iam-contents/repository.ts` und zugehörige Tests
- Affected arc42 sections: keine; die Änderung konkretisiert einen bestehenden Sortiervertrag innerhalb des vorhandenen Inhaltslisten-Read-Models
- Datenmigration: keine

