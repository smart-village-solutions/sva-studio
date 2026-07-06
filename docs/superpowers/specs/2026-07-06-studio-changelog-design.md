# Studio-Changelog direkt aus PRs

## Ziel

Jeder Pull Request soll genau einen nachvollziehbaren Changelog-Eintrag
erzwingen, der nach dem Merge nach `main` unmittelbar im Studio
sichtbar wird.

Die Texte sollen nicht für Entwickler, sondern für Studio-Nutzer
geschrieben sein. Auch kleine oder rein technische PRs müssen daher
mindestens einen knappen, verständlichen Eintrag wie
`Allgemeine Verbesserungen` liefern.

## Nicht-Ziele

- kein semantisches Versionsmodell als führender Nutzervertrag
- keine Kategorisierung nach `Neu`, `Verbessert` oder `Behoben`
- keine Abhängigkeit von Commit-Messages als primärer Quelle
- keine manuelle Pflege eines zentralen Markdown-Changelogs
- kein Warten auf gesonderte Releases vor der Sichtbarkeit im Studio

## Ausgangslage

Das Repository enthält bereits PR-, Build- und Release-Workflows, aber
keinen belastbaren Mechanismus, der pro PR einen nutzerverständlichen
Änderungstext erzwingt und automatisch ins Studio ausspielt.

Ein reiner PR-Body-Ansatz wäre zu GitHub-zentriert und als
Produktdatenquelle zu indirekt. Ein commit- oder titelbasierter Ansatz
würde die gewünschte Textqualität nicht zuverlässig liefern.

## Leitentscheidung

Jeder PR liefert genau eine strukturierte Changelog-Datei im
Repository. Diese Datei ist die kanonische Quelle für den später im
Studio angezeigten Eintrag.

Diese Entscheidung priorisiert:

1. klare Reviewbarkeit im PR
2. maschinelle Validierbarkeit in CI
3. direkte Wiederverwendung im Produkt
4. nachvollziehbare Zuordnung zwischen PR und Studio-Eintrag

## Format des Changelog-Eintrags

Jeder PR legt genau eine Datei in einem festen Verzeichnis an, etwa
`docs/changelog/entries/` oder einem app-näheren, klar benannten
Pfad.

Das Format bleibt minimal:

```json
{
  "prNumber": 412,
  "body": "Im Studio wurden mehrere Detailverbesserungen und kleinere Fehlerbehebungen umgesetzt.\n\n- Stabilere Speicherung in den Formulareinstellungen\n- Bereinigte Darstellung in der Detailansicht"
}
```

Verbindliche Regeln:

- `body` ist Pflicht
- `body` darf Markdown enthalten
- `body` darf nie leer sein
- `prNumber` dient der Rückverfolgbarkeit
- pro PR ist genau ein Eintrag zulässig

Ein separates `title`-Feld wird bewusst nicht geführt. Die
Studio-Anzeige arbeitet mit dem Textkörper selbst.

## Qualitätsanforderungen an den Text

Der Eintrag ist ein Nutzertext, kein technischer Änderungsvermerk.

Verbindliche Leitplanken:

- kurze, verständliche Sprache
- keine internen Implementierungsdetails ohne Nutzerwert
- keine Pflicht zur Vollständigkeit auf Subtask-Ebene
- Sammeltexte wie `Allgemeine Verbesserungen` sind zulässig
- Markdown nur in einem kleinen, kontrollierten Umfang

Erlaubt sein sollen insbesondere:

- Absätze
- Aufzählungen
- Hervorhebungen
- Links

Nicht als führender Vertragsbestandteil vorgesehen sind:

- rohes HTML
- eingebettete Skripte
- beliebige Rich-Text-Erweiterungen

## PR-Gate

Jeder PR wird durch einen verpflichtenden CI-Check blockiert, wenn der
Changelog-Eintrag fehlt oder ungültig ist.

Der Gate-Check prüft mindestens:

1. genau eine neue oder geänderte Entry-Datei pro PR
2. gültiges JSON-Schema
3. `body` vorhanden und nicht leer
4. keine zweite konkurrierende Entry-Datei
5. `prNumber` stimmt mit dem PR-Kontext überein oder wird bei Bedarf
   deterministisch ergänzt

