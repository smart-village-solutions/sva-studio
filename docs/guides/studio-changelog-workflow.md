# Studio-Changelog-Workflow

## Ziel

Jeder Pull Request muss einen nutzerverständlichen
Studio-Changelog-Eintrag für die eigene PR mitliefern. Dieser Eintrag wird nach dem
Merge nach `main` direkt im Studio unter „Letzte Änderungen“
angezeigt.

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

- die Datei `docs/changelog/entries/pr-<nummer>.json` für die aktuelle PR ist Pflicht
- ältere Changelog-Dateien dürfen im selben PR zusätzlich ergänzt oder überarbeitet werden
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

Wenn eine Änderung keinen klaren Fachhinweis verdient, bleibt ein
Minimaltext wie `Allgemeine Verbesserungen` zulässig.

## CI-Vertrag

Ein dediziertes GitHub-Action-Gate prüft:

- im PR: die geänderte oder neue Datei
  `docs/changelog/entries/pr-<nummer>.json` für die aktuelle PR;
  zusätzliche Änderungen an älteren Einträgen sind erlaubt
- auf `main`: den gesamten Eintragskatalog

Lokal kann der Repository-Katalog mit folgendem Befehl geprüft werden:

```bash
pnpm check:studio-changelog
```

## Studio-Anzeige

Beim Studio-Build wird aus den letzten 20 gültigen Einträgen zunächst ein
Zwischenartefakt unter
`apps/sva-studio-react/.generated/studio-changelog.json`
erzeugt. Dieses wird anschließend in das Runtime-Artefakt unter
`apps/sva-studio-react/.output/server/generated/studio-changelog.json`
kopiert. Der serverseitige Endpoint liest im Runtime-Image genau dieses
serverseitige Artefakt und zeigt die Einträge auf der Startseite im Abschnitt
„Letzte Änderungen“ an.

Maßgeblich ist dabei immer der Stand von `main`. Ein gesonderter
Release-Schritt ist für die Sichtbarkeit des Changelogs nicht
erforderlich.
