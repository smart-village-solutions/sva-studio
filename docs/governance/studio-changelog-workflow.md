# Studio-Changelog-Workflow

## Ziel

Pull Requests mit erkennbarer Nutzerwirkung erhalten einen verständlichen
Studio-Changelog-Eintrag. Rein interne Refactorings und routinemäßige Updates
benötigen keinen Eintrag. Ein Update mit sichtbarer Fehler- oder
Sicherheitswirkung kann einen knappen Nutzereintrag erhalten.

## Pflichtformat

Die Datei liegt immer unter:

`docs/changelog/entries/pr-<nummer>.json`

Beispiel:

```json
{
  "prNumber": 412,
  "body": "Allgemeine Verbesserungen\n\n- Stabilere Speicherung\n- Bereinigte Detailansicht"
}
```

Verbindliche Regeln:

- ein Eintrag für die aktuelle PR ist bei erkennbarer Nutzerwirkung erforderlich
- ältere Changelog-Dateien dürfen im selben PR ergänzt, überarbeitet oder bei fehlendem Nutzerbezug entfernt werden
- `prNumber` muss zur PR-Nummer passen
- `body` darf nicht leer sein
- `body` ist ein Nutzertext, kein interner Technikvermerk
- Markdown ist erlaubt
- rohes HTML ist nicht erlaubt

## Schreibregeln

Der Text soll für Studio-Nutzer verständlich sein.

Geeignet:

- `Allgemeine Verbesserungen`
- `Die Suche in der Inhaltsübersicht reagiert zuverlässiger auf Filterwechsel.`
- `Die Rollenansicht zeigt fehlende Berechtigungen jetzt klarer an.`

Nicht geeignet:

- `Refactor organization mutation handler`
- `Fix 403 in iam-api`
- `Cleanup after scope semantics changes`

Wenn eine Änderung keinen klaren Fachhinweis verdient, wird kein künstlicher
Minimaltext angelegt.

## CI-Vertrag

Ein dediziertes GitHub-Action-Gate prüft:

- im PR: alle noch vorhandenen geänderten Einträge; ein PR ohne Eintrag besteht dieses Gate
- der aktuelle Eintrag muss zur PR-Nummer passen; zusätzliche Änderungen an
  älteren Einträgen sind erlaubt
- auf `main`: den gesamten Eintragskatalog

Lokal kann der Repository-Katalog mit folgendem Befehl geprüft werden:

```bash
pnpm check:studio-changelog
```

## Release Notes

Beim Studio-Build werden die neuen Eintragsdateien zwischen dem letzten stabilen
`studio-v*`-Production-Tag und dem gebauten Commit ausgewählt. Einträge, die
bereits im Production-Tag enthalten waren, erscheinen auch nach Übernahme eines
Hotfixes nach `main` nicht erneut. Solange kein verifizierter Basistag existiert,
bleibt die Auswahl leer; es werden keine historischen Einträge als neues Release
ausgegeben. Die Build-Prüfung schreibt eine auf 20 Einträge begrenzte Auswahl
unter `apps/sva-studio-react/.generated/studio-changelog.json` und bindet sie
an den Quellcommit. Sie wird nicht in das Runtime-Artefakt kopiert oder im
Studio-Dashboard angezeigt.

Maßgeblich sind der ausgecheckte Build-Commit und der letzte stabile
Production-Tag. Der reguläre Release-Kandidat muss nach dem letzten
Production-Tag gebaut werden. Release Notes lassen sich aus der vollständigen
Auswahl erzeugen, etwa mit
`pnpm exec tsx scripts/ci/generate-studio-changelog-artifact.ts --format notes --base-ref studio-v0.10.4 --head-ref <commit-sha> --output <datei>`.
Die Ausgabe wird vor einer GitHub-Veröffentlichung gegen den Live-Digest und
die tatsächliche Release-Grenze redaktionell geprüft.
