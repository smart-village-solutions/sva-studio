# iam-auditing Specification

## Purpose
TBD - created by archiving change setup-iam-identity-auth. Update Purpose after archive.
## Requirements
### Requirement: Immutable Logging für Identity-Basisereignisse
Das System MUST sicherheitsrelevante Identity-Ereignisse aus Child A unveraenderbar protokollieren und Audit- von operativen Logging-Pfaden strikt trennen.

#### Scenario: Login/Logout wird protokolliert

- **WHEN** ein Benutzer sich erfolgreich anmeldet oder abmeldet
- **THEN** wird ein unveraenderbares Audit-Event mit Zeitpunkt, pseudonymisierter Actor-Referenz und Ergebnis erzeugt
- **AND** Klartext-PII wird nicht gespeichert
- **AND** tokenhaltige Redirect- oder Logout-URLs werden weder im Audit- noch im operativen Log als Klartext gespeichert

#### Scenario: Token-Validierungsfehler wird protokolliert

- **WHEN** Token-Validierung fehlschlaegt (z. B. `invalid`, `expired`, `issuer_mismatch`, `audience_mismatch`)
- **THEN** wird ein `warn`-faehiges Sicherheitsereignis mit Fehlerklasse erzeugt
- **AND** Tokenwerte, tokenhaltige URLs, Session-IDs und Klartext-PII werden nicht geloggt

### Requirement: Dual-Write für Child-A-Sicherheitsereignisse

Das System MUST Child-A-Sicherheitsereignisse sowohl in `iam.activity_logs` als auch über den SDK Logger in die OTEL-Pipeline emittieren.

#### Scenario: Duale Emission bei Login-Ereignis

- **WHEN** ein Login-Ereignis entsteht
- **THEN** wird ein Audit-Record in `iam.activity_logs` geschrieben
- **AND** ein strukturierter SDK-Logeintrag mit korrelierbaren IDs (`request_id`, `trace_id`) emittiert

### Requirement: Auditierbare Migrations- und Seed-Operationen

Das System SHALL sicherheitsrelevante IAM-Migrations- und Seed-Operationen nachvollziehbar protokollieren.

#### Scenario: Ausführung einer IAM-Migration

- **WHEN** eine Migration im `iam`-Schema ausgeführt wird
- **THEN** wird ein nachvollziehbarer Lauf mit Zeitpunkt, Version und Ergebnis erzeugt
- **AND** fehlgeschlagene Läufe sind für Betrieb und Incident-Analyse sichtbar

### Requirement: Audit-Kontext für RLS-Ausnahmepfade

Das System SHALL dokumentierte RLS-Ausnahmepfade in Migrationen oder Admin-Prozessen als Sicherheitskontext erfassbar machen.

#### Scenario: Geplanter RLS-Bypass in Migration

- **WHEN** ein legitimierter Prozess RLS temporär umgeht
- **THEN** enthält der Vorgang einen dokumentierten Grund und Scope
- **AND** nach Abschluss ist der Normalzustand wiederhergestellt und nachweisbar

### Requirement: Unveränderbare Governance-Audit-Events

Das System SHALL für alle Governance-Aktionen unveränderbare Audit-Events erzeugen und revisionssicher speichern.

#### Scenario: Rechteänderung wird protokolliert

- **WHEN** eine Rollen- oder Rechteänderung beantragt, genehmigt oder abgelehnt wird
- **THEN** erzeugt das System ein Audit-Event mit Zeitstempel, pseudonymisierter Actor-ID, Zielobjekt und Ergebnis
- **AND** das Event kann nachträglich nicht verändert werden
- **AND** Klartext-PII (E-Mail, volle IP-Adresse) wird nicht im Event gespeichert

### Requirement: Exportfähige Compliance-Nachweise

Das System SHALL Audit- und Compliance-Nachweise in den Formaten CSV, JSON und SIEM-kompatibel bereitstellen.

#### Scenario: Export für Auditprüfung

- **WHEN** eine Compliance-Prüfung einen Zeitraum anfordert
- **THEN** kann das System die relevanten Governance-Events exportieren
- **AND** die Exportdaten sind konsistent zu den gespeicherten Audit-Events

