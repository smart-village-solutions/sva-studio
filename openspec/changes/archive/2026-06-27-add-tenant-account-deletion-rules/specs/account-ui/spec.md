## ADDED Requirements

### Requirement: Tenant-Löschregeln im IAM-Admin-Cockpit

Das System MUST unter `/admin/iam?tab=deletion-rules` einen tenantgebundenen Admin-Tab für Löschregeln bereitstellen. Der Tab zeigt und bearbeitet ausschließlich die Regeln der aktiven `instanceId` und ist nicht für Root- oder Plattform-Administration ohne Tenant-Scope vorgesehen.

#### Scenario: Tenant-Admin bearbeitet Löschregeln der aktiven Instanz

- **WENN** ein berechtigter Tenant-Admin `/admin/iam?tab=deletion-rules` öffnet
- **DANN** zeigt die UI die aktuellen Werte für `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays`, die tenantweite Default-Inhaltsstrategie und den Tenant-Schalter `Nutzer dürfen die Standardregel für eigene Inhalte überschreiben`
- **UND** zeigt die UI die Baseline-Defaults/Fallbacks `90 / 180 / 365` getrennt von tenant-spezifischen Werten an
- **UND** zeigt die UI bei unkonfigurierten Tenants die Baseline-Defaults `90 / 180 / 365`, die geerbte Default-Inhaltsstrategie `beibehalten` und den Override-Schalter standardmäßig deaktiviert als wirksamen Zustand
- **UND** können die Werte in einer validierten Bearbeitungsmaske geändert werden
- **UND** ist die auswählbare Strategiemenge auf `beibehalten` und `mit Eigentümer-Lifecycle mitbehandeln` begrenzt
- **UND** wird klar angezeigt, dass sich die Regeln nur auf Tenant-Accounts der aktiven `instanceId` beziehen

#### Scenario: Speichern erzeugt oder aktualisiert explizite Tenant-Konfiguration

- **WENN** ein berechtigter Tenant-Admin im Tab `deletion-rules` Werte speichert
- **DANN** erzeugt das System für zuvor unkonfigurierte Tenants eine explizite Tenant-Konfiguration
- **UND** aktualisiert das System für bereits konfigurierte Tenants die bestehende Tenant-Konfiguration
- **UND** zeigt die UI nach dem Speichern die gespeicherten tenant-spezifischen Werte statt nur geerbter Baseline-Defaults
- **UND** bleibt die Speicheraktion ausschließlich mit `iam.deletionRules.manage` verfügbar

#### Scenario: Entfernen einer expliziten Tenant-Konfiguration kehrt zum geerbten Zustand zurück

- **WENN** ein berechtigter Tenant-Admin eine bestehende explizite Tenant-Konfiguration entfernt
- **DANN** zeigt die UI wieder die wirksamen Baseline-Defaults `90 / 180 / 365` und die geerbte Strategie `beibehalten`
- **UND** behandelt die UI dies als gültigen Zustandswechsel statt als leeren oder fehlerhaften Zustand

#### Scenario: UI erklärt die fachlichen Lebenszykluszustände

- **WENN** der Tab `deletion-rules` dargestellt wird
- **DANN** beschreibt die UI die Zustände `active`, `deactivated`, `pseudonymized` und `deleted`
- **UND** erläutert, dass `deleted` einen finalen Tombstone-Soft-Delete und keine physische Löschung bedeutet
- **UND** erläutert, dass `deactivated` nicht automatisch durch Login aufgehoben wird und eine separate Reaktivierung verlangt
- **UND** macht kenntlich, dass ohne Reaktivierung spätere automatische Lifecycle-Stufen weiterlaufen können
- **UND** weist darauf hin, dass V1 Inaktivität ausschließlich aus dem letzten `login`-Event der aktiven `instanceId` ableitet

#### Scenario: Root- oder plattformweite Administration erhält keinen Tenant-Regeltab

- **WENN** ein Benutzer ohne aktiven Tenant-Scope oder nur mit Root-/Plattformrechten `/admin/iam?tab=deletion-rules` aufruft
- **DANN** zeigt die UI keinen bearbeitbaren Tenant-Regelzustand
- **UND** erhält der Benutzer einen verweigerten oder nicht verfügbaren Zustand ohne Leckage tenantbezogener Konfigurationsdaten

#### Scenario: Ladezustand zeigt wirksame Regelermittlung an

- **WENN** die UI die wirksamen Regeln, Baseline-Defaults oder tenant-spezifischen Werte für `deletion-rules` lädt
- **DANN** zeigt sie einen expliziten Ladezustand
- **UND** vermeidet sie währenddessen irreführende Leer- oder Default-Formulare als vermeintlich bereits geladene Daten

#### Scenario: Fehlerzustand für Laden oder Speichern ist handlungsleitend

