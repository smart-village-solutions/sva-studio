## MODIFIED Requirements

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
- **THEN** gelten die Baseline-Defaults `365 / 730 / 1.095`, die geerbte Default-Inhaltsstrategie `beibehalten` und der geerbte Override-Default `false` als wirksamer Tenant-Zustand
- **AND** sind Deaktivierung, Pseudonymisierung und finaler Tombstone-Soft-Delete jeweils absolute Schwellwerte seit dem letzten erfolgreichen Login und keine inkrementellen Zusatzfristen
- **AND** bleibt dieser geerbte Zustand wirksam, bis ein Tenant-Admin eine explizite Konfiguration speichert

#### Scenario: Expliziter Self-Service-Override kann auf Tenant-Default zurückgesetzt werden

- **WHEN** ein Benutzer denselben Strategiewert wie den aktuellen Tenant-Standard speichert
- **THEN** gilt wieder die tenantweite Default-Inhaltsstrategie für diesen Account
- **AND** bleibt dafür kein eigener expliziter Override mehr erforderlich
