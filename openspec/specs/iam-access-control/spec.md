# iam-access-control Specification

## Purpose
Diese Spezifikation beschreibt die technischen und fachlichen Anforderungen an das IAM-Access-Control-Modul. Sie legt fest, wie nach erfolgreicher OIDC-Authentifizierung ein verlässlicher Identity-Kontext bereitgestellt wird, wie RBAC-Basisdaten instanzgebunden persistiert werden und wie die Abgrenzung zu nachgelagerten Autorisierungsentscheidungen in Child C/D erfolgt.
## Requirements
### Requirement: Authentifizierter Identity-Kontext als Vorbedingung

Das System MUST nach erfolgreicher OIDC-Authentifizierung einen verlässlichen Identity-Kontext bereitstellen, der in nachgelagerten Child-Changes für RBAC/ABAC verwendet werden kann.

#### Scenario: Identity-Kontext nach Login verfügbar

- **WHEN** ein Benutzer sich erfolgreich über Keycloak anmeldet
- **THEN** stehen mindestens `sub` (Identity-ID) und `instanceId` im Server-Kontext bereit
- **AND** dieser Kontext kann von nachgelagerten Autorisierungspfaden konsumiert werden

### Requirement: Keine fachliche Autorisierungsentscheidung in Child A

Das System MUST in Child A keine fachlichen RBAC-/ABAC-Entscheidungen implementieren; diese werden in Child C/D spezifiziert.

#### Scenario: Autorisierung außerhalb Child-A-Scope

- **WHEN** ein Fachmodul eine fachliche Berechtigungsentscheidung benötigt
- **THEN** ist Child A nicht die entscheidende Instanz
- **AND** die verbindliche Entscheidung erfolgt erst über die in Child C/D definierten Authorize-Pfade

### Requirement: Persistente RBAC-Basisdaten

Das System SHALL die für Autorisierung erforderlichen RBAC-Basisdaten (`roles`, `permissions`, Zuordnungen) konsistent und instanzgebunden persistieren.

#### Scenario: Rollenauflösung im Instanzkontext

- **WHEN** Rollen- und Permission-Zuordnungen für einen Benutzer abgefragt werden
- **THEN** werden ausschließlich Zuordnungen der aktiven `instanceId` berücksichtigt
- **AND** organisationsfremde Zuordnungen bleiben wirkungslos

### Requirement: Idempotente Initialisierung von Basisrollen

Das System SHALL Basisrollen und Permission-Zuordnungen idempotent initialisieren, damit wiederholte Deployments keine Dubletten erzeugen.

#### Scenario: Wiederholte Seed-Ausführung für Rollen

- **WHEN** Seed-Skripte mehrfach ausgeführt werden
- **THEN** existiert jede Basisrolle nur einmal
- **AND** Rollen-Permission-Beziehungen bleiben konsistent

### Requirement: Zentrale Authorize-Schnittstelle (RBAC v1)

Das System SHALL eine zentrale Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert.

#### Scenario: Autorisierungsentscheidung mit Begründung

- **WHEN** ein Modul `POST /iam/authorize` mit `instanceId`, `action` und `resource` aufruft
- **THEN** liefert das System eine Antwort mit `allowed` und `reason`
- **AND** die Entscheidung ist bei identischem Kontext reproduzierbar

### Requirement: Instanzzentriertes Scoping in RBAC v1

Das System SHALL `instanceId` als primären Scoping-Filter für RBAC-Entscheidungen erzwingen und organisationsspezifischen Kontext innerhalb der Instanz auswerten.

#### Scenario: Zugriff außerhalb der aktiven Instanz

- **WHEN** ein Benutzerkontext für `instanceId=A` aktiv ist
- **AND** eine Berechtigungsprüfung Ressourcen von `instanceId=B` adressiert
- **THEN** wird der Zugriff verweigert
- **AND** ein passender Denial-Reason wird zurückgegeben

### Requirement: Permissions-Übersicht pro aktivem Kontext

Das System SHALL eine kontextbezogene Permissions-Übersicht für den aktuell angemeldeten Benutzer bereitstellen.

#### Scenario: Laden der effektiven Berechtigungen

