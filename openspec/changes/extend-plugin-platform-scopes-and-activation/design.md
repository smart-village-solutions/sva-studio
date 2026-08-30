## Context

`UiAccessRequirement` unterstützt bereits Plattform- und Tenant-Scope. Der
Plugin-SDK-Validator akzeptiert gegenwärtig jedoch nur tenantbezogene
Anforderungen. Gleichzeitig ist der explizite Modulsatz einer Instanz derzeit
nur durch Root-Mutationen veränderbar.

## Goals / Non-Goals

### Goals

- Plattformbeiträge als eng begrenzten generischen Plugin-Vertrag zulassen.
- Root- und Tenant-Scope in Manifest, Snapshot, Routing und Autorisierung
  konsistent halten.
- Wiederverwendbare Aktivierungsrichtlinien einführen.
- Den expliziten Modulsatz als kanonische Runtime-Quelle erhalten.

### Non-Goals

- Keine SSF-spezifischen Routen, Actions oder Datenmodelle.
- Keine Plugin-Provisionierung oder Readiness-Orchestrierung; dies folgt in
  `add-plugin-tenant-lifecycle`.
- Keine generelle Freigabe beliebiger Plattformrechte für Fachplugins.

## Decisions

### Scope ist Teil jedes sicherheitsrelevanten Beitrags

Routen, Navigation, Aktionen und Serverbeiträge deklarieren `platform` oder
`tenant`. Der Host validiert Extension-Tier, Contribution-Typ und
Autorisierungsanforderung gemeinsam und verwirft widersprüchliche Deskriptoren
vor der Snapshot-Materialisierung.

### Extension-Tiers sind explizite Manifest-Metadaten

Die stabilen Tier-IDs lauten `feature`, `admin` und `platform`. Ein fehlender
oder unbekannter Tier ist ein Manifestfehler; es gibt keinen aus Plugin-ID oder
Installationsprofil abgeleiteten Default. Bestehende Fachplugins werden
explizit als `feature` klassifiziert. Nur `admin` und `platform` dürfen die
freigegebenen Plattformbeiträge deklarieren.

Plattformbeiträge sind zunächst auf `instance_registry_admin` begrenzt. Die
Scope-Validierung verwendet die stabilen Fehlerfamilien
`plugin_manifest_extension_tier_*` und `plugin_platform_access_*`;
Cross-Contribution-Abweichungen behalten die bestehenden
`plugin_*_access_requirement_mismatch`-Fehler.

### Installation, Host-Aktivierung und Tenant-Aktivierung bleiben getrennt

- `installed`: Distribution ist Teil des Deployments.
- `hostActive`: Manifest und Host-Kompatibilität sind validiert.
- `tenantActive`: Plugin gehört zum expliziten Modulsatz einer Instanz.

Nur `tenantActive` schaltet tenantbezogene Beiträge frei. Plattformbeiträge
werden ausschließlich aus dem hostaktiven, scopevalidierten Snapshot geladen.

### Richtlinien werden in einen expliziten Sollzustand materialisiert

| Richtlinie  | Initialer Tenantzustand | Manuell deaktivierbar     |
| ----------- | ----------------------- | ------------------------- |
| `optional`  | deaktiviert             | ja                        |
| `automatic` | aktiviert               | ja, persistenter Override |
| `required`  | aktiviert               | nein                      |

Ein Reconcile persistiert das Ergebnis im vorhandenen Modulsatz einschließlich
Richtlinie, Herkunft und Revision. Globale Registrierung oder Feature Flags
werden dadurch nicht zu einer zweiten Aktivierungsquelle.

`iam.instance_modules` bleibt die einzige persistente Wahrheit. Der Datensatz
führt `activation_policy`, `activation_origin`, `effective_active`,
`manual_override`, `manifest_version`, `policy_revision`, die monotone
`state_revision` sowie `reconcile_id` und `reconciled_at`. Bestehende aktive
Zuordnungen werden als `optional`, Herkunft `migration` und manueller Override
`enabled` übernommen.

Die stabilen Aktivierungsfehler lauten
`plugin_activation_required_cannot_disable` für einen unzulässigen Entzug und
`plugin_activation_state_conflict` für eine verlorene nebenläufige Mutation.
Manifest-Vertragsfehler verwenden
`plugin_manifest_contract_version_*` beziehungsweise
`plugin_manifest_activation_policy_*`.

### Deaktivierung ist keine Datenlöschung

Deaktivierung entfernt tenantbezogene Beiträge und Modul-IAM, erhält aber
Fachdaten und Audit. Die Entfernung einer Distribution bleibt eine getrennte
Deployment-Operation.

## Risks / Trade-offs

- Plattformbeiträge vergrößern die Angriffsfläche. → Extension-Tier,
  Allowlist und fail-closed Cross-Contribution-Validierung.
- Policy-Reconcile kann manuelle Zustände überschreiben. → Persistente
  Overrides mit Vorrang bei `automatic`.
- Aktive SDK-Changes können konkurrierende Validatoren erzeugen. → Vor
  Implementierung konsolidieren.

## Migration Plan

1. Aktive SDK-/Extension-Tier-Changes abstimmen.
2. Bestehende Plugins explizit als `optional` klassifizieren, sofern keine
   andere freigegebene Richtlinie besteht.
3. Vorhandene Modulzuweisungen unverändert übernehmen.
4. Neue Felder beziehungsweise Tabellen migrationsbasiert einführen.
5. Richtlinien zunächst als Dry-Run, danach kontrolliert reconciliieren.

## Open Questions

- Wie der serverseitige Host den validierten Build-Snapshot ohne zweiten
  statischen Plugin-Katalog in den Instanz-Reconcile injiziert.
