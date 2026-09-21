## MODIFIED Requirements

### Requirement: Gesteuerter Tenant-Lebenszyklus

Das System SHALL den Lebenszyklus einer Instanz über explizite Statuswerte
steuern. Die technische Bereitstellung und die produktive Aktivierung SHALL
getrennte Übergänge bleiben. Ausschließlich eine ausdrücklich bestätigte,
serverseitig nachweisgebundene Benutzeraktion darf eine Instanz auf `active`
setzen.

#### Scenario: Instanz wird manuell aktiviert

- **WHEN** eine neue Instanz vollständig provisioniert ist
- **AND** alle aktuellen blockierenden technischen Bereitschaftsnachweise erfolgreich sind
- **AND** ein berechtigter Benutzer die kritische Aktivierungsaktion mit
  gültigem kanalgebundenem Identitäts- und Bestätigungsnachweis bestätigt
- **THEN** prüft der Server die aktuellen Nachweise und Revisionen erneut
- **AND** wechselt der Status kontrolliert auf `active`
- **AND** erst ab diesem Zeitpunkt darf produktiver Traffic für ihren Host
  zugelassen werden

#### Scenario: Technische Bereitstellung aktiviert nicht automatisch

- **WHEN** ein Provisioning-Worker, Recovery-Scheduler oder MCP-Gesamtprozess
  alle technischen Schritte erfolgreich abgeschlossen hat
- **THEN** weist das System die Instanz als `awaiting_activation` oder fachlich
  gleichwertig wartend aus
- **AND** setzt keiner dieser technischen Prozesse den Instanzstatus auf
  `active`
- **AND** nennt die Antwort die ausstehende manuelle Aktivierung als nächste
  kritische Aktion

#### Scenario: Kassel verwendet denselben fachlichen Tenant-Lebenszyklus

- **WHEN** eine Instanz im Kasseler Betriebsprofil angelegt und bereitgestellt
  wird
- **THEN** gelten dieselben Create-Gates, Zustandsklassen, Fehler- und
  Retry-Verträge wie in anderen Betriebsprofilen
- **AND** erweitert der Kasseler Provisioner ausschließlich die technischen
  Ingress-, TLS- und Readiness-Schritte
- **AND** setzt auch der Kasseler Elternlauf die Instanz nicht automatisch auf
  `active`

#### Scenario: Aktivierung wird bei veralteter oder unvollständiger Evidenz abgelehnt

- **WHEN** der kanalgebundene Bestätigungsnachweis, die Instanzrevision oder ein blockierender
  Betriebsnachweis fehlt, veraltet oder widersprüchlich ist
- **THEN** lehnt das System die Aktivierung fail-closed ab
- **AND** bleibt die Instanz im zuletzt sicheren Zustand
- **AND** nennt der Befund den betroffenen Nachweis, die erforderliche Behebung
  und die anschließend auszuführende Prüfung

#### Scenario: Instanz wird suspendiert oder archiviert

- **WHEN** eine Instanz außer Betrieb genommen oder temporär gesperrt wird
- **THEN** wird ihr Status fachlich nachvollziehbar auf `suspended` oder
  `archived` gesetzt
- **AND** produktiver Host-Traffic wird danach fail-closed abgelehnt

### Requirement: Modularer MCP-Instanzprozess mit Doctor-Abnahme

Das System SHALL berechtigten MCP-Operatoren einen modularen Gesamtprozess für die Neuanlage, Reparatur und Anpassung von Studio-Instanzen bereitstellen. Der Prozess SHALL die vorhandenen fachlichen Registry-, Modul-, Keycloak- und IAM-Verträge orchestrieren, ohne einen parallelen Provisioning-Pfad einzuführen.

#### Scenario: Neue Instanz wird erst nach vollständiger Abnahme als abgeschlossen gemeldet

- **WHEN** ein MCP-Operator den Gesamtprozess im Modus `create` für eine neue Instanz ausführt
- **THEN** legt das System Registry, angeforderte Module, IAM-Basis und Keycloak-Artefakte über die bestehenden Verträge an
- **AND** wartet es auf das terminale Ergebnis des Keycloak-Workers
- **AND** führt es einen aktuellen Postflight, einen Rollenabgleich und eine tenantlokale Rechteprobe aus
- **AND** meldet es `completed: true` nur, wenn die Instanz aktiv ist und alle für den Auftrag erforderlichen technischen Doctor-Achsen `ready` sind
- **AND** verlangt es weder einen Browsernachweis noch eine zusätzliche
  Abnahmeaktion nach der Aktivierung

