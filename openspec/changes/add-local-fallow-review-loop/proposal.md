# Change: Begrenzten lokalen Fallow-Loop für Draft-PRs einführen

## Why

Der Pilot auf dem Z640 benötigte für jeden Befund manuell Datei, Export und Nx-Projekt. Der vorhandene unversionierte Befehl kann deshalb keine Aufgaben selbst auswählen; freie Modell-Diffs führten zudem zu No-op- oder ungültigen Änderungen. Der unmittelbare Verbraucher ist ein unbeaufsichtigter Z640-Lauf, dessen Ergebnisse als wenige prüfbare Draft-PRs im Studio-Repository ankommen.

## What Changes

- Die versionierte Fallow-CLI des Workspaces liefert die Kandidatenliste vom aktuellen `origin/main`; ein Repo-Skript erweitert und ersetzt den bisherigen Befehl unter `~/.local/bin/sva-fallow-export-task`.
- Der Loop bündelt nur zusammengehörige, risikoarme Befunde eines Nx-Projekts und eines Verantwortungsbereichs. Die erste Aufgabenart ist das Entfernen tatsächlich ungenutzter Exports in App-Code; öffentliche Packages, Auth-/IAM-, Routen-, Plugin- und Server-Verträge werden zunächst nicht automatisch geändert.
- Das lokale Modell bewertet ein begrenztes Kandidatenbündel und liefert strukturierte Änderungen. Ein unabhängiger Validator begrenzt Dateien und Änderungsart, prüft Verbraucher und Fallow-Befund erneut und führt die passenden Nx-Unit-/Type-Gates aus.
- Pro Lauf entstehen höchstens zwei Draft-PRs mit Changelog-Eintrag, Modell-/Prüfnachweis und dem Label `local-llm`. Der Loop wartet die GitHub-Gates am finalen HEAD ab; Merge und fachliche Freigabe bleiben manuell.
- Fallow selbst bleibt die Aufgabenquelle. Einzelne statische Befunde erzeugen keine GitHub-Issues; Issues sind für fachliche Entscheidungen oder belegte Follow-ups reserviert.

## Nicht-Ziele

- Kein autonomer Merge, keine Produkt-, Datenbank- oder Deployment-Änderung und kein neuer CI-Gate-Pfad.
- Keine generische Agentenplattform, keine parallelen Worker, keine automatische Bearbeitung von Security-, Auth-, IAM-, Migrations- oder öffentlichen Package-Verträgen.
- Keine Mindestzahl an PRs: Ohne zusammenhängendes und ausreichend prüfbares Bündel endet der Lauf ohne Veröffentlichung.

## Impact

- Betroffene Bereiche: ein versionierter Operator-Pfad unter `scripts/ops/` mit gezielten Vitest-Tests, `docs/development/fallow-agent-integration.md` und diese OpenSpec-Änderung. Die bestehende `llama-server`-Benutzereinheit bleibt erhalten; der alte Home-Verzeichnis-Befehl wird bei der Installation entfernt.
- Betroffene Spezifikation: `complexity-quality-governance` für die lokale Bearbeitung von Qualitätsbefunden.
- Keine Produkt-Runtime oder arc42-Bausteinsicht betroffen. Die Trust Boundary verläuft zwischen lokalem Modellvorschlag und dem Prozess, der Dateien, Git und GitHub verändert; sie wird im Design begrenzt.

## Erfolg

Ein gestarteter Lauf ermittelt ohne manuelle Dateivorgabe aktuelle Fallow-Kandidaten, verwirft unpassende Fälle mit Grund, erstellt höchstens zwei zusammenhängende Draft-PRs und lässt bestehende Arbeit bei Neustart ohne Duplikate nachvollziehbar. Jeder veröffentlichte PR enthält nur den vereinbarten Bereich plus verpflichtenden Changelog-Eintrag, bestandene lokale Gates und terminale GitHub-Gates für den finalen HEAD. Ein ungültiger Modellvorschlag, ein Testfehler oder rote CI führen zu keiner automatischen Freigabe.
