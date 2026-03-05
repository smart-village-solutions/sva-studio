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
- Decision: Write-Operationen folgen Keycloak-First mit Compensation.
  - Rationale: Verhindert „erfolgreich in UI, fehlt im IdP“-Zustände bei synchronen Admin-Operationen.
- Decision: Reconciliation ergänzt den synchronen Pfad als Sicherheitsnetz.
  - Rationale: Netzwerkfehler, Timeouts oder externe manuelle Keycloak-Änderungen erzeugen sonst dauerhaft Drift.
- Decision: Rolle erhält stabilen technischen Schlüssel (`role_key`) und getrennten Anzeigenamen.
  - Rationale: Vermeidet instabile externe Referenzen bei UI-Umbenennungen.

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

- Soll Reconciliation orphaned, studioverwaltete Keycloak-Rollen automatisch löschen oder nur melden?
- Soll eine Umbenennung des technischen `role_key` erlaubt sein oder nur `display_name`?
- Welche SLOs gelten für maximale Drift-Dauer in produktiven Umgebungen?
