## ADDED Requirements

### Requirement: Einfache Tags am Medien-Asset

Das System SHALL registrierte Medien über eine optionale Tag-Liste im bestehenden Asset-Metadatenmodell organisieren, ohne eigene Tag-Entitäten, Ordner oder Kategorien einzuführen.

#### Scenario: Tags werden gepflegt

- **WHEN** ein berechtigter Benutzer Tags eines Assets hinzufügt oder entfernt
- **THEN** validiert das System client- und serverseitig höchstens 20 Tags mit je 1 bis 64 Zeichen nach Unicode-NFC- und Leerzeichennormalisierung
- **AND** werden gleiche Tags unabhängig von Groß-/Kleinschreibung einmal gespeichert, wobei die zuerst eingegebene Schreibweise angezeigt wird
- **AND** bleiben Asset-Identität, andere Metadaten und Medienreferenzen unverändert
- **AND** verändern nicht angegebene Tags einen Metadaten-Patch nicht; eine leere Liste entfernt alle Tags

#### Scenario: Bestehendes Asset hat keine Tags

- **WHEN** ein bereits vorhandenes Asset ohne Tag-Liste gelesen wird
- **THEN** behandelt das System dies als leere Liste ohne erforderliche manuelle Nachpflege

### Requirement: Tags in bestehender Suche und Filterung

Das System SHALL Tag-Begriffe in der vorhandenen Suche berücksichtigen und in Medienbibliothek sowie vorhandenem Medienpicker nach genau einem normalisierten Tag filtern können.

#### Scenario: Suche und Tag-Filter werden kombiniert

- **WHEN** ein berechtigter Benutzer Suchtext und einen Tag-Filter setzt
- **THEN** wendet das System beide Bedingungen serverseitig innerhalb des bestehenden Instanz- und Berechtigungsscope an
- **AND** vergleicht es den Filter vollständig und unabhängig von Groß-/Kleinschreibung nach derselben Tag-Normalisierung
- **AND** liefert es unter gesetztem Tag-Filter keine unregistrierten Bucket-Dateien

#### Scenario: Filter wird während der Seitennavigation geändert

- **WHEN** sich der Tag-Filter ändert
- **THEN** beginnt die Seitennavigation mit dem neuen Filter
- **AND** wird ein Cursor eines anderen Filters nicht ungeprüft weiterverwendet

### Requirement: ClamAV-Prüfung vor der Upload-Freigabe

Das System SHALL neue Uploads im bestehenden Medienjob vor Variantenverarbeitung und Freigabe über den internen ClamAV-Dienst prüfen. Nur eine vollständig abgeschlossene Prüfung ohne Fund darf die weitere Verarbeitung erlauben.

#### Scenario: Datei wird erfolgreich geprüft

- **WHEN** ClamAV die Datei vollständig ohne Fund geprüft hat
- **AND** die übrige Validierung und Verarbeitung erfolgreich sind
- **THEN** darf die vorhandene Finalisierung das Asset unter gültigem Claim, offener Content-Speicheroperation soweit erforderlich und erfolgreicher Quotenprüfung auf `ready` setzen
- **AND** verwendet sie dieselben geprüften Originalbytes für Veröffentlichung und Varianten

#### Scenario: Schadsoftware wird gefunden

- **WHEN** ClamAV einen Fund meldet
- **THEN** bleibt das Asset unreferenzierbar und wird im vorhandenen gesperrten Uploadzustand geführt
- **AND** erfolgen weder Variantenfreigabe noch erfolgreiche Quotenbuchung
- **AND** erhält der Benutzer eine verständliche übersetzte Fehlermeldung ohne Scanner-Interna

#### Scenario: Prüfung ist nicht erfolgreich abgeschlossen

- **WHEN** der Scanner nicht erreichbar ist, ein Timeout, ungültige Antwort, überschrittenes Limit oder eine sonstige unvollständige Prüfung auftritt
- **THEN** wird keine Scanfreigabe erteilt
- **AND** verwenden technische Fehler die vorhandenen Studio-Job-Wiederholungen und nach deren Ausschöpfung den bestehenden Upload-Fehlerzustand
- **AND** existiert kein automatischer Erfolgsfallback oder manueller Freigabebypass

### Requirement: Geschützter Eingang und Bindung an geprüfte Bytes

Das System SHALL ungeprüfte und abgewiesene Uploads auch auf Storage-Ebene vor öffentlichem Abruf schützen und verhindern, dass nachträglich ausgetauschte Bytes vom Scanergebnis profitieren.

#### Scenario: Direkter Zugriff auf ungeprüften Upload

- **WHEN** ein neuer Upload noch nicht freigegeben oder bereits abgewiesen ist
- **THEN** erlauben weder Studio-Delivery und Preview noch direkte öffentliche Storage-URLs oder Bucket-Listings seine Nutzung
- **AND** wird Scanbetrieb auf einer Storage-Anbindung ohne nachgewiesenen Zugriffsschutz nicht als geschützt aktiviert

