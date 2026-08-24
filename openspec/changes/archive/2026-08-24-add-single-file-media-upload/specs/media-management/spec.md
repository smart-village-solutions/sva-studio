## ADDED Requirements
### Requirement: Direkter Single-File-Upload aus der Medienbibliothek

Das System SHALL im hostseitigen Einstieg `/admin/media` für berechtigte Benutzer einen direkten Upload-Flow für genau eine Datei bereitstellen, der Dateiauswahl, kontrollierten Browser-Upload und anschließende Finalisierung als zusammenhängenden Redaktionspfad führt.

#### Scenario: Benutzer startet einen direkten Upload aus der Bibliothek

- **WHEN** ein berechtigter Benutzer im hostseitigen Einstieg `/admin/media` eine einzelne Datei auswählt
- **THEN** initialisiert das System einen kontrollierten Upload-Pfad für genau diese Datei
- **AND** führt den eigentlichen Datei-Transfer an den freigegebenen MinIO-/S3-kompatiblen Zielpfad aus, ohne dem Benutzer primär technische Upload-Artefakte als Endschritt zu präsentieren
- **AND** behandelt der Flow Dateiauswahl, Upload und Finalisierung als zusammenhängende Enduser-Aktion

#### Scenario: Benutzer wird nach erfolgreichem Upload in das Asset gefuehrt

- **WHEN** der Datei-Upload erfolgreich abgeschlossen und das Medienobjekt finalisiert wurde
- **THEN** leitet das System den Benutzer direkt in die Detailansicht des neu entstandenen `MediaAsset` weiter
- **AND** zeigt nicht nur die signierte Upload-URL oder Upload-Session als primaeren Erfolgsausgang

### Requirement: Upload-first-Minimalpersistenz für neue Assets

Das System SHALL nach erfolgreichem Single-File-Upload ein neues `MediaAsset` mit Minimalmetadaten persistieren können, ohne vor dem Upload redaktionelle Pflichtmetadaten zu erzwingen.

#### Scenario: Asset wird mit Minimaldaten finalisiert

- **WHEN** eine einzelne Datei erfolgreich hochgeladen und serverseitig verifiziert wurde
- **THEN** persistiert das System mindestens `storageKey`, `fileName`, `mimeType`, `byteSize`, `visibility` und eine stabile Asset-Identität für das neue `MediaAsset`
- **AND** darf das System einen initialen Titel aus dem Dateinamen ableiten
- **AND** bleiben weitergehende redaktionelle Metadaten wie Alt-Text oder Beschreibung für spätere Pflege nachgelagert

#### Scenario: Upload wird nicht durch fehlende Metadaten blockiert

- **WHEN** ein Benutzer vor dem Upload noch keine redaktionellen Metadaten gepflegt hat
- **THEN** darf das System den Single-File-Upload trotzdem ausführen
- **AND** erzeugt nach erfolgreichem Upload ein minimal nutzbares `MediaAsset`
- **AND** verlagert die nachträgliche Metadatenpflege in den Detail-Workspace oder einen gleichwertigen Nachbearbeitungspfad

### Requirement: Getrennte Fehlerpfade für Initialisierung, Upload und Finalisierung

Das System SHALL im direkten Single-File-Upload-Flow Fehler von Upload-Initialisierung, Datei-Transfer und Asset-Finalisierung getrennt behandeln und für berechtigte Benutzer nachvollziehbar ausweisen.

#### Scenario: Initialisierung oder Finalisierung scheitert getrennt vom Datei-Upload

- **WHEN** der Upload-Pfad nicht initialisiert werden kann oder die Persistierung des `MediaAsset` nach erfolgreichem Datei-Transfer fehlschlägt
- **THEN** weist das System den jeweiligen Fehlerpfad explizit getrennt aus
- **AND** markiert den Gesamtflow nicht stillschweigend als erfolgreich
- **AND** offenbart die Fehlermeldung keine Secrets, signierten URLs oder anderen sensitiven Storage-Details

#### Scenario: Datei-Transfer scheitert vor Finalisierung

- **WHEN** der Browser-Upload an den kontrollierten Zielpfad fehlschlägt
- **THEN** finalisiert das System kein nutzbares `MediaAsset` als erfolgreichen Abschluss
- **AND** bleibt für den Benutzer sichtbar, dass der Fehler im eigentlichen Datei-Upload und nicht in der Metadatenpflege liegt