### Requirement: Nachweisbare Legal-Text-Akzeptanzen

Das System SHALL Versionen von Rechtstexten und deren Akzeptanz durch Benutzer nachvollziehbar speichern.

#### Scenario: Prüfung einer Akzeptanzhistorie

- **WHEN** die Akzeptanz eines Rechtstextes nachgewiesen werden muss
- **THEN** kann das System Version, Zeitpunkt und zugehörigen Benutzerkontext bereitstellen
- **AND** die Nachweise sind exportierbar

### Requirement: Einheitlicher Exportvertrag für Governance-Events

Das System SHALL Governance-Events in CSV, JSON und SIEM-formatiert mit feldäquivalenten Pflichtdaten exportieren.

#### Scenario: Vergleich zweier Exportformate

- **WHEN** derselbe Governance-Zeitraum als CSV und JSON exportiert wird
- **THEN** enthalten beide Exporte mindestens `event_id`, `timestamp`, `instance_id`, `action`, `result`, `actor_pseudonym`, `target_ref`, `reason_code`, `request_id`, `trace_id`
- **AND** es entsteht kein inhaltlicher Informationsverlust

### Requirement: Governance-Reason-Codes sind auditierbar

Das System SHALL für Governance-Denials standardisierte `reason_code`-Werte revisionssicher protokollieren.

#### Scenario: Denial wegen Self-Approval

- **WHEN** eine Freigabe wegen Self-Approval abgewiesen wird
- **THEN** wird ein Audit-Event mit `reason_code=DENY_SELF_APPROVAL` gespeichert
- **AND** das Event ist exportierbar

### Requirement: Unveränderbare Auditspur für Betroffenenanfragen

Das System SHALL jede Betroffenenanfrage und jeden Bearbeitungsschritt revisionssicher als Audit-Event erfassen.

#### Scenario: Bearbeitung einer Löschanfrage

- **WHEN** eine Löschanfrage erstellt, geprüft, blockiert oder abgeschlossen wird
- **THEN** wird pro Statuswechsel ein Audit-Event mit Zeitpunkt, Aktion und Ergebnis erzeugt
- **AND** die Event-Historie bleibt unveränderbar

### Requirement: Pseudonymisierte Nachweise nach Löschung

Das System SHALL Audit-Nachweise nach finaler Account-Löschung pseudonymisiert erhalten.

#### Scenario: Auditprüfung nach abgeschlossener Löschung

- **WHEN** ein gelöschter Account in Auditdaten referenziert ist
- **THEN** enthalten Nachweise nur pseudonymisierte Referenzen
- **AND** Rückschlüsse auf Klartext-PII sind ohne gesonderte Berechtigung nicht möglich

### Requirement: Auditspur für Session-Recovery und Forced Reauth
Das System SHALL Forced-Reauth- und Silent-Session-Recovery-Vorgänge revisionsfähig protokollieren.

#### Scenario: Forced Reauth wird auditiert

- **WHEN** ein Benutzer per Systementscheidung zum Re-Login gezwungen wird
- **THEN** erzeugt das System ein Audit-Event `forced_reauth`
- **AND** das Event enthält Ergebnis, pseudonymisierte Actor-Referenz und keinen Klartext von Tokens oder Session-IDs

#### Scenario: Silent Reauth-Erfolg wird auditiert

- **WHEN** ein stiller Reauth-Versuch erfolgreich eine neue App-Session herstellt
- **THEN** erzeugt das System ein Audit-Event `silent_reauth_success`
- **AND** das Event bleibt frei von Tokenwerten, Session-IDs und Klartext-PII

#### Scenario: Silent Reauth-Fehlschlag wird auditiert

- **WHEN** ein stiller Reauth-Versuch fehlschlägt
- **THEN** erzeugt das System ein Audit-Event `silent_reauth_failed`
- **AND** das Ereignis ist von einem normalen Logout oder Login-Fehler unterscheidbar

