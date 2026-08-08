# Servergrenze für scopegebundenen UI-Zugriff

Dieses Dokument ist die Abschlussinventur für den Change `centralize-scoped-ui-access`. UI-Entscheidungen verbessern Sichtbarkeit und Bedienbarkeit, ersetzen aber keine serverseitige Autorisierung. Maßgeblich bleiben der aktuelle Instanz- und Organisationskontext sowie der fachlich führende Ressourcenvertrag.

## Host-IAM

| Oberfläche und Mutation                                                         | HTTP-Vertrag                                                               | UI-Action                                           | Führende Serverprüfung                                                                                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Benutzer erstellen, ändern, deaktivieren, synchronisieren oder reprovisionieren | `POST /api/v1/iam/users`, `PATCH /api/v1/iam/users/:id` und Unteraktionen  | `iam.user.write`                                    | `authorizeInstancePermissionForUser` im aktuellen Tenant; Plattformoperationen bleiben technische Control-Plane-Operationen |
| Benutzer löschen                                                                | `DELETE /api/v1/iam/users/:id`                                             | `iam.accounts.delete`                               | Instanzgebundene Permission-Prüfung und serverseitige Löschregeln                                                           |
| Organisationen und Mitgliedschaften ändern                                      | `/api/v1/iam/organizations` einschließlich `/:id/memberships`              | `iam.org.write`                                     | Instanz- und Organisationskontext über den Organization-Mutation-Authorizer; ohne Authorizer fail-closed                    |
| Rollen erstellen, ändern, löschen oder abgleichen                               | `/api/v1/iam/roles` und `/api/v1/iam/roles/reconcile`                      | `iam.role.write`                                    | Instanzgebundene Permission-Prüfung, Rollenlevel- und verwaltete-Permission-Regeln                                          |
| Gruppen und Gruppenzuordnungen ändern                                           | `/api/v1/iam/groups` einschließlich Rollen- und Mitgliedschaftsunterpfaden | `iam.role.write`                                    | Instanzgebundene Permission-Prüfung und gruppenspezifische Mutation-Handler                                                 |
| Rechtstexte erstellen, ändern oder löschen                                      | `/api/v1/iam/legal-texts`                                                  | `iam.legalText.write`                               | Instanzgebundene Permission-Prüfung und Governance-Regeln                                                                   |
| Instanzen, Module und Provisionierung ändern                                    | `/api/v1/iam/instances` und Unteraktionen                                  | technische Plattformrolle `instance_registry_admin` | Instance-Registry-Service, Bestätigungs- und Zustandsregeln; kein Tenant-Action-Fallback                                    |

Die entsprechenden Reads verwenden `iam.user.read`, `iam.org.read`, `iam.role.read` und `iam.legalText.read`. Eine lesbare Detailroute verleiht kein Schreibrecht. Der Browser verwirft nach erfolgreichen lokalen IAM-Mutationen seinen Effective-Access-Snapshot; ein Identitätsrefresh und ein Session-Widerruf sind davon getrennt.

## Content, Media und Plugins

| Ressourcenfamilie                           | Mutation                                                                        | Serververtrag und Scope                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lokaler Content                             | `POST/PATCH/DELETE /api/v1/iam/contents[/:id]`                                  | `content.create`, feldabhängig `content.updateMetadata` oder `content.updatePayload`, `content.archive` und `content.delete`; die Autorisierung erhält Ressourcen-ID, Instanz, Organisation und fachliche Domain-Capability. |
| Media                                       | Upload-Session, Registrierung, `PATCH/DELETE /api/v1/iam/media/:id`, Referenzen | `media.create`, `media.update`, `media.delete` und `media.reference.manage`; datensatzbezogene Prüfungen erhalten `assetId`.                                                                                                 |
| Standard-Content-Plugins                    | Host-Content-Verträge beziehungsweise Mainserver-Mutationen                     | Plugin-Actions wie `news.update`, `events.delete` oder `projects.create` steuern nur die UI. Die konkrete Mutation bleibt im Host- beziehungsweise Mainserver-Vertrag autorisiert.                                           |
| Waste Management und operative Plugin-Tools | jeweilige `/api/v1/waste-management/...`- und Job-Verträge                      | Vollständig qualifizierte Modul-Actions; serverseitige Modul-, Instanz- und Ressourcenprüfung bleibt führend.                                                                                                                |

