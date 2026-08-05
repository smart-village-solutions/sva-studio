## ADDED Requirements

### Requirement: Mainserver-Detailadapter isolieren optionale Vertragsabweichungen

Das System MUST Mainserver-Detailantworten feldgruppenweise auswerten. Eine sichere Mainserver-ID und typbezogen deklarierte harte Mindestfelder bleiben Voraussetzung; Fehler optionaler Skalare, Listenpositionen oder Unterobjekte MUST als strukturierte Abweichungen neben den weiterhin verwendbaren Daten zurückgegeben werden, statt pauschal den gesamten Datensatz als `invalid_response` abzulehnen.

#### Scenario: Einzelner optionaler Listeneintrag ist ungültig

- **WHEN** eine Mainserver-Detailantwort eine gültige Identität sowie gültige und ungültige Einträge derselben optionalen Liste enthält
- **THEN** erhält der Adapter die sicher interpretierbaren Einträge
- **AND** meldet den ungültigen Eintrag mit stabilem Feldpfad, Abweichungscode, Phase und Behandlung
- **AND** gibt er den übrigen Datensatz erfolgreich zurück

#### Scenario: Anzeige-Default ersetzt keinen Originalwert

- **WHEN** der Adapter für ein abweichendes optionales Feld einen sicheren Anzeige-Default bereitstellt
- **THEN** kennzeichnet er diesen Wert als Default oder ausgelassen
- **AND** verwendet der Schreibpfad ihn nicht automatisch als Ersatz für den unmittelbar zuvor gelesenen Originalwert

#### Scenario: Fachlicher Diskriminator schützt die typisierte Route

- **WHEN** ein GenericItem-Detail nicht den für die aufgerufene Fachroute erforderlichen `genericType` besitzt
- **THEN** behandelt der Adapter den Diskriminator nicht als optionale Abweichung
- **AND** gibt die Route den bestehenden deterministischen Fehler zurück, ohne eine Mutation über das falsche Fachplugin zu ermöglichen

### Requirement: Mainserver-Abweichungen sind strukturiert und datensparsam beobachtbar

Das System MUST jede erkannte Mainserver-Vertragsabweichung serverseitig über den Server-Runtime-Logger mit stabilen, aggregierbaren Metadaten protokollieren. Logs MUST die nach bestehender Logging-Klassifizierung zulässigen und vorhandenen technischen Korrelationsfelder, Inhaltstyp, Operation, Phase, normalisierten Feldpfad, Abweichungscode und Behandlung enthalten und dürfen keine Rohwerte, Payloads, Freitexte, Kontaktdaten oder sonstige potenzielle PII enthalten. Konkrete Listenindizes und freie Payload-Schlüssel MUST aus aggregierbaren Feldpfaden entfernt werden.

#### Scenario: Optionale Feldabweichung wird erkannt

- **WHEN** ein Detailadapter eine optionale Feldabweichung isoliert
- **THEN** emittiert der Server genau einen strukturierten Befund pro Request, Feldpfad und Abweichungsklasse
- **AND** der Befund ist nach Inhaltstyp, Abweichungscode und Behandlung aggregierbar
- **AND** enthält er nicht den abweichenden Rohwert

#### Scenario: Listenabweichungen erzeugen begrenzte Kardinalität

- **WHEN** mehrere Listeneinträge desselben optionalen Felds denselben Vertrag verletzen
- **THEN** normalisiert der Server den Feldpfad ohne konkrete Listenindizes
- **AND** emittiert er höchstens einen Befund pro Request, normalisiertem Feldpfad und Abweichungsklasse

#### Scenario: Zusatzdienst degradiert den Editor

- **WHEN** ein optionaler Zusatzdienst für einen Mainserver-Datensatz fehlschlägt
- **THEN** protokolliert der Host die Phase `enrichment`, den betroffenen Dienst und die Behandlung `temporarily_unavailable`
- **AND** korreliert der Befund über vorhandene Request- oder Trace-IDs, ohne sensible Antwortdaten zu loggen

### Requirement: Mainserver-Updates erhalten bestätigte Passthrough-Feldgruppen

Das System MUST für Mainserver-Updates mit Erhaltungsbedarf unmittelbar vor der Mutation im selben effektiven Credential- und Organisationskontext den aktuellen Datensatz lesen und ausschließlich typbezogen deklarierte Feldgruppen zusammenführen. Der Merge MUST auf Felder begrenzt bleiben, die der bestätigte GraphQL-Lese- und Mutationsvertrag verlustfrei unterstützt. Vor der Migration eines Inhaltstyps MUST eine getestete Feldmatrix harte Mindestfelder, kontrollierte Editorfelder, nur lesbare Felder, Passthrough-Felder und nicht erhaltbare Felder klassifizieren.

#### Scenario: Update erhält unmittelbar zuvor gelesene Werte

- **GIVEN** ein Plugin deklariert kontrollierte und Passthrough-Feldgruppen für seinen Inhaltstyp
- **WHEN** der Host eine gültige Aktualisierung ausführt
- **THEN** liest er den aktuellen Datensatz im selben Instanz-, Account- und Organisationskontext
- **AND** ersetzt kontrollierte Felder aus der validierten Eingabe
- **AND** erhält deklarierte Passthrough-Felder aus dem aktuellen Datensatz
- **AND** sendet ausschließlich vom Mutation-Input unterstützte Variablen

#### Scenario: Read- und Write-Vertrag sind nicht symmetrisch

- **GIVEN** ein für die Erhaltung relevantes Feld kann nicht verlustfrei gelesen oder nicht im Mutation-Input übertragen werden
- **WHEN** der Adapter die Aktualisierung ohne Datenverlust nicht bilden kann
- **THEN** klassifiziert die Feldmatrix das Feld nicht als Passthrough
- **AND** blockiert der Server die betroffene Mutation vor dem Provider-Aufruf

#### Scenario: Parallele externe Änderung bleibt ein dokumentiertes Restrisiko

- **WHEN** sich der Mainserver-Datensatz zwischen dem vorbereitenden Read und der Mutation extern ändert
- **THEN** behauptet das System ohne Revision oder vergleichbare Vorbedingung keine konfliktfreie Zusammenführung
- **AND** stellt Reconciliation nicht als Wiederherstellung bereits überschriebener Providerfelder dar

### Requirement: Detailabweichungen werden rückwärtskompatibel transportiert

Das System MUST Detailabweichungen additiv über den gemeinsamen Host-/SDK-Vertrag bereitstellen. Bestehende typisierte Detailaufrufe, die ausschließlich den Datensatz erwarten, MUST während der Migration unverändert funktionieren; ein Plugin MUST Abweichungsmetadaten explizit über den erweiterten Vertrag anfordern oder aus einer versionierten Response-Hülle lesen.

#### Scenario: Bestehender Plugin-Client wird noch nicht migriert

- **GIVEN** ein Plugin verwendet weiterhin den bestehenden `get(id)`-Vertrag
- **WHEN** der Host den Abweichungsvertrag einführt
- **THEN** erhält der bestehende Client weiterhin den typisierten Datensatz in der bisherigen Form
- **AND** entstehen weder ein ungeplanter Response-Shape-Bruch noch ein erzwungener gleichzeitiger Big-Bang-Rollout aller Plugins

#### Scenario: Migrierter Plugin-Client fordert Detailmetadaten an

- **WHEN** ein migrierter Editor den erweiterten Detailvertrag verwendet
- **THEN** erhält er Datensatz und sichere Abweichungsmetadaten getrennt
- **AND** enthalten die Browser-Metadaten keine Rohwerte oder internen Fehlertexte