### Requirement: Auditspur für Redis-basierte Session-Lebenszyklen
Das System SHALL Redis-basierte Session-Lebenszyklen revisionsfähig protokollieren, ohne Tokenwerte, Session-IDs oder sonstige sensitive Details im Klartext offenzulegen.

#### Scenario: Session-Erstellung wird auditiert
- **WHEN** nach erfolgreichem Login eine App-Session im Redis-Store angelegt wird
- **THEN** erzeugt das System ein Audit-Event für die Session-Erstellung
- **AND** das Event enthält mindestens Zeitpunkt, pseudonymisierte Actor-Referenz, Instanzkontext und Ergebnis
- **AND** das Event enthält keine Klartext-Tokens, keine rohe Session-ID und keine Klartext-PII

#### Scenario: Session-Invalidierung wird auditiert
- **WHEN** eine App-Session durch Logout, Revocation oder Ablauf explizit invalidiert wird
- **THEN** erzeugt das System ein Audit-Event mit Grundklasse und Ergebnis
- **AND** das Ereignis bleibt von normalen Login- oder Forced-Reauth-Events unterscheidbar

### Requirement: Auditspur für Login-State-Objekte
Das System SHALL kurzlebige Login-State-Objekte und deren sicherheitsrelevante Zustandswechsel nachvollziehbar protokollieren.

#### Scenario: Login-State wird erzeugt und verbraucht
- **WHEN** das System einen Login-State für einen OIDC-Flow anlegt und später erfolgreich konsumiert
- **THEN** entstehen auditierbare Ereignisse für Erzeugung und Verbrauch
- **AND** die Nachweise enthalten keine sensitiven State-, Code- oder Tokenwerte im Klartext

#### Scenario: Login-State läuft ab oder wird ungültig
- **WHEN** ein Login-State abläuft oder als ungültig verworfen wird
- **THEN** wird ein unterscheidbares Audit-Ereignis mit Ergebnis `expired` oder `rejected` erzeugt

### Requirement: Audit-Retention und Löschtrennung für Sessions
Das System SHALL für sessionbezogene Auditdaten Archivierung und operative Löschung klar trennen.

#### Scenario: Benutzerbezogene Sessiondaten werden gelöscht
- **WHEN** operative Session- oder Login-State-Daten aus Datenschutz- oder Sicherheitsgründen entfernt werden
- **THEN** bleiben zugehörige Audit-Nachweise nur in pseudonymisierter, revisionsfähiger Form erhalten
- **AND** Audit-Archive werden nicht mit dem operativen Session-Store gekoppelt gelöscht

### Requirement: Revisionssicherer Einzel- und Sammelnachweis für Rechtstext-Akzeptanzen

Das System SHALL für Rechtstext-Akzeptanzen exportierbare Einzel- und Sammelnachweise bereitstellen, die konsistent zur Auditspur bleiben. Audit-Records werden in einem vom operativen Logging-Pfad (OTEL → Loki) getrennten, persistenten Store gespeichert und sind unveränderlich.

#### Scenario: Einzel-Nachweis einer Akzeptanz

- **WHEN** ein Administrator den Nachweis einer konkreten Rechtstext-Akzeptanz anfordert
- **THEN** enthält der Nachweis mindestens: `workspace_id`, `subject_id` (OIDC `sub`-Claim, kein Klarname), `legal_text_id`, `legal_text_version`, `action_type` (`accepted` | `revoked` | `prompted`), Zeitpunkt, Ergebnis, `request_id` und `trace_id`
- **AND** der Nachweis bleibt konsistent zu den gespeicherten Audit- und Akzeptanzdaten

#### Scenario: Sammel-Export für Auditprüfung

- **WHEN** ein Administrator einen Zeitraum oder Filter für Rechtstext-Akzeptanzen exportiert
- **THEN** enthält der Export alle passenden Akzeptanz- und Widerrufsereignisse mit vollständigen Pflichtfeldern
- **AND** es entsteht kein Informationsverlust zwischen UI-Sicht, API-Export und Auditspur
- **AND** der Export enthält **keine** Klarnamen, E-Mail-Adressen oder andere PII-Felder außer `subject_id`

#### Scenario: Pflichtfelder für Einzel- und Sammelnachweise sind normiert

