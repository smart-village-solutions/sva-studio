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

Das System SHALL eine zentrale Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert und Diagnoseinformationen für Admin-Transparenz bereitstellen kann.

#### Scenario: Autorisierungsentscheidung mit Begründung

- **WHEN** ein Modul `POST /iam/authorize` mit `instanceId`, `action` und `resource` aufruft
- **THEN** liefert das System eine Antwort mit `allowed` und `reason`
- **AND** die Entscheidung ist bei identischem Kontext reproduzierbar

#### Scenario: Request-Input wird schema-validiert

- **WHEN** ein `POST /iam/authorize`-Request eingeht
- **THEN** wird der Request-Body gegen ein Zod-Schema validiert
- **AND** bei ungültigem Input wird ein strukturierter 400-Fehler zurückgegeben

#### Scenario: Diagnosefelder sind für Admin-UI auswertbar

- **WHEN** eine Autorisierungsentscheidung zusätzliche technische Einordnung benötigt
- **THEN** enthält die Antwort ausschließlich allowlist-basierte Diagnosefelder mit konflikt-, Hierarchie-, Scope- oder Impersonation-Hinweisen
- **AND** interne Rohdaten, Stacktraces oder nicht spezifizierte Diagnosefelder werden nicht ausgegeben
- **AND** diese Diagnoseinformationen sind stabil genug, um in einer Admin-Oberfläche verständlich dargestellt zu werden

#### Scenario: Keine `any`-Casts in Auth-Infrastruktur

- **WHEN** Auth-Server-Code kompiliert wird
- **THEN** enthält kein Modul in `packages/auth/src/` einen `any`-Cast ohne dokumentierten TODO-Kommentar mit Begründung und Scope
- **AND** Redis-Optionen werden über typisierte Interfaces konfiguriert

#### Scenario: Duplizierte Validierungs-Helfer konsolidiert

- **WHEN** Input-Validierung in IAM-Endpoints benötigt wird
- **THEN** werden zentrale Utilities aus `packages/auth/src/shared/` verwendet
- **AND** keine Dateien in `packages/auth/src/` definieren lokale Duplikate von `readString`, `isUuid`, `buildLogContext` oder `isTokenErrorLike`

### Requirement: Instanzzentriertes Scoping in RBAC v1

Das System SHALL `instanceId` als primären Scoping-Filter für RBAC-Entscheidungen erzwingen und organisationsspezifischen Kontext innerhalb der Instanz auswerten.

#### Scenario: Zugriff außerhalb der aktiven Instanz

- **WHEN** ein Benutzerkontext für `instanceId=A` aktiv ist
- **AND** eine Berechtigungsprüfung Ressourcen von `instanceId=B` adressiert
- **THEN** wird der Zugriff verweigert
- **AND** ein passender Denial-Reason wird zurückgegeben

### Requirement: Permissions-Übersicht pro aktivem Kontext

Das System SHALL eine kontextbezogene Permissions-Übersicht für den aktuell angemeldeten Benutzer bereitstellen, optional einen impersonierten Zielkontext auswerten und dabei alle für Transparenz- und Diagnose-UI erforderlichen strukturierten Felder liefern.

#### Scenario: Laden der effektiven Berechtigungen (Self)

- **WHEN** `GET /iam/me/permissions` ohne `actingAsUserId` im aktiven Instanzkontext aufgerufen wird
- **THEN** werden die effektiven RBAC-Berechtigungen für den aktuellen Benutzer zurückgegeben
- **AND** die Antwort enthält ein `subject`-Objekt mit `actorUserId == effectiveUserId` und `isImpersonating=false`

#### Scenario: Laden der effektiven Berechtigungen (Impersonation aktiv)

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** eine aktive, gültige Impersonation-Session zwischen Actor und Target existiert
- **THEN** werden die effektiven RBAC-Berechtigungen des Target-Subjekts zurückgegeben
- **AND** die Antwort enthält `subject.actorUserId`, `subject.effectiveUserId` und `subject.isImpersonating=true`

#### Scenario: Impersonation nur im zulässigen Policy-Kontext

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** Actor und Target nicht im zulässigen Instanz-/Organisationskontext liegen
- **THEN** wird die Anfrage mit einem strukturierten Deny-Fehler abgewiesen
- **AND** es werden keine Detaildaten des Target-Subjekts offengelegt

#### Scenario: Strukturierte Permission-Felder sind UI-verfügbar

- **WHEN** die Permissions-Übersicht zurückgegeben wird
- **THEN** enthält jeder Permission-Eintrag mindestens `action`, `resourceType`, optionale `resourceId`, optionale `organizationId`, optionale `effect`, optionale `scope` und `sourceRoleIds`
- **AND** diese Felder können ohne zusätzliche Server-Interpretation in einer Admin-UI gerendert werden

#### Scenario: Keine aktive Impersonation für Target

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** keine aktive Impersonation-Session existiert
- **THEN** wird die Anfrage mit Fehlercode `impersonation_not_active` abgewiesen

#### Scenario: Impersonation ist abgelaufen

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** die zugehörige Impersonation-Session abgelaufen ist
- **THEN** wird die Anfrage mit Fehlercode `impersonation_expired` abgewiesen

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

### Requirement: Plattformrollen und Tenant-Admin-Rollen bleiben getrennt

Das System SHALL tenant-lokale Admin-Rollen und globale Plattformrollen in der Instanzverwaltung strikt trennen.

#### Scenario: Nur Plattform-Admin darf Keycloak-Provisioning anstossen

- **WHEN** ein Benutzer ohne `instance_registry_admin` versucht, Instanz-Realm-Grundeinstellungen zu ändern oder ein Keycloak-Provisioning auszulösen
- **THEN** lehnt das System die Operation ab

#### Scenario: Technischer Keycloak-Zugang blockiert fehlende Rechte vor dem Lauf

- **WHEN** der technische Keycloak-Admin-Zugang den Ziel-Realm nicht verwalten kann
- **THEN** markiert der Preflight die Ausführung als blockiert
- **AND** wird getrennt ausgewiesen, ob der Plattformpfad oder der Tenant-Admin-Client betroffen ist
- **AND** es wird kein Keycloak-Mutationslauf gestartet

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

### Requirement: Stabile Rollenidentität für Autorisierung und IdP-Sync

Das System SHALL für Rollen einen stabilen technischen Schlüssel (`role_key`) verwenden, der unabhängig von UI-Anzeigenamen ist und für Keycloak-Synchronisierung sowie Autorisierungsauflösung genutzt wird.

#### Scenario: Anzeigename wird geändert

- **WHEN** ein Admin den Anzeigenamen einer Custom-Rolle ändert
- **THEN** bleibt der technische `role_key` unverändert
- **AND** bestehende Rollen-Zuweisungen und Berechtigungsauflösungen bleiben gültig
- **AND** es entsteht keine neue Rolle durch Umbenennung

#### Scenario: Rollenauflösung nach Synchronisierung

- **WHEN** eine Rollen-Zuweisung für einen Benutzer ausgewertet wird
- **THEN** nutzt die Access-Control-Auflösung den stabilen `role_key` als Referenz
- **AND** ist unabhängig von Keycloak-Display-Metadaten deterministisch

