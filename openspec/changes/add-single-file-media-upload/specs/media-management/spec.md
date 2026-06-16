## ADDED Requirements
### Requirement: Direkter Single-File-Upload aus der Medienbibliothek

Das System SHALL im hostseitigen Einstieg `/admin/media` fuer berechtigte Benutzer einen direkten Upload-Flow fuer genau eine Datei bereitstellen, der Dateiauswahl, kontrollierten Browser-Upload und anschliessende Finalisierung als zusammenhaengenden Redaktionspfad fuehrt.

#### Scenario: Benutzer startet einen direkten Upload aus der Bibliothek

- **WHEN** ein berechtigter Benutzer im hostseitigen Einstieg `/admin/media` eine einzelne Datei auswaehlt
- **THEN** initialisiert das System einen kontrollierten Upload-Pfad fuer genau diese Datei
- **AND** fuehrt den eigentlichen Datei-Transfer an den freigegebenen MinIO-/S3-kompatiblen Zielpfad aus, ohne dem Benutzer primaer technische Upload-Artefakte als Endschritt zu praesentieren
- **AND** behandelt der Flow Dateiauswahl, Upload und Finalisierung als zusammenhaengende Enduser-Aktion

#### Scenario: Benutzer wird nach erfolgreichem Upload in das Asset gefuehrt

- **WHEN** der Datei-Upload erfolgreich abgeschlossen und das Medienobjekt finalisiert wurde
- **THEN** leitet das System den Benutzer direkt in die Detailansicht des neu entstandenen `MediaAsset` weiter
- **AND** zeigt nicht nur die signierte Upload-URL oder Upload-Session als primaeren Erfolgsausgang

### Requirement: Upload-first-Minimalpersistenz fuer neue Assets

Das System SHALL nach erfolgreichem Single-File-Upload ein neues `MediaAsset` mit Minimalmetadaten persistieren koennen, ohne vor dem Upload redaktionelle Pflichtmetadaten zu erzwingen.

#### Scenario: Asset wird mit Minimaldaten finalisiert

- **WHEN** eine einzelne Datei erfolgreich hochgeladen und serverseitig verifiziert wurde
- **THEN** persistiert das System mindestens `storageKey`, `fileName`, `mimeType`, `byteSize`, `visibility` und eine stabile Asset-Identitaet fuer das neue `MediaAsset`
- **AND** darf das System einen initialen Titel aus dem Dateinamen ableiten
- **AND** bleiben weitergehende redaktionelle Metadaten wie Alt-Text oder Beschreibung fuer spaetere Pflege nachgelagert

#### Scenario: Upload wird nicht durch fehlende Metadaten blockiert

- **WHEN** ein Benutzer vor dem Upload noch keine redaktionellen Metadaten gepflegt hat
- **THEN** darf das System den Single-File-Upload trotzdem ausfuehren
- **AND** erzeugt nach erfolgreichem Upload ein minimal nutzbares `MediaAsset`
- **AND** verlagert die nachtraegliche Metadatenpflege in den Detail-Workspace oder einen gleichwertigen Nachbearbeitungspfad

### Requirement: Getrennte Fehlerpfade fuer Initialisierung, Upload und Finalisierung

Das System SHALL im direkten Single-File-Upload-Flow Fehler von Upload-Initialisierung, Datei-Transfer und Asset-Finalisierung getrennt behandeln und fuer berechtigte Benutzer nachvollziehbar ausweisen.

#### Scenario: Initialisierung oder Finalisierung scheitert getrennt vom Datei-Upload

- **WHEN** der Upload-Pfad nicht initialisiert werden kann oder die Persistierung des `MediaAsset` nach erfolgreichem Datei-Transfer fehlschlaegt
- **THEN** weist das System den jeweiligen Fehlerpfad explizit getrennt aus
- **AND** markiert den Gesamtflow nicht stillschweigend als erfolgreich
- **AND** offenbart die Fehlermeldung keine Secrets, signierten URLs oder anderen sensitiven Storage-Details

#### Scenario: Datei-Transfer scheitert vor Finalisierung

- **WHEN** der Browser-Upload an den kontrollierten Zielpfad fehlschlaegt
- **THEN** finalisiert das System kein nutzbares `MediaAsset` als erfolgreichen Abschluss
- **AND** bleibt fuer den Benutzer sichtbar, dass der Fehler im eigentlichen Datei-Upload und nicht in der Metadatenpflege liegt
