## Context

`buildDoiDispatchMessage` formt einen bereits normalisierten Waste-Versandauftrag in den Laufzeitvertrag von `@sva/mail-runtime` um. Dabei sind Reihenfolge und Leerzeilen der Nur-Text-Mail ebenso beobachtbar wie die Priorität der Mailadressen. Die Funktion liegt im produktiven Outbox-Pfad, berührt in diesem Change aber weder Erzeugung noch Prüfung von Token oder URLs.

## Goals / Non-Goals

- Goals:
  - den vorhandenen DOI-Vertrag durch Characterization explizit machen
  - Templatewerte, Textabschnitte und Envelope in kleine interne, reine Helfer zerlegen
  - bestehende Fallback- und Prioritätsregeln unverändert erhalten
- Non-Goals:
  - Inhalte, Übersetzungen oder rechtliche Pflichtabschnitte fachlich neu gestalten
  - Adressen validieren, normalisieren oder priorisieren
  - die Reminder-Komposition oder den Dispatch-Vertrag vereinheitlichen
  - einen generischen Mail- oder Template-Baukasten einführen

## Decisions

### Decision: Der bestehende Ausgabe-Vertrag ist die Refactoring-Grenze

Die Characterization prüft das vollständige `MailDispatchMessage` einschließlich `from`, `to`, optionalem `cc`, `bcc`, `replyTo`, Betreff und Text. Helfer bleiben dateiintern und liefern genau die bestehenden Zwischenwerte; es entsteht kein neuer öffentlicher Vertrag.

### Decision: Legacy-Leerwertsemantik bleibt erhalten

Ein vorhandener Payload-Wert hat über Nullish-Priorität Vorrang vor der Konfiguration. Daher unterdrücken leere oder nur aus Whitespace bestehende Payload-Labels den konfigurierten Service- beziehungsweise Verantwortlichen-Fallback. Unbekannte Template-Platzhalter werden weiterhin durch den leeren String ersetzt. Diese Semantik wird nicht im Refactoring korrigiert.

### Decision: Abschnittsreihenfolge bleibt explizit lokal

Die DOI-Abschnitte bleiben in ihrer bisherigen Reihenfolge sichtbar: Preheader, Intro, Ort, Bestätigungszeile, Fallback, Ablaufhinweis, Service, Verantwortlicher, Datenschutz und Impressum. Es wird keine generische Abschnitts-Engine erzeugt.

### Decision: Der Envelope-Helfer bleibt DOI-spezifisch

Der dateiinterne Envelope-Helfer kapselt ausschließlich den bestehenden DOI-Aufbau für Absender, Empfänger, optionale Kopien und Reply-To. Die Reminder-Komposition und ihr eigener Envelope-Block bleiben source-seitig unverändert, damit die fachliche Scope-Grenze sichtbar und unabhängig rückrollbar bleibt.

## Risks / Trade-offs

- Eine scheinbar hilfreiche Normalisierung könnte bestehende Leerwert- oder Fallback-Semantik verändern. Die kombinatorischen Characterization-Fälle verhindern dies.
- Das Herausziehen zu vieler Einzeiler könnte Ownership erhöhen. Helfer werden nur entlang der drei vorhandenen Verantwortungen Templatewerte, Text und Envelope geschnitten.
- Mailadressen sind personenbezogen. Tests verwenden ausschließlich reservierte synthetische Domains und die Implementierung erzeugt keine neuen Logs.

## Migration Plan

Keine Daten-, Konfigurations- oder Laufzeitmigration. Das Refactoring kann als einzelner Merge-Commit zurückgerollt werden.

## Open Questions

Keine. Eine fachliche Änderung der Legacy-Leerwertsemantik wäre ein eigener, freizugebender Change.
