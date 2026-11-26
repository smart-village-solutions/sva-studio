# i18n-Ressourcen

Die Host-Übersetzungen unter `src/i18n/resources` sind nach zwei Achsen organisiert:

- pro Sprache (`de`, `en`)
- pro Feature bzw. Namespace (`shell`, `account`, `admin`, `admin/instances` usw.)

Studio löst die Schlüssel mit `t('namespace.key', { name })` auf.
Die Sprachressourcen enthalten Textwerte und verwenden `{{name}}` für Platzhalter.
Der Host bindet die Ressourcen registrierter Plugins in denselben Übersetzer ein.
Fehlende Werte fallen auf Deutsch zurück. Fehlt ein Schlüssel auch dort, erscheint
der Schlüssel selbst. Der öffentliche Abfallkalender nutzt denselben
frameworkunabhängigen Übersetzer aus `@sva/core` mit eigenen Ressourcen.

## Strukturregeln

- Jede konkrete Übersetzungsdatei liegt unter `resources/<locale>/...` und endet auf `.resources.ts`.
- Teilressourcen, die ausschließlich innerhalb einer anderen Ressource eingebunden werden, enden auf `.partial.resources.ts`. Sie werden mitformatiert, aber nicht als eigener Namespace in Aggregatoren aufgenommen; der besitzende Namespace importiert sie ausdrücklich.
- Aggregator-Dateien wie `resources/de.ts`, `resources/de/account.resources.ts` oder `resources/de/admin/instances.resources.ts` fassen die Unterdateien zusammen.
- Neue Übersetzungen sollen in die fachlich passendste Datei einsortiert werden statt bestehende Sammeldateien wieder aufzublähen.

## Größenregel

- Ziel ist, einzelne Übersetzungsdateien überschaubar zu halten.
- Aktuelle Arbeitsregel: möglichst unter `300 LOC` pro Datei bleiben.
- Wenn eine Datei zu groß wird, weiter entlang von Feature-, Teilbereichs- oder UI-Grenzen aufsplitten.

## Formatierung

- Aggregator-Dateien werden nicht manuell sortiert oder umgebaut. Eigene Textobjekte gehören in die jeweiligen Blattressourcen; direkt eingetragene Texte würden beim Regenerieren überschrieben.
- Dafür gibt es das Script:

```sh
pnpm i18n:format:resources
```

- Prüfen ohne Schreibzugriff:

```sh
pnpm i18n:format:resources --check
```

Das Script regeneriert die Aggregator-Dateien deterministisch aus der Ordnerstruktur und formatiert danach den gesamten Ressourcenbaum mit der Repo-Prettier-Konfiguration.
