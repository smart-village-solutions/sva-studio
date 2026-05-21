## ADDED Requirements

### Requirement: Tenantbezogener Inaktivitäts-Lebenszyklus ergänzt das Recht auf Löschung

Das System SHALL für Tenant-Accounts einen regelbasierten Inaktivitäts-Lebenszyklus bereitstellen, der die Stufen `active`, `deactivated`, `pseudonymized` und `deleted` verwendet. Der Lebenszyklus gilt nur im Tenant-Scope, leitet Inaktivität in V1 ausschließlich aus erfolgreichen Login-Events der betroffenen `instanceId` ab und endet in einem finalen Tombstone-Soft-Delete statt in einer physischen Löschung.

#### Scenario: Inaktivität wird aus dem letzten Login bestimmt

- **WHEN** das System prüft, ob ein Tenant-Account die konfigurierten Löschregeln erreicht hat
- **THEN** verwendet es in V1 ausschließlich `MAX(iam.activity_logs.created_at)` für erfolgreiche `event_type = 'login'`-Events mit `result = 'success'` innerhalb der betroffenen `instanceId` als Referenzzeitpunkt
- **AND** behandelt es diesen Wert nicht als globales Cross-Tenant-Inaktivitätssignal
- **AND** halten fehlgeschlagene Login-Versuche diesen Referenzzeitpunkt nicht künstlich frisch
- **AND** sind Accounts ohne Login-Event in V1 nicht für den automatischen Inaktivitäts-Lifecycle qualifiziert
- **AND** sind Accounts ohne Login-Event auch durch manuelle Läufe dieses Deletion-Rules-Mechanismus nicht für Lifecycle-Übergänge qualifiziert
- **AND** gilt ein Schwellwert `N` als erreicht, sobald `last_login_at + N * 24h <= now()`
- **AND** verlangt kein neues Aktivitäts-Tracking-System und keine zusätzlichen Aktivitätsquellen

#### Scenario: Accounts ohne Login-Event bleiben außerhalb dieses V1-Lifecycles

- **WHEN** ein Tenant-Account in `iam.activity_logs` kein erfolgreiches `login`-Event für die aktive `instanceId` besitzt
- **THEN** verarbeitet das System den Account weder in geplanten noch in manuellen Läufen dieses Deletion-Rules-Mechanismus
- **AND** bleibt die Behandlung dieses Accounts außerhalb des V1-Inaktivitäts-Lifecycles
- **AND** erfordert sie separate manuelle Account-Administration

#### Scenario: Lebenszyklus durchläuft die fachlichen Stufen geordnet

- **WHEN** ein Tenant-Account die konfigurierten Schwellwerte erreicht
- **THEN** wechselt er höchstens in der Reihenfolge `active` → `deactivated` → `pseudonymized` → `deleted`
- **AND** bewegt ein einzelner geplanter oder manueller Lifecycle-Lauf den Account höchstens um eine benachbarte Stufe weiter
- **AND** erfolgen weitere Stufen trotz bereits überschrittener späterer Schwellwerte erst in nachfolgenden Läufen
- **AND** blockiert `deactivated` Login und reguläre Nutzung des Accounts, sodass bestehende Sessions keinen normalen Zugriff mehr vermitteln dürfen
- **AND** bleibt `pseudonymized` für Login und Nutzung unbenutzbar und entfernt oder pseudonymisiert direkte identifizierende Account-Felder irreversibel, während Account-Referenzen für Audit- und Referenzintegrität erhalten bleiben
- **AND** hebt ein bloßer Login den Zustand `deactivated` nicht automatisch auf
- **AND** verlangt eine Rückkehr aus `deactivated` einen separaten Reaktivierungsprozess
- **AND** dürfen ohne Reaktivierung spätere automatische Lifecycle-Stufen weiterhin greifen
- **AND** beschreibt `deleted` einen finalen Tombstone-Soft-Delete ohne physische Löschung, bei dem die Deleted-/Tombstone-Darstellung eine frühere pseudonymisierte Darstellung übersteuert
- **AND** werden referenzwahrende Nachweise und Auditspuren weiterhin pseudonymisiert erhalten

#### Scenario: Neue oder unkonfigurierte Tenants verwenden Baseline-Defaults

- **WHEN** für einen Tenant noch keine individuellen Löschregeln konfiguriert wurden
- **THEN** verwendet das System die Baseline-Defaults/Fallbacks `deactivateAfterDays=90`, `pseudonymizeAfterDays=180` und `deleteAfterDays=365`
- **AND** gilt `beibehalten` als geerbte Default-Inhaltsstrategie
- **AND** gilt `allowContentPreferenceOverride = false` als geerbter Tenant-Default
- **AND** gelten diese Werte so lange als wirksame Tenant-Regeln, bis tenant-spezifische Werte gespeichert werden

