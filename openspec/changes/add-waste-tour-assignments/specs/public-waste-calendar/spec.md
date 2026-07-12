## ADDED Requirements

### Requirement: Öffentlicher Kalender löst explizite Einsatzorte hierarchisch auf

Das System SHALL einen expliziten Einsatz anzeigen, wenn einer seiner Abholorte dem angefragten Abholort oder einem Vorfahren davon entspricht.

#### Scenario: Ortsebene gilt für konkrete Straße

- **WHEN** ein Einsatz für einen Ort mit allen Straßen hinterlegt ist
- **AND** ein Benutzer eine konkrete Straße dieses Orts abfragt
- **THEN** enthält der Kalender den Einsatz

### Requirement: Öffentlicher Kalender filtert Einsätze über Tour-Fraktionen

Das System SHALL die Abfallfraktionen eines expliziten Einsatzes ausschließlich aus seiner Tour ableiten.

#### Scenario: Schadstoffmobil-Fraktion filtert Einsatz

- **WHEN** eine Tour der Fraktion Schadstoffmobil zugeordnet ist
- **AND** ein Benutzer diese Fraktion auswählt
- **THEN** zeigt der Kalender die expliziten Einsätze dieser Tour

### Requirement: Explizite Einsätze verdrängen doppelte Wiederholungstermine

Das System SHALL einen expliziten Einsatz statt eines sonst identischen berechneten Wiederholungstermins ausgeben.

#### Scenario: Expliziter Einsatz ergänzt regulären Termin

- **WHEN** ein expliziter Einsatz und ein berechneter Termin für dieselbe Tour, denselben Tag und den abgefragten Ort existieren
- **THEN** zeigt der Kalender den expliziten Einsatz nur einmal
- **AND** ein expliziter Hinweis hat Vorrang vor einem allgemeinen Tourhinweis
