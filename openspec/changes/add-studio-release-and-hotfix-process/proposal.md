# Change: Versionierte Studio-Releases und Prod-Hotfixes

## Why

`main` aktualisiert Dev laufend, während Production größere Änderungen nur gelegentlich erhält. Ohne festgehaltene Release-Linie lässt sich ein kleiner Prod-Fix nicht unabhängig von den inzwischen in `main` integrierten Features durch den geschützten Staging-/Production-Pfad befördern. Zudem verlangt das aktuelle Studio-Changelog für fast jeden PR einen sichtbaren Eintrag und zeigt technische Änderungen ohne Nutzwert.

## What Changes

- Studio erhält eine eigene, unveränderliche Versionslinie `studio-v0.10.4`, `studio-v0.10.5`, `studio-v0.11.0-beta.1`, `studio-v0.11.0`. Die erste Version wird nur an einen eindeutig verifizierten Production-Commit samt Live-Digest und Config-Revision gebunden; es werden keine früheren Versionen erfunden.
- Ein regulärer Kandidat bleibt ein fest gewählter, erfolgreich gebauter `main`-Commit. Staging prüft seinen Digest; Production übernimmt exakt diesen Digest über den bestehenden geschützten `Promote`-Workflow. `Beta` bezeichnet den Kandidatenstatus, nicht eine neue technische Umgebung.
- Ein Hotfix-Zweig startet ausschließlich vom letzten verifizierten Prod-Tag. Er enthält den minimalen Fix und, falls der alte Quellstand die zugesagte Changelog-Auswahl noch nicht beherrscht, deren gezielte Anpassung. Der aktuelle `main`-Workflow baut und testet diesen explizit angeforderten Quellcommit, auch wenn der ältere Hotfix-Zweig die neuen Workflow-Trigger noch nicht enthält. Dev bleibt an `main` gebunden. Nach dem Prod-Patch wird der Fix samt Changelog-Eintrag nach `main` übernommen, ohne ihn unter einer neuen PR-Nummer erneut anzukündigen.
- Der vorhandene `Build`-/`Promote`-Pfad akzeptiert diesen eng begrenzten Hotfix-Quellstand, ohne Image-Provenienz, Backup, Migration, Staging-Parität, Config-Revision oder Prod-Freigabe zu umgehen. Build und Image-Verifikation binden alle im Hotfix-Modus veröffentlichten Images an den validierten Quell-SHA; kein `latest`-Alias wird verschoben. Ein Wechsel des gemeinsamen Staging von einer neueren Beta zur Prod-basierten Hotfix-Linie erfordert einen expliziten, geprüften Wechsel und verwirft die bisherige Staging-Parität.
- Das Studio-Changelog und GitHub-Release-Notes enthalten nur Änderungen mit erkennbarem Nutzen für Anwender. Rein interne Refactorings und routinemäßige Updates bleiben über PRs und Git-Vergleich nachvollziehbar. Ein Update mit sichtbarer Fehler- oder Sicherheitswirkung kann einen knappen Nutzereintrag erhalten.
- GitHub-Releases bezeichnen einen tatsächlich verifizierten Release-Commit und Digest; eine Beta kann als Pre-release dokumentiert werden. Das stabile Release wird erst nach erfolgreichem Production-Nachweis veröffentlicht. GitHub-Notes und das In-App-Changelog leiten ihren Inhalt aus dem tatsächlich ausgelieferten Bereich ab, nicht aus der neuesten PR-Nummer oder dem aktuellen `main`. Das nächste reguläre Release nach einem Hotfix kündigt dessen bereits ausgelieferte Korrektur nicht erneut an.

## Nicht-Ziele

- Kein automatischer Production-Deploy, kein direkter Portainer-/Docker-/Quantum-Pfad und keine Umbenennung der GitHub-Environments oder Stacks.
- Kein neues Deployment-System, keine zweite CI-Gate-Hierarchie und keine zusätzliche dauerhafte Umgebung ohne belegte Notwendigkeit.
- Keine Änderung an Kassels eigenständigem Standalone-Rollout oder am Public-Waste-Web-Release.
- Keine nachträglichen historischen Tags und keine Festlegung eines Termins für `1.0.0`.

## Impact

- Betroffene Specs: `deployment-topology`, `app-e2e-integration-testing`, neue fokussierte Fähigkeit `studio-changelog` (bisher nicht spezifiziert).
- Betroffene Implementierung: `.github/workflows/{build,app-e2e,promote,studio-changelog}.yml`, bestehende Promote-/E2E-Evidenz- und Changelog-Validatoren unter `scripts/ci/`, bestehender Changelog-Artefaktgenerator und die Studio-Anzeige.
- Normativer Betriebsvertrag: `docs/guides/studio-rollout-process.md`. Die arc42-Abschnitte `04-solution-strategy.md`, `07-deployment-view.md`, `09-architecture-decisions.md`, `10-quality-requirements.md` und `11-risks-and-technical-debt.md` werden zur Umsetzung geprüft und gezielt fortgeschrieben. Die vorgeschlagene Entscheidung steht in `docs/adr/ADR-066-versionierte-studio-releases-und-hotfix-linie.md`.
- Der offene Change `refactor-ci-gate-orchestration` beansprucht keine Änderungen an `build.yml`, `app-e2e.yml` oder `promote.yml`; vor Umsetzung dennoch den finalen Main-Stand und offene Workflow-PRs erneut prüfen.

## Freigabegrenze

Dieser Change ist ein Vorschlag. Er autorisiert noch keine Implementierung, kein Tagging, keine GitHub-Release-Veröffentlichung und keinen Rollout. Vor dem ersten Hotfix-Workflow-Fix muss die Staging-Wechselprobe einschließlich Schema- und Config-Kompatibilität gegen einen realen Beta-vor-Prod-Ausgangszustand definiert und geprüft sein.