Ein `EffectivePermission` mit `own`, `organization`, Geo-, `resourceId`- oder sonstigem ABAC-Scope ist keine unbeschränkte Freigabe. `evaluateUiAccess` verlangt dann zusätzlich eine an Action, Ressource, Instanz und gegebenenfalls Organisation gebundene `UiResourceCapability`. Fehlt sie oder passt sie nach einem Organisationswechsel nicht mehr, bleibt die Mutation ausgeblendet.

Listenprojektionen und globale Action-Mitgliedschaft sind ebenfalls keine Ressourcen-Capability. Bereits serverseitig gelieferte Zeilen- und Detailzugriffe wie `access.canUpdate` werden für die konkrete Zeile konsumiert. Der Server autorisiert die spätere Mutation trotzdem erneut.

## Mainserver-Sequenzierung

Für News, Events, POI und Generic Items bleibt `use-mainserver-data-provider-as-content-author` fachlich führend. DataProvider-Bindung, `MutationPrincipalContext`, Same-Credential-Pre-Read und Mainserver-Autorisierung dürfen nicht durch eine generische Studio-Capability ersetzt werden.

Der Endpoint `GET /api/v1/mainserver/mutation-capabilities` liefert nur die derzeit technisch verfügbaren Mutationstypen. Er beweist keine Ownership einer konkreten Ressource. Wo der Mainserver-Detailvertrag noch keine belastbare ressourcengebundene Capability liefert, ist die scope-beschränkte Mutation ein Blocker des genannten Fach-Changes und bleibt im Studio fail-closed.

## Fehler- und Invalidierungsverhalten

- `401` kann einen getrennten Identitäts-/Session-Refresh auslösen.
- Ein erwartbarer Ressourcen-`403` ohne maschinenlesbares Stale-, Scope- oder Versionssignal löst keinen globalen Effective-Access-Refetch und keine Session-Aktion aus.
- Die stabilen Fehlercodes `frontend_state_stale`, `instance_scope_mismatch`, `permission_revision_mismatch`, `permission_snapshot_stale` und `permission_snapshot_version_mismatch` lösen ausschließlich die globale Effective-Access-Invalidierung aus. Mehrere Signale für dieselbe Snapshot-Generation werden zusammengeführt.
- Ein erfolgreiches lokales Rollen-, Gruppen-, Benutzer-, Organisations-, Modul- oder Rechtstext-Update invalidiert nur den Browser-Snapshot; die revisionsgebundene Server-Cache-Gültigkeit folgt unabhängig dem PostgreSQL-Revisionsvektor.
- Cache-Reset, Browser-Refetch und Session-Widerruf sind drei getrennte Verträge. Dieser Change stellt keinen manuellen Permission-Cache-Reset bereit.

## Prüfnachweise

Die maschinenlesbare Aktionsinventur entsteht im Guardrail-Report aus `studio-module-iam`, Plugin-Permissions, Module-IAM und allen Route-, Navigation- und Action-Beiträgen. Registry-Builds weisen nach der Migration fehlende Access-Anforderungen und unbekannte Action-Referenzen fail-fast ab. Die Persona-, Provider-, Routing-, Host-, Plugin- und Server-Authorization-Tests prüfen die oben beschriebenen Negativpfade.

Der abschließende read-only Audit über Aktionsinventur, Registry-Verträge, Revisionsmatrix und Servergrenzen ergab keine weitere unklassifizierte UI-Freigabe. Folgende Abschlussbedingungen bleiben außerhalb des lokal nachweisbaren Scopes offen:

- Die Multi-Replikat-Integration mit echten PostgreSQL- und Redis-Instanzen einschließlich Rollback, Eventverlust und Ausfallpfaden benötigt eine dafür provisionierte Testumgebung.
- Der reale p95-Nachweis für Cache-Hit, Cache-Miss und Recompute benötigt mehrere App-Replikate sowie die IAM-Acceptance-Zugangsdaten. Der lokale Benchmark-Target bricht ohne diese Zugangsdaten vor der Messung ab.
- Der Playwright-Pfad ist implementiert und wird erkannt. Der lokale Lauf erreicht den Test nicht, weil die Login-Route der Entwicklungsumgebung mit HTTP 500 antwortet; der Nx-Pfad wird zusätzlich durch die nicht zu diesem Change gehörende Public-Waste-Konfiguration blockiert.
- Der verpflichtende Changelog-Eintrag kann erst mit einer PR-Nummer als `docs/changelog/entries/pr-<nummer>.json` angelegt werden.
- Die geplante Parallelisierung über Subagent-Runs war in diesem Durchlauf nicht zulässig; die Migrationsslices wurden stattdessen sequenziell integriert und jeweils gezielt geprüft.
