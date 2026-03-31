# Change: Rechtstexte auf fachliches Inhaltsmodell mit HTML-Editor erweitern

## Why
Die aktuelle Rechtstext-Verwaltung bildet nur technische Metadaten wie technische ID, Version, Locale, Prüfsumme und Aktiv-Flag ab. Für die fachliche Pflege werden jedoch benannte Rechtstexte mit HTML-Inhalt, Statusmodell und vollständigen Zeitstempeln benötigt.

## What Changes
- Erweitert das Rechtstext-Datenmodell um automatisch vergebene UUID, fachlichen Namen, HTML-Inhalt, Änderungsdatum und expliziten Status `draft`, `valid`, `archived`
- Passt API, Contracts und Persistenz für serverseitig gespeicherten HTML-Inhalt an
- Ersetzt die bisherige Prüfsummen-/Aktiv-Orientierung der Admin-UI durch eine fachliche Detailansicht mit Rich-Text-Editor
- Entfernt irreführende UI-Hinweise, dass der Textkörper nicht serverseitig gespeichert werde
- Hält die bestehende Package-Architektur strikt ein: UI-spezifische Editor-Logik bleibt in der App, serialisierbare Fachdaten in `packages/core`, Persistenz und HTML-Validierung in `packages/auth`

## Impact
- Affected specs: `account-ui`, `iam-core`
- Affected code: `apps/sva-studio-react/src/routes/admin/legal-texts/*`, `apps/sva-studio-react/src/hooks/use-legal-texts*`, `apps/sva-studio-react/src/lib/iam-api.ts`, `packages/core/src/iam/account-management-contract.ts`, `packages/auth/src/iam-legal-texts*`, `packages/data/migrations/*`, `docs/api/iam-v1.yaml`, `docs/guides/iam-authorization-api-contract.md`
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`, `docs/architecture/08-cross-cutting-concepts.md`
