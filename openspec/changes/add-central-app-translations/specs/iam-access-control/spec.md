## ADDED Requirements

### Requirement: App-Übersetzungs-Serviceidentität besitzt eigene Audience und Scopebindung

Das System MUST technische Main-Server-Übersetzungszugriffe über kurzlebige verifizierte Serviceidentitäten mit eigener Audience, expliziten Actions und aktivierter serverseitiger Instanz-/Organisationsbindung autorisieren. SSF-spezifische Audience, Clientannahmen und interne Netzrestriktionen MUST nicht ungeprüft übernommen werden. Unverifizierte Client-/Tenantangaben aus Headern oder Payloads MUST keine Berechtigungen begründen.

#### Scenario: Gültiges Token für anderen Zweck oder andere Organisation

- **GIVEN** ein Request enthält ein gültig signiertes Token mit falscher Audience, falscher Clientbindung oder ohne erforderliche Action
- **WHEN** Batch- oder Statuszugriff autorisiert wird
- **THEN** verweigert Studio den Zugriff vor Cache-/Job-/Anbieteroperationen
- **AND** liefert ein Ausfall der Identitäts- oder Bindungsprüfung keinen anonymen oder privilegierten Fallback

### Requirement: Redaktion, Manifestimport und dynamische Services getrennt berechtigen

Das System MUST Kataloglesen/-bearbeiten/-veröffentlichen, gemeinsame Standards, technischen Manifestimport und dynamische Requests/Status als getrennte `app-translations`-Actions prüfen. Plattformstandards MUST nur im berechtigten Plattformkontext schreibbar sein; kommunale Daten MUST organisationsgebunden bleiben. Serviceclients MUST keine redaktionellen oder globalen Schreibrechte durch ihren dynamischen Zugriff erhalten. Technische Anzeigeprofile MUST keinen zusätzlichen Quellenfreigabeprozess pro Mandant oder Quelle darstellen. App-seitige Treffer-/Statusausgaben MUST zusätzlich die aktuelle Leseberechtigung des App-Aufrufers anhand der aktuell im Main-Server geprüften Quellenangabe und passenden aktuellen Vorlage prüfen; Service-Action, kommunaler Scope und Entry-ID allein ersetzen dies nicht. Die redaktionelle Formular-Leseanzeige MUST zusätzlich aktuellen Inhaltszugriff, Principal, Organisation und Pluginzugang prüfen; App-Leserechte dürfen weder still vorausgesetzt noch durch eine bekannte Cache-ID ersetzt werden. Der genaue Originalbezug dieser Studio-Anbindung bleibt offen, ohne dauerhaften Quellenbestand. Die Sprachauswahl der DeepL-Schnittstelle MUST mit `integration.manage` auf die eigene Instanz und ihre aktuell geprüfte Anbieterantwort begrenzt sein; kommunale Katalogdaten MUST organisationsgebunden bleiben. Eine zweite zentrale Sprachfreigabe MUST dafür nicht vorausgesetzt werden.

#### Scenario: Dynamischer Client versucht Katalogveröffentlichung

- **GIVEN** ein Serviceclient besitzt ausschließlich dynamische Request-/Statusrechte
- **WHEN** er einen Katalog ändern, einen Override zurücksetzen oder Standards veröffentlichen möchte
- **THEN** wird der Vorgang verweigert
- **AND** bleibt ein technischer Buildexport ausschließlich lesend

### Requirement: Mandanten- und Berechtigungsgrenzen gelten auch im Worker und in PostgreSQL

Das System MUST verifizierten Instanz-/Organisationsscope bei Session-, Service-, Status-, Repository- und Workerzugriff durchsetzen. Organisationsisolation MUST zusätzlich zur vorhandenen Instanz-RLS erfolgen. Vor verzögerter Ausführung MUST ein gesperrter Bereich, ein deaktivierter Client, ein inaktives/suspendiertes Modul oder eine deaktivierte Zielsprache erkannt werden. Der vorhandene Pluginzugang MUST zusätzlich zu IAM-Grants in allen kommunalen Session-/Service-/Statusfassaden geprüft werden. Kommunale Fachjobs MUST mit Plugin-ID als Plugin-Jobs registriert werden; der bestehende automatische Lifecycleguard schützt Host-Jobs nicht. Vor Anbieteraufruf sowie Abschluss/Remoteaktivierung MUST aktueller Zugriff, Lifecyclegeneration und Lease nochmals geprüft werden. Eng begrenzte Lifecycle-/Wartungsoperationen MUST eigene Hostberechtigung besitzen und dürfen keinen allgemeinen Übersetzungszugriff eröffnen. Ein Worker MUST ausschließlich eine bestehende Entry-ID mit gültiger Lease aktualisieren und darf bereinigte Ergebnisse nicht per Upsert wiederherstellen. Originalverwendungen MUST keine Worker-Voraussetzung sein; die aktuelle App-Leseberechtigung bleibt separat im Main-Server zu prüfen. Automatische Standardübernahme MUST einen explizit berechtigten technischen Ausführungskontext verwenden, ohne persönliche Sessiontokens und ohne kommunale Entwürfe mitzuveröffentlichen. Tokens, Original-/Ergebnistexte und persönliche Platzhalterwerte MUST nicht in allgemeine Jobpayloads, Audit oder Logs gelangen.

#### Scenario: Gleichnamiger Text oder veralteter Job in gesperrtem Bereich

- **GIVEN** zwei Organisationen derselben Instanz besitzen denselben Ausgangstext und ein Job wurde vor einer Sperrung angelegt
- **WHEN** Scopeauflösung oder Worker-Ausführung erfolgt
- **THEN** werden weder fremde Cachezeilen geteilt noch alte Poolkontexte übernommen
- **AND** führt der gesperrte Bereich keinen neuen Anbieteraufruf aus
- **AND** bleibt die Ablehnung anhand sicherer Codes und IDs ohne Text- oder Secret-Offenlegung nachvollziehbar

#### Scenario: Fremder Zugriff und deaktivierte Zielsprache

- **GIVEN** ein Client besitzt dynamische Request-/Statusrechte für Kommune A
- **WHEN** er fremde Einträge aus Kommune B oder eine kommunal deaktivierte Zielsprache anfordert
- **THEN** wird der Zugriff verweigert, ohne Ergebnistext oder Verlängerung von `last_used_at`
- **AND** begründet ein bekannter Cache-Key oder eine mitgesendete Quellenangabe keine Berechtigung
- **AND** erhält der Client keine freie Lösch- oder Bestandsabgleichoperation

#### Scenario: Berechtigter Benutzer oder alter Job bei suspendiertem Modul

- **GIVEN** IAM-Grants und ein fertiger Cachetreffer oder ein vor Suspendierung angelegter Auftrag sind vorhanden
- **WHEN** die Session-/Servicefassade oder der Worker normalen kommunalen Fachzugriff versucht
- **THEN** verhindert der aktuelle Pluginzugang die Ausgabe beziehungsweise weitere Anbieterarbeit und fachliche Aktivierung
- **AND** bleibt der begrenzte Suspendierungs-/Recoveryauftrag über den bestehenden Lifecyclevertrag ausführbar, solange dessen Modul-/Claimvoraussetzungen gelten
- **AND** ist eine vollständig entzogene Modulzuordnung kein automatischer Bypass für den Lifecycle-Worker