#### Scenario: Kritische Aktivierung bleibt Human-in-the-Loop

- **WHEN** die technische Abnahme erfolgreich ist, die Instanz aber noch nicht aktiviert wurde
- **THEN** meldet der Gesamtprozess `awaiting_human_action` und `completed: false`
- **AND** erklärt die Antwort verständlich, dass die Aktivierung noch aussteht und warum sie nicht automatisch ausgeführt wurde
- **AND** nennt sie die konkrete nächste Action und die erforderliche serverseitige Bestätigungs-Challenge

#### Scenario: Bestehende Instanz wird gezielt repariert oder angepasst

- **WHEN** ein MCP-Operator den Gesamtprozess im Modus `repair` oder `adapt` aufruft, beispielsweise um ein Modul hinzuzufügen
- **THEN** ermittelt das System den aktuellen Zustand und führt nur erforderliche, idempotente Schritte aus
- **AND** ergänzt für neue Module deren IAM-Basis und Admin-Struktur über die gemeinsame Modul-IAM-Vertragsquelle
- **AND** liefert es nach dem Postflight eine verständliche Beschreibung der erledigten, offenen und blockierten Schritte

#### Scenario: Historischer Preflight übersteuert keinen aktuellen erfolgreichen Zustand

- **WHEN** ein Keycloak-Worker vor der Mutation einen Preflight gespeichert und die Mutation anschließend erfolgreich abgeschlossen hat
- **THEN** persistiert der Worker einen separaten aktuellen Postflight
- **AND** verwenden Doctor, Instanzdetail und MCP für die Abschlussbewertung den aktuellen Status oder den Postflight statt des historischen Preflights

#### Scenario: Prozessantwort bleibt verständlich und handlungsfähig

- **WHEN** ein Gesamtprozess abgeschlossen, blockiert oder auf menschliche Bestätigung wartet
- **THEN** enthält die MCP-Antwort den aktuellen Schritt, erledigte und offene Schritte, Doctor-Zusammenfassung, Korrelation und eine konkrete nächste Aktion
- **AND** ergänzt sie stabile technische Codes nur als Diagnosehilfe
- **AND** enthält sie keine Secrets, Tokens, Passwörter oder unnötigen Providerdetails

#### Scenario: Jeder MCP-Modus wartet auf die konkrete Planbestätigung

- **WHEN** `create`, `repair` oder `adapt` eine nicht bereits bestätigte
  Keycloak-Mutation benötigt
- **THEN** liefert der Prozess `awaiting_human_action` und `completed: false`
- **AND** enthält die Antwort Instanz, Intent, Plan-Fingerprint, geplante
  Änderungen und die erlaubte nächste Aktion
- **AND** führen weder Execute noch Reconcile die Mutation ohne ausdrücklich
  menschlich bestätigten und serverseitig erneut geprüften Plan aus

#### Scenario: Bestätigter Prozess wird über den bestehenden Run fortgesetzt

- **WHEN** ein berechtigter Operator den geprüften Plan ausdrücklich bestätigt
- **THEN** prüft der Server Akteur, Instanz, Intent und aktuellen Plan erneut
- **AND** bindet er die Freigabe an den vorhandenen Ausführungsvertrag
- **AND** liest eine Wiederaufnahme nach Tool-Timeout oder Kanalwechsel den
  bestehenden Run statt Instanz oder laufenden Auftrag zu duplizieren
- **AND** bleibt die spätere Aktivierung eine getrennte menschliche Aktion

#### Scenario: Veraltete oder fremde Planbestätigung mutiert nichts

- **WHEN** der übergebene Plan-Fingerprint veraltet oder an eine andere
  Instanz beziehungsweise einen anderen Intent gebunden ist
- **THEN** lehnt der Server die Ausführung ohne Keycloak-Mutation ab
- **AND** liefert der Prozess den aktuellen Plan zur erneuten Bestätigung