### Requirement: Managed Scope für externe Rollen

Das System MUST bei Synchronisierung und Reconciliation strikt zwischen studioverwalteten Rollen und nicht verwalteten Keycloak-Rollen unterscheiden.

#### Scenario: Externe, nicht verwaltete Keycloak-Rolle

- **WHEN** eine Rolle in Keycloak existiert, aber nicht zum Studio-Managed-Scope gehört
- **THEN** wird diese Rolle durch den Reconcile-Lauf nicht verändert oder gelöscht
- **AND** sie hat keine automatische Wirkung auf den Studio-Rollenkatalog
- **AND** der Managed-Scope wird ausschließlich über `managed_by = "studio"` und `instance_id` bestimmt

#### Scenario: Drift innerhalb des Managed Scope

- **WHEN** eine studioverwaltete Rolle im Managed-Scope in Keycloak abweicht
- **THEN** darf der Reconcile-Lauf die Abweichung gemäß Richtlinie korrigieren
- **AND** die Korrektur wird mit `request_id` und Ergebnisstatus auditierbar protokolliert

#### Scenario: Versuch der `role_key`-Änderung

- **WHEN** ein Admin eine Änderung des technischen `role_key` anfordert
- **THEN** lehnt das System die Änderung mit verständlicher Begründung ab
- **AND** verweist auf den erlaubten Weg über Änderung von `display_name`

### Requirement: Gruppen als zusätzliche Quelle effektiver Berechtigungen

Das System SHALL Gruppen als instanzgebundene IAM-Entität auswerten und deren Zuweisungen in die effektive Berechtigungsberechnung einbeziehen.

#### Scenario: Gruppenmitgliedschaft erweitert effektive Rechte

- **WHEN** ein Benutzer einer Gruppe mit fachlich relevanten Berechtigungen zugewiesen ist
- **THEN** werden diese Gruppenrechte in `GET /iam/me/permissions` und `POST /iam/authorize` berücksichtigt
- **AND** die Herkunft der Berechtigung bleibt nachvollziehbar

#### Scenario: Konflikte zwischen Rollen und Gruppen bleiben deterministisch

- **WHEN** eine Rollenfreigabe und eine gruppenbasierte Restriktion denselben Zugriff betreffen
- **THEN** wird die finale Entscheidung nach einer dokumentierten Prioritätsregel berechnet
- **AND** identischer Kontext führt zu identischem Ergebnis und identischem Reasoning

#### Scenario: Inaktive oder soft-gelöschte Gruppen bleiben fachlich wirkungslos

- **WHEN** eine Gruppe deaktiviert oder soft-gelöscht ist
- **THEN** fließen weder ihre Rollenzuordnungen noch ihre Mitgliedschaften in `GET /iam/me/permissions` oder `POST /iam/authorize` ein
- **AND** bestehende Historien- und Herkunftsdaten bleiben weiterhin auditierbar

### Requirement: Hierarchische Geo-Vererbung für ABAC-Scopes

Das System SHALL geografische Berechtigungen entlang definierter Geo-Hierarchien vererben und untergeordnete Restriktionen berücksichtigen.

#### Scenario: Übergeordneter Geo-Scope wirkt auf untergeordnete Einheiten

- **WHEN** eine Berechtigung für eine übergeordnete geografische Einheit vergeben ist
- **AND** die angefragte Ressource zu einer untergeordneten geografischen Einheit gehört
- **THEN** wird die Berechtigung auf Basis der Geo-Hierarchie vererbt
- **AND** die Entscheidung bleibt auf die aktive `instanceId` begrenzt

#### Scenario: Untergeordnete Geo-Restriktion überschreibt Parent-Freigabe

- **WHEN** eine übergeordnete Geo-Freigabe vorliegt
- **AND** für eine untergeordnete geografische Einheit eine restriktive Regel existiert
- **THEN** wird der Zugriff für diese untergeordnete Einheit verweigert
- **AND** die Antwort enthält einen nachvollziehbaren Denial-Reason

#### Scenario: Geo-Vererbung nutzt das kanonische Read-Modell

- **WHEN** die Autorisierungsberechnung einen Geo-Scope auf Vorfahren oder Nachfahren prüfen muss
- **THEN** verwendet sie das von `iam-organizations` bereitgestellte Geo-Read-Modell statt lokaler String- oder Präfixvergleiche
- **AND** die Vererbungsentscheidung bleibt für identische Eingaben deterministisch reproduzierbar

#### Scenario: Instanzfremder oder unbekannter Geo-Scope führt nicht zu impliziter Freigabe

- **WHEN** ein angefragter Geo-Scope unbekannt ist oder nicht zur aktiven `instanceId` gehört
- **THEN** wird keine Geo-Vererbung angenommen
- **AND** der Zugriff bleibt verweigert, sofern keine andere zulässige Freigabe greift

### Requirement: Kanonisches Gruppen-Datenmodell für IAM

Das System SHALL Gruppen als instanzgebundene IAM-Entität mit normierten Zuordnungs- und Integritätsregeln persistieren.

**Datenmodell (normativ):**

Gruppe:
- `id` UUID PK
- `instance_id` UUID NOT NULL
- `group_key` TEXT NOT NULL
- `display_name` TEXT NOT NULL
- `description` TEXT NULLABLE
- `group_type` TEXT NOT NULL mit den erlaubten Werten `system`, `organizational`, `geo`, `custom`
- `is_active` BOOLEAN NOT NULL DEFAULT `true`
- `created_at` TIMESTAMP NOT NULL
- `updated_at` TIMESTAMP NOT NULL
- `deleted_at` TIMESTAMP NULLABLE
- Unique-Constraint: `(instance_id, group_key)`

Gruppen-Rollen-Zuordnung:
- `group_id` UUID NOT NULL
- `role_id` UUID NOT NULL
- `assigned_at` TIMESTAMP NOT NULL
- `assigned_by_account_id` UUID NULLABLE
- PK: `(group_id, role_id)`

Account-Gruppen-Mitgliedschaft:
- `group_id` UUID NOT NULL
- `account_id` UUID NOT NULL
- `origin` TEXT NOT NULL mit den erlaubten Werten `manual`, `sync`, `derived`
- `valid_from` TIMESTAMP NULLABLE
- `valid_until` TIMESTAMP NULLABLE
- `created_at` TIMESTAMP NOT NULL
- `updated_at` TIMESTAMP NOT NULL
- PK: `(group_id, account_id)`

Zusätzliche Constraints:
- `group_id`, `role_id` und `account_id` dürfen nur Datensätze derselben `instance_id` referenzieren
- Mitgliedschaften mit `valid_until < valid_from` werden abgewiesen
- soft-gelöschte Gruppen dürfen keine neuen Rollen- oder Account-Zuordnungen erhalten

#### Scenario: Gruppe bleibt innerhalb der Instanz eindeutig

- **WHEN** in derselben `instanceId` eine zweite Gruppe mit identischem `group_key` angelegt wird
- **THEN** lehnt das System die Operation deterministisch ab
- **AND** in anderen Instanzen darf derselbe `group_key` weiterhin verwendet werden

