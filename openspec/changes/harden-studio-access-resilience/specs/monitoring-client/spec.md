## ADDED Requirements

### Requirement: Sichtbare Studio-API-Betriebsfehler besitzen einen abschließenden Ergebnisnachweis

Das Studio MUST für zurückgegebene Authentifizierungs-, Autorisierungs-, Kontext-, Credential-Readiness- und Infrastrukturfehler an einer vorhandenen verantwortlichen Ergebnisgrenze genau ein abschließendes operatives Ereignis `studio.request.failed` emittieren. Das Ereignis MUST Request-ID, sicheren Fehlercode, HTTP-Status, Route-Vorlage, Methode und Prüfphase enthalten. Optionale Instanz-/Actioninformationen MUST aus autoritativem Studio-Kontext stammen. Bestehende eigenständige Security-/Auditereignisse SHALL erhalten bleiben; normale Feldvalidierung SHALL keine zentrale Einzelmeldungsflut erzeugen.

#### Scenario: Response und Exception enden am selben Ergebnisvertrag

- **WHEN** eine geschützte Studio-Anfrage als frühe Fehler-Response oder nach einer Exception endet
- **THEN** entsteht genau ein abschließendes Ergebnisereignis mit der Response-Request-ID
- **AND** werden 5xx als `error` und erwartbare Ablehnungen höchstens als `warn` protokolliert
- **AND** erzeugen tiefere Mapper und Clients kein Duplikat desselben abschließenden Ereignisses

#### Scenario: Sichere Diagnose bleibt datensparsam

- **WHEN** Studio eine Fehlermeldung protokolliert
- **THEN** enthält der neue Diagnosevertrag keine Secretwerte, Credential-Fingerprints, Bodies, Cookies, Token, freien Providertexte oder Querystrings
- **AND** sind Benutzer-/Organisationsidentitäten keine pauschalen Pflichtfelder
- **AND** bleiben Korrelations-IDs Log-Body-Felder statt Transport-Labels

### Requirement: Reine Browser-Betriebsfehler werden begrenzt als Clientbeobachtung gemeldet

Das Studio SHALL Root-Renderingfehler, lokale Timeouts und Netzwerkfehler ohne korrelierte Serverantwort über genau einen Host-Meldepfad im bestehenden Monitoring erfassen. `POST /api/v1/monitoring/client-errors` MUST eine gültige Session, bestehende Same-Origin-/CSRF-Prüfung und serverseitige Instanzbindung verlangen. Das strikte Schema MUST auf höchstens 2 KiB und sichere Fehlerklasse, statische Route-ID, Zeitpunkt, zufällige Client-Ereignis-ID und optionale validierte zugehörige Request-ID begrenzt sein. Freitext, Stack, Formularinhalt und Fingerprinting MUST abgewiesen werden.

#### Scenario: Begrenzte Annahme mit sicherer Herkunft

- **WHEN** ein authentifizierter Browser einen zulässigen Betriebsfehler meldet
- **THEN** emittiert Studio höchstens ein `studio.client.failure_reported` je `clientEventId` im Fünf-Minuten-Fenster
- **AND** begrenzt es die Annahme auf 20 Meldungen je authentifiziertem Account und Minute in einem getrennten Telemetrie-Bucket, ohne fachliche Read-/Write-Budgets zu verbrauchen
- **AND** werden parallele Duplikate atomar innerhalb des serverbestimmten Instanz-/Account-Scope derselben Ereignis-ID zusammengeführt
- **AND** kennzeichnet es das Ergebnis als unbestätigte Clientbeobachtung statt autoritativer Sicherheitsentscheidung
- **AND** erhält die Empfangsanfrage eine eigene serverseitige Request-ID; eine zugehörige Fach-Request-ID bleibt getrennt

#### Scenario: Offlinezustand und Sessionverlust unterbrechen keine Fachaktion

- **WHEN** Telemetrie wegen Netzwerk, ungültiger Session, 429 oder Serverausfall scheitert
- **THEN** entsteht keine rekursive Fehlermeldung oder automatische Anmeldung durch Telemetrie
- **AND** werden höchstens zehn sichere Meldungen fünf Minuten ausschließlich im Browserspeicher gehalten
- **AND** erfolgt nach Online-/Session-Recovery höchstens ein erneuter Versuch je Meldung
- **AND** werden Meldungen bei Logout, Benutzer-/Tenantwechsel und Ablauf verworfen
- **AND** verändert dies weder Fachzustand noch Erfolgsaussage einer bereits ausgeführten Mutation

#### Scenario: Korrelierter API-Fehler wird nicht doppelt gemeldet

- **WHEN** bereits eine Studio-API-Fehlerantwort mit Request-ID vorliegt
- **THEN** verwendet die UI deren Fehlerreferenz
- **AND** erzeugt sie kein zusätzliches Browser-Betriebsfehlerereignis für dasselbe Ergebnis

### Requirement: Telemetrieannahme und tatsächliche Logzustellung bleiben unterscheidbar

Das Studio MUST Emission, Annahme und tatsächlich im zentralen Logsystem gefundene Evidenz getrennt ausweisen. Die Abnahme SHALL einen freigegebenen Staging-Nachweis derselben Request-ID in API-Antwort, UI und Loki sowie einen erkennbaren Exportausfall enthalten. Ein Unit-Test auf einen Logger oder ein Annahme-ACK MUST nicht als Zustellgarantie ausgegeben werden.

#### Scenario: Diagnose wird betrieblich abgenommen

- **WHEN** die Fehlerkorrelation für einen Implementierungs-HEAD abgenommen wird
- **THEN** wird eine freigegebene sichere Studio-Ablehnung ausgelöst und ihre Referenz tatsächlich in Loki gefunden
- **AND** werden Umgebung, HEAD, Zeitpunkt und Ergebnis ohne Secrets festgehalten

#### Scenario: Export oder Prozess fällt aus

- **WHEN** Telemetrie nicht exportiert wird oder flüchtiger Puffer verloren geht
- **THEN** wird kein erfolgreicher Zustellnachweis behauptet
- **AND** bleiben Exportfehler beziehungsweise verworfene Meldungen über die vorhandene Monitoringgrenze diagnostizierbar
- **AND** wird keine neue persistente Zustellinfrastruktur vorausgesetzt
