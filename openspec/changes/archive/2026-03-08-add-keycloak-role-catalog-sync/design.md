## Context

Die aktuelle IAM-Implementierung kann Rollen im Studio verwalten und Nutzerrollen nach Keycloak zuweisen, setzt jedoch voraus, dass Zielrollen in Keycloak bereits existieren. Das widerspricht dem Ziel, das Studio als zentrale IAM-Oberfläche ohne manuelle Keycloak-UI-Nutzung zu betreiben.

## Goals / Non-Goals

- Goals:
  - Studio-Rollenverwaltung wird führend für den Rollen-Lebenszyklus.
  - Konsistentes Mapping zwischen `iam.roles` und Keycloak Realm Roles.
  - Drift-Erkennung und kontrollierte Heilung bei Inkonsistenzen.
  - Sichtbarer Sync-Zustand für Admins im Studio.
- Non-Goals:
  - Verwaltung von Keycloak Clients, Gruppen, Policies oder Flows.
  - Vollständiger Ersatz der Keycloak-Administration für nicht-IAM-Features.
  - Cross-Realm-Synchronisierung.

## Decisions

- Decision: IAM-Datenbank bleibt Source of Truth für Studio-verwaltete Rollen.
  - Rationale: Rollenmodell und Berechtigungsmatrix werden bereits im Studio gepflegt.
- Decision: Role-Catalog-Sync wird über die IdP-Abstraktionsschicht (ADR-016) umgesetzt; Keycloak ist ein konkreter Adapter.
  - Rationale: Reduziert direkte Anbieterkopplung und hält die Architektur austauschbar.
- Decision: Write-Operationen folgen Keycloak-First mit Compensation.
  - Rationale: Verhindert „erfolgreich in UI, fehlt im IdP“-Zustände bei synchronen Admin-Operationen.
- Decision: Reconciliation ergänzt den synchronen Pfad als Sicherheitsnetz.
  - Rationale: Netzwerkfehler, Timeouts oder externe manuelle Keycloak-Änderungen erzeugen sonst dauerhaft Drift.
- Decision: Rolle erhält stabilen technischen Schlüssel (`role_key`) und getrennten Anzeigenamen.
  - Rationale: Vermeidet instabile externe Referenzen bei UI-Umbenennungen.
- Decision: `role_key` ist nach Erstellung unveränderlich; editierbar ist nur `display_name`.
  - Rationale: Verhindert Identitätswechsel durch Umbenennung und schützt Zuordnungen.
- Decision: Managed-Scope wird deterministisch über `managed_by = "studio"` und `instance_id` bestimmt.
  - Rationale: Verhindert Eingriffe in fremdverwaltete Keycloak-Rollen.
- Decision: Orphaned, studio-verwaltete Keycloak-Rollen werden standardmäßig `report-only` behandelt; Löschung erfolgt nur explizit per Admin-Freigabe.
  - Rationale: Minimiert Risiko unbeabsichtigter destruktiver Reconcile-Eingriffe.
- Decision: `POST /api/v1/iam/admin/reconcile` ist eine privilegierte Admin-Operation mit serverseitigem RBAC-Enforcement (`system_admin`).
  - Rationale: UI-only-Gates reichen für Sicherheitsgrenzen nicht aus.
- Decision: Für produktive Umgebungen gilt ein Drift-SLO (`Erkennung <= 15 min`, `Korrektur oder Eskalation <= 60 min`).
  - Rationale: Macht Drift-Betrieb messbar und alarmierbar.
- Decision: Serverseitige Role-Sync-/Reconcile-Logs nutzen verpflichtend den SDK-Logger (`@sva/sdk`) mit strukturierten Feldern; `console.*` ist ausgeschlossen.
  - Rationale: Einheitliche Observability, bessere Korrelation und Einhaltung der Logging-Guidelines.
- Decision: Audit- und Fehlerdaten sind datensparsam (`No-PII`, `No-Secret`) und enthalten Korrelation (`request_id`, optional `trace_id`/`span_id`).
  - Rationale: Sicheres Debugging ohne Preisgabe sensibler Informationen.

## Risks / Trade-offs

- Höhere Abhängigkeit von Keycloak-Verfügbarkeit bei Rollen-CRUD.
  - Mitigation: Circuit-Breaker, Retry, sichtbarer `syncState`, Reconcile-Job.
- Zusätzliche Komplexität in API und Datenmodell.
  - Mitigation: klare Trennung Sync-Orchestrierung vs. Persistenz, hohe Testabdeckung.
- Risiko versehentlicher Änderung von nicht-studioverwalteten Keycloak-Rollen.
  - Mitigation: strikter Managed-Scope über Mapping und eindeutige Kennzeichnung.

## Migration Plan

1. Schema erweitern und bestehende Rollen initial mappen.
2. Keycloak-Role-CRUD im Admin-Client ergänzen.
3. Rollen-Endpunkte schrittweise auf Sync-Orchestrierung umstellen.
4. Reconciliation aktivieren und vorhandenen Drift bereinigen.
5. UI-Sync-Status und Admin-Retry ausrollen.

## Open Questions

- Welche initialen Alert-Schwellen sollen für Warnung/Kritisch in Produktion gelten?