#### Scenario: Mitgliedschaft über Instanzgrenze wird blockiert

- **WHEN** eine Account-Gruppen-Zuordnung auf ein Konto, eine Rolle oder eine Gruppe aus einer anderen `instanceId` zeigen würde
- **THEN** wird die Zuordnung nicht persistiert
- **AND** die Berechtigungsberechnung bleibt instanzisoliert

#### Scenario: Gruppen bündeln Rollen, aber keine direkten Permissions

- **WHEN** eine Gruppe in die effektive Berechtigungsauflösung einbezogen wird
- **THEN** stammen ihre fachlich wirksamen Rechte ausschließlich aus den zugeordneten Rollen
- **AND** direkte gruppenbasierte Permission-Einträge sind in diesem Schnitt unzulässig

### Requirement: Effektive Berechtigungsauflösung über Gruppenmitgliedschaften

Das System SHALL die effektive Berechtigungsauflösung um gültige Gruppenmitgliedschaften erweitern und dabei Herkunft, Gültigkeit und Deduplizierung normiert behandeln.

#### Scenario: Gruppenrollen werden in die effektive Auswertung aufgenommen

- **WHEN** ein Benutzer direkt Rollen besitzt und zusätzlich Mitglied einer oder mehrerer Gruppen mit Rollen ist
- **THEN** berücksichtigt die Berechtigungsauflösung beide Quellen im selben Entscheidungslauf
- **AND** die Antwort führt die Herkunft pro Treffer mindestens als `direct_role` oder `group_role` nachvollziehbar mit

#### Scenario: Abgelaufene oder noch nicht gültige Gruppenmitgliedschaft bleibt wirkungslos

- **WHEN** eine Gruppenmitgliedschaft außerhalb ihres Gültigkeitsfensters `valid_from` bis `valid_until` liegt
- **THEN** wird sie nicht in die effektive Berechtigungsauflösung einbezogen
- **AND** direkte Rollen desselben Benutzers bleiben davon unberührt

#### Scenario: Mehrfache Herkunft wird ohne Doppelergebnis verdichtet

- **WHEN** dieselbe effektive Berechtigung sowohl direkt als auch über mehrere Gruppenrollen erreicht wird
- **THEN** erzeugt das System kein doppeltes Permission-Ergebnis
- **AND** die Antwort enthält dennoch die vollständige Herkunftsmenge für Transparenz und Debugging

### Requirement: Normierte Testmatrix für Gruppen- und Geo-Konfliktfälle

Das System SHALL für Paket 3 eine verbindliche Testmatrix bereitstellen, die Konflikt- und Randfälle der Gruppen-, Organisations- und Geo-Auswertung vollständig abdeckt.

#### Scenario: Testmatrix deckt Mehrfachherkunft und Deduplizierung ab

- **WHEN** die Abnahme- oder technische Testmatrix für Paket 3 erstellt wird
- **THEN** enthält sie mindestens einen Fall, in dem dieselbe Berechtigung aus direkter Rolle und aus mindestens einer Gruppenrolle stammt
- **AND** der erwartete Ausgang normiert ein einzelnes fachliches Permission-Ergebnis mit vollständiger Herkunftsmenge

#### Scenario: Testmatrix deckt Gruppenkonflikte und Gültigkeitsfenster ab

- **WHEN** die Testmatrix Konflikt- und Negativfälle beschreibt
- **THEN** enthält sie mindestens Fälle für deaktivierte Gruppen, soft-gelöschte Gruppen, abgelaufene Mitgliedschaften und noch nicht gültige Mitgliedschaften
- **AND** alle diese Fälle erwarten, dass die betroffenen Gruppenpfade fachlich wirkungslos bleiben

#### Scenario: Testmatrix deckt Geo-Vererbung und Restriktionen ab

- **WHEN** die Testmatrix Geo-bezogene Vererbungen beschreibt
- **THEN** enthält sie mindestens einen Fall für Parent-Allow mit Child-Deny, einen Fall für vererbte Parent-Freigabe ohne lokale Restriktion und einen Fall für unbekannten oder instanzfremden Geo-Scope
- **AND** die erwarteten Ergebnisse normieren deterministisches Allow bzw. Deny inklusive nachvollziehbarem Reasoning

#### Scenario: Testmatrix deckt Instanzisolation ab

- **WHEN** Gruppen-, Rollen- oder Geo-Daten instanzfremd referenziert werden
- **THEN** enthält die Testmatrix mindestens je einen Negativfall für instanzfremde Gruppenmitgliedschaft und instanzfremden Geo-Scope
- **AND** beide Fälle erwarten eine verweigerte oder ignorierte Auswertung ohne implizite Freigabe

### Requirement: Strukturierte Permission-Persistenz für Autorisierung

Das System SHALL fachliche Berechtigungen in strukturierter Form persistieren, sodass die Autorisierungsberechnung nicht ausschließlich auf flachen `permission_key`-Strings basiert.

#### Scenario: Strukturierte Rollen-Permission wird gespeichert

- **WHEN** eine Rollen-Permission im IAM erfasst oder aus Seeds bereitgestellt wird
- **THEN** liegen mindestens `action`, `resource_type`, optional `resource_id`, `scope` und `effect` in maschinenlesbarer Form vor
- **AND** die Berechtigung bleibt auf die aktive `instanceId` begrenzt

#### Scenario: Bestehende Permission-Key-Daten bleiben während der Migration auswertbar

- **WHEN** noch nicht alle bestehenden Rollen-Permissions in die strukturierte Form migriert wurden
- **THEN** existiert ein definierter Migrations- oder Kompatibilitätspfad
- **AND** bestehende Autorisierungsentscheidungen brechen nicht ungesteuert weg

### Requirement: Effektive Berechtigungsauflösung über Organisationshierarchie

Das System SHALL effektive Berechtigungen entlang der Organisationshierarchie innerhalb der aktiven `instanceId` vererben.

#### Scenario: Parent-Berechtigung wirkt auf Child-Organisation

- **WHEN** ein Benutzer im aktiven Org-Kontext einer untergeordneten Organisation handelt
- **AND** eine passende `allow`-Berechtigung auf einer übergeordneten Organisation vorliegt
- **THEN** wird diese Berechtigung auf die untergeordnete Organisation vererbt
- **AND** `POST /iam/authorize` liefert eine reproduzierbare Freigabe

#### Scenario: Instanzfremde Hierarchie bleibt wirkungslos

- **WHEN** eine Hierarchieauswertung Parent- oder Child-Daten außerhalb der aktiven `instanceId` referenzieren würde
- **THEN** werden diese Daten nicht in die effektive Berechnung einbezogen
- **AND** die Entscheidung bleibt instanzisoliert

### Requirement: Restriktionen überschreiben vererbte Freigaben

Das System SHALL lokale Restriktionen auf untergeordneten Ebenen höher priorisieren als vererbte Freigaben aus Parent-Ebenen.

#### Scenario: Child-Restriktion blockiert Parent-Allow