- **WENN** das Laden oder Speichern der Löschregeln fehlschlägt
- **DANN** zeigt die UI einen expliziten Fehlerzustand mit verständlicher, handlungsleitender Meldung
- **UND** bleibt erkennbar, ob der Fehler beim Laden oder beim Speichern entstanden ist
- **UND** werden keine unbestätigten Eingaben als erfolgreich übernommen dargestellt

#### Scenario: Unkonfigurierter Tenant erzeugt keinen leeren Admin-Zustand

- **WENN** für einen Tenant noch keine explizite Löschregel-Konfiguration gespeichert ist
- **DANN** zeigt die UI die Baseline-Defaults `90 / 180 / 365`, die geerbte Strategie `beibehalten` und den Override-Default `deaktiviert` als wirksamen Zustand
- **UND** verwendet sie keinen leeren oder mehrdeutigen Empty-State anstelle dieser wirksamen Standardwerte

### Requirement: Self-Service zeigt Löschregeln und Inhaltspräferenz transparent an

Das System MUST in den Account-/Privacy-Oberflächen die tenantweiten Löschregeln transparent darstellen und dem Benutzer einen per-Account-Override für die Behandlung eigener Inhalte im Scope `iam.contents` anbieten.

#### Scenario: Benutzer sieht tenantweite Fristen und eigene Inhaltspräferenz

- **WENN** ein authentifizierter Benutzer `/account/privacy` oder die zugehörige Datenschutzfläche seines Accounts öffnet
- **DANN** sieht er die tenantweiten Fristen für Deaktivierung, Pseudonymisierung und finalen Tombstone-Soft-Delete
- **UND** sieht er bei nicht konfigurierten Tenants die Baseline-Defaults/Fallbacks `90 / 180 / 365` als wirksame Standardwerte
- **UND** sieht er bei nicht konfigurierten Tenants `beibehalten` als geerbte wirksame Default-Inhaltsstrategie
- **UND** wird erklärt, dass die Fristen sich auf den letzten `login`-Zeitpunkt innerhalb der aktiven `instanceId` beziehen
- **UND** wird erklärt, dass Accounts ohne Login-Event in V1 nicht automatisch in den Inaktivitäts-Lifecycle fallen
- **UND** sieht der Benutzer den aktuell wirksamen Strategiewert für eigene Inhalte im Scope `iam.contents`
- **UND** werden die zulässigen Strategiewerte `beibehalten` und `mit Eigentümer-Lifecycle mitbehandeln` verständlich benannt
- **UND** werden die Strategiewirkungen verständlich erklärt: unverändert lassen oder die jeweils erreichte Account-Stufe auf Inhalte spiegeln

#### Scenario: Root- oder Plattform-Accounts ohne Tenant-Scope sehen keine Konten-Löschregeln-Box

- **WENN** ein Root- oder Plattform-Account ohne aktive `instanceId` `/account/privacy` öffnet
- **DANN** zeigt die UI keine Konten-Löschregeln-Box
- **UND** leakt sie keinen tenantbezogenen Regelzustand in diese Oberfläche

#### Scenario: Benutzer überschreibt die tenantweite Default-Inhaltsstrategie für eigene Inhalte

- **WENN** ein Benutzer seine Inhaltspräferenz in der Privacy-Oberfläche ändert und der Tenant Self-Service-Overrides erlaubt
- **DANN** kann er die tenantweite Default-Inhaltsstrategie für seine eigenen Inhalte gezielt überschreiben
- **UND** ist der Override auf den Scope `iam.contents` begrenzt
- **UND** ist der schreibbare Zielaccount serverseitig aus dem Session-/Authentifizierungskontext des Benutzers gebunden
- **UND** kann die Self-Service-Oberfläche keinen Override für andere Benutzerkonten schreiben
- **UND** ist im Auswahlfeld direkt die wirksame Regel vorausgewählt
- **UND** zeigt die UI nach dem Speichern den wirksamen Zustand verständlich und ohne Rohdateninterpretation an

#### Scenario: Tenant deaktiviert Self-Service-Overrides

- **WENN** für den Tenant `allowContentPreferenceOverride = false` gilt
- **DANN** zeigt die UI in der Konten-Löschregeln-Box keinen Überschreibungs- und Speicherbereich
- **UND** bleibt nur die tenantweit wirksame Regel sichtbar

#### Scenario: Self-Service bleibt auch ohne verfügbare Override-Daten verständlich

- **WENN** für einen Benutzer noch kein individueller Override gespeichert ist
- **DANN** zeigt die UI die tenantweite Default-Inhaltsstrategie als wirksamen Zustand
- **UND** erklärt, dass nur eigene Inhalte im Scope `iam.contents` betroffen sind
- **UND** bleibt die Oberfläche tastaturbedienbar, screenreader-tauglich und mit klaren Leer-, Lade- und Fehlerzuständen ausgestattet
