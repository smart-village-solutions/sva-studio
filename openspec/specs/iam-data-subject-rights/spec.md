# iam-data-subject-rights Specification

## Purpose
TBD - created by archiving change add-iam-data-subject-rights. Update Purpose after archive.
## Requirements
### Requirement: Recht auf Auskunft (Art. 15 DSGVO)

Das System SHALL Benutzern die Möglichkeit geben, eine vollständige Auskunft über ihre gespeicherten personenbezogenen Daten zu erhalten.

#### Scenario: Selbstauskunft über API

- **WHEN** ein authentifizierter Benutzer `GET /iam/me/data-export` aufruft
- **THEN** erhält er eine vollständige Auflistung aller zu ihm gespeicherten IAM-Daten
- **AND** die Antwort enthält mindestens Account-Daten, Organisationszuordnungen, Rollenzuweisungen
- **AND** die Daten sind in einem maschinenlesbaren Format (JSON) strukturiert

#### Scenario: Auskunft durch Administrator

- **WHEN** ein berechtigter Administrator eine Auskunftsanfrage für einen Benutzer bearbeitet
- **THEN** kann er die vollständigen Daten des Benutzers exportieren
- **AND** die Auskunftsanfrage wird als Audit-Event protokolliert

### Requirement: Recht auf Berichtigung (Art. 16 DSGVO)

Das System SHALL Benutzern die Korrektur unrichtiger personenbezogener Daten ermöglichen.

#### Scenario: Selbstkorrektur durch Benutzer

- **WHEN** ein Benutzer seine Profildaten korrigiert
- **THEN** werden die Änderungen gespeichert
- **AND** die Änderung wird als Audit-Event mit pseudonymisierten Referenzen protokolliert

### Requirement: Recht auf Löschung (Art. 17 DSGVO)

Das System SHALL eine vollständige Löschung personenbezogener Daten eines Benutzers ermöglichen, unter Berücksichtigung gesetzlicher Aufbewahrungspflichten.

#### Scenario: Account-Löschung durch Benutzer

- **WHEN** ein Benutzer die Löschung seines Accounts beantragt
- **THEN** wird der Account zunächst als Soft-Delete markiert
- **AND** nach Ablauf der konfigurierbaren Karenzzeit erfolgt die endgültige Löschung
- **AND** zugehörige IAM-Daten werden kaskadierend entfernt
- **AND** Audit-Log-Einträge des Benutzers werden pseudonymisiert

#### Scenario: Löschung bei aktivem Legal Hold

- **WHEN** ein Löschantrag vorliegt
- **AND** ein Legal Hold für den Benutzer aktiv ist
- **THEN** wird die Löschung blockiert
- **AND** die Löschung wird erst nach Aufhebung des Legal Holds fortgesetzt

### Requirement: Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)

Das System SHALL die Verarbeitung personenbezogener IAM-Daten auf Antrag einschränken können.

#### Scenario: Verarbeitung wird eingeschränkt

- **WHEN** ein Benutzer eine gültige Einschränkungsanfrage stellt
- **THEN** werden nicht zwingend erforderliche Verarbeitungsvorgänge für die betroffenen Daten ausgesetzt
- **AND** der Datensatz wird mit einem restriktiven Verarbeitungsstatus markiert
- **AND** alle Statusänderungen werden auditierbar protokolliert

### Requirement: Mitteilungspflicht bei Berichtigung/Löschung/Einschränkung (Art. 19 DSGVO)

Das System SHALL nachvollziehbar dokumentieren, dass relevante Empfänger über Berichtigung, Löschung oder Einschränkung informiert wurden, sofern gesetzlich erforderlich.

#### Scenario: Empfängerbenachrichtigung wird nachgewiesen

- **WHEN** eine Berichtigung, Löschung oder Einschränkung wirksam wird
- **THEN** werden betroffene Empfängerklassen gemäß Verarbeitungsmodell ermittelt
- **AND** die erfolgte oder begründet entfallene Benachrichtigung wird mit Zeitpunkt und Ergebnis protokolliert

### Requirement: Recht auf Datenportabilität (Art. 20 DSGVO)

Das System SHALL Benutzern den Export ihrer personenbezogenen Daten in maschinenlesbaren Formaten ermöglichen.

#### Scenario: Datenexport in verschiedenen Formaten

- **WHEN** ein Benutzer `GET /iam/me/data-export?format={json|csv|xml}` aufruft
- **THEN** erhält er seine Daten im gewünschten Format
- **AND** die exportierten Daten sind vollständig und konsistent

#### Scenario: Asynchroner Export mit Statusverfolgung

- **WHEN** ein Export aufgrund Datenumfangs asynchron verarbeitet wird
- **THEN** erhält der Benutzer einen eindeutig referenzierbaren Export-Request
- **AND** der Bearbeitungsstatus ist als `queued|processing|completed|failed` nachvollziehbar
- **AND** bei Status `completed` steht das angeforderte Zielformat zum Abruf bereit

### Requirement: Recht auf Widerspruch (Art. 21 DSGVO)

Das System SHALL Benutzern den Widerspruch gegen nicht zwingend erforderliche Datenverarbeitungen ermöglichen.

#### Scenario: Widerspruch gegen optionale Verarbeitung

- **WHEN** ein Benutzer einer optionalen Datenverarbeitung widerspricht
- **THEN** wird die betroffene Verarbeitung für den Benutzer deaktiviert
- **AND** der Widerspruch wird revisionssicher protokolliert

### Requirement: Konfigurierbare Löschfristen

Das System SHALL konfigurierbare Aufbewahrungsfristen für verschiedene Datenarten unterstützen.

#### Scenario: Ablauf einer Löschfrist