- **WHEN** eine vererbte `allow`-Berechtigung aus einer Parent-Organisation vorliegt
- **AND** auf der untergeordneten Organisation eine passende Restriktion oder `deny`-Regel existiert
- **THEN** wird die effektive Berechtigung verweigert
- **AND** die Antwort enthält einen nachvollziehbaren Denial-Reason

### Requirement: Konsistente Auswertung von Org- und Geo-Scopes

Das System SHALL Organisations- und Geo-Scopes gemeinsam in die finale Berechtigungsentscheidung einbeziehen, sofern beide für die angefragte Ressource relevant sind.

#### Scenario: Org-Scope erlaubt, Geo-Scope verweigert

- **WHEN** eine Rollen-Permission im aktiven Organisationskontext grundsätzlich passt
- **AND** der angefragte Geo-Kontext nicht im effektiven Scope enthalten ist
- **THEN** wird die Anfrage verweigert
- **AND** die Verweigerung ist deterministisch reproduzierbar

### Requirement: Erweiterte Snapshot-Berechnung für Scope-Kontexte

Das System SHALL Permission-Snapshots so berechnen, dass aktiver Org-Kontext, Organisationshierarchie und Geo-Scopes im Hit-Pfad ohne zusätzliche Datenbankzugriffe ausgewertet werden können.

#### Scenario: Snapshot enthält effektive Scope-Daten

- **WHEN** ein Snapshot für einen Benutzer-/Instanzkontext erzeugt wird
- **THEN** enthält der Snapshot die effektiven Berechtigungen inklusive relevanter Org- und Geo-Reichweite
- **AND** `POST /iam/authorize` kann im Cache-Hit-Pfad reine In-Memory-Checks ausführen

### Requirement: Erweiterte Invalidation bei Strukturänderungen

Das System SHALL Permission-Snapshots auch bei Änderungen an Hierarchie- und Scope-Strukturen invalidieren.

#### Scenario: Hierarchieänderung invalidiert effektive Berechtigungen

- **WHEN** Parent-/Child-Beziehungen, Memberships oder relevante Geo-Zuordnungen geändert werden
- **THEN** werden betroffene Snapshots invalidiert
- **AND** nachfolgende Authorize-Anfragen berechnen effektive Rechte auf Basis des neuen Zustands

### Requirement: Redis-basierte Permission-Snapshots

Das System SHALL effektive Berechtigungen als serialisierte Snapshots in Redis pro Benutzer-, Instanz- und Kontextscope verwalten.

#### Scenario: Snapshot-Key ist normiert und kontextstabil

- **WHEN** ein Permission-Snapshot geschrieben oder gelesen wird
- **THEN** verwendet das System das Key-Schema `perm:v1:{instanceId}:{userId}:{orgCtxHash}:{geoCtxHash}`
- **AND** `instanceId` trennt Mandanten strikt
- **AND** `userId` adressiert den effektiven Benutzerkontext
- **AND** `orgCtxHash` repräsentiert den aktiven Organisationskontext deterministisch, ohne rohe Org-ID im Redis-Key zu duplizieren
- **AND** `geoCtxHash` repräsentiert den aktiven Geo-Kontext deterministisch
- **AND** das Präfix `perm:v1` erlaubt eine explizite Schema- und Rollout-Versionierung des Key-Raums

#### Scenario: Cache-Miss schreibt Snapshot nach Redis

- **WHEN** für einen Benutzer-/Kontextscope noch kein gültiger Snapshot in Redis existiert
- **THEN** werden die effektiven Berechtigungen aus den führenden IAM-Daten berechnet
- **AND** der resultierende Snapshot wird in Redis gespeichert

#### Scenario: Cache-Hit lädt Snapshot aus Redis

- **WHEN** für einen Benutzer-/Kontextscope ein gültiger Snapshot in Redis vorliegt
- **THEN** wird die Autorisierungsentscheidung auf Basis des Redis-Snapshots getroffen
- **AND** der Endpunkt benötigt für den Hit-Pfad keine erneute Permission-Berechnung

#### Scenario: TTL, Serialisierung und Eviction sind normiert

- **WHEN** ein Snapshot in Redis persistiert wird
- **THEN** beträgt die Basis-TTL 15 Minuten
- **AND** ein Recompute-Fenster von 30 Sekunden wird für Rebuild- und Degraded-State-Bewertung berücksichtigt
- **AND** der Snapshot wird als JSON serialisiert
- **AND** das Payload enthält mindestens `schema_version`, `signed_at`, `permissions`, `version` und `hmac`
- **AND** Redis ist mit der Eviction-Policy `allkeys-lru` zu betreiben

### Requirement: Normierter Lese- und Schreibpfad für Snapshot-Auflösung

Das System SHALL den Snapshot-Pfad für `POST /iam/authorize` und `GET /iam/me/permissions` in definierter Reihenfolge ausführen.

#### Scenario: Lese- und Schreibpfad läuft deterministisch ab

- **WHEN** eine Autorisierungsentscheidung effektive Rechte benötigt
- **THEN** prüft das System zuerst den lokalen In-Memory-Snapshot als L1
- **AND** bei L1-Miss oder stale wird Redis als primärer geteilter Snapshot-Store gelesen
- **AND** erst bei Redis-Miss oder Integritätsfehler wird ein Recompute gegen die führenden IAM-Daten ausgeführt
- **AND** ein erfolgreicher Recompute schreibt zuerst den Redis-Snapshot und danach den L1-Snapshot
- **AND** ein Recompute überschreitet maximal 6 Datenbank-Roundtrips

### Requirement: Fail-Closed für Redis- und Recompute-Fehler

Das System MUST bei Redis- oder Recompute-Fehlern fail-closed bleiben.

#### Scenario: Redis-Lookup oder Snapshot-Write schlägt fehl

- **WHEN** Redis im Autorisierungspfad nicht erreichbar ist oder ein Snapshot-Write nach Recompute fehlschlägt
- **THEN** antworten `POST /iam/authorize` und `GET /iam/me/permissions` mit HTTP 503
- **AND** es wird kein fachlicher Zugriff aus einem teilweisen oder nur lokal vorhandenen Zustand abgeleitet

#### Scenario: Stale Snapshot darf nicht als Fallback dienen

- **WHEN** ein vorhandener Snapshot stale ist und der Recompute scheitert
- **THEN** wird kein leeres oder veraltetes Permission-Set als Notfallantwort ausgeliefert
- **AND** die Anfrage endet mit HTTP 503
- **AND** der Fehler wird als technischer Incident geloggt und metriert

### Requirement: Ereignisbasierte Invalidierung für Snapshot-Kontexte

Das System SHALL Redis-Snapshots bei relevanten Mutationen gezielt invalidieren.

#### Scenario: Rollen- oder Membership-Änderung invalidiert betroffene Snapshots

- **WHEN** Rollen, Gruppen, Memberships, Permissions oder Hierarchiebezüge eines Benutzers geändert werden
- **THEN** werden die betroffenen Redis-Snapshots invalidiert oder versioniert unbrauchbar gemacht
- **AND** die nächste Anfrage erzeugt einen Snapshot auf Basis des aktuellen Zustands

#### Scenario: Eventverlust wird durch Fallback begrenzt

