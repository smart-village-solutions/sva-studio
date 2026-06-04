# ADR-046: Plattform- vs. Tenant-Rollenmodell und Legacy-Standardrollen

## Status

Akzeptiert

## Kontext

Das bestehende IAM-Modell mischte drei getrennte Ebenen:

- Plattformrechte für Root-Host und Instanz-Control-Plane
- tenantlokale Sonderrollen für die Erstadministration
- tenantlokale Standardrollen als historische Bootstrap-Kompatibilität

Dadurch tauchten `instance_registry_admin`, `system_admin`, `roleLevel` und frühere Standardrollen wie `app_manager` oder `editor` gleichzeitig in Seeds, Provisioning, Permission-Katalogen, UI-Gates und Rollenmutationen auf. Die Folge waren fachlich unscharfe Grenzen zwischen Root- und Tenant-Scope sowie unnötige Kopplung zwischen Modulrechten und kanonischen Rollennamen.

## Entscheidung

1. `instance_registry_admin` ist ausschließlich eine Plattformrolle des Root-Realm.
2. `system_admin` bleibt die einzige geschützte tenantlokale Defaultrolle.
3. Tenant-seitige Permission-Kataloge, Rollenmutationen und Laufzeit-Projektionen wie `auth/me`, `iam/me/permissions` und `iam/authorize` blenden Root-only-Artefakte wie `instance_registry_admin` und `instance.registry.manage` aus beziehungsweise lehnen sie fail-closed ab.
4. Frühere tenantlokale Standardrollen (`app_manager`, `feature-manager`, `interface-manager`, `designer`, `editor`, `moderator`) bleiben als Legacy-Bootstrap-Rollen kompatibel bestehen, gelten aber nicht länger als geschützte Systemrollen.
5. `roleLevel` bleibt vorerst als Kompatibilitätsfeld im Vertrag, ist aber nicht mehr die normative Quelle für neue Rollenmodellentscheidungen.
6. Neue tenantlokale Fachzugriffe dürfen nicht wieder über feste Rollennamen modelliert werden, sobald fachliche Permissions existieren; Ausnahmen sind nur echte Plattformpfade.

## Konsequenzen

### Positiv

- Root- und Tenant-Scope sind technisch und fachlich klarer getrennt.
- Tenant-Admins können individuelle Rollen und Gruppen verwalten, ohne auf kanonische Standardrollen festgelegt zu sein.
- Bestandsinstanzen lassen sich additiv bereinigen, ohne produktive Rollen hart zu löschen.

### Negativ

- Legacy-Standardrollen und `roleLevel` bleiben vorerst als Kompatibilitätslast sichtbar.
- Zusätzliche Permission-Backfills und Anti-Regression-Tests sind nötig, damit Bestandsrollen und Spezialpfade nicht schleichend wieder an Rollennamen gekoppelt werden.

## Verworfen

### Sofortige Entfernung aller Legacy-Standardrollen

Verworfen, weil laufende Instanzen, Seeds und fachliche Erwartungshaltungen sonst unnötig hart gebrochen würden.

### Modellierung von `instance_registry_admin` als normale tenantlokale Rolle mit Spezial-Permission

Verworfen, weil dies die Root-/Tenant-Trennung erneut verwischt und tenantlokale Pfade unbeabsichtigt in die Plattform-Control-Plane eskalieren lassen könnte.

## Referenzen

- `openspec/changes/refactor-iam-platform-tenant-role-model/proposal.md`
- `openspec/changes/refactor-iam-platform-tenant-role-model/design.md`
- `packages/data/migrations/0050_iam_platform_tenant_role_split.sql`