- **WHEN** `GET /iam/me/permissions` im aktiven Instanzkontext aufgerufen wird
- **THEN** werden die effektiven RBAC-Berechtigungen für diesen Kontext zurückgegeben
- **AND** organisationsspezifische Einschränkungen werden berücksichtigt

### Requirement: RBAC-v1-Baseline-Performance

Das System SHALL die Baseline-Performance von `POST /iam/authorize` messen und dokumentieren.

#### Scenario: Baseline-Messung

- **WHEN** die RBAC-v1-Implementierung getestet wird
- **THEN** wird die P95-Latenz für `authorize` erhoben
- **AND** die Ergebnisse werden als Referenz für nachfolgende Optimierungen dokumentiert


### Requirement: ABAC-Erweiterung für kontextbasierte Entscheidungen

Das System SHALL neben RBAC kontextbasierte ABAC-Regeln auswerten und diese deterministisch in die Autorisierungsentscheidung einbeziehen.

#### Scenario: Kontextabhängige Freigabe

- **WHEN** eine `authorize`-Anfrage mit gültigem Kontext (Instanz, Organisation, Geo, weitere Attribute) eingeht
- **THEN** werden passende ABAC-Regeln ausgewertet
- **AND** die finale Entscheidung enthält einen nachvollziehbaren Grund

### Requirement: Hierarchische Vererbung mit Restriktionen

Das System SHALL Berechtigungen entlang definierter Org-/Geo-Hierarchien vererben und untergeordnete Restriktionen berücksichtigen.

#### Scenario: Vererbte Berechtigung mit Einschränkung

- **WHEN** eine Berechtigung auf übergeordneter Ebene vergeben ist
- **AND** auf untergeordneter Ebene eine Einschränkung existiert
- **THEN** wird die effektive Berechtigung unter Berücksichtigung der Einschränkung berechnet
- **AND** die Entscheidung ist reproduzierbar

### Requirement: Cache-basierte Berechtigungs-Snapshots

Das System SHALL effektive Berechtigungen als Snapshots im Cache pro Benutzer- und Instanzkontext verwalten.

#### Scenario: Snapshot-Hit

- **WHEN** für den Benutzer-/Instanzkontext ein gültiger Snapshot vorliegt
- **THEN** wird die Autorisierungsentscheidung auf Basis dieses Snapshots getroffen
- **AND** die P95-Latenz von `POST /iam/authorize` bleibt unter 50 ms

#### Scenario: Snapshot-TTL und Stale-Grenze

- **WHEN** Snapshot-Caching für `authorize` aktiv ist
- **THEN** beträgt die Snapshot-TTL maximal 300 Sekunden
- **AND** die maximal tolerierte Dauer potenziell veralteter Entscheidungen beträgt 300 Sekunden

### Requirement: Event-basierte Invalidierung mit Fallback

Das System SHALL Cache-Einträge bei relevanten Änderungen invalidieren und bei Event-Problemen über Fallback-Mechanismen konsistent bleiben.

#### Scenario: Rollenänderung invalidiert Snapshot

- **WHEN** Rollen oder relevante Kontextzuordnungen eines Benutzers geändert werden
- **THEN** wird der zugehörige Cache-Eintrag invalidiert
- **AND** eine nachfolgende Anfrage berechnet Berechtigungen neu
- **AND** die End-to-End-Invalidierungslatenz liegt bei P95 <= 2 Sekunden und P99 <= 5 Sekunden

#### Scenario: Eventverlust wird abgefangen

- **WHEN** ein Invalidation-Event ausfällt
- **THEN** begrenzen TTL und Recompute-Mechanismus die Dauer potenziell veralteter Entscheidungen
- **AND** Konsistenztests erkennen unzulässige Dauerabweichungen

### Requirement: Messbare Performance- und Lastkriterien für ABAC-Authorize

Das System SHALL die ABAC-erweiterte Authorize-Strecke mit definiertem Lastprofil und SLOs verifizieren.

#### Scenario: Lastprofil erfüllt SLO