## ADDED Requirements

### Requirement: Tenant-Draft besitzt eine verbindliche Create-Readiness

Das System SHALL für noch nicht persistierte Tenant-Daten eine gemeinsame
read-only Create-Readiness bereitstellen. UI und MCP SHALL denselben
serverseitigen Vertrag verwenden. Der Vertrag SHALL Befunde getrennt als
Anlageblocker, Bereitstellungsblocker oder Aktivierungsblocker klassifizieren.

#### Scenario: Readiness wird vor der Bestätigung angezeigt

- **WHEN** ein berechtigter Benutzer oder MCP-Operator einen vollständigen
  Tenant-Draft prüfen lässt
- **THEN** validiert das System Eingaben, Registry-Konflikte,
  Keycloak-Verfügbarkeit, Realm-Eignung und bekannte Background-Fähigkeiten
  ohne fachliche Mutation
- **AND** liefert es pro Befund Ursache, Auswirkung, Behebung, Zuständigkeit,
  Folgeprüfung und Korrelation
- **AND** zeigt es ausdrücklich, ob die Tenant-Anlage möglich ist

#### Scenario: Create wiederholt die anlageblockierenden Prüfungen

- **WHEN** nach einem erfolgreichen angezeigten Preflight die verbindliche
  Tenant-Anlage angefordert wird
- **THEN** führt der Server die aktuellen anlageblockierenden Prüfungen
  unmittelbar vor der Registry-Persistenz erneut aus
- **AND** verlässt er sich nicht allein auf einen Clientzustand, eine alte
  Preflight-Antwort oder einen lokalen MCP-Entscheid

#### Scenario: Privilegierte Keycloak-Prüfung bleibt im Provisioner

- **WHEN** UI oder MCP Realm-Katalog, Draft-Readiness oder Registry-Create am
  öffentlichen App-Endpunkt anfordert
- **THEN** leitet die App ausschließlich die fest erlaubte Methode und den
  fest erlaubten Pfad an den privaten Provisioner weiter
- **AND** prüft der Provisioner Authentifizierung, CSRF und `instance.create`
  erneut, bevor er die globale Keycloak-Provisioner-Identität verwendet
- **AND** erhält der App-Prozess weder diese Identität noch einen lokalen
  Fallback auf eine andere Keycloak-Identität
- **AND** schlägt der Request bei einem nicht erreichbaren oder ungültig
  konfigurierten Provisioner fail-closed fehl

#### Scenario: Keycloak ist vor Create nicht erreichbar

- **WHEN** Keycloak unmittelbar vor der Registry-Persistenz nicht erreichbar
  oder der Admin-Zugang nicht ausreichend autorisiert ist
- **THEN** lehnt das System die Tenant-Anlage ab
- **AND** persistiert es weder Tenant noch Bereitstellungsauftrag
- **AND** nennt die Antwort die betriebliche Voraussetzung und die sichere
  erneute Prüfung

#### Scenario: Tenant-Admin-Stammdaten sind unvollständig

- **WHEN** Benutzername, gültige E-Mail, Vorname oder Nachname des initialen
  Tenant-Admins fehlen
- **THEN** klassifiziert die Draft-Readiness die konkreten Felder als
  Anlageblocker
- **AND** nennt sie erwartetes Format beziehungsweise erforderlichen Wert
- **AND** persistiert der Create-Endpunkt keinen Tenant mit unvollständigem
  initialen Admin-Profil

#### Scenario: MCP verwendet keine parallele Readiness-Logik

- **WHEN** ein MCP-Operator einen Tenant prüft oder anlegt
- **THEN** verwendet der MCP-Pfad die serverseitige Realm-Discovery,
  Draft-Readiness und den authoritative Create-Vertrag
- **AND** rekonstruiert er Anlage- oder Aktivierungsfreigaben nicht aus
  lokalen Heuristiken

### Requirement: Bestands-Realms werden sicher entdeckt und bewertet

Das System SHALL für `realmMode = existing` einen autorisierten,
durchsuchbaren Realm-Katalog und eine read-only Eignungsprüfung bereitstellen.
Freie Realm-Texteingabe SHALL nicht der reguläre UI- oder MCP-Pfad sein.

