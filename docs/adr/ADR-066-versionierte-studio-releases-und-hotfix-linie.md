# ADR-066: Versionierte Studio-Releases und Prod-basierte Hotfix-Linie

## Status

Vorgeschlagen am 4. Oktober 2026. Entscheidung und Implementierung stehen aus.

## Kontext

Studio baut jeden `main`-Push und aktualisiert Dev automatisch. Staging und Production werden manuell über denselben unveränderlichen Image-Digest und geschützte GitHub-Environments aktualisiert. Zwischen Production-Rollouts kann `main` mehrere noch nicht freigegebene Features enthalten. Ein kleiner Prod-Fix darf diese Änderungen nicht unbeabsichtigt mit ausliefern. Der heutige E2E-Vertrag akzeptiert für Staging nur Main-Pushes, und die Staging-Deployment-Basis verlangt Abstammung vom dort laufenden Commit. Das gemeinsame Staging kann bereits einen neueren Beta-Stand enthalten.

Das bestehende PR-Changelog verlangt nahezu immer einen Eintrag; die Studio-Oberfläche zeigt die neuesten Einträge nach PR-Nummer. Für Nutzer sind technische Refactorings und Routine-Updates meist keine sinnvollen Versionshinweise. Release Notes sollen den tatsächlich ausgelieferten Stand beschreiben.

## Vorgeschlagene Entscheidung

1. Die Studio-Versionen verwenden eigene unveränderliche Git-Tags `studio-v0.10.4`, `studio-v0.10.5`, `studio-v0.11.0-beta.1` und `studio-v0.11.0`. `studio-v0.10.4` darf nur den nachgewiesenen aktuellen Production-Commit bezeichnen. Ein Tag ist Release-Metadatum; der verifizierte Image-Digest bleibt die technische Deploy-Identität.
2. `main` bleibt Integrationslinie und aktualisiert Dev automatisch. Ein reguläres Release wählt einen konkreten Main-Commit und promotet genau dessen bereits gebautes Image über Staging nach Production. `Beta` bezeichnet den Kandidatenstatus auf Staging und kann als GitHub-Pre-release sichtbar sein; die technische Umgebung heißt weiter `staging`.
3. Ein Hotfix beginnt an der letzten verifizierten Production-Version und enthält nur den notwendigen Fix. Die aktuellen GitHub-Workflows auf `main` bauen und testen den ausdrücklich ausgewählten alten Quellcommit. So benötigt der Hotfix-Zweig keine neuen Workflow-Trigger. Er verwendet denselben `Build`-/`Promote`-Pfad, denselben Digest von Staging nach Production und dieselben Backup-, Migrations-, Config-, Smoke- und Freigabegates. Der Fix wird auch nach `main` übernommen.
4. Das gemeinsame Staging darf nur mit ausdrücklich geprüfter Live-Basis zwischen Beta- und Hotfix-Linie wechseln. Bereits angewendete Datenmigrationen werden nicht automatisch zurückgenommen. Nicht nachgewiesene Schema-, Config- oder Secret-Kompatibilität blockiert den Wechsel vor der ersten Mutation. Eine zuvor vorhandene Staging-Parität gilt nach dem Wechsel nicht weiter.
5. GitHub-Release-Notes und das In-App-Changelog beschreiben nur nutzerrelevante Änderungen im tatsächlich ausgelieferten Commit-Bereich. Ein rein technischer PR benötigt keinen künstlichen Nutzereintrag. Ein Update mit sichtbarer Fehler- oder Sicherheitswirkung kann einen kurzen Eintrag erhalten. Der vollständige technische Verlauf bleibt über PRs und Git-Vergleich verfügbar.

## Begründung

Die Trennung zwischen fortlaufendem `main` und festem Release-Commit verhindert, dass ein Prod-Patch wartende Features mitnimmt. Die Erweiterung des vorhandenen `Build`-/`Promote`-Pfads erhält die bewährten Schutzgrenzen und führt keinen zweiten Deploy-Kanal ein. Versions-Tags geben Menschen einen stabilen Namen; SHA und Digest bleiben die überprüfbaren technischen Identitäten. Die kuratierte Veröffentlichung reduziert Rauschen, ohne technische Nachvollziehbarkeit zu verlieren.

## Verworfene Alternativen

- **Nur `main` taggen und direkt promoten:** Ein Hotfix würde auch die seit dem letzten Prod-Stand gemergten Features enthalten.
- **GitHub-Release als eigener Image-Build oder Deploy-Trigger:** Das würde die einmalige Build- und Same-Digest-Garantie aufspalten.
- **Technische PRs erst in GitHub-Release-Notes ausblenden:** Das vorhandene Studio-Changelog bliebe weiterhin mit ihnen gefüllt.
- **Ungeprüfter Staging-Rücksprung oder direkte Stack-Mutation:** Ein neuerer Schema- oder Config-Stand kann mit dem Hotfix-Image unvereinbar sein; der kanonische Promote-Pfad würde umgangen.
- **Dauerhaft zweite Staging-Umgebung von Beginn an:** Eine weitere Betriebsoberfläche ist erst gerechtfertigt, wenn der kontrollierte Wechsel des vorhandenen Staging nachweislich nicht ausreicht.

## Folgen und offene Nachweise

- Build-, E2E- und Promote-Verträge benötigen eine eng begrenzte zweite Release-Quellklasse. Der Hotfix darf Dev nicht automatisch aktualisieren.
- Alle im Hotfix-Modus gebauten Images und ihre Verifikation müssen den validierten Hotfix-Quell-SHA verwenden; kein `latest`-Alias darf dabei verschoben werden.
- Der Staging-Linienwechsel benötigt negative Tests und eine reale Probe mit neuerem Beta-Live-Stand. Bei inkompatibler Migration bleibt der Hotfix über das gemeinsame Staging blockiert, bis ein gesondert geprüfter Weg vorliegt.
- Das Hotfix-Image benötigt die Changelog-Auswahl im eigenen Quellstand; fehlt sie im Production-Basistag, ist die kleinste nötige Anpassung auf dem Hotfix-Zweig erforderlich. Das nächste reguläre Release darf die nach `main` übernommene Korrektur nicht erneut ankündigen.
- Release Notes werden vor Veröffentlichung gegen die tatsächlichen Production-Commits und den Live-Digest geprüft. Ein grüner GitHub-Run allein ist kein Nachweis für fachliche Akzeptanz.
- Die Bedienanleitung bleibt ausschließlich [der kanonische Studio-Rollout](../guides/studio-rollout-process.md); diese ADR begründet die Entscheidung und definiert keinen zweiten Operatorpfad.

## Bezüge

- [OpenSpec-Change: Versionierte Studio-Releases und Prod-Hotfixes](../../openspec/changes/add-studio-release-and-hotfix-process/proposal.md)
- [Deployment-Sicht](../architecture/07-deployment-view.md)
- [Architekturentscheidungen](../architecture/09-architecture-decisions.md)