- **WHEN** `POST /iam/authorize` unter einem Lastprofil von mindestens 100 RPS und 500 gleichzeitigen Nutzern getestet wird
- **THEN** liegt die gemessene P95-Latenz unter 50 ms
- **AND** die Messergebnisse werden versioniert dokumentiert

### Requirement: Operative Pflichtfelder im Authorize-/Cache-Logging

Das System SHALL in Authorize- und Cache-bezogenen operativen Logs die Pflichtfelder für Korrelation und Mandantenkontext mitführen.

#### Scenario: Strukturierter Log-Eintrag im Authorize-/Cache-Pfad

- **WHEN** im Authorize-/Cache-Pfad ein operativer Log-Eintrag erzeugt wird
- **THEN** enthält der Eintrag mindestens `workspace_id` (= `instanceId`), `component`, `environment`, `level`
- **AND** der Eintrag referenziert `request_id` und `trace_id`

### Requirement: Governance-Workflows mit Vier-Augen-Prinzip

Das System SHALL kritische Rechteänderungen über einen Workflow mit Vier-Augen-Freigabe steuern.

#### Scenario: Kritische Änderung ohne Freigabe

- **WHEN** eine kritische Rechteänderung beantragt wurde
- **AND** keine zweite berechtigte Freigabe vorliegt
- **THEN** wird die Änderung nicht wirksam
- **AND** der Status bleibt nicht-aktiv

### Requirement: Instanzisolierte Governance-Aktionen

Das System SHALL alle Governance-Aktionen strikt auf die aktive `instanceId` begrenzen.

#### Scenario: Governance-Aktion über Instanzgrenze

- **WHEN** eine Workflow-Aktion auf Ressourcen einer anderen Instanz abzielt
- **THEN** wird die Aktion abgewiesen
- **AND** ein entsprechender Denial-/Audit-Eintrag wird erzeugt

### Requirement: Sicheres Impersonation-Modell

Das System SHALL Impersonation nur unter definierten Sicherheitsbedingungen erlauben (Ticketpflicht, Zeitlimit, Sichtbarkeit).

#### Scenario: Ablauf einer Impersonation-Sitzung

- **WHEN** die erlaubte Dauer einer Impersonation-Sitzung abläuft
- **THEN** wird die Sitzung beendet
- **AND** nachfolgende Aktionen im Namen des Zielbenutzers sind nicht mehr zulässig

### Requirement: Verbindliche Definition kritischer Rechteänderungen

Das System SHALL kritische Rechteänderungen als approval-pflichtige Governance-Aktionen behandeln.

#### Scenario: Privilegierte Rollenänderung ohne Approval

- **WHEN** eine Rolle mit privilegierten IAM-/Security-Permissions vergeben oder entzogen werden soll
- **AND** keine gültige Freigabe vorliegt
- **THEN** wird die Änderung nicht angewendet
- **AND** ein Denial mit `reason_code` wird erzeugt

### Requirement: Ticket-Validierung für kritische Governance-Aktionen

Das System SHALL kritische Governance-Aktionen nur mit gültiger Ticketreferenz und zulässigem Ticketstatus ausführen.

#### Scenario: Ticketstatus ungültig

- **WHEN** eine kritische Aktion mit `ticket_state=closed` beantragt wird
- **THEN** wird die Aktion abgewiesen
- **AND** der Denial-Code lautet `DENY_TICKET_STATE_INVALID`

### Requirement: Harte Zeitgrenzen für Delegation und Impersonation

Das System SHALL harte Maximaldauern für Delegation und Impersonation erzwingen.

#### Scenario: Impersonation überschreitet Obergrenze

- **WHEN** eine Impersonation mit einer Dauer größer als der globalen Obergrenze angelegt wird
- **THEN** wird die Aktion abgewiesen
- **AND** der Denial-Code lautet `DENY_IMPERSONATION_DURATION_EXCEEDED`

### Requirement: Kein Self-Approval bei kritischen Aktionen

Das System SHALL Self-Approval für kritische Governance-Aktionen verhindern.

#### Scenario: Antragsteller versucht Selbstfreigabe

- **WHEN** `requester` und `approver` identisch sind
- **THEN** wird die Freigabe abgewiesen
- **AND** der Denial-Code lautet `DENY_SELF_APPROVAL`

