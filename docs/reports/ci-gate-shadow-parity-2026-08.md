# CI-Gate-Shadow-Parität 2026-08

## Status

- Messung: ausstehend
- Auswertbare Live-Läufe: `0/20`
- Cutover-Empfehlung: nein
- Required-Kontexte und Ruleset: unverändert
- Releasepfad `Build` → Dev → `Promote`: unverändert

## Lokal vorbereiteter Nachweis

Der PR-Shadow berechnet den allgemeinen Scope genau einmal und veröffentlicht
eine Evidenz mit Schema-Version, Base-SHA, Head-SHA, normalisierten Dateien,
Gate-Modi und Fallback-Gründen. Die Shadow-Jobs tragen ausschließlich
nicht blockierende Namen. Ein fail-closed Paritätsauswerter ordnet die sieben
Required-Verträge sowie A11y, App Build, Documentation Integrity,
Documentation Catalog und DB Schema Snapshot ihren Shadow-Ergebnissen zu.

Contract-Tests prüfen insbesondere Docs-only-No-op, normalen affected Scope,
globalen Full-Fallback, fehlende oder doppelte Checks, nicht terminale
Ergebnisse, Fremd-SHA-Evidenz und die Trennung des Main-/Nightly-Shadows von
PR-Scope, PR-Cache und App-Build. Die konkreten lokalen Gate-Ergebnisse werden
mit dem Implementierungsstand dokumentiert; sie ersetzen keine GitHub-Läufe.

Am 28. August 2026 waren lokal grün:

- `tooling-testing:test:unit`: 7 Dateien, 69 Tests;
- `tsc -p tsconfig.scripts.json --noEmit`;
- `tooling-testing:lint`;
- strikte OpenSpec-Validierung;
- File-Placement-, Dokumentations- und Rollout-Dokumentationsprüfung;
- Prettier-, YAML-Parse- und `git diff --check`-Prüfung.

## Erforderliche Live-Auswertung

Für jeden repräsentativen PR-Head sind mindestens folgende Felder zu erfassen:

- Head-SHA, Base-SHA und Scope-Schema-Version;
- Scope- und terminale Ergebnisparität je Gate;
- Setup-, Queue-, Ausführungs- und Aggregationszeit;
- Zeit bis zum ersten verwertbaren Fehler;
- Runner-Minuten und temporär doppelte Arbeit;
- ungeklärte Abweichungen und deren Ursache.

Plan 036 bleibt gesperrt, bis mindestens 20 auswertbare Läufe null ungeklärte
Scope-Unterabdeckungen oder Ergebnisabweichungen zeigen und die mediane grüne
Required-Zeit gegenüber der Baseline um höchstens 30 Sekunden steigt.

## Aussagegrenze

Lokale Type-, Lint-, Unit-, Workflow-Contract-, YAML-, OpenSpec- und
Placement-Prüfungen können die Struktur und das fail-closed Verhalten belegen.
Sie beweisen weder GitHub-Queue-Zeiten noch Live-Check-Semantik oder
Runner-Minuten. Deshalb bleibt der Messstand bis zum freigegebenen Push und
den anschließenden GitHub-Läufen bei `0/20`.
