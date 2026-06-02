## ADDED Requirements

### Requirement: Mainserver-Credentials in der Organisationsdetailansicht pflegen

Das System MUST in der Organisationsverwaltung eine abgesicherte Pflege organisationsgebundener Mainserver-Credentials bereitstellen. Die Organisationsdetailansicht zeigt dafür ein Feld für `Mainserver Application-ID`, ein write-only Feld für `Mainserver Application-Secret` und einen Status, ob bereits ein Secret hinterlegt ist.

#### Scenario: Organisationsdetail zeigt write-only Credential-Felder

- **WENN** ein Administrator die Detailansicht einer Organisation öffnet
- **DANN** sieht er die aktuelle `Mainserver Application-ID`, falls vorhanden
- **UND** das Secret-Feld ist nie mit einem bestehenden Klartextwert vorbefüllt
- **UND** die UI zeigt stattdessen an, ob bereits ein Secret hinterlegt ist

#### Scenario: Administrator aktualisiert organisationsgebundene Mainserver-Credentials

- **WENN** ein Administrator in der Organisationsdetailansicht eine `Mainserver Application-ID` und optional ein neues Secret speichert
- **DANN** sendet die UI nur die eingegebenen Änderungswerte an den vorgesehenen Organisations-Endpunkt
- **UND** nach erfolgreichem Speichern zeigt die Oberfläche den aktualisierten Application-ID-Wert und den Secret-Status an
- **UND** kein Klartext-Secret wird im UI-State oder in Responses angezeigt