#### Scenario: Verfügbare Realms werden mit Auswahlstatus aufgelistet

- **WHEN** ein berechtigter Root-Administrator nach Bestands-Realms sucht
- **THEN** liefert das System die aktuell in Keycloak lesbaren Realms
  paginierbar und mit minimalen auswahlrelevanten Daten
- **AND** kennzeichnet es jeden Eintrag serverseitig als auswählbar oder
  deaktiviert
- **AND** enthält ein deaktivierter Eintrag einen stabilen Grundcode

#### Scenario: System-Realm master bleibt sichtbar aber gesperrt

- **WHEN** der Realm-Katalog den Realm `master` enthält
- **THEN** zeigt der Vertrag ihn mit dem Grund `system_realm` als deaktiviert
- **AND** lehnt der Create-Endpunkt `master` auch bei einem direkten HTTP-
  oder MCP-Aufruf ab

#### Scenario: Bereits zugeordneter Realm bleibt gesperrt

- **WHEN** ein Realm bereits einer anderen Studio-Instanz zugeordnet ist
- **THEN** zeigt der Katalog ihn mit dem Grund `already_assigned` als
  deaktiviert
- **AND** verhindert die eindeutige Registry-Zuordnung zusätzlich ein Race
  zwischen Auswahl und Create

#### Scenario: Realm ist automatisch ergänzbar

- **WHEN** einem lesbaren Bestands-Realm ausschließlich fehlende oder
  eindeutig Studio-eigene Vertragsartefakte fehlen
- **THEN** klassifiziert das System ihn als `auto_completable`
- **AND** zeigt es vor der Tenant-Anlage den konkreten noch nicht ausgeführten
  Änderungsplan

#### Scenario: Bestands-Secret wird später sicher abgeglichen

- **WHEN** ein geeigneter Bestands-Realm gewählt wurde
- **AND** das bestehende Tenant-Client-Secret im Draft leer bleibt
- **THEN** behandelt das System das leere Feld nicht allein als
  Anlageblocker
- **AND** weist es den sicheren Secret-Abgleich als Bereitstellungs- und
  Aktivierungsvoraussetzung aus
- **AND** überschreibt oder rotiert es das Secret nicht vor dem ausdrücklich
  bestätigten Provisioning

#### Scenario: Realm benötigt manuelle Klärung

- **WHEN** ein Bestands-Realm ein gleichnamiges fremdes oder nicht eindeutig
  zuordenbares Artefakt oder eine nicht automatisch verwaltete Voraussetzung
  enthält
- **THEN** klassifiziert das System ihn als
  `manual_resolution_required`
- **AND** blockiert die Tenant-Anlage bis zur Behebung und erneuten read-only
  Prüfung
- **AND** führt es keine automatische Übernahme oder Mutation aus

### Requirement: Fachliche Tenant-Anlage bleibt von Background-Fähigkeiten entkoppelt

Das System SHALL Registry-Sollzustand und einen minimalen dauerhaften
Bereitstellungsauftrag atomar speichern. Fehlende oder blockierte
Background-Fähigkeiten außerhalb Keycloaks SHALL die fachliche Tenant-Anlage
nicht verhindern, aber als wartender oder blockierter Bereitstellungszustand
sichtbar bleiben.

#### Scenario: Worker fehlt bei erfolgreicher Tenant-Anlage

- **WHEN** Keycloak und alle Anlage-Gates bereit sind
- **AND** der zuständige Worker nicht läuft oder keine aktuelle
  Capability-Evidenz besitzt
- **THEN** speichert das System Tenant, Audit und dauerhaften
  Bereitstellungsauftrag atomar
- **AND** weist es die technische Bereitstellung als wartend, blockiert oder
  unbekannt aus
- **AND** meldet es weder einen gestarteten nicht angenommenen Auftrag noch
  Betriebsbereitschaft

#### Scenario: Callback schlägt nach dem Commit fehl

- **WHEN** Registry-Sollzustand und dauerhafter Auftrag erfolgreich committet
  wurden
