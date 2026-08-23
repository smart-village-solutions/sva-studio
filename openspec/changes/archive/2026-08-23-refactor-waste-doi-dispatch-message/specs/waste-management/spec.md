## ADDED Requirements

### Requirement: DOI-Versandnachrichten bewahren ihren deterministischen Kompositionsvertrag

Das System SHALL DOI-Versandnachrichten aus der Waste-Konfiguration, dem normalisierten Versandauftrag und der zentralen Mail-Transport-Konfiguration deterministisch zusammensetzen, ohne den Token-, Outbox- oder Zustellvertrag in der Kompositionsschicht zu verändern.

#### Scenario: DOI-Text verwendet die bestehende Abschnittsreihenfolge

- **WHEN** eine DOI-Versandnachricht aus vollständigen Textbausteinen und Templatewerten erzeugt wird
- **THEN** enthält ihr Nur-Text-Inhalt Preheader, Intro, Ort, Bestätigungszeile, Fallback, Ablaufhinweis, Service, Verantwortlichen, Datenschutz und Impressum in der bestehenden Reihenfolge
- **AND** die enthaltenen Abschnitte bleiben durch genau eine Leerzeile getrennt
- **AND** unbekannte Template-Platzhalter werden weiterhin durch den leeren String ersetzt

#### Scenario: Optionale oder leere DOI-Abschnitte behalten ihre Legacy-Semantik

- **WHEN** optionale DOI-Texte fehlen, leer sind oder nur Whitespace enthalten
- **THEN** werden dieselben Abschnitte wie bisher ausgelassen
- **AND** ein vorhandener Payload-Wert besitzt weiterhin Nullish-Priorität vor dem entsprechenden Konfigurationswert
- **AND** ein leerer oder nur aus Whitespace bestehender Payload-Wert wird nicht stillschweigend durch den Konfigurationswert ersetzt

#### Scenario: DOI-Envelope bewahrt die bestehende Adresspriorität

- **WHEN** Payload, Waste-Konfiguration und Transport unterschiedliche Absender- oder Antwortadressen liefern
- **THEN** bleiben Payload-`replyTo`, konfiguriertes `replyTo` und Transport-`replyTo` in dieser Prioritätsreihenfolge
- **AND** konfigurierte Absenderwerte bleiben vor Transport-Fallbacks priorisiert
- **AND** `to`, `cc`, `bcc` und vorhandene Anzeigenamen aus dem Payload bleiben unverändert erhalten

#### Scenario: Nicht-DOI-Template bleibt im Reminder-Pfad

- **WHEN** der Versandauftrag keinen DOI-Template-Key besitzt
- **THEN** verwendet das System weiterhin die bestehende Reminder-Komposition
- **AND** das DOI-Refactoring verändert weder Reminder-Text noch Reminder-Envelope
