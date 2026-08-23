## Context

Die Tourenübersicht lädt die Touren bereits vollständig und filtert sie clientseitig anhand typisierter Search-Parameter. Touren können einen tourweiten Gültigkeitsbeginn und ein Gültigkeitsende sowie zusätzliche explizite Termine besitzen. Die vorhandenen vier Datumsfilter bilden konkrete Grenzen ab, lösen aber die häufige Auswahl eines relativen Kalenderjahres nicht verständlich ab.

## Goals / Non-Goals

- Goals:
  - schnelle Auswahl des letzten, aktuellen oder nächsten Kalenderjahres,
  - fachlich korrekte inklusive Überschneidungsprüfung für Gültigkeitszeiträume,
  - Berücksichtigung expliziter Termine,
  - reload-stabiler Filterzustand mit `Alle Touren` als Default,
  - unveränderte Kombinierbarkeit mit allen bestehenden Tourenfiltern.
- Non-Goals:
  - serverseitige Filterung oder neue API-Parameter,
  - Datenbank- oder Tourenmodelländerungen,
  - Entfernung der bestehenden freien Datumsfilter,
  - frei wählbare oder weiter entfernte Kalenderjahre.

## Decisions

### Eigener relativer Jahresfilter

Der Filter verwendet einen eigenen typisierten Wert `all`, `previous`, `current` oder `next`. Er überschreibt die bestehenden Datumsfelder nicht. Dadurch bleiben die Jahresauswahl und manuell gesetzte Detailgrenzen als getrennte, gemeinsam wirkende Kriterien verständlich und im URL-Zustand reproduzierbar.

Ungültige oder fehlende Werte werden auf `all` normalisiert. Die Oberfläche zeigt zur Orientierung neben der relativen Bezeichnung die zur Laufzeit ermittelte Jahreszahl an.

### Inklusive Gültigkeitsüberschneidung

Für das ausgewählte Jahr werden `YYYY-01-01` und `YYYY-12-31` gebildet. Ein tourweiter Gültigkeitszeitraum überschneidet das Jahr, wenn sein Beginn fehlt oder spätestens am Jahresende liegt und sein Ende fehlt oder frühestens am Jahresbeginn liegt. Fehlende Grenzen werden damit als offen behandelt; beide Jahresgrenzen sind eingeschlossen.

Eine Tour erfüllt den Jahresfilter außerdem, wenn mindestens ein expliziter Termin innerhalb der beiden Jahresgrenzen liegt. Dieses Kriterium gilt unabhängig von der Überschneidungsprüfung, damit ein tatsächlich gepflegter Termin nicht durch einen abweichenden allgemeinen Zeitraum verborgen wird. Touren ohne passenden Zeitraum und ohne passenden expliziten Termin werden ausgeblendet.

### Framework-agnostische Berechnung

Die Berechnung des Zieljahres und die fachliche Trefferprüfung werden als reine TypeScript-Helfer außerhalb der React-Komponenten umgesetzt. Der Helfer erhält das Referenzjahr explizit, sodass Jahreswechsel deterministisch testbar bleiben. Die React-Schicht ermittelt lediglich das aktuelle lokale Kalenderjahr und bindet Auswahl sowie Navigation an.

## Risks / Trade-offs

- Relative URL-Werte wie `current` können bei einem späteren Aufruf nach einem Jahreswechsel ein anderes konkretes Jahr bezeichnen. Das entspricht bewusst der relativen Beschriftung; die angezeigte Jahreszahl macht den aktuellen Bezug sichtbar.
- Die Kombination mit freien Datumsgrenzen kann zu einer leeren Ergebnismenge führen. Die Kriterien wirken bewusst gemeinsam und werden über die bestehende Aktion `Filter zurücksetzen` vollständig aufgehoben.

## Test Strategy

- Unit-Tests für letztes, aktuelles und nächstes Jahr sowie den Default `all`.
- Unit-Tests für offene Grenzen, vollständig umschließende und nur eintägig überlappende Zeiträume.
- Unit-Tests für explizite Termine innerhalb und an den Grenzen des Kalenderjahres.
- Search-Parameter-Tests für Normalisierung, Navigation, Reload-Stabilität und Seiten-Reset.
- Komponenten-Tests für Auswahl, Beschriftung mit konkreter Jahreszahl, Anwenden und Zurücksetzen.