- **WHEN** ein Einzel- oder Sammelnachweis für Rechtstext-Akzeptanzen erzeugt wird
- **THEN** enthält jeder Datensatz mindestens `workspace_id`, `subject_id`, `legal_text_id`, `legal_text_slug`, `legal_text_version`, `legal_text_version_published_at`, `action_type`, `decision_state`, `accepted_at`, `request_id`, `trace_id`, `actor_subject_id`, `source_channel`, `exported_at`
- **AND** Sammelnachweise enthalten zusätzlich die verwendeten Filter (`time_range`, `legal_text_ids[]`, `version_range`, `decision_states[]`) als Export-Metadaten
- **AND** fehlende Pflichtfelder machen den Nachweis fachlich unvollständig und damit nicht abnahmefähig

### Requirement: Zugriffsschutz für Rechtstext-Nachweis-Export

Das System MUST den Zugriff auf Rechtstext-Nachweis-Exporte auf Benutzer mit der Permission `legal-consents:export` beschränken.

#### Scenario: Export ohne ausreichende Permission

- **WHEN** ein Benutzer ohne die Permission `legal-consents:export` den Export-Endpunkt aufruft
- **THEN** antwortet das System mit HTTP 403
- **AND** kein Akzeptanz-Datensatz wird ausgeliefert

#### Scenario: Export-Rate-Limiting schützt vor Bulk-PII-Extraktion

- **WHEN** ein Benutzer den Export-Endpunkt in kurzer Folge mehrfach aufruft
- **THEN** greift ein Rate-Limit von max. 10 Exporten pro Stunde pro Benutzer
- **AND** überschreitende Anfragen erhalten HTTP 429 mit dokumentierter Retry-After-Angabe

### Requirement: Audit-Trail für Permission-Mutationen

Das System SHALL sicherheitsrelevante IAM-Mutationen revisionssicher protokollieren.

#### Scenario: Rollen-Permission wird geändert

- **WHEN** eine Rollen-Permission angelegt, geändert oder entfernt wird
- **THEN** wird ein Audit-Eintrag mit folgenden Feldern gespeichert: `workspace_id`, `actor_subject_id`, `target_role_id`, `action_type` (`permission_added` | `permission_modified` | `permission_removed`), `changed_fields`, Zeitpunkt, `request_id`, `trace_id`
- **AND** der Eintrag ist unveränderlich und exportierbar

#### Scenario: Gruppenberechtigungsentzug wird auditiert

- **WHEN** einem Benutzer eine Gruppenmitgliedschaft entzogen wird
- **THEN** wird ein Audit-Eintrag mit `action_type: membership_removed`, `workspace_id`, `actor_subject_id`, `target_subject_id`, `group_id`, Zeitpunkt, `request_id` gespeichert
- **AND** der Eintrag bleibt konsistent zur tatsächlichen Invalidation des Permission-Snapshots

### Requirement: Konsistenz zwischen UI, Export und Auditspur für Rechtstext-Akzeptanzen

Das System MUST dieselben Rechtstext-Akzeptanzereignisse in UI, Export und Auditspur konsistent darstellen.

#### Scenario: UI, Export und Audit zeigen denselben Akzeptanzstand

- **WHEN** ein Administrator dieselbe Rechtstext-Akzeptanz in der UI einsieht und als Einzel- oder Sammelnachweis exportiert
- **THEN** stimmen `subject_id`, `legal_text_id`, `legal_text_version`, `decision_state`, Zeitpunkt und Korrelation (`request_id`, `trace_id`) zwischen UI, Export und Auditstore überein
- **AND** Abweichungen gelten als Dateninkonsistenz und verhindern die fachliche Abnahme

#### Scenario: Widerruf und erneute Akzeptanz bleiben nachvollziehbar

- **WHEN** ein Benutzer einen Rechtstext mehrfach über verschiedene Versionen oder Zustände hinweg akzeptiert oder widerruft
- **THEN** bleiben Reihenfolge, Versionsbezug und letzter fachlich wirksamer Zustand in UI, Export und Auditspur deckungsgleich nachvollziehbar

