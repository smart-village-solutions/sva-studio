## Kontext

`build.yml` baut Studio und SSF nacheinander im selben Job. `verify-images` prüft beide Images und ist eine Voraussetzung von `promote-dev`. Kassel nutzt bereits einen eigenen Standalone-Pfad, bezieht den Digest aber aus diesem zentralen Build. Der Studio-Hotfix-Nachweis verlangt heute zusätzlich einen SSF-Digest.

## Ziele und Nicht-Ziele

- Ziel: SSF-Builds finden nur nach manuellem Start statt und können weder den zentralen Build noch dessen Dev-Promotion verzögern oder fehlschlagen lassen.
- Ziel: Der Kassel-Kandidat bleibt an Quellcommit, Distribution, unveränderlichen Digest und erfolgreiche Image-Verifikation gebunden.
- Nicht-Ziel: Kassel automatisch deployen, den zentralen Promote-Pfad ändern oder einen zweiten Kasseler Deploymentmechanismus schaffen.
- Nicht-Ziel: SSF-Hotfixes aus beliebigen Branches in diesem Lieferabschnitt ermöglichen. Der manuelle Build verwendet den zum Startzeitpunkt ausgewählten `main`-Stand.

## Entscheidung

Der vorhandene `Build` behält seinen Studio- und Backup-Agent-Pfad sowie die automatische Dev-Promotion. SSF-Build und SSF-Image-Verifikation werden dort entfernt. Ein eigenständiger `workflow_dispatch`-Workflow auf `main` nutzt dieselben vorhandenen Workspace-, Docker- und Image-Verifikationsmittel für die SSF-Distribution. Beide Workflows erhalten getrennte Concurrency-Gruppen. Das Runbook verlangt den terminal erfolgreichen SSF-Workflow, seinen gebundenen Quellcommit und den verifizierten Digest vor dem bestehenden Standalone-Rollout; ein weiteres Evidenzformat ist dafür nicht nötig.

Ein zusätzlicher Job im zentralen Workflow genügt nicht: Sein Status und seine Concurrency blieben Teil desselben Build-Laufs. Ein eigener Workflow ist deshalb die kleinste wirksame Trennung. Er führt keine eigene Deploymentlogik ein.

Beide Distributionen verwenden weiterhin denselben App-Quellbaum und Nx-Abhängigkeitsgraphen. Der zentrale Studio-Image-Build kann deshalb weiterhin gemeinsame oder von der App deklarierte Workspace-Pakete kompilieren, einschließlich `plugin-ssf`. Die Trennung entfernt den zusätzlichen SSF-Image-Build, seine Laufzeitverifikation und ihre Freigabeabhängigkeit aus dem Studio-Rollout; eine vollständige Quellcode-Isolation wäre ein eigener Architekturumbau.

Der zentrale Hotfix-Build erzeugt künftig keinen SSF-Digest. Die Hotfix-Evidenz erhält ein neues Schema für Studio und Backup-Agent; der Leser akzeptiert die bisherige Schemafassung für schon veröffentlichte Nachweise weiterhin, prüft aber auch dort nur die für die Studio-Promotion relevanten Digests und Jobs.

## Kritische Invarianten und Nachweise

| Invariante                                                                     | Nachweis                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Studio-Dev wartet nicht auf SSF und veröffentlicht bei einem SSF-Fehler weiter | Workflow-Vertragstest für Job-Abhängigkeiten und getrennte Trigger/Concurrency; terminaler Main-Build nach Merge  |
| Kassel erhält nur ein verifiziertes SSF-Image aus dem gebundenen Main-Commit   | Image-Verifikationsskript mit `ssf`, Digest/OCI-Revision und terminalem Workflow-Ergebnis; erster manueller Build |
| Kein Build startet einen Kasseler Deployment-Schritt                           | Workflow-Vertragstest und Runbook-Prüfung                                                                         |
| Bestehende kontrollierte Studio-Hotfix-Evidenz bleibt auswertbar               | Gezielte Tests für alte und neue Evidenzfassung                                                                   |

## Risiken und Rückweg

Fehlt im neuen Workflow eine bisherige Build-Eingabe oder Image-Prüfung, kann ein ungeeigneter Kassel-Kandidat entstehen. Deshalb wird der erste manuelle Lauf am exakten Main-Commit einschließlich Image-Verifikation geprüft, bevor sein Digest verwendet wird. Bei Fehlern bleibt Kassel auf dem bisherigen Live-Digest; der normale Studio-Rollout läuft unabhängig weiter.
