# Change: Sichtbarer Runtime-Healthcheck in der Studio-Shell

## Why
Produktive Fehleranalyse im Studio ist derzeit unnötig aufwendig, weil der Gesundheitszustand zentraler Abhängigkeiten wie Keycloak, Redis und Postgres zwar serverseitig geprüft wird, aber nicht dauerhaft in der Benutzeroberfläche sichtbar ist.

## What Changes
- Ergänzung einer dauerhaft sichtbaren Runtime-Health-Anzeige am Ende der Studio-Shell auf allen Studioseiten
- Erweiterung des bestehenden Readiness-Vertrags für eine UI-taugliche, stabile Gesundheitsdarstellung der relevanten Dienste
- Client-seitige Polling- und Fehlerbehandlung für den Health-Status in allen Environments
- Strukturierte Logs für fehlgeschlagene Health-Abfragen im Browser und auf dem Server

## Impact
- Affected specs: `ui-layout-shell`, `iam-core`
- Affected code: `apps/sva-studio-react/src/routes/__root.tsx`, `apps/sva-studio-react/src/components/AppShell.tsx`, neue Shell-Health-Komponente/Hooks, `packages/auth/src/iam-account-management/platform-handlers.ts`, zugehörige API-/Typdefinitionen
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `12-glossary`