- **AND** ein anschließender Wake-up oder Callback fehlschlägt
- **THEN** bleibt der Tenant erhalten
- **AND** wird der Fehler am bestehenden Auftrag korrelierbar sichtbar
- **AND** kann der vorhandene Claim-/Recovery-Pfad den Auftrag später
  übernehmen

#### Scenario: Dauerhafter Sollzustand kann nicht atomar gespeichert werden

- **WHEN** Tenant, Audit und minimaler Bereitstellungsauftrag nicht atomar
  gespeichert werden können
- **THEN** wird die Tenant-Anlage vollständig abgelehnt oder zurückgerollt
- **AND** meldet das System keinen erfolgreichen oder eingeplanten Vorgang

#### Scenario: Nachgelagertes Zielsystem ist nicht erreichbar

- **WHEN** ein Zielsystem außerhalb Keycloaks vor oder nach der Tenant-Anlage
  nicht erreichbar ist
- **THEN** verhindert der Befund nicht die Registry-Persistenz
- **AND** blockiert er ausschließlich die betroffenen technischen Schritte
  und die Aktivierung
- **AND** nennt er Behebung und erneute Prüfung

### Requirement: Keycloak-Mutationen sind eigentums- und plangebunden

Das System SHALL Keycloak-Mutationen der Instanz-Provisioning- und
MCP-Instanzprozesse für neue und bestehende Realms nur anhand eines aktuellen,
ausdrücklich bestätigten Plans ausführen. Das gilt
für Provisioning, Reconcile und nachgelagerte Rollenänderungen. Der Plan SHALL
bei Bestands-Realms ausschließlich fehlende oder eindeutig Studio-eigene und
genau dieser Instanz zugeordnete Artefakte enthalten. Nachgewiesene eigene
Teilerfolge SHALL die Freigabe verbleibender Planschritte erhalten; fremde
Drift oder zusätzlicher Umfang SHALL sie entwerten.

#### Scenario: Fremder gleichnamiger Client wird nicht verändert

- **WHEN** der erwartete Login-, Tenant-Admin- oder Plugin-Client bereits
  existiert, seine Studio- und Instanz-Ownership aber nicht eindeutig belegt
  ist
- **THEN** markiert der Plan den Befund als manuellen Konflikt
- **AND** aktualisiert oder rotiert Studio diesen Client nicht

#### Scenario: Fremder gleichnamiger Benutzer wird nicht privilegiert

- **WHEN** der erwartete Tenant-Admin-Benutzer bereits existiert, aber nicht
  eindeutig dem Studio-Tenant-Bootstrap zugeordnet ist
- **THEN** markiert der Plan den Befund als manuellen Konflikt
- **AND** aktualisiert Studio weder Profil noch Passwort oder Rollenzuweisung

#### Scenario: Bestätigter Plan ist veraltet

- **WHEN** sich Sollzustand, Ownership oder Vertragsversion geändert hat
- **OR** Realm-Readback oder relevante Secret-Version außerhalb nachgewiesener
  eigener Effekte des bestätigten Plans abweichen
- **THEN** lehnt das System die Mutation wegen eines veralteten
  Plan-Fingerprints ab
- **AND** verlangt es eine neue read-only Prüfung und Bestätigung

#### Scenario: Nicht verwaltete Realm-Einstellungen bleiben unverändert

- **WHEN** der Bestands-Realm Identity Provider, User Federation, SMTP,
  Passwort-, MFA-, Session-, Token- oder andere realmweite
  Sicherheitseinstellungen enthält
- **THEN** verändert Studio diese Einstellungen nicht automatisch
- **AND** nimmt der bestätigte Plan sie nicht still in seinen Mutationsumfang
  auf

### Requirement: Provisioning-Befunde sind handlungsfähig und sicher wiederholbar

Das System SHALL jeden Create-, Provisioning- und Aktivierungsfehler dem
betroffenen Feld oder Prozessschritt zuordnen. Es SHALL Ursache, Auswirkung,
sichere Behebung, Zuständigkeit, Folgeprüfung, Korrelation und zulässige
Wiederholbarkeit maschinenlesbar und verständlich bereitstellen.

#### Scenario: Bekannter reparierbarer Fehler nennt den sicheren Folgeschritt

