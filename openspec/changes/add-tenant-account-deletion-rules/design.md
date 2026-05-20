## Context

Das Studio besitzt bereits DSR-nahe Funktionen, Audit-Logging und ein tab-basiertes IAM-Cockpit, aber noch kein tenantbezogenes Löschkonzept für inaktive Accounts. Für diesen Change muss ein eigenständiges Regelmodul beschrieben werden, das Tenant-Admins konfigurieren können und das Self-Service, Berechtigungen und Auditspur konsistent ergänzt.

## Goals / Non-Goals

- Goals:
  - Tenantweite Default-Regeln für Account-Deaktivierung, Pseudonymisierung und finalen Tombstone-Soft-Delete
  - Transparente Anzeige der Regeln in Admin- und Self-Service-Oberflächen
  - Ein per-Account-Override für die Behandlung eigener Inhalte in `iam.contents`
  - Explizite tenantgebundene Permissions und Audit-Events für Regelpflege und Lifecycle-Ausführung
- Non-Goals:
  - Keine Unterstützung für Root-/Plattform-Admins ohne Tenant-Scope
  - Kein neues Aktivitäts- oder Telemetrie-Tracking-System
  - Keine physische Löschung von Accounts oder Inhalten in V1
  - Keine Inhaltsdomänen außerhalb von `iam.contents`

## Decisions

- Decision: Inaktivität wird in V1 ausschließlich aus `last_login_at` abgeleitet.
  - Rationale: Das vermeidet ein neues Aktivitäts-Tracking-System und hält den ersten Wurf fachlich klar.
  - Tenant-Scope: `last_login_at` wird gegen den Tenant-Account-Record beziehungsweise den aktiven Tenant-Mitgliedschaftskontext der betroffenen `instanceId` ausgewertet und nicht als globales Cross-Tenant-Inaktivitätssignal interpretiert.

- Decision: Tenant-Admins verwalten die Regeln in `/admin/iam?tab=deletion-rules`.
  - Rationale: Das Feature gehört in das bestehende IAM-Transparenz- und Governance-Cockpit und bleibt damit für Betreiber auffindbar.
  - Normative Baseline-Defaults/Fallbacks für neue oder noch nicht konfigurierte Tenants: `deactivateAfterDays=90`, `pseudonymizeAfterDays=180`, `deleteAfterDays=365`
  - UI-Verhalten für unkonfigurierte Tenants: Die Oberfläche zeigt diese Baseline-Defaults und die geerbte Default-Inhaltsstrategie als wirksamen Zustand; Speichern erzeugt oder aktualisiert eine explizite Tenant-Konfiguration.

- Decision: Der Lebenszyklus verwendet die Zustände `active`, `deactivated`, `pseudonymized` und `deleted`.
  - Rationale: Diese Zustände bilden die fachlichen Eskalationsstufen verständlich ab und trennen reversible Sperre von irreversibleren Datenschutzschritten.
  - Reaktivierungssemantik: `deactivated` wird nicht automatisch durch Login aufgehoben; eine Reaktivierung verlangt einen separaten Prozess. Ohne Reaktivierung dürfen spätere automatische Lifecycle-Stufen weiterhin greifen.

- Decision: `deleted` bleibt ein finaler Tombstone-Soft-Delete.
  - Rationale: Referenzintegrität, Auditierbarkeit und Compliance-Nachweise bleiben erhalten, ohne eine Hard-Delete-Kaskade zu verlangen.

- Decision: Die Inhaltsbehandlung in V1 beschränkt sich auf `iam.contents`, mit tenantweitem Default und per-Account-Override.
  - Rationale: Das reduziert Komplexität und schafft dennoch eine klare Nutzerentscheidung für die einzige unterstützte Inhaltsdomäne.
  - Normative V1-Strategiemenge: `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln`, `bei Löschung mitbehandeln`
  - Strategiebedeutung in V1: `beibehalten` lässt Inhalte über alle Account-Zustandswechsel unverändert; `bei Deaktivierung mitbehandeln` überführt Inhalte beim Übergang nach `deactivated` in denselben fachlichen Stufeneffekt; `bei Pseudonymisierung mitbehandeln` überführt Inhalte beim Übergang nach `pseudonymized` in denselben fachlichen Stufeneffekt; `bei Löschung mitbehandeln` überführt Inhalte erst beim finalen Übergang nach `deleted` in denselben fachlichen Stufeneffekt. Auch für Inhalte bleibt dies in V1 zustandsbezogene Tombstone-Behandlung und keine physische Löschung.

- Decision: Für Regelpflege und Lifecycle-Ausführung werden eigene tenantgebundene Actions im `iam`-Namespace benötigt.
  - Rationale: Das Feature darf weder implizit über Plattformrechte noch über allgemeine Admin-Rechte ohne expliziten Tenant-Bezug steuerbar sein.
  - Geplante Lifecycle-Läufe verwenden eine dedizierte tenantgebundene technische Service-Identität, der `iam.accountLifecycle.run` explizit für die Ziel-`instanceId` zugewiesen ist; Plattform- oder Root-Rechte allein reichen nicht aus.

## Risks / Trade-offs

- `last_login_at` kann fachlich weniger reichhaltig sein als ein vollwertiges Aktivitätsmodell.
  - Mitigation: Der Scope wird explizit dokumentiert; spätere Erweiterungen können zusätzliche Aktivitätsquellen separat einführen.

- Ein Tombstone-Soft-Delete kann bei Nutzern als unvollständige Löschung missverstanden werden.
  - Mitigation: Self-Service und Audit-Nachweise müssen den finalen Zustand und seine Datenschutzwirkung klar erläutern.

- Zusätzliche Permissions und Audit-Pfade erhöhen die Governance-Komplexität.
  - Mitigation: Die Actions werden klein, tenantgebunden und eindeutig benannt; Auditfelder werden normativ vorgegeben.

## Migration Plan

1. Tenantbezogene Regeln, Zustände und Inhaltsstrategien fachlich normieren.
2. Admin-Cockpit-Tab und Self-Service-Anzeigen samt Override-Verhalten spezifizieren.
3. Permissions, Lifecycle-Ausführung und Audit-Events als querschnittliche Anforderungen ergänzen.
4. Danach Implementierung und Dokumentation gegen die freigegebenen Deltas planen.

## Open Questions

- Wie der separate Reaktivierungsprozess operativ oder UI-seitig ausgelöst wird, bleibt einem nachfolgenden Implementierungschange vorbehalten.
