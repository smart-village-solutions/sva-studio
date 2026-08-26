# Change: DataProvider-Konflikte gelöschter Benutzer automatisch auflösen

## Why

Eine einmal konfliktbehaftete persönliche Mainserver-DataProvider-Bindung bleibt derzeit dauerhaft `conflict`, selbst wenn der konkurrierende Studio-Account endgültig gelöscht wurde. Dadurch blockiert eine historische, nicht mehr handlungsfähige Principal-Zuordnung weiterhin alle Mutationen des einzigen verbleibenden aktiven Benutzers. Die Account-Löschung darf die Evidenz nicht entfernen, soll aber einen eindeutig auflösbaren Konflikt auch nicht dauerhaft betriebswirksam halten.

## What Changes

- Der bestehende serverseitige Identity-Guard darf einen DataProvider-Konflikt anlassbezogen im selben Mutationsrequest selbst heilen.
- Automatische Auflösung ist ausschließlich zulässig, wenn der aktuelle Benutzer aktiv ist und sämtliche konkurrierenden aktuellen Bindungen zu endgültig gelöschten oder nicht mehr vorhandenen Benutzer-Accounts derselben Instanz gehören.
- Historische Bindungsevidenz bleibt erhalten und wird auf `historical` gesetzt; `revoked` wird ohne bestätigten externen Credential-Widerruf nicht behauptet.
- Die aktuelle Credential-Version wird über den authentifizierten Identity-Endpunkt bestätigt und in derselben Datenbanktransaktion als `verified` markiert.
- Bei aktiven, gesperrten, vorläufig gelöschten, organisatorischen oder anderweitig unklaren konkurrierenden Principals bleibt der Konflikt unverändert fail-closed.
- Der ursprüngliche Speichervorgang läuft nach erfolgreicher Auflösung ohne zusätzlichen UI-Schritt weiter. Es entstehen keine neue Oberfläche, kein Scheduler und keine Queue.
- Auflösung und Ablehnung werden PII- und secret-minimiert beobachtbar und auditierbar.

## Non-Goals

- Keine automatische Auflösung zwischen mehreren aktiven Principals.
- Keine Wiederherstellung, Zusammenführung oder externe Übernahme von Benutzeridentitäten.
- Kein Mainserver-Credential-Widerruf und keine Behauptung, dass historische Credentials extern ungültig sind.
- Keine Änderung am separaten `local_user_conflict`-Rebind-Vorschlag.
- Keine manuelle Datenbankreparatur und keine neue Admin-UI.

## Impact

- Affected specs: `sva-mainserver-integration`, `iam-auditing`
- Affected code: `packages/auth-runtime`, `packages/sva-mainserver`
- Affected docs: `docs/development/studio-db-schema.md`, `docs/guides/mainserver-data-provider-authoring.md`, relevante arc42-Abschnitte
- Affected arc42 sections: `06-runtime-view`, `08-cross-cutting-concepts`, `11-risks-and-technical-debt`
- Database schema: keine neue Tabelle oder Spalte; vorhandene Statuswerte `conflict`, `historical` und `verified` werden verwendet