Wenn ein PR keinen echten Fachhinweis hat, bleibt trotzdem mindestens
ein Minimaltext verpflichtend. Das verhindert stille Merges ohne
Nutzerkommunikation.

## Merge- und Aggregationspfad

Nach Merge nach `main` wird aus allen Einträgen automatisch ein
konsumierbares Studio-Artefakt erzeugt.

Der bevorzugte Ablauf ist:

1. PR wird gemergt
2. ein Workflow auf `main` sammelt alle Entry-Dateien ein
3. die Einträge werden chronologisch in ein kanonisches JSON-Artefakt
   überführt
4. das Studio liest genau dieses Artefakt für die Anzeige

Dieses Artefakt kann entweder:

- zur Build-Zeit in die Studio-App generiert werden oder
- serverseitig als eigener Read-Endpunkt ausgeliefert werden

Die führende fachliche Regel bleibt gleich: Sichtbarkeit beginnt sofort
nach Merge nach `main`.

## Studio-Anzeige

Im Studio wird eine einfache chronologische Liste der letzten
Änderungen angezeigt. Es gibt bewusst keine zusätzliche Kategorisierung
und keine sichtbare Versionsnummer als primären Vertrag.

Wesentliche Anforderungen:

- nur die neuesten Einträge anzeigen
- Markdown sicher und eingeschränkt rendern
- stabile Reihenfolge nach Merge-Zeitpunkt
- direkte Lesbarkeit ohne GitHub-Kontext

Ein sinnvoller erster Vertrag ist eine begrenzte Historie, etwa die
letzten 20 bis 30 Einträge, damit die Anzeige schlank bleibt.

## Sicherheits- und Robustheitsanforderungen

Markdown aus PRs darf im Studio nie ungeprüft als HTML gerendert
werden.

Deshalb gelten:

- Sanitizing vor dem Rendern
- kleine erlaubte Markdown-Oberfläche
- fail-closed bei ungültigen Einträgen
- keine stillschweigende Übernahme kaputter Daten

Wenn ein Entry-Artefakt ungültig ist, muss der Fehler im CI-Gate oder
im Aggregationsschritt sichtbar scheitern, statt im Studio zur
Laufzeit.

## Betriebsvertrag

Der Prozess ist absichtlich PR-zentriert und nicht release-zentriert.

Das bedeutet:

- `main` ist die führende Quelle für sichtbare Änderungen
- Merge ist der Veröffentlichungszeitpunkt für Changelog-Texte
- spätere klassische Versionierung kann ergänzt werden, ist aber nicht
  Voraussetzung

Damit entsteht ein sauberer, kontinuierlicher Kommunikationspfad für
Studio-Nutzer, ohne einen separaten Release-Redaktionsprozess
erzwingen zu müssen.

## Betrachtete Alternativen

### PR-Body als Quelle

Vorteil wäre weniger Repo-Dateien. Die Lösung wurde verworfen, weil
GitHub-Metadaten schlechter lokal prüfbar sind und weniger gut als
produktive Datenquelle taugen.

### Commit- oder PR-Titel als Quelle

Vorteil wäre wenig Pflegeaufwand. Die Lösung wurde verworfen, weil die
Textqualität für Nutzer nicht zuverlässig genug ist.

### Zentrale manuelle Changelog-Datei

Vorteil wäre ein einziger Sammelort. Die Lösung wurde verworfen, weil
Merge-Konflikte steigen und die Zuordnung pro PR unsauber wird.

## Offene Umsetzungsentscheidungen

Für die Implementierung bleiben noch drei technische Detailfragen zu
entscheiden:

1. finaler Ablagepfad der Entry-Dateien
2. JSON-Datei versus YAML-Datei als Autorenformat
3. Build-time-Artefakt versus serverseitiger Read-Endpunkt für die
   Studio-Anzeige

Diese Punkte ändern nicht die Produktentscheidung, sondern nur den
technischen Zuschnitt der Umsetzung.