- **WHEN** ein Invalidation-Event nicht verarbeitet wird
- **THEN** begrenzen TTL- und Recompute-Regeln die Dauer potenziell veralteter Entscheidungen
- **AND** ein dokumentierter Fallback-Pfad bleibt aktiv

#### Scenario: Mutationsmatrix normiert Fanout und Scope der Invalidierung

- **WHEN** relevante IAM-Mutationen auftreten
- **THEN** gilt folgende Matrix verbindlich:

| Mutation | Event | Invalidation-Scope | Fanout-Regel |
|----------|-------|--------------------|--------------|
| Rollen-Permission geändert | `RolePermissionChanged` | gesamte Instanz | sofort, keine Benutzerselektion im Request-Pfad |
| Direkte Rollenzuweisung geändert | `account_role_assignment_changed` | betroffener Benutzer | gezielt per `keycloakSubject` |
| Gruppenmitgliedschaft geändert | `GroupMembershipChanged` | betroffener Benutzer | gezielt per `keycloakSubject` |
| Gruppe gelöscht | `GroupDeleted` | alle betroffenen Benutzer | Batch, betroffene Subjects im Event |
| Org-Membership oder Org-Kontext geändert | `organization_membership_changed` / Kontextwechsel | betroffener Benutzer | gezielt per `keycloakSubject` |
| Organisationshierarchie geändert | `OrgHierarchyChanged` | potenziell betroffene Instanz-Snapshots | asynchron, max. 200 Keys pro Batch, 500 ms Delay-Window |
| Geo-Zuordnung geändert | `GeoAssignmentChanged` | potenziell betroffene Instanz-Snapshots | asynchron, max. 200 Keys pro Batch, 500 ms Delay-Window |

### Requirement: Eventformat und Consumer-Verhalten für Redis-Invalidierung

Das System SHALL den Modul-Eventkontrakt für Snapshot-Invalidierung at-least-once und idempotent konsumieren.

#### Scenario: Event-Payload ist normiert

- **WHEN** ein Invalidation-Event publiziert wird
- **THEN** enthält es mindestens `eventId`, `event`, `instanceId` und den scopespezifischen Payload
- **AND** user-scoped Events enthalten `keycloakSubject`, sofern eine gezielte Benutzerinvalidierung möglich ist
- **AND** `GroupDeleted` enthält `affectedAccountIds[]` und, wenn verfügbar, `affectedKeycloakSubjects[]`

#### Scenario: Consumer verarbeitet Events idempotent

- **WHEN** ein Event mehrfach zugestellt wird
- **THEN** verarbeitet der Consumer es höchstens einmal pro `eventId`
- **AND** die Delivery-Semantik bleibt at-least-once
- **AND** unbekannte oder unvollständige Payloads führen nicht zu stiller Snapshot-Freigabe

### Requirement: Observability- und Alerting-Vertrag für Snapshot-Betrieb

Das System SHALL den Snapshot-Betrieb mit normierten Metriken, Logs und Infrastruktur-Targets absichern.

#### Scenario: Cache-Metriken und Logs sind vollständig

- **WHEN** der Snapshot-Pfad genutzt oder invalidiert wird
- **THEN** emittiert das System mindestens OTEL-Metriken für Cache-Lookups (`hit`/`miss`), Invalidation-Latenz und Recompute-Aktivität
- **AND** strukturierte Logs verwenden die Operationen `cache_lookup`, `cache_invalidate`, `cache_invalidate_failed`, `cache_stale_detected`, `cache_store_failed`
- **AND** Degraded- und Failed-State sind aus Logs und Metriken ableitbar

#### Scenario: Redis-Exporter ist Bestandteil des Betriebsmodells

- **WHEN** der Monitoring-Stack für die IAM-Autorisierung betrieben wird
- **THEN** ist `redis-exporter` als Prometheus-Scrape-Target vorgesehen
- **AND** Alerting korreliert Applikationsmetriken (`sva_iam_cache_*`) mit Redis-Infrastrukturmetriken

#### Scenario: Lastprofile und Berichtsformat sind verbindlich

- **WHEN** Performance-Nachweise für die Snapshot-Strecke erstellt werden
- **THEN** enthalten sie mindestens die Lastprofile `N = 100` gleichzeitige Requests für `lokal` und `Slow-4G`
- **AND** der Bericht dokumentiert Testprofil, Messumgebung, Stichprobenzahl, p50/p95/p99, Abnahmegrenzen, verwendete Endpunkte und Abweichungen

### Requirement: Endpoint-nahe Performance-Verifikation für Authorize

Das System SHALL die Redis-gestützte Authorize-Strecke endpoint-nah unter Last verifizieren.

#### Scenario: Lastprofil wird mit Bericht nachgewiesen

- **WHEN** die Redis-gestützte Authorize-Strecke gegen das vereinbarte Lastprofil getestet wird (100 gleichzeitige Requests, lokales Netz)
- **THEN** werden mindestens Cache-Hit-, Cache-Miss- und Recompute-Szenarien gemessen
- **AND** die Abnahmegrenzen werden eingehalten: Cache-Hit p95 < 5 ms, Cache-Miss p95 < 80 ms, Recompute p95 < 300 ms
- **AND** die Ergebnisse werden versioniert als Bericht unter `docs/reports/` mit Pflichtfeldern (Testprofil, Messumgebung, Stichprobenzahl, p50/p95/p99) dokumentiert

### Requirement: API-Erweiterungskontrakt für Autorisierungsendpunkte

Das System SHALL die neuen Felder in `POST /iam/authorize` und `GET /iam/me/permissions` additiv und nicht-brechend ergänzen.

**Normatives JSON-Beispiel `POST /iam/authorize` Response:**
```json
{
  "allowed": true,
  "reason": "allowed_by_abac",
  "instanceId": "de-musterhausen",
  "action": "content.read",
  "resourceType": "content",
  "resourceId": "article-1",
  "cacheStatus": "hit",
  "snapshotVersion": "f84a6f7b9c3d2e10",
  "provenance": {
    "sourceKinds": ["group_role"],
    "inheritedFromGeoUnitId": "geo-bw"
  }
}
```

Bei Verweigerung enthält `reason` einen maschinenlesbaren Code (z. B. `geo_scope_mismatch`, `hierarchy_restriction`, `instance_scope_mismatch`) und der bestehende Error-Envelope bleibt für echte `4xx/5xx`-Fehler stabil.

**Normatives JSON-Beispiel `GET /iam/me/permissions` Response (Auszug):**
```json
{
  "instanceId": "de-musterhausen",
  "permissions": [
    {
      "action": "content.write",
      "resourceType": "content",
      "effect": "allow",
      "organizationId": "uuid-org",
      "sourceRoleIds": ["uuid-role"],
      "sourceGroupIds": ["uuid-group"],
      "scope": {
        "allowedGeoUnitIds": ["geo-bw"],
        "restrictedGeoUnitIds": ["geo-bw-stuttgart"]
      },
      "provenance": {
        "sourceKinds": ["group_role"]
      }
    }
  ],
  "cacheStatus": "hit",
  "snapshotVersion": "f84a6f7b9c3d2e10",
  "provenance": {
    "hasGroupDerivedPermissions": true,
    "hasGeoInheritance": true
  }
}
```

