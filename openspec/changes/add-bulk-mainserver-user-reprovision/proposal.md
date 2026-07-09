# Change: Bulk-Reprovision für Mainserver-Benutzerdaten

## Why
Die Benutzerverwaltung unterstützt die Aktualisierung von Mainserver-Daten bislang nur pro Einzelkonto. Für Admins fehlt ein effizienter Sammel-Flow für explizit markierte Nutzer.

## What Changes
- Neue Bulk-Action `Mainserver-Daten aktualisieren` in `/admin/users`
- Neuer IAM-Endpunkt `POST /api/v1/iam/users/bulk-reprovision-mainserver` mit Idempotency-Key und Teil-Erfolgsvertrag
- Auditierbarer Bulk-Flow mit deterministischen Fehlercodes pro Zielnutzer

## Impact
- Affected specs: `account-ui`, `iam-core`, `iam-auditing`
- Affected code: `apps/sva-studio-react`, `packages/auth-runtime`, `packages/iam-admin`, `packages/routing`
- Affected arc42 sections: `06-runtime-view`
