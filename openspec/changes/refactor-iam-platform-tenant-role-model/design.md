## Context
Das aktuelle IAM verbindet drei fachlich getrennte Ebenen:

1. Root-/Plattformzugriff auf Instanzverwaltung und Keycloak-Provisioning
2. tenantlokale Sonderrechte für die Erstadministration einer Instanz
3. fachliche Modul- und Inhaltsrechte

Diese Ebenen sind derzeit nicht sauber getrennt. `instance_registry_admin` erscheint in Seed-Personas, Provisioning-Prüfungen und UI-Gates, obwohl Root- und Tenant-Realm getrennt sind. Gleichzeitig werden modulbezogene Rechte über kanonische Rollenverträge synchronisiert, sodass Standardrollen implizit die fachliche Quelle der Rechtevergabe bleiben.

## Goals / Non-Goals
- Goals:
  - Root- und Tenant-Realm semantisch und technisch sauber trennen.
  - `instance_registry_admin` auf den Plattform-/Root-Scope beschränken.
  - `system_admin` als einzige geschützte tenantlokale Defaultrolle beibehalten.
  - modulbezogene Rechte so entkoppeln, dass sie individuellen tenantlokalen Rollen und Gruppen zugewiesen werden können.
  - eine migrationsfähige Zwischenstufe bereitstellen, die laufende Instanzen nicht hart bricht.
- Non-Goals:
  - vollständige Entfernung von `roleLevel` in demselben Change
  - Redesign sämtlicher Governance-Rollen (`iam_admin`, `support_admin`, `security_admin`, `compliance_officer`) in derselben Lieferung
  - Neuaufbau der gesamten Root-Control-Plane-UI

## Decisions
- Decision: `instance_registry_admin` bleibt eine Rolle im Rollenmodell, existiert aber ausschließlich im Plattform-/Root-Realm.
  - Why: Das ist der kleinste Eingriff gegenüber einem komplett separaten Plattform-Access-Mechanismus.
- Decision: Tenant-Provisioning und Tenant-Admin-Bootstrap dürfen `instance_registry_admin` nicht mehr im Tenant-Realm erwarten oder synchronisieren.
  - Why: Root-User wechseln nicht in Tenant-Realm-Kontexte; die Realms sind getrennt.
- Decision: Modulverträge liefern weiterhin kanonische Permission-Listen, aber tenantseitig keine normativ führenden Standardrollen mehr.
  - Why: Rechte sollen über individuelle Rollen und Gruppen der Instanz zuweisbar werden.
- Decision: `system_admin` bleibt tenantseitig geschützt und unlöschbar als Defaultrolle für den initialen Tenant-Admin.
  - Why: Die Erstadministration einer Instanz braucht weiterhin eine sichere, vollständige Vollzugriffsrolle.
- Decision: `roleLevel` bleibt in dieser Phase kompatibel bestehen, wird aber aus neuen fachlichen Entscheidungen nach Möglichkeit herausgedrängt.
  - Why: Die bestehende User-/Role-Admin-Logik, API-Verträge und UI sind daran breit gekoppelt; ein gleichzeitiger Rückbau erhöht das Risiko unverhältnismäßig.

## Risks / Trade-offs
- Risiko: Root- und Tenant-Checks laufen vorübergehend parallel nebeneinander.
  - Mitigation: Zuerst Plattform-/Tenant-Grenzen normativ absichern, danach Guards schrittweise konsolidieren.
- Risiko: Alte Instanzen enthalten tenantseitig noch `instance_registry_admin` oder Standardrollen mit impliziten Modulrechten.
  - Mitigation: Additive Datenmigration mit Drift-Reporting, nicht-destruktiver Voranalyse und explizitem Repair-/Cleanup-Pfad.
- Risiko: UI und API-Verträge referenzieren `roleLevel` weiterhin sichtbar.
  - Mitigation: `roleLevel` in Phase 1 nur als kompatibles Feld belassen und als spätere Rückbauachse dokumentieren.
- Risiko: Modul-IAM-Seeding verliert unbeabsichtigt Rechte, wenn Standardrollen entfallen.
  - Mitigation: Modulverträge zuerst auf Permission-Basis normieren, erst danach Standardrollen aus dem produktiven Sollmodell herausnehmen.

## Migration Plan
1. Spezifikation und Architektur aktualisieren.
2. Root-/Tenant-Scope und Sonderrollen in Core-/Runtime-Verträgen entkoppeln.
3. Tenant-Provisioning und Tenant-Admin-Bootstrap von `instance_registry_admin` bereinigen.
4. Modul-IAM-Verträge auf tenantseitige Permission-Basis umstellen.
5. Tenant-Admin-UI und Backend-Gates von kanonischen Standardrollen lösen.
6. Migrations- und Repair-Pfade für Bestandsdaten bereitstellen.
7. Nach Stabilisierung Folgespec für Rückbau von `roleLevel` und verbleibenden Standardrollen erstellen.

## Open Questions
- Welche Governance-Rollen bleiben tenantseitig normativ, falls fachliche Admin-Funktionen künftig permission-basiert statt rollenbasiert freigeschaltet werden?
- Soll `system_admin` langfristig weiterhin über dieselbe Rollen-UI sichtbar sein oder als stärker geschützter Systemartefakt-Typ modelliert werden?
- Wann dürfen tenantlokale Standardrollen aus Default-Seeds entfernt werden, ohne bestehende Berechtigungskonzepte der Instanzen zu brechen?
