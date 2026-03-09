## Context
Die Studio-Benutzerverwaltung nutzt IAM als führende Quelle für Listen- und Detailansichten. Keycloak ist führend für Authentifizierung und IdP-nahe User-Verwaltung. Extern in Keycloak angelegte Benutzer fehlen im Studio, solange kein JIT-Provisioning oder Studio-interner Create-Flow greift.

## Goals / Non-Goals
- Goals:
  - expliziter, nachvollziehbarer Importpfad von Keycloak nach IAM
  - keine automatische, versteckte Mutation bei jedem Listenaufruf
  - deterministische Zuordnung zum aktuellen `instanceId`-Kontext
- Non-Goals:
  - vollständige bidirektionale Synchronisierung aller Keycloak-Felder
  - automatische periodische Background-Synchronisierung
  - Rollen-Mapping aus beliebigen externen Keycloak-Rollen ohne Studio-Bezug

## Decisions
- Decision: Der Sync wird als explizite Admin-Aktion in `/admin/users` umgesetzt.
  - Why: vermeidet Seiteneffekte auf reine Lese-Requests und hält Audit/Fehlerbilder verständlich.
- Decision: Importiert werden nur Keycloak-User, die über ein `instanceId`-Attribut dem aktuellen Studio-Kontext entsprechen.
  - Why: verhindert Cross-Instance-Leaks und bleibt mit bestehender Multi-Tenant-Logik konsistent.
- Decision: Der Sync arbeitet als idempotenter Upsert in `iam.accounts` plus `iam.instance_memberships`.
  - Why: wiederholte Läufe sollen sicher sein und bestehende Accounts nur aktualisieren, nicht duplizieren.

## Risks / Trade-offs
- Manuell in Keycloak angelegte Benutzer ohne `instanceId`-Attribut werden nicht importiert.
  - Mitigation: klare Fehlermeldung/Ergebnisanzeige im Sync-Report.
- Externe Datenqualität in Keycloak kann unvollständig sein.
  - Mitigation: Display-Name-Fallbacks und defensive Feldableitung wie im bestehenden IAM-Modell.

## Migration Plan
1. Optionales IAM-Feld für importierte Benutzerbasisdaten vervollständigen.
2. Keycloak-User-Liste lesen und nach `instanceId` filtern.
3. Idempotenten Upsert nach IAM implementieren.
4. Admin-UI-Aktion inkl. Ergebnisanzeige anbinden.

## Open Questions
- Soll der Sync nur aktive Keycloak-User importieren oder auch deaktivierte/pending Nutzer zeigen?
- Brauchen wir mittelfristig zusätzlich einen Hintergrundjob statt nur einer Admin-Aktion?