#### Scenario: Upload-Eingang wird nach der Prüfung überschrieben

- **WHEN** eine noch gültige Upload-URL oder ein konkurrierender Schreibzugriff den Eingang nach der Prüfung verändert
- **THEN** gelangen diese ungeprüften Bytes weder in das freigegebene Original noch in dessen Varianten
- **AND** berechtigt das frühere Scanergebnis nicht zur Veröffentlichung der veränderten Datei

#### Scenario: Verarbeitung wird überholt oder abgebrochen

- **WHEN** der Claim eines Versuchs überholt oder seine provisorische Content-Speicheroperation abgebrochen wird
- **THEN** darf der Versuch weder ein Asset freigeben noch fremde Verarbeitungsobjekte löschen
- **AND** erfolgen Bereinigung und Quotenbehandlung über die bestehenden Pfade ohne doppelte Buchung oder Abzug nie gebuchter Bytes

### Requirement: Kein scanfreier Weg für neue Bucket-Registrierungen

Das System SHALL bei aktivem Scan die Neuregistrierung bisher unregistrierter Bucket-Dateien zunächst abweisen, solange dieser bestehende Pfad keinen Scan vor `ready` gewährleistet.

#### Scenario: Neue Bucket-Datei soll unmittelbar registriert werden

- **WHEN** bei aktivem Scan eine bisher unregistrierte Bucket-Datei als Asset angelegt werden soll
- **THEN** weist das System dies mit einer verständlichen Meldung ab
- **AND** erzeugt es daraus kein ungeprüftes `ready`-Asset

#### Scenario: Bereits registriertes Medium wird verwendet

- **WHEN** ein bestehendes registriertes Medium gelesen oder verwendet wird
- **THEN** bleibt dessen vorhandener Lebenszyklus maßgeblich
- **AND** behauptet das System dafür keinen nachträglichen Scan-Nachweis und startet keine automatische Bestandsprüfung

### Requirement: Automatische Signaturpflege und bestehende Betriebsdiagnose

Das System SHALL ClamAV gemäß ADR-068 intern betreiben, die offiziellen Signaturen automatisch mit `freshclam` aktualisieren, persistent speichern und vom Scanner nachladen lassen.

#### Scenario: Signaturen werden aktualisiert oder Container neu gestartet

- **WHEN** neue Signaturen bereitstehen oder der Scanner-Container neu startet
- **THEN** werden Signaturdaten automatisch aktualisiert beziehungsweise aus dem persistenten Volume wiederverwendet
- **AND** lädt der Scanner aktualisierte Signaturen ohne Studio-Deployment

#### Scenario: Aktualitätsbestätigung bleibt aus

- **WHEN** seit der letzten bestätigten Aktualität der tatsächlich geladenen Signaturen 24 Stunden vergangen sind
- **THEN** warnt das vorhandene Monitoring; ausschließlich für die am 22.10.2026 ausdrücklich freigegebene vorläufige Staging-Ausnahme erfolgt diese Warnung durch die tägliche manuelle Betriebskontrolle
- **AND** werden ab 72 Stunden ohne diesen Nachweis keine neuen Uploads mehr freigegeben
- **AND** bleiben bereits verfügbare Medien nutzbar
- **AND** setzt weder ein bloßer Scanner-Ping noch ein Updateversuch oder Container-Neustart die Frist zurück

#### Scenario: Vorläufige manuelle Staging-Kontrolle

- **GIVEN** die ausdrücklich freigegebene Staging-Ausnahme und die noch fehlende Metrikübernahme für den automatischen 24-Stunden-Warnalarm
- **WHEN** der Staging-Upload-Scan aktiviert wird
- **THEN** prüft der Betrieb täglich Nachweisalter und Übereinstimmung mit der geladenen Revision, dokumentiert das Ergebnis und eskaliert ab 24 Stunden ohne bestätigte Aktualität manuell
- **AND** bleiben fehlender Nachweis, Scanner-Ausfall und mindestens 72 Stunden alte Signaturen automatische Freigabesperren
- **AND** wird das Staging-Gate über den regulären Rollout deaktiviert, wenn die tägliche Kontrolle nicht gewährleistet ist; der private Bucket bleibt erhalten
- **AND** endet die Ausnahme mit nachgewiesener Metrikübernahme und automatischem Alarm
- **AND** bleiben Dev und Production deaktiviert und Bestandsscans separat freizugeben

#### Scenario: Aktualität wird initial oder erneut bestätigt

- **WHEN** die Aktualität der Signaturen erfolgreich geprüft und der dazu passende geladene Signaturstand bestätigt wurde
- **THEN** gilt der Zeitpunkt als neuer Aktualitätsnachweis, auch wenn kein Update verfügbar war
- **AND** darf eine wegen der 72-Stunden-Grenze gesperrte Freigabe nach erneuter Prüfung der übrigen Bedingungen fortgesetzt werden
- **AND** werden ohne initialen Nachweis keine Uploads freigegeben