#### Scenario: Me-Permissions akzeptiert optionalen Geo-Kontext additiv

- **WHEN** `GET /iam/me/permissions` mit `geoUnitId` und `geoHierarchy` aufgerufen wird
- **THEN** werden diese Werte nur als additive Laufzeitdimension für Snapshot-Key, Provenance und Scope-Auswertung verwendet
- **AND** ungültige Geo-Parameter werden mit `400 invalid_request` abgewiesen

#### Scenario: Consumer mit strict-parse erhält unbekannte Felder

- **WHEN** ein Consumer `POST /iam/authorize` aufruft und neue optionale Felder im Response erscheinen
- **THEN** bleiben alle bisherigen Felder unverändert und rückwärtskompatibel
- **AND** neue optionale Felder sind additive Erweiterungen (kein breaking change)

### Requirement: Integrität von Redis-Permission-Snapshots

Das System MUST Redis-Snapshots gegen unbefugte Manipulation schützen.

#### Scenario: Snapshot wird vor dem Schreiben signiert

- **WHEN** ein Permission-Snapshot in Redis geschrieben wird
- **THEN** wird der Payload mit HMAC-SHA-256 signiert; der Schlüssel liegt außerhalb von Redis (z. B. Anwendungs-Secret)
- **AND** der Snapshot enthält ein `schema_version`-Feld und einen `signed_at`-Zeitstempel

#### Scenario: Signaturprüfung schlägt fehl

- **WHEN** ein aus Redis gelesener Snapshot eine ungültige oder fehlende Signatur aufweist
- **THEN** wird der Snapshot verworfen und wie ein Cache-Miss behandelt (Recompute)
- **AND** der Vorfall wird als strukturiertes Log-Event mit `integrity_check_failed: true` protokolliert

### Requirement: Strukturierte Logs für Autorisierungsentscheidungen

Das System SHALL alle Autorisierungsentscheidungen mit folgenden Pflichtfeldern protokollieren.

#### Scenario: Autorisierungsentscheidung wird geloggt

- **WHEN** `POST /iam/authorize` eine Entscheidung trifft
- **THEN** enthält der Log-Eintrag: `workspace_id`, `component`, `trace_id`, `request_id`, `cache_status` (`hit`|`miss`|`recompute`), `decision_source` (`role`|`group`|`org_inherit`|`geo_inherit`)
- **AND** PII-Felder wie `user_email`, `session_id` oder Klartextnamen sind verboten

### Requirement: Conflict-Testmatrix für Gruppen, Rollen, Org und Geo

Das System SHALL deterministische Entscheidungen für alle bekannten Konfliktfälle treffen. Die folgende Testmatrix ist normativ:

| Quelle A | Quelle B | Erwartetes Ergebnis | Begründung |
|----------|----------|---------------------|------------|
| Rolle: allow | Gruppe: deny (gleiche Ressource) | deny | deny vor allow |
| Gruppe: allow | Geo-Restriktion | deny | lokal vor vererbt |
| Org-Parent: allow | Org-Child: deny | deny | lokal vor Parent |
| Org-Parent: allow | Org-Child: kein Eintrag | allow | Vererbung greift |
| Geo-Parent: allow | Geo-Child: deny | deny | lokal vor Parent |
| Geo-Parent: allow | Geo-Child (3. Ebene): deny | deny | 3+-Ebenen denselben Regeln |
| Rolle: allow | Org-Child: deny + Gruppe: allow | deny | deny schlägt alle allow |
| permission_key-legacy: allow | Strukturiert: deny | deny | strukturiert vor legacy |

#### Scenario: Dreistufige Geo-Hierarchie mit Konflikten

- **WHEN** auf Ebene 1 (Bundesland) eine `allow`-Berechtigung vorliegt, Ebene 2 (Landkreis) keinen Eintrag hat und Ebene 3 (Gemeinde) eine `deny`-Regel trägt
- **THEN** wird die Berechtigung für Ebene 3 verweigert
- **AND** identischer Kontext führt immer zu identischem Ergebnis

#### Scenario: Mixed-State-Migration — partial permission_key und strukturiert

- **WHEN** 50 % der Rollen-Permissions noch als `permission_key`-String vorliegen und 50 % bereits strukturiert sind
- **THEN** werden beide Formate für dieselbe Autorisierungsentscheidung korrekt ausgewertet
- **AND** strukturierte Permissions haben bei Widerspruch Vorrang vor legacy-Strings
- **AND** die Entscheidung erzeugt kein inkonsistentes Reasoning

### Requirement: Normierte Abnahmematrix für Vererbung, Cache, Invalidierung und Migration

Das System SHALL für Paket 4A eine tabellarische Abnahmematrix bereitstellen, die Vererbung, Restriktionen, Snapshot-Cache, Event-Invalidierung und Mixed-State-Migration in einem gemeinsamen Testset normiert.

#### Scenario: Abnahmematrix deckt alle Pflichtkategorien ab

- **WHEN** die technische Abnahme für Paket 4A vorbereitet oder nachgewiesen wird
- **THEN** enthält die Matrix mindestens Fälle für Org-Vererbung, Geo-Vererbung mit drei oder mehr Ebenen, lokale Restriktionen, Cache-Hit, Cache-Miss, Recompute, Event-Invalidierung, Event-Duplikate, Mixed-State-Migration und Race-Conditions
- **AND** jeder Fall dokumentiert Ausgangslage, Mutation oder Anfrage, erwarteten Cache-Status und das normative Ergebnis

#### Scenario: Paket-4A-Abnahmematrix ist tabellarisch normiert

- **WHEN** die Abnahmematrix erstellt wird
- **THEN** gilt mindestens folgende Tabelle verbindlich:

