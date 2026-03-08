# Verifikationsbericht: IAM-Organisationsverwaltung

## Kontext

Dieser Bericht dokumentiert die technischen Nachweise für den Change `add-iam-organization-management-hierarchy` mit Schwerpunkt auf Organisationsverwaltung, Membership-Metadaten und sessionbasiertem Org-Kontext.

## Ausgeführte Prüfungen

### Unit- und Typtests

- `pnpm nx run auth:test:unit`
  - Ergebnis: grün
  - Fokus: IAM-Handler, Negativpfade für CSRF, instanzfremde Org-Kontexte, Hierarchie-Zyklen und Deaktivierungskonflikte
- `pnpm nx run data:test:unit`
  - Ergebnis: grün
- `pnpm nx run sva-studio-react:test:unit`
  - Ergebnis: grün
  - Fokus: Organisations-Admin-UI, Org-Switcher, Fehler- und Statuskommunikation
- `pnpm test:types`
  - Ergebnis: grün
- `pnpm test:eslint`
  - Ergebnis: grün
  - Hinweis: bestehende Repository-Warnungen bleiben unverändert, keine neuen Blocker durch diesen Change

### Coverage-Läufe

- `pnpm nx run auth:test:coverage`
  - Ergebnis: grün
  - Statements: `79.78%`
  - Branches: `65.5%`
  - Functions: `89.71%`
  - Lines: `79.55%`
- `pnpm nx run sva-studio-react:test:coverage`
  - Ergebnis: grün
  - Statements: `79.03%`
  - Branches: `68.81%`
  - Functions: `67.91%`
  - Lines: `79.42%`
- `pnpm nx run data:test:coverage`
  - Ergebnis: grün
  - Hinweis: `@sva/data` ist aktuell als `coverage-exempt` konfiguriert

### Migrations- und Seed-Nachweise

- `pnpm nx run data:db:migrate:validate`
  - Ergebnis: grün
  - Nachweis: `0009_iam_organization_management.sql` wurde erfolgreich in der Sequenz `up -> down -> up` validiert
- `pnpm nx run data:db:test:seeds`
  - Ergebnis: grün
  - Nachweis: Seed-Idempotenz erfolgreich
  - Beobachtete Kennzahlen:
    - `organization count: 3`
    - `account organizations: 10`
    - `default organization contexts: 7`

## Abgedeckte Qualitäts- und Risikopfade

- Instanzfremde Org-Kontextwechsel werden serverseitig abgewiesen.
- Org-Kontextwechsel ohne gültigen CSRF-Contract werden serverseitig abgewiesen.
- Hierarchie-Zyklen in Organisationsupdates liefern deterministische Konfliktantworten.
- Deaktivierung von Organisationen mit aktiven Children oder Memberships bleibt fail-closed.
- Der Org-Switcher zeigt den aktiven Kontext über eine Live-Region an und rendert internationalisierte Fehlermeldungen bei Ablehnung.

## Rollback-Nachweis

Der Rollback-Pfad für das Datenmodell ist durch `pnpm nx run data:db:migrate:validate` explizit nachgewiesen. Der Lauf validiert die Change-Migration als Paar aus Up- und Down-Migration und bestätigt damit die Rückführbarkeit des Schemas für den ersten Schnitt.

## Einschränkungen

- Für `@sva/data` existiert weiterhin kein vollwertiger Coverage-Report, weil das Projekt bewusst als `coverage-exempt` markiert ist.
- Responsive-Verhalten für 320 px, 768 px und 1024 px ist über die spezifizierten UI-Leitplanken und bestehende Komponentenstruktur abgesichert; ein dedizierter visueller E2E-Nachweis ist nicht Teil dieses Berichts.