#### Scenario: Scanner fällt innerhalb der Aktualitätsfrist aus

- **WHEN** ein Scanner-Ausfall oder eine unvollständige Prüfung eintritt, obwohl der Aktualitätsnachweis noch keine 72 Stunden alt ist
- **THEN** wird der Upload unabhängig von der Aktualitätsfrist nicht freigegeben
- **AND** wird ein einzelner Updatefehler bei weiterhin zulässigem Aktualitätsnachweis und erfolgreichem Scan nicht allein als Scanfehler gewertet

### Requirement: Feste Sichtbarkeit neu gescannter Medien

Das System SHALL die beim Upload gewählte Sichtbarkeit nach erfolgreichem Scan und Freigabe festhalten. Für eine andere Sichtbarkeit ist ein neuer Upload erforderlich; ein später deaktivierter Scanner hebt diese Regel nicht auf.

#### Scenario: Sichtbarkeit eines gescannten Mediums soll wechseln

- **WHEN** ein freigegebenes, neu gescanntes Medium von `public` zu `protected` oder umgekehrt geändert werden soll
- **THEN** weist die bestehende Metadaten-API die Änderung mit HTTP 409 und dem Grund `media_visibility_fixed` ab
- **AND** bleiben gleichzeitig übermittelte Metadaten unverändert
- **AND** erläutert die Mediendetailansicht den erforderlichen neuen Upload

#### Scenario: Metadaten eines gescannten Mediums werden gepflegt

- **WHEN** Titel, Alternativtext oder Tags eines neu gescannten Mediums geändert werden und die Sichtbarkeit unverändert bleibt oder ausgelassen wird
- **THEN** bleibt die Metadatenpflege möglich und der Scan-Nachweis erhalten

#### Scenario: Bestandsmedium ohne Scan-Nachweis

- **WHEN** ein vorhandenes Medium keinen nachträglichen Scan-Nachweis besitzt
- **THEN** bleibt sein bisheriger Änderungsvertrag erhalten

### Requirement: Manueller begrenzter Bestandsscan ohne Sperren

Das System SHALL einen manuell gestarteten lesenden Bestandsscan in der vorhandenen Medienbibliothek anbieten. Ein Durchlauf SHALL höchstens 25 Dateien des konfigurierten instanzbezogenen Medienbestands prüfen, bestehende Größen-/Scanlimits einhalten und je Datei `sauber`, `Fund` oder `nicht prüfbar` berichten.

#### Scenario: Berechtigter Benutzer startet einen Abschnitt

- **WHEN** ein authentifizierter Benutzer mit `media.read` und `media.update` einen gültigen manuellen Scan startet
- **THEN** wird nach CSRF- und Eingabeprüfung genau ein begrenzter Host-Job über den vorhandenen Job-/Queue-Pfad angelegt
- **AND** kann der Bericht ausschließlich im autorisierten Instanzkontext abgerufen werden

#### Scenario: Datei ist sauber oder infiziert

- **WHEN** ClamAV die gelesenen Bytes vollständig als sauber beziehungsweise infiziert bewertet
- **THEN** enthält der Bericht das entsprechende Ergebnis zum Prüfzeitpunkt
- **AND** bleiben Datei, Asset-Status, Sichtbarkeit, Referenzen, Quoten und Berechtigungen unverändert
- **AND** wird kein Upload-Scan-Nachweis am Bestandsasset gesetzt

#### Scenario: Datei kann nicht vollständig geprüft werden

- **WHEN** eine Datei größer als 64 MiB ist, nach dem Listing/HEAD über das Limit wächst oder ein Lese-/Scanfehler beziehungsweise ein bestehendes Scanlimit eintritt
- **THEN** lautet das Ergebnis `nicht prüfbar` mit normiertem Grund
- **AND** verhindert die begrenzte Leseoperation einen unbegrenzten Download
- **AND** bleiben vorhandene Dateien bei diesem Ergebnis weiter nutzbar

#### Scenario: Scanner oder Signaturnachweis ist nicht verfügbar

- **WHEN** der Scanner ausfällt oder kein ausreichend aktueller geladener Signaturstand bestätigt ist
- **THEN** enthält der Bericht `nicht prüfbar`
- **AND** wird daraus keine Bestandssperre und keine wiederholte erfolglose Scan-Anfrage je verbleibender Datei abgeleitet

#### Scenario: Weiterer Abschnitt ist vorhanden

- **WHEN** der begrenzte Abschnitt einen weiteren Storage-Cursor liefert
- **THEN** kann der Benutzer den nächsten Abschnitt ausdrücklich manuell starten
- **AND** wird ohne diese Aktion kein weiterer Abschnitt eingeplant