| Kategorie | Ausgangslage | Mutation / Anfrage | Erwarteter Cache-Status | Erwartetes Ergebnis |
|-----------|--------------|--------------------|-------------------------|---------------------|
| Org-Vererbung | Parent-Org `allow`, Child ohne lokale Regel | `POST /iam/authorize` im Child-Kontext | `miss` oder `recompute` beim Erstlauf | `allow`, Reasoning verweist auf Parent-Vererbung |
| Org-Restriktion | Parent-Org `allow`, Child-Org `deny` | `POST /iam/authorize` im Child-Kontext | `hit` oder `miss` zulässig | `deny`, lokale Restriktion schlägt Parent-Allow |
| Geo-Vererbung 3 Ebenen | Geo-Parent `allow`, Ebene 2 ohne Regel, Ebene 3 `deny` | `POST /iam/authorize` auf Ebene 3 | `miss` oder `recompute` beim Erstlauf | `deny`, Denial-Reason für Child-Restriktion |
| Cache-Hit | Gültiger Snapshot für `{instanceId,userId,orgCtxHash,geoCtxHash}` vorhanden | Wiederholter `POST /iam/authorize` mit identischem Kontext | `hit` | keine zusätzliche Datenbankberechnung erforderlich |
| Cache-Miss | Kein Snapshot vorhanden | Erstaufruf `GET /iam/me/permissions` | `miss` gefolgt von Write | Snapshot wird berechnet und in Redis persistiert |
| Recompute nach TTL | Snapshot abgelaufen, Redis erreichbar | `POST /iam/authorize` nach TTL | `recompute` | neue Entscheidung aus führenden Daten, alter Snapshot wird nicht weiterverwendet |
| Mixed-State-Migration | Rolle enthält legacy `permission_key` und strukturierte Permission mit Widerspruch | `POST /iam/authorize` | `miss` oder `recompute` | strukturierte Permission gewinnt deterministisch |
| User-scoped Invalidierung | Gruppenmitgliedschaft eines Benutzers ändert sich | Event `GroupMembershipChanged` | nächster Zugriff `miss` oder `recompute` | alter Snapshot dieses Benutzers ist unbrauchbar |
| Hierarchische Invalidierung | Org-Hierarchie einer Instanz ändert sich | Event `OrgHierarchyChanged` | betroffene Folgezugriffe `miss` oder `recompute` | betroffene Instanz-Snapshots werden asynchron erneuert |
| Event-Duplikat | identisches Invalidation-Event wird mehrfach zugestellt | Consumer verarbeitet dieselbe `eventId` erneut | unverändert | keine doppelte Seiteneffekte, Idempotenz bleibt gewahrt |
| Race-Condition Recompute vs. Mutation | Snapshot-Recompute läuft, während eine Rollen- oder Gruppenmutation committed wird | Mutation direkt vor Snapshot-Write | final `recompute` auf aktuellem Stand oder erneuter `miss` | kein veralteter Snapshot darf als gültiger Endzustand bestehen bleiben |
| Fail-Closed bei Recompute-Fehler | Snapshot stale, Redis oder Recompute scheitert | `POST /iam/authorize` unter Fehlerlast | `recompute` fehlgeschlagen | HTTP 503, kein stiller Zugriff |

### Requirement: Wiederverwendbare Autorisierungs- und Prüfdaten für Rechteverwaltung

Das System SHALL die bestehende Rollenverwaltung, Rechteübersicht und Szenario-Prüfung auf denselben vorhandenen Autorisierungs- und Permissions-Daten aufbauen lassen.

#### Scenario: Rollennahe Rechteansichten nutzen bestehende Permissions-Felder

- **WHEN** eine Admin-UI Rollenrechte, effektive Rechte oder Prüfergebnisse darstellt
- **THEN** kann sie auf vorhandene strukturierte Felder wie `action`, `resourceType`, optionale `resourceId`, optionale `organizationId`, optionale `effect`, optionale `scope`, `sourceRoleIds` und `sourceGroupIds` zugreifen
- **AND** diese Felder bleiben ohne zusätzliche serverseitige Sonderlogik UI-tauglich

#### Scenario: Rechteprüfung verwendet bestehende Authorize-Pfade

- **WHEN** ein Administrator aus der Rollenverwaltung heraus eine konkrete Rechteentscheidung nachvollziehen möchte
- **THEN** verwendet die UI denselben serverseitigen Prüfpfad wie die bestehende IAM-Szenario-Prüfung oder operative Autorisierung
- **AND** es entsteht keine zweite konkurrierende Entscheidungslogik nur für die Rollenansicht

#### Scenario: Explainability bleibt auf vorhandene strukturierte Diagnostik begrenzt

- **WHEN** Diagnose- oder Begründungsdaten an Rollenverwaltung oder Fach-UI ausgeliefert werden
- **THEN** bestehen diese aus den bestehenden allowlist-basierten Diagnosefeldern, Reason-Codes oder Denial-Codes
- **AND** die UI muss keine unstrukturierten Rohdiagnosen interpretieren
- **AND** interne Policy- oder Identitätsdetails werden nicht offengelegt

#### Scenario: Fehlende Prüfdaten bleiben als definierter Zustand behandelbar

- **WHEN** eine Autorisierungsentscheidung oder Permissions-Antwort keine optionalen Diagnosefelder enthält
- **THEN** bleibt mindestens ein stabiler Entscheidungs- oder Fehlerkontext wie `allowed`, `reason` oder ein strukturierter Denial-Fehler verfügbar
- **AND** die UI kann den Zustand verständlich darstellen, ohne aus dem Fehlen optionaler Prüfdaten eine Erlaubnis abzuleiten

### Requirement: Inkrementelle Rechteverwaltung ohne neues Ownership-Modell

Das System SHALL eine erweiterte Rechteverwaltungs-UI ermöglichen, ohne dafür in diesem Change ein neues Ownership-, Transfer- oder Override-Modell vorauszusetzen.

#### Scenario: Bestehendes Rollen- und Permission-Modell bleibt Grundlage

- **WHEN** die Rechteverwaltungs-UI erweitert wird
- **THEN** basiert sie weiterhin auf den bestehenden Rollen-, Permission- und Authorize-Contracts
- **AND** ein neues autorisierungsrelevantes Ownership-Modell ist keine Voraussetzung für die erste Ausbaustufe

#### Scenario: Technische Permission-Referenzen bleiben kompatibel nutzbar

- **WHEN** Rollen-Permissions noch ganz oder teilweise über technische Referenzen wie `permissionKey` modelliert sind
- **THEN** bleiben diese Referenzen im System und in kompatiblen APIs nutzbar
- **AND** die UI darf darüber eine fachlich lesbarere Mapping-Schicht legen
- **AND** bestehende Rollenauflösung und bestehende Entscheidungen brechen dadurch nicht

#### Scenario: Read-only-Zustände sind serverseitig anschlussfähig

- **WHEN** eine Rolle aufgrund von `isSystemRole` oder `managedBy != studio` fachlich nicht editierbar ist
- **THEN** bleibt die Bearbeitung serverseitig begrenzt oder verweigert
- **AND** die UI kann diesen Zustand ohne eigene heuristische Sonderlogik konsistent darstellen

### Requirement: Konsistente Fehler- und Konfliktkommunikation für Admin- und Fach-UI

Das System SHALL für Rechteverwaltung und priorisierte Fach-UI stabile Fehler- und Konfliktsignale bereitstellen, die auf dem heutigen Modell aufsetzen.

#### Scenario: Serverseitige Verweigerung bleibt verständlich darstellbar

- **WHEN** eine Rollenänderung, eine Rechteprüfung oder eine Fachaktion serverseitig verweigert wird
- **THEN** liefert das System einen strukturierten Fehler- oder Denial-Kontext, der der UI eine verständliche Darstellung erlaubt
- **AND** die UI muss nicht zwischen ungeprüften Textmeldungen und HTTP-Statuscodes reverse-engineeren

#### Scenario: Konflikte bei Rollenänderungen bleiben von generischen Fehlern unterscheidbar

- **WHEN** eine Rollenänderung aufgrund von Read-only-Regeln, Synchronisationsstand oder konkurrierender Änderung nicht übernommen werden kann
- **THEN** liefert das System einen strukturierten Konflikt- oder Denial-Kontext mit stabiler Klassifikation
- **AND** die UI kann diesen Zustand gesondert von generischen Transport- oder Validierungsfehlern behandeln

