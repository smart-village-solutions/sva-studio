# i18n-Ressourcen

Die Host-Übersetzungen unter `src/i18n/resources` sind nach zwei Achsen organisiert:

- pro Sprache (`de`, `en`)
- pro Feature bzw. Namespace (`shell`, `account`, `admin`, `admin/instances` usw.)

## Strukturregeln

- Jede konkrete Übersetzungsdatei liegt unter `resources/<locale>/...` und endet auf `.resources.ts`.
- Aggregator-Dateien wie `resources/de.ts`, `resources/de/account.resources.ts` oder `resources/de/admin/instances.resources.ts` fassen die Unterdateien zusammen.
- Neue Übersetzungen sollen in die fachlich passendste Datei einsortiert werden statt bestehende Sammeldateien wieder aufzublähen.

## Größenregel

- Ziel ist, einzelne Übersetzungsdateien überschaubar zu halten.
- Aktuelle Arbeitsregel: möglichst unter `300 LOC` pro Datei bleiben.
- Wenn eine Datei zu groß wird, weiter entlang von Feature-, Teilbereichs- oder UI-Grenzen aufsplitten.

## Formatierung

- Aggregator-Dateien werden nicht manuell sortiert oder umgebaut.
- Dafür gibt es das Script:

```sh
pnpm i18n:format:resources
```

- Prüfen ohne Schreibzugriff:

```sh
pnpm i18n:format:resources --check
```

Das Script regeneriert die Aggregator-Dateien deterministisch aus der Ordnerstruktur und formatiert danach den gesamten Ressourcenbaum mit der Repo-Prettier-Konfiguration.
