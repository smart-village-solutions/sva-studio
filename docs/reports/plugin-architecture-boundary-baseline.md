# Plugin-Architecture-Boundary-Baseline

## Zweck

Diese Baseline dokumentiert bewusst tolerierte Brownfield-Abweichungen gegen den Plugin-Architekturvertrag. Sie ist keine Freigabeliste fuer neue Erweiterungen, sondern nur ein Schutz gegen stillschweigende Neudrift.

## Aktueller Altbestand

- `@sva/plugin-waste-management` ist derzeit der bekannte Brownfield-Fall.
- Die tolerierten Eintraege decken nur die bereits vorhandene Kopplung an `@sva/core`, `@sva/studio-module-iam` und die review-pflichtigen Runtime-Signale des bestehenden Dateibaums ab.
- Folgechange fuer den Ownership-Schlupfloch-Abbau: `refactor-studio-module-iam-public-contract`

## Review-Regeln

- Jede Aenderung an diesem Report ist ein Architekturereignis und braucht Review durch `Architecture`, `Documentation` und `Code Quality`.
- Neue Eintraege brauchen `owner`, `justification` und `removalChange`.
- Das Entfernen eines Eintrags ist jederzeit erlaubt und erwuenscht, wenn der zugrunde liegende Verstoss beseitigt wurde.

## Machine Readable Baseline

```json
[
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "workspace-dependency",
    "subject": "@sva/core",
    "owner": "studio-platform",
    "justification": "Bestehende Plugin-Operations- und Host-Kopplung im Brownfield-Bestand.",
    "removalChange": "refactor-studio-module-iam-public-contract"
  },
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "workspace-dependency",
    "subject": "@sva/studio-module-iam",
    "owner": "studio-platform",
    "justification": "Historische Modul-IAM-Kopplung ueber ein gemischtes Host-Package.",
    "removalChange": "refactor-studio-module-iam-public-contract"
  },
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "workspace-import",
    "subject": "@sva/studio-module-iam",
    "owner": "studio-platform",
    "justification": "Der aktuelle Plugin-Einstieg liest Modul-IAM-Metadaten noch direkt aus dem Host-Package.",
    "removalChange": "refactor-studio-module-iam-public-contract"
  },
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "review-required-path-signal",
    "subject": ".controller.",
    "owner": "studio-platform",
    "justification": "Der Brownfield-Dateibaum fuehrt hostnahe Controller-Segmente noch innerhalb des Plugins.",
    "removalChange": "refactor-studio-module-iam-public-contract"
  },
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "review-required-path-signal",
    "subject": ".loaders.",
    "owner": "studio-platform",
    "justification": "Der Brownfield-Dateibaum fuehrt Loader-Segmente noch innerhalb des Plugins.",
    "removalChange": "refactor-studio-module-iam-public-contract"
  },
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "review-required-path-signal",
    "subject": ".state.",
    "owner": "studio-platform",
    "justification": "Der Brownfield-Dateibaum fuehrt hostnahe State-Segmente noch innerhalb des Plugins.",
    "removalChange": "refactor-studio-module-iam-public-contract"
  },
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "review-required-path-signal",
    "subject": ".submissions.",
    "owner": "studio-platform",
    "justification": "Der Brownfield-Dateibaum fuehrt Submission-Segmente noch innerhalb des Plugins.",
    "removalChange": "refactor-studio-module-iam-public-contract"
  },
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "review-required-path-signal",
    "subject": "plugin-operations.ts",
    "owner": "studio-platform",
    "justification": "Plugin-Operations sind aktuell historisch im Plugin-Dateibaum verortet.",
    "removalChange": "refactor-studio-module-iam-public-contract"
  },
  {
    "packageName": "@sva/plugin-waste-management",
    "rule": "review-required-path-signal",
    "subject": "server.ts",
    "owner": "studio-platform",
    "justification": "Der bestehende Dateibaum traegt noch eine pluginseitige Server-Segmentierung.",
    "removalChange": "refactor-studio-module-iam-public-contract"
  }
]
```