#### Scenario: Vorschau und operative Prüfung bleiben logisch anschlussfähig

- **WHEN** eine UI eine Rechteprüfung vorab darstellt oder einen operativen Fehler nach einer Aktion verarbeitet
- **THEN** beruhen beide auf demselben bestehenden Autorisierungs- und Diagnosemodell
- **AND** Unterschiede zwischen Rollen-Kontext, effektiver Berechtigung und konkreter Anfrage bleiben nachvollziehbar

### Requirement: Rollenbasierte Autorisierung für Inhaltsverwaltung

Das System SHALL die Inhaltsverwaltung über die zentrale IAM-Autorisierung absichern.

#### Scenario: Zugriff auf Inhaltsliste ohne Leserecht

- **WHEN** ein Benutzer die Seite `Inhalte` oder eine Inhaltsdetailseite aufruft
- **AND** ihm im aktiven Kontext die Berechtigung `content.read` fehlt
- **THEN** verweigert das System den Zugriff
- **AND** es werden keine Inhaltsdaten offengelegt

#### Scenario: Read-only-Zugriff auf Inhalte

- **WHEN** ein Benutzer `content.read`, aber keine schreibenden Inhaltsrechte besitzt
- **THEN** kann er Liste, Detailansicht und freigegebene Historie lesen
- **AND** Erstellungs-, Bearbeitungs- und Statuswechselaktionen bleiben gesperrt

#### Scenario: Statuswechsel erfordert passende Fachberechtigung

- **WHEN** ein Benutzer den Status eines Inhalts ändern will
- **THEN** prüft das System die dazu passende Inhaltsberechtigung wie `content.submit_review`, `content.approve`, `content.publish` oder `content.archive`
- **AND** ein unzulässiger Statuswechsel wird serverseitig abgewiesen

#### Scenario: Inhaltsrechte werden im aktiven Scope ausgewertet

- **WHEN** eine Berechtigungsprüfung für Inhaltsverwaltung erfolgt
- **THEN** wertet das System die Rechte im aktiven `instanceId`- und Organisationskontext aus
- **AND** Rechte aus fremden Instanzen oder unzulässigen Organisationskontexten bleiben wirkungslos

### Requirement: Einheitliches Zielformat für autorisierbare Action-IDs
Das IAM-System MUST autorisierbare Action-IDs langfristig in einem einheitlichen fully-qualified Format `<namespace>.<actionName>` behandeln, unabhängig davon, ob die Action aus dem Core oder aus einem Plugin stammt.

#### Scenario: Core-Action verwendet das gemeinsame Zielformat
- **WHEN** ein Client `POST /iam/authorize` für eine interne Action wie `content.read` aufruft
- **THEN** wird die Action als gültige fully-qualified Action-ID akzeptiert
- **AND** sie folgt demselben Formatvertrag wie eine Plugin-Action

#### Scenario: Plugin-Action verwendet das gemeinsame Zielformat
- **WHEN** ein Client `POST /iam/authorize` für eine Plugin-Action wie `news.create` aufruft
- **THEN** wird die Action als gültige fully-qualified Action-ID akzeptiert
- **AND** sie folgt demselben Formatvertrag wie eine interne Core-Action

### Requirement: Namespace-sichere Plugin-Action-Autorisierung
Das IAM-System MUST Plugin-Aktionen in vollständig qualifizierter Form autorisieren und Action-IDs ohne Namespace-Kollaps oder implizites Prefix-Mapping auswerten.

#### Scenario: Authorize nutzt vollständig qualifizierte Action-ID
- **WHEN** ein Client `POST /iam/authorize` für `news.create` aufruft
- **THEN** wird genau `news.create` gegen die effektiven Berechtigungen ausgewertet
- **AND** es findet keine implizite Umdeutung auf `create`, `content.create` oder einen anderen Namespace statt

#### Scenario: Fremder Namespace bleibt verboten
- **WHEN** ein Plugin ohne passende Berechtigung eine fremde Action-ID wie `events.publish` ausführen will
- **THEN** liefert die Autorisierung eine Deny-Entscheidung
- **AND** die Diagnose bleibt auf die vollständig qualifizierte Action-ID referenzierbar

### Requirement: Legacy-Kurzformen bleiben eine explizite Übergangsphase
Das IAM-System MUST unqualifizierte Legacy-Action-Strings wie `read`, `write` oder `create` nur als zeitlich begrenzte Übergangsphase behandeln und darf daraus keine implizite Namespace-Zuordnung ableiten.

#### Scenario: Legacy-Kurzform erhält keinen impliziten Namespace
- **WHEN** eine unqualifizierte Legacy-Action wie `read` verarbeitet wird
- **THEN** wird sie nicht implizit zu `content.read`, `news.read` oder einem anderen fully-qualified Namen umgedeutet
- **AND** eine zukünftige Verschärfung des Request-Schemas kann diese Legacy-Kurzform vollständig verbieten

### Requirement: Normale Tenant-Admin-Mutationen nutzen ausschließlich den Tenant-Admin-Client

Das System SHALL normale Tenant-Admin-Mutationen ausschließlich über den tenantlokalen Admin-Client der aktiven Instanz ausführen.

#### Scenario: Tenant-User-CRUD löst Tenant-Admin-Client auf

- **WHEN** innerhalb eines Tenant-Hosts Nutzer, Rollen, Gruppen oder Zuordnungen geändert werden
- **THEN** löst der Server Realm und Client aus `iam.instances.authRealm` und `iam.instances.tenantAdminClient`
- **AND** verwendet keinen globalen Plattform-Admin-Client als stillen Fallback

#### Scenario: Tenant-Admin-Client ist nicht konfiguriert

- **WHEN** eine normale Tenant-Mutation ausgeführt werden soll, aber `tenantAdminClient` fehlt oder unvollständig ist
- **THEN** lehnt das System die Mutation fail-closed ab
- **AND** liefert einen strukturierten Fehler wie `tenant_admin_not_configured`
- **AND** leitet die Operation nicht implizit auf den Plattformpfad um

### Requirement: Login-Client und Tenant-Admin-Client bleiben diagnostisch getrennt

Das System SHALL Login-Pfad, Tenant-Admin-Pfad und Plattformpfad in Diagnosen und Health-Antworten getrennt ausweisen.

#### Scenario: Tenant-Health zeigt getrennte Auth-Artefakte

- **WHEN** Health-, Doctor- oder Diagnoseinformationen für eine Tenant-Instanz abgefragt werden
- **THEN** enthalten sie mindestens den Login-Realm, den Login-Client, den Tenant-Admin-Realm und den Tenant-Admin-Client
- **AND** weisen sie den verwendeten `executionMode` und die `resolutionSource` aus

#### Scenario: Break-Glass bleibt expliziter Sonderpfad

- **WHEN** eine Plattform- oder Break-Glass-Operation tenant-interne Daten ändern darf
- **THEN** ist dieser Modus technisch und auditierbar als `break_glass` oder `platform_admin` gekennzeichnet
- **AND** wird nicht als Normalpfad für Tenant-Admin-Screens verwendet