- **WHEN** ein zur Löschung vorgemerkter Datensatz die konfigurierte Karenzzeit erreicht
- **AND** kein Legal Hold aktiv ist
- **THEN** wird der Datensatz endgültig gelöscht
- **AND** die Löschung wird protokolliert

#### Scenario: Konfiguration der Löschfristen

- **WHEN** ein Administrator die Löschfrist für Account-Daten konfiguriert
- **THEN** wird der neue Wert für zukünftige Löschvorgänge wirksam
- **AND** die Änderung wird als Audit-Event protokolliert

### Requirement: 48h-SLA für Löschanträge

Das System SHALL für gültige Löschanträge eine Sperrung und Soft-Delete-Markierung innerhalb von 48 Stunden sicherstellen.

#### Scenario: SLA-konforme Löschvorbereitung

- **WHEN** ein gültiger Löschantrag angenommen wird
- **THEN** wird der Account innerhalb von maximal 48 Stunden gesperrt und als Soft-Delete markiert
- **AND** der Zeitstempel für Antragseingang und Soft-Delete ist auditierbar gespeichert

#### Scenario: SLA-Verstoß führt zu Eskalation

- **WHEN** die 48-Stunden-Grenze ohne Soft-Delete überschritten wird
- **THEN** wird automatisch ein Eskalationsereignis erzeugt
- **AND** der Verstoß ist im Monitoring und Audit-Trail nachvollziehbar

### Requirement: UI-gestützte Betroffenenrechtsprozesse

Das System SHALL Betroffenenrechtsprozesse nicht nur per API, sondern auch über nachvollziehbare Self-Service- und Admin-Oberflächen bereitstellen.

#### Scenario: Admin-UI zeigt bearbeitbare DSR-Fälle

- **WHEN** ein berechtigter Administrator die DSR-Sicht im IAM-Cockpit öffnet
- **THEN** sieht er Requests, Export-Jobs, Legal Holds, Profilkorrekturen und Empfängerbenachrichtigungen in filterbaren, tabellarischen Listen
- **AND** die Übersicht unterstützt Drill-downs auf separate Detailseiten für Statuswechsel, Fristen und Audit-relevante Metadaten

#### Scenario: Unberechtigter Admin-Zugriff auf DSR-Fälle wird sicher abgefangen

- **WHEN** ein Administrator ohne DSR-Berechtigung die DSR-Sicht öffnet
- **THEN** wird ein verweigerter Zustand angezeigt
- **AND** personenbezogene Details aus DSR-Fällen werden nicht offengelegt

#### Scenario: Statuswechsel in DSR-Fällen sind nachvollziehbar und handlungsleitend

- **WHEN** ein berechtigter Administrator den Status eines DSR-Falls ändert
- **THEN** zeigt die UI den neuen Status samt Zeitstempel und nächster erwarteter Aktion
- **AND** bei Konflikt oder Validierungsfehler erhält der Administrator eine konkrete, umsetzbare Fehlerrückmeldung

#### Scenario: DSR-Detailseite zeigt blockierende Umstände strukturiert

- **WHEN** ein berechtigter Administrator einen DSR-Fall auf dessen Detailseite öffnet
- **THEN** werden Blocker wie Legal Holds, fehlende Vorbedingungen oder restriktive Verarbeitungszustände strukturiert und verständlich dargestellt
- **AND** muss der Administrator diese Informationen nicht aus Rohmetadaten oder einer Listenzeile rekonstruieren

### Requirement: Session- und Login-State-Löschung als Teil von Betroffenenrechten
Das System SHALL bei Datenschutz- oder Sicherheitslöschungen alle operativen Session- und Login-State-Daten eines Benutzers aktiv entfernen und sich nicht allein auf TTL-Ablauf verlassen.

#### Scenario: Datenschutzbedingte Löschung eines Benutzers
- **WHEN** eine zulässige Löschung personenbezogener Daten für einen Benutzer wirksam wird
- **THEN** entfernt das System alle aktiven App-Sessions dieses Benutzers aus dem Redis-basierten Session-Store
- **AND** entfernt noch vorhandene Login-State-Objekte desselben Benutzers oder zugehöriger Login-Flows
- **AND** die Entfernung erfolgt aktiv und nicht erst beim natürlichen TTL-Ablauf

#### Scenario: Sicherheitsbedingte sofortige Session-Löschung
- **WHEN** eine Sicherheits- oder Governance-Entscheidung die sofortige Entfernung aller App-Sessions eines Benutzers verlangt
- **THEN** invalidiert das System die aktiven Sessions und zugehörigen Login-States unverzüglich
- **AND** nachfolgende Requests mit zuvor gültigen Session-Artefakten werden abgewiesen

### Requirement: Nachweisbare Lösch- und Compliance-Berichte für Session-Daten
Das System SHALL für Session- und Login-State-Löschungen nachvollziehbare Ergebnisnachweise bereitstellen.

#### Scenario: Löschlauf erzeugt Ergebnisnachweis
- **WHEN** ein Datenschutz- oder Sicherheitslöschlauf Session- und Login-State-Daten entfernt
- **THEN** stellt das System einen maschinenlesbaren Ergebnisnachweis mit mindestens Benutzerreferenz, betroffener Instanz, Anzahl entfernter Sessions, Anzahl entfernter Login-States und Ergebnis bereit
- **AND** der Nachweis enthält keine Klartext-Tokens, keine rohen Session-IDs und keine Klartext-PII

#### Scenario: Teilweise erfolgreiche Löschung
- **WHEN** ein Löschlauf operative Session-Daten nur teilweise entfernen kann
- **THEN** weist der Ergebnisnachweis die unvollständige Bereinigung explizit aus
- **AND** der Vorgang bleibt für Audit und Betrieb nachverfolgbar

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

