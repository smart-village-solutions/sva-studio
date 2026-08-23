## Kontext

`mapEventsDetailFormValuesToInput` erzeugt den vollständigen Event-Mutation-Input. Die Funktion wiederholt dieselben Kompaktierungsentscheidungen für mehrere Fachbereiche und enthält dadurch viele unabhängige Verzweigungen in einem einzigen Ownership-Bereich.

## Ziele / Nicht-Ziele

- Ziele: den bestehenden Output exakt charakterisieren, fachlich zusammengehörige Serialisierung isolieren und die Hauptfunktion auf reine Assemblierung reduzieren.
- Nicht-Ziele: Validierung verschieben, URL- oder Datumswerte korrigieren, POI-Code verändern, Mainserver-Verträge anpassen oder eine neue packageübergreifende API einführen.

## Entscheidungen

- Serializer bleiben paketintern in `@sva/plugin-events` und frameworkfrei.
- Redaktionelle Werte, Web-URLs, Kontakte, Preise und Barrierefreiheit werden in kleine reine Funktionen zerlegt.
- Datum, Adresse/Geo und Medien erhalten eigene reine Serializer, weil ihre Grenzwerte datenintegritätsrelevant sind.
- Der öffentliche Mapper behält seinen Namen und Rückgabetyp und assembliert ausschließlich die vorserialisierten Bereiche.
- Der bestehende Events-POI-Medienclone bleibt ausdrücklich unangetastet; ohne belegten gemeinsamen Owner wird keine Shared-API eingeführt.
- Alternative „nur lokale Variablen umbenennen“ wird verworfen, weil sie die Ownership der unabhängigen Entscheidungen nicht reduziert.

## Datenfluss

```text
EventsDetailFormValues
  -> redaktionelle Serializer
  -> Datums-Serializer
  -> Adress-/Geo-Serializer
  -> Medien-Serializer
  -> bestehender EventFormInput-Assembler
```

## Risiken / Abwägungen

- Feldverlust und geänderte Omit-Regeln werden durch Deep-Equal-Characterization für vollständige, minimale, leere, `null`-, `false`-, `0`- und ungültige Werte verhindert.
- Datums- und Zeitzonen-Drift wird verhindert, indem all-day-, lokale und Offset-Werte exakt unverändert erwartet werden.
- Medien- und Geo-Drift wird durch partielle, nicht-endliche und Null-Grenzmatrizen abgesichert.
- Reihenfolge und Kompatibilitätswerte werden explizit charakterisiert; die Refaktorierung führt keine zusätzliche Validierung ein.

## Migrationsplan

Keine Datenmigration. Die Änderung ist verhaltensgleich und durch Zurücksetzen des Code-Commits rückgängig zu machen.

## Offene Fragen

Keine. Die bestehende Semantik ist durch den Altcode und die grüne Characterization festgelegt.