#### Scenario: Root- und Plattform-Accounts bleiben außerhalb des Löschregelmodells

- **WHEN** ein Root- oder Plattform-Admin ohne Tenant-Scope betrachtet wird
- **THEN** wird der Account nicht durch tenantbezogene Inaktivitätsregeln verarbeitet
- **AND** bleiben solche Identitäten außerhalb dieses V1-Löschkonzepts

### Requirement: Inhaltsbehandlung ist tenantweit steuerbar und pro Account überschreibbar

Das System SHALL für den Lösch-Lebenszyklus eine tenantweite Default-Inhaltsstrategie und einen tenantseitig freischaltbaren per-Account-Override für eigene Inhalte unterstützen. In V1 ist `iam.contents` die einzige unterstützte Inhaltsdomäne. Die normative V1-Strategiemenge lautet `beibehalten` und `mit Eigentümer-Lifecycle mitbehandeln`.

#### Scenario: Strategiebedeutungen sind zustandsbezogen, nicht physisch und labelstabil

- **WHEN** das System die Inhaltsstrategie eines Accounts im Scope `iam.contents` auswertet
- **THEN** bedeutet `beibehalten`, dass Inhalte über alle Account-Zustandswechsel unverändert bleiben
- **AND** bedeutet `mit Eigentümer-Lifecycle mitbehandeln`, dass Inhalte die jeweils erreichte Owner-Stufe spiegeln
- **AND** führt ein Owner-Übergang nach `deactivated` mindestens zu einem referenzwahrenden Content-Lifecycle-Zustand `deactivated`
- **AND** kann die fachliche Auswirkung dieses Zustands in V1 je nach konsumierender Oberfläche als deaktiviert oder ausgeblendet interpretiert werden, ohne dass `iam.contents` physisch gelöscht wird
- **AND** führt ein Owner-Übergang nach `pseudonymized` zu einem referenzwahrenden pseudonymisierten Content-Zustand, in dem owner-/author-facing Ownership- und Display-Name-Felder durch ein stabiles pseudonymisiertes Label ersetzt werden
- **AND** führt ein Owner-Übergang nach `deleted` zu einem referenzwahrenden Deleted-Tombstone-Zustand, in dem owner-/author-facing Ownership- und Display-Name-Felder durch ein Deleted-Label ersetzt werden
- **AND** sind das pseudonymisierte Label und das Deleted-Label pro Locale über alle betroffenen Entitäten stabil und nicht pro Account oder Inhalt individuell abgeleitet
- **AND** werden `iam.contents`-Zeilen in V1 nicht physisch gelöscht

#### Scenario: Tenantweite Default-Strategie wirkt ohne individuellen Override

- **WHEN** ein Tenant Löschregeln mit einer Default-Inhaltsstrategie konfiguriert
- **THEN** gilt diese Strategie für eigene Inhalte eines Accounts, solange kein individueller Override gesetzt ist
- **AND** stammt die Strategie aus der normativen V1-Menge `beibehalten`, `mit Eigentümer-Lifecycle mitbehandeln`
- **AND** ist die Wirkung auf `iam.contents` begrenzt

#### Scenario: Individueller Override ersetzt nur die Inhaltsstrategie des eigenen Accounts

- **WHEN** ein Benutzer eine abweichende Inhaltspräferenz für die Behandlung seiner eigenen Inhalte speichert
- **THEN** überschreibt diese Präferenz nur die tenantweite Default-Inhaltsstrategie für diesen Account
- **AND** verändert sie keine Fristenwerte des Tenants
- **AND** bleibt auch der Override auf die normative V1-Menge `beibehalten`, `mit Eigentümer-Lifecycle mitbehandeln` begrenzt
- **AND** erweitert sie den Scope nicht auf andere Inhaltsdomänen als `iam.contents`
- **AND** ist der Override nur verfügbar, wenn der Tenant `allowContentPreferenceOverride = true` gesetzt hat

#### Scenario: Unkonfigurierter Tenant verwendet geerbte Regeln bis zur expliziten Speicherung

- **WHEN** für einen Tenant noch keine explizite Löschregel-Konfiguration gespeichert ist
- **THEN** gelten die Baseline-Defaults `90 / 180 / 365`, die geerbte Default-Inhaltsstrategie `beibehalten` und der geerbte Override-Default `false` als wirksamer Tenant-Zustand
- **AND** bleibt dieser geerbte Zustand wirksam, bis ein Tenant-Admin eine explizite Konfiguration speichert

#### Scenario: Expliziter Self-Service-Override kann auf Tenant-Default zurückgesetzt werden

- **WHEN** ein Benutzer denselben Strategiewert wie den aktuellen Tenant-Standard speichert
- **THEN** gilt wieder die tenantweite Default-Inhaltsstrategie für diesen Account
- **AND** bleibt dafür kein eigener expliziter Override mehr erforderlich