- **WHEN** ein klassifizierter Fehler nach einer Tenant-Anlage auftritt
- **THEN** bleibt der erreichte persistierte Teilzustand sichtbar
- **AND** nennt der Befund die konkrete betriebliche oder fachliche Behebung
- **AND** bietet das System nur die für diesen Schritt sichere Folgeaktion an

#### Scenario: Unbekannter Fehler bietet keinen blinden Retry

- **WHEN** ein Fehlercode unbekannt oder der Commit-Zustand einer
  Teilmutation nicht sicher nachweisbar ist
- **THEN** klassifiziert das System den Fehler als nicht automatisch
  wiederholbar
- **AND** fordert es zur Diagnose anhand der Request- oder Run-ID auf
- **AND** bietet es weder UI noch MCP noch Scheduler einen blinden Retry an

#### Scenario: Retry erhält gültige Teilerfolge

- **WHEN** ein berechtigter Benutzer einen nachweislich sicheren Retry nach
  Behebung der Ursache startet
- **THEN** setzt der Prozess am ersten nicht nachgewiesenen idempotenten
  Schritt fort
- **AND** wiederholt er keine zum aktuellen Snapshot gehörenden erfolgreichen
  Schritte ohne Notwendigkeit

#### Scenario: Fehlerantwort schützt Geheimnisse und personenbezogene Daten

- **WHEN** ein Preflight, Plan, Worker-Schritt oder Retry fehlschlägt
- **THEN** enthalten Antwort, Audit und Logs keine Secrets, Tokens,
  Passwörter, unkontrollierten Providertexte oder unnötige PII
- **AND** bleibt die Korrelation für Betrieb und Support erhalten

#### Scenario: Eigener bestätigter Fortschritt bleibt nach Worker-Crash gültig

- **WHEN** ein bestätigter externer Schritt erfolgreich war und der Worker
  vor seiner lokalen Quittung ausfällt
- **AND** aktueller Readback und Run-Evidenz den Effekt eindeutig dem
  bestätigten Schritt und seiner Ownership zuordnen
- **THEN** übernimmt die Recovery diesen Schritt als erledigt
- **AND** führt sie nur verbleibende Schritte innerhalb derselben Bestätigung aus
- **AND** entwerten die geplanten eigenen Secret- und Registry-Änderungen
  diese Bestätigung nicht

#### Scenario: Nicht zurechenbarer Fortschritt wird nicht übernommen

- **WHEN** Readback einen passenden Zustand zeigt, seine Zuordnung zum
  bestätigten Schritt aber nicht beweisbar ist
- **THEN** stoppt die Recovery mit Diagnosebedarf
- **AND** wiederholt sie weder Secret-Rotation noch Passwort-Reset blind
- **AND** erfordern fremde Drift oder zusätzlicher Umfang einen neuen Plan

### Requirement: Aktivierung verwendet kanalgeeignete Identitätsnachweise

Das System SHALL identische fachliche Aktivierungsgates für UI und MCP
anwenden und die bestehenden unterschiedlichen Identitätsnachweise erhalten.

#### Scenario: Browser bestätigt mit aktueller Session und Fresh-Reauth

- **WHEN** ein berechtigter Benutzer die Aktivierung im Cockpit bestätigt
- **THEN** prüft der Server Session, CSRF, Action und Fresh-Reauth
- **AND** bindet er die bestätigte Aktion an aktuelle Instanz- und Evidenzrevision
- **AND** führt eine veraltete Revision zu keinem Statuswechsel

#### Scenario: MCP bestätigt mit dem bestehenden Maschinenvertrag

- **WHEN** ein MCP-Operator nach ausdrücklicher menschlicher Bestätigung
  die separate Aktivierungsaktion aufruft
- **THEN** prüft Studio Service-Account, Action-Scope, Idempotenz und eine
  gültige Einmal-Challenge mit exakter Phrase
- **AND** bindet es diese an Akteur, Aktion, Instanz und aktuelle Zustands-
  und Evidenzrevision gemäß erweitertem ADR-047-Vertrag
- **AND** verlangt es keine Browser-Session oder Browser-Fresh-Reauth
- **AND** können Gesamtprozess oder Worker die Bestätigung nicht selbst erzeugen
