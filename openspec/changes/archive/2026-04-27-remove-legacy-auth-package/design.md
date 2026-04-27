## Context

Die Zielarchitektur trennt den alten IAM/Auth-Monolithen in Zielpackages. App, Routing und Mainserver konsumieren heute `@sva/auth-runtime`; neue IAM-Fachlogik gehört je nach Verantwortung in `@sva/auth-runtime`, `@sva/iam-admin`, `@sva/iam-core`, `@sva/iam-governance` oder `@sva/instance-registry`.

`@sva/auth` enthält noch Quellcode, Tests, Benchmarks, Build-Artefakte und eigene Nx-Targets. Diese Oberfläche ist nicht mehr der aktive Runtime-Vertrag und soll deshalb nicht weiter als Workspace-Projekt gepflegt werden.

## Safety Strategy

Die Entfernung erfolgt nur, wenn vor dem Löschen keine aktiven produktiven Consumer mehr auf `@sva/auth` oder `packages/auth` zeigen. Als aktiv gelten Root-Konfiguration, App-/Package-`package.json`, `tsconfig`-Mappings, Nx-Targets, produktive Source-Dateien, CI-/Script-Gates, aktive OpenSpec-Specs, nicht-archivierte OpenSpec-Changes und nicht-archivierte Dokumentation.

Historische Referenzen in `openspec/changes/archive/**`, älteren ADRs oder Reports dürfen bestehen bleiben, wenn sie eindeutig historischen Kontext beschreiben und nicht als aktueller Import- oder Betriebsvertrag gelesen werden.

Aktuelle harte Blocker vor dem Löschen sind insbesondere:

- normative Spezifikationen, die `packages/auth/src` noch als Implementierungsort oder Helper-Quelle beschreiben
- nicht-archivierte OpenSpec-Changes, die `packages/auth` als affected code oder Zielort nennen
- CI-Skripte, die Typen, Route-Konstanten, Keycloak-Clients oder Package-Dependencies direkt aus `packages/auth` beziehen
- Quality- und Coverage-Baselines, die `auth` oder Dateien unter `packages/auth/src/**` als aktiven Projektumfang führen
- Test-Fixtures, die `auth` als Beispiel für ein reales Workspace-Projekt verwenden

## Removal Order

1. Aktive Referenzen mit `rg` und Nx-Projektgraph erfassen.
2. Falls aktive Consumer gefunden werden, diese zuerst auf Zielpackages umstellen oder den Change abbrechen.
3. Aktive OpenSpec-Specs und nicht-archivierte Changes auf Zielpackages korrigieren, damit keine parallele Planung `@sva/auth` wieder einführt.
4. CI-Skripte, Root-Scripts und Check-Konfigurationen von `auth` auf Zielpackages oder dedizierte Test-Fixtures bereinigen.
5. Coverage-/Complexity-Konfigurationen inklusive Baselines und tracked Findings von `packages/auth` lösen.
6. `packages/auth` inklusive `src`, Tests, Benchmarks, Dist und Coverage-Artefakten entfernen.
7. Aktive Docs aktualisieren und den Hard-Cut-Fortschritt dokumentieren.
8. Workspace-, Type-, Unit-, Runtime-, Quality- und PR-Gates ausführen.

## Rollback

Rollback erfolgt nicht über einen versteckten Kompatibilitäts-Re-Export. Falls nach der Entfernung ein echter aktiver Consumer fehlt, wird der Consumer auf das zuständige Zielpackage migriert. Nur bei blockierendem Release-Risiko darf `packages/auth` aus Git wiederhergestellt werden; danach muss ein neues Entfernungsticket mit konkretem Blocker angelegt werden.
