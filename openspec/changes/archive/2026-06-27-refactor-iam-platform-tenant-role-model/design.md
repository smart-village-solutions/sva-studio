## Context
Das aktuelle IAM verbindet drei fachlich getrennte Ebenen:

1. Root-/Plattformzugriff auf Instanzverwaltung und Keycloak-Provisioning
2. tenantlokale Sonderrechte für die Erstadministration einer Instanz
3. fachliche Modul- und Inhaltsrechte

Diese Ebenen sind derzeit nicht sauber getrennt. `instance_registry_admin` erscheint in Seed-Personas, Provisioning-Prüfungen und UI-Gates, obwohl Root- und Tenant-Realm getrennt sind. Gleichzeitig werden modulbezogene Rechte über kanonische Rollenverträge synchronisiert, sodass Standardrollen implizit die fachliche Quelle der Rechtevergabe bleiben. In Bestands-Tenants zeigt sich zudem, dass `system_admin` nicht zuverlässig den erwarteten Vollzugriff gewährt, wenn zusätzliche Gruppen- oder Rollenbündel wie `admins` oder `core_admin` fehlen.

## Goals / Non-Goals
- Goals:
  - Root- und Tenant-Realm semantisch und technisch sauber trennen.
  - `instance_registry_admin` auf den Plattform-/Root-Scope beschränken.
  - `system_admin` als einzige geschützte tenantlokale Default- und Vollzugriffsrolle beibehalten.
  - sicherstellen, dass `system_admin` normativ immer die vollständige tenantlokale Permission-Menge direkt bündelt.
  - modulbezogene Rechte so entkoppeln, dass sie individuellen tenantlokalen Rollen und Gruppen zugewiesen werden können.
  - additive Cleanup- und Repair-Pfade für Altbestände bereitstellen, ohne neue Legacy-Standardrollen weiter zu seedieren.
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
- Decision: `system_admin` bleibt tenantseitig geschützt und unlöschbar als Defaultrolle für den initialen Tenant-Admin und muss zugleich jede tenantlokale Permission direkt enthalten.
  - Why: Die Erstadministration einer Instanz braucht weiterhin eine sichere, vollständige Vollzugriffsrolle, die nicht implizit von zusätzlichen Gruppen, Rollenbündeln oder Seed-Reihenfolgen abhängt.
- Decision: Gruppen wie `admins` und kanonische Rollen wie `core_admin` dürfen tenantseitig keine versteckte Vollzugriffsvoraussetzung mehr sein; Legacy-Standardrollen werden aus Entwicklungs-Seeds und Modulverträgen vollständig entfernt.
  - Why: Der Vollzugriff des initialen Tenant-Admins muss deterministisch ohne zusätzliche Default-Artefakte funktionieren, und neue Legacy-Rollen dürfen nicht wieder in das Sollmodell zurückkriechen.
- Decision: Historische Cleanup-, Repair- und Upgrade-Pfade dürfen frühere Legacy-Rollen weiterhin als Altbestand erkennen, aber nicht erneut als Default- oder Systemrollen materialisieren.
  - Why: Bestandsinstanzen brauchen einen sicheren Migrationspfad, ohne dass das neue Sollmodell wieder implizit von den alten Rollennamen abhängt.
- Decision: `roleLevel` bleibt in dieser Phase kompatibel bestehen, wird aber aus neuen fachlichen Entscheidungen nach Möglichkeit herausgedrängt.
  - Why: Die bestehende User-/Role-Admin-Logik, API-Verträge und UI sind daran breit gekoppelt; ein gleichzeitiger Rückbau erhöht das Risiko unverhältnismäßig.

## Risks / Trade-offs
- Risiko: Root- und Tenant-Checks laufen vorübergehend parallel nebeneinander.
  - Mitigation: Zuerst Plattform-/Tenant-Grenzen normativ absichern, danach Guards schrittweise konsolidieren.
- Risiko: Alte Instanzen enthalten tenantseitig noch `instance_registry_admin` oder Standardrollen mit impliziten Modulrechten.
  - Mitigation: Additive Datenmigration mit Drift-Reporting, nicht-destruktiver Voranalyse und explizitem Cleanup-/Repair-Pfad.
- Risiko: `system_admin` und Gruppen wie `admins` driften auseinander und liefern je nach Tenant unterschiedliche effektive Permission-Mengen.
  - Mitigation: Eine führende Permission-Quelle definieren, `system_admin` daraus direkt reseeden und Abweichungen zwischen geschützten Rollen und Gruppen diagnostisch sichtbar machen.
- Risiko: UI und API-Verträge referenzieren `roleLevel` weiterhin sichtbar.
  - Mitigation: `roleLevel` in Phase 1 nur als kompatibles Feld belassen und als spätere Rückbauachse dokumentieren.
- Risiko: Modul-IAM-Seeding verliert unbeabsichtigt Rechte, wenn Standardrollen nicht mehr die führende Bündelung darstellen.
  - Mitigation: Modulverträge auf Permission-Basis normieren, `system_admin` als deterministisches Superset aus derselben Quelle zusammensetzen und Legacy-Standardrollen aus dem produktiven Sollmodell entfernen.

## Migration Plan
1. Spezifikation und Architektur aktualisieren.
2. Root-/Tenant-Scope und Sonderrollen in Core-/Runtime-Verträgen entkoppeln.
3. Tenant-Provisioning und Tenant-Admin-Bootstrap von `instance_registry_admin` bereinigen.
4. Modul-IAM-Verträge auf tenantseitige Permission-Basis umstellen.
5. `system_admin` aus derselben Permission-Quelle als vollständiges tenantlokales Superset normieren.
6. Tenant-Admin-UI und Backend-Gates von kanonischen Standardrollen lösen.
7. Migrations- und Repair-Pfade für Bestandsdaten bereitstellen.
8. Nach Stabilisierung Folgespec für Rückbau von `roleLevel` und verbleibenden Komfortartefakten erstellen.

## Open Questions
- Welche Governance-Rollen bleiben tenantseitig normativ, falls fachliche Admin-Funktionen künftig permission-basiert statt rollenbasiert freigeschaltet werden?
- Soll `system_admin` langfristig weiterhin über dieselbe Rollen-UI sichtbar sein oder als stärker geschützter Systemartefakt-Typ modelliert werden?
- Sollen Gruppen wie `admins` künftig normativ auf `system_admin` verweisen oder nur noch optionale, manuell gepflegte Komfortbündel sein?
