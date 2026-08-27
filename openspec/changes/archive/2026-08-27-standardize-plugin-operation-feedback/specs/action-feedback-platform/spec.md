## ADDED Requirements

### Requirement: Jobstart bleibt im auslösenden Fachkontext nachvollziehbar

Das System MUST nach erfolgreicher Annahme eines Plugin-Operations-Jobs im auslösenden Bereich mindestens die stabile Job-ID, den initialen Hoststatus und einen Weg zum dauerhaften Jobdetail oder Monitoring-Kontext darstellen.

#### Scenario: Plugin-Job wird angenommen

- **WHEN** ein Host-Endpunkt einen Plugin-Operations-Job erfolgreich annimmt
- **THEN** zeigt der auslösende Bereich die Job-ID und den initialen Status
- **AND** bietet einen Weg zum dauerhaften Jobkontext
- **AND** ist ein flüchtiger Start-Toast nicht die einzige Rückmeldung

### Requirement: Jobfeedback verwendet den zentralen Hoststatus

Das System MUST Queue-, Lauf-, Retry-, Erfolgs-, Fehler- und Cancel-Zustände aus dem zentralen Plugin-Operations-Jobdatensatz ableiten.

#### Scenario: Aktiver Job meldet Fortschritt

- **WHEN** ein aktiver Job Status oder Progress aktualisiert
- **THEN** lesen Fachkurzsicht und Jobdetail denselben Hostvertrag
- **AND** erzeugt das Plugin keinen konkurrierenden fachlichen Jobstatus im Client

#### Scenario: Seite wird neu geladen

- **WHEN** der Benutzer den Fachbereich oder das Jobdetail neu lädt
- **THEN** rekonstruiert die UI den aktuellen Zustand über die stabile Job-ID aus dem Hoststore
- **AND** geht die Nachvollziehbarkeit nicht mit lokalem React-State verloren

### Requirement: Terminalzustände bleiben dauerhaft sichtbar

Das System MUST erfolgreiche, fehlgeschlagene und abgebrochene Jobs im Jobdetail und in der Monitoring-Historie dauerhaft nachvollziehbar halten.

#### Scenario: Job wird erfolgreich abgeschlossen

- **WHEN** ein Job in `succeeded` wechselt
- **THEN** zeigen Jobdetail und Historie den Terminalstatus und verfügbare Ergebnisaktionen
- **AND** hängt der Erfolgsnachweis nicht von einer kurzlebigen globalen Meldung ab

#### Scenario: Job schlägt fehl

- **WHEN** ein Job in `failed` wechselt
- **THEN** bleiben Fehlerstatus, sichere Diagnose und verfügbare Folgeaktionen im dauerhaften Kontext sichtbar
- **AND** verschwindet der Fehler nicht automatisch

### Requirement: Jobfolgeaktionen sind Host-Capabilities

Das System MUST Retry, Cancel, Ergebnisöffnung oder Download nur darstellen, wenn Hostvertrag, Berechtigung und aktueller Jobzustand die konkrete Aktion erlauben.

#### Scenario: Fehlgeschlagener Job unterstützt Retry

- **WHEN** der Hostvertrag für einen fehlgeschlagenen Job einen autorisierten Retry erlaubt
- **THEN** darf die UI die Aktion anbieten
- **AND** bleibt die neue oder wiederholte Ausführung über den Hostvertrag und die Jobhistorie nachvollziehbar

#### Scenario: Job unterstützt keinen Retry

- **WHEN** kein sicherer Retry-Vertrag existiert
- **THEN** bietet die UI keinen generischen Retry an
- **AND** beschreibt sie stattdessen die nächste sichere Handlung

### Requirement: Jobfortschritt bleibt zugänglich und begrenzt angekündigt

Das System MUST bedeutende Status- oder Phasenwechsel zugänglich ankündigen, ohne jede Progress-Aktualisierung als Live-Region-Meldung auszugeben oder den Fokus zu verschieben.

#### Scenario: Job meldet viele Fortschrittswerte

- **WHEN** ein laufender Job häufige numerische Progress-Updates liefert
- **THEN** aktualisiert die UI die sichtbare Progressdarstellung
- **AND** kündigt die Live-Region nur nach der festgelegten Drosselungs- oder Phasenregel an
- **AND** verschiebt sie den Fokus nicht automatisch
