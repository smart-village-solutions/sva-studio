## MODIFIED Requirements

### Requirement: Mainserver-Diagnostik besitzt eindeutige Fehlerownership und semantische Level

Das Studio MUST das abschließende Ergebnis seiner Mainserver-Fassade an genau einer verantwortlichen Grenze protokollieren. Dies umfasst frühe Principal-, Credential-, Readiness- und Kontextantworten ebenso wie Exceptions und Upstream-Ergebnisse. Unerwartete interne oder Providerfehler mit 5xx-Ergebnis MUST dort als `error` erscheinen; erwartbare validierte Ablehnungen dürfen höchstens als `warn` erscheinen. Tiefere Clients MUST Fehler klassifiziert propagieren und dürfen dasselbe operative Ergebnis nicht erneut protokollieren. Der externe SVA Mainserver bleibt unverändert und muss dafür keine zusätzlichen Felder oder Header liefern.

#### Scenario: Providerfehler führt zu einem 5xx-Ergebnis

- **WHEN** ein unerwarteter Mainserver-Providerfehler als 5xx-Ergebnis beantwortet wird
- **THEN** emittiert die verantwortliche Studio-Mainserver-Routengrenze genau ein korreliertes `error`-Ereignis
- **AND** protokollieren tiefere Client- und Mapper-Schichten kein Duplikat desselben Fehlerereignisses

#### Scenario: Validierte Eingabe wird erwartbar abgelehnt

- **WHEN** eine Mainserver-Operation aufgrund eines erwartbaren fachlichen oder Eingabefehlers abgelehnt wird
- **THEN** emittiert die verantwortliche Grenze höchstens ein `warn`-Ereignis
- **AND** klassifiziert sie das Ergebnis mit einem stabilen Fehlercode ohne Payload oder freien Provider-Fehlertext

#### Scenario: Credential-Preflight endet vor dem Upstream-Aufruf

- **WHEN** die Studio-Principalauflösung eine nicht bereite Credential-Version oder einen Kontextfehler meldet
- **THEN** enthält die Studio-Antwort ihre Request-ID und einen sicheren eindeutigen Diagnosegrund
- **AND** wird das Ergebnis auch ohne geworfene Exception genau einmal abschließend protokolliert
- **AND** bleibt die Zahl der Upstream-Mutationsaufrufe null

## ADDED Requirements

### Requirement: Studio klassifiziert Principal- und Credentialzustände vollständig ohne Upstream-Änderung

Die Studio-Fassade MUST alle bestehenden Ergebnisse ihrer Principal-/Credentialauflösung exhaustiv abbilden. `partial_credentials` MUST als Konfigurationsfehler mit HTTP 400 und nicht als `acting_principal_not_allowed` erscheinen. Vorhandene aber noch nicht freigegebene Organisations-Credentials MUST durch sichere additive Grundcodes von tatsächlich fehlenden Credentials unterscheidbar sein. Dependency-Ausfälle MUST als solche erhalten bleiben. Die Abbildung SHALL ausschließlich Studio-eigene Fehlerverträge betreffen.

#### Scenario: Persönliches oder organisatorisches Credential-Paar ist unvollständig

- **WHEN** die vorhandene Auflösung `partial_credentials` meldet
- **THEN** antwortet Studio mit einem korrelierten Konfigurationsfehler und HTTP 400
- **AND** behauptet es weder fehlende IAM-Rechte noch ein verbotenes Autorenprincipal

#### Scenario: Organisation besitzt noch nicht freigegebene Credentials

- **WHEN** Credentials gespeichert sind, ihr bestehender Provisionierungs-/Verifikationszustand aber keine Nutzung erlaubt
- **THEN** bleibt die Operation fail-closed
- **AND** unterscheidet ein sicherer Diagnosegrund den Zustand von fehlenden Credentials
- **AND** beginnt Fehlerbehandlung weder Provisionierung noch Rotation oder Credential-Reparatur

### Requirement: Studio projiziert lokale Principal-Readiness vor Content-Erstellung

Die vorhandene Studio-Principal-/Kontextprojektion SHALL lokale Credential-/Provisioning-Readiness für den tatsächlich ausgewählten persönlichen oder organisatorischen Principal ohne Secretwerte bereitstellen. Die UI MUST diese Voraussetzung additiv mit aktuellen Permissions, Modulfreigabe und Autorenpolicy kombinieren. Die Projektion MUST ohne neue Upstream-API, Upstream-Probe oder Credential-Schreiboperation auskommen und darf keine spätere Upstream-Verfügbarkeit garantieren.

#### Scenario: Readiness wird angezeigt

- **WHEN** eine Standard-Content-Erstellung im Studio für einen bestimmten Principal geöffnet wird
- **THEN** verwendet ihre Aktionsfläche die lokale sichere Readiness dieses Principals
- **AND** werden weder fremde Principal-Credentials noch globale technische Mutation-Capabilities als Ersatz verwendet
- **AND** bleiben vor der tatsächlichen Mutation die bestehenden serverseitigen Prüfungen erforderlich

### Requirement: Veralteter Studio-Editorkontext erholt sich ohne automatische Mutation

Bei `stale_mainserver_context` MUST das Studio den Fehler ausdrücklich darstellen, das alte Context-Binding und betroffene Ressourcen-Capabilities verwerfen und den aktuellen Kontext sowie Detailfreigaben neu lesen. Ungespeicherte Form-/Medienänderungen MUST erhalten bleiben. Ein geänderter Veröffentlichungsprincipal MUST vor einem erneuten Save bewusst bestätigt werden. Recovery MUST keine Fachmutation automatisch wiederholen und benötigt keine Änderung des externen Mainserver-Vertrags.

#### Scenario: Zweiter Tab ändert den Organisationskontext

- **WHEN** ein offener Editor mit altem Binding nach einem Organisationswechsel in einem anderen Tab einen Kontextkonflikt erhält
- **THEN** zeigt er den Kontextkonflikt mit Fehlerreferenz statt nur einer allgemeinen Speichermeldung
- **AND** wird das alte Binding nicht für weitere Saves wiederverwendet
- **AND** bleiben Eingaben erhalten, während aktueller Kontext und Ressourcenrechte gelesen werden
- **AND** erfolgt kein weiterer POST/PATCH/PUT/DELETE ohne neue ausdrückliche Nutzeraktion

#### Scenario: Ergebnis einer vorherigen Mutation ist bestätigt oder unklar

- **WHEN** eine Mutation bereits bestätigt ist oder ihr Ergebnis wegen eines Transport-/Folgefehlers unklar bleibt
- **THEN** verwendet Studio den vorhandenen Journal-/Read-back-Vertrag zur Einordnung
- **AND** erzeugt Kontext-Recovery kein zweites Create oder irreführendes „nicht gespeichert“

### Requirement: Private News-Operationsabfrage und sichere explizite Wiederaufnahme

Studio SHALL ein unbekanntes News-Speicherergebnis anhand des vorhandenen
Mutationsjournals prüfen können, ohne die ursprüngliche Inhaltsmutation erneut
auszuführen. Die Abfrage MUST an aktuelle Session-Instanz, Account, aktive
Organisation und konkreten Principal gebunden sein und aktuelle Rechte prüfen.

#### Scenario: Verlorene Antwort einer bestätigten Erstellung

- **WHEN** die Erstellung im Journal als erfolgreich bestätigt ist, aber der Browser die Antwort nicht erhält
- **THEN** prüft der Editor dieselbe Operationskennung über einen geschützten GET
- **AND** wird kein zweiter Content-POST oder PATCH ausgelöst
- **AND** bleiben spätere Formular- und Medienänderungen erhalten
- **AND** führt ein Medienreferenz-Retry ausschließlich den vorhandenen Referenzabschluss aus

#### Scenario: Unbewiesener Ausgang oder fehlende Operation

- **WHEN** ein Ergebnis aus Transportfehler, historischem Fehlerjournal, Idempotenzkonflikt oder fehlendem Eintrag nicht beweisbar ist
- **THEN** bleibt es unbekannt und ein neuer Save ist gesperrt
- **AND** wird weder Erfolg noch eine sichere Nichtausführung behauptet

#### Scenario: Sicher nicht begonnener Write

- **WHEN** SDK-Context-Preflight oder die News-Fassade einen Fehler vor Beginn des Providerwrites eindeutig bestätigt
- **THEN** darf der Nutzer nach Korrektur ausdrücklich einen neuen Save starten
- **AND** gilt ein HTTP-4xx allein nicht als dieser Nachweis

#### Scenario: Offener Entwurf bei Wiederanmeldung

- **WHEN** eine Session-Recovery einen offenen News-Create- oder Detaileditor mit ungespeicherten Eingaben betrifft
- **THEN** bleibt der Editor gemountet, gesperrt und im selben Dokument erhalten
- **AND** kann der Nutzer über den bestehenden Anmeldeweg einen neuen Tab öffnen
- **AND** erfordert die Wiederaufnahme ausdrücklich dieselbe Identität, Instanz und aktive Organisation einschließlich des abschließend geladenen Kontexts
- **AND** werden Freigaben erneut geladen und kein Inhalt automatisch gespeichert
- **AND** bleibt ein noch zulässiger ausdrücklich gewählter Principal erhalten
