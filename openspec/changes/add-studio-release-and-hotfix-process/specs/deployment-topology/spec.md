## MODIFIED Requirements

### Requirement: Kanonischer Studio-Rollout-Pfad

Das System SHALL genau einen offiziellen Rollout-Pfad über GitHub Actions `Build` und `Promote` bereitstellen. Ein regulärer Main-Kandidat wird automatisch nach Dev gebaut und sein unveränderlicher Digest über Staging nach Production befördert. Ein Prod-basierter Hotfix SHALL denselben geschützten `Build`-/`Promote`-Pfad ohne automatisches Dev-Deployment verwenden und in Production exakt den in Staging verifizierten Digest ausrollen.

#### Scenario: Main-Build aktualisiert Dev automatisch

- **WHEN** ein erfolgreicher Push nach `main` ein verifiziertes Image erzeugt
- **THEN** ruft der Build `Promote` für `dev` mit `migration_mode=auto` und `bootstrap_mode=auto` auf
- **AND** wird `studio-dev` nur nach allen erforderlichen erfolgreichen One-shot-Jobs aktualisiert

#### Scenario: Staging und Production verwenden denselben Digest

- **WHEN** ein Operator ein reguläres Release oder einen Hotfix nach Staging und Production befördert
- **THEN** läuft jede Mutation über GitHub Actions `Promote`
- **AND** verwendet Production denselben zuvor erfolgreich in Staging verifizierten Digest
- **AND** bleiben lokale Operator-Einstiege auf read-only Diagnose und dokumentierte Incident-Recovery begrenzt

#### Scenario: Prod-basierter Hotfix wird vom aktuellen Controller gebaut

- **GIVEN** ein Hotfix-Zweig beginnt am verifizierten Production-Tag
- **WHEN** der bestehende `Build` auf dem aktuellen `main`-Controller mit explizitem Hotfix-Modus, Prod-Basistag, Ref und Head-SHA gestartet wird
- **THEN** validiert er diese Bindung, checkt den Hotfix-HEAD aus und veröffentlicht ein Image mit dessen OCI-Revision
- **AND** löst dieser Build keinen automatischen Dev-Promote aus
- **AND** aktualisiert er keinen `latest`-Alias
- **AND** werden beliebige andere Zweige und Tags nicht als Hotfix-Build-Quelle akzeptiert

### Requirement: Staging-Promote benötigt erfolgreiche Main-E2E-Evidenz

Das System SHALL einen Staging-Promote vor jeder Remote-Mutation fail-closed blockieren, solange für den exakten `change_head` keine erfolgreiche kanonische E2E-Evidenz aus einem Main-Push oder einem als Prod-basiert verifizierten Hotfix-Dispatch des aktuellen Controllers vorliegt. Der E2E-Nachweis des Quellstands und die OCI-Revisionsprüfung des Ziel-Digests SHALL getrennte, gemeinsam erforderliche Verträge bleiben.

#### Scenario: Exakte Main-E2E-Evidenz ist erfolgreich

- **GIVEN** der kanonische App-E2E-Workflow wurde durch einen Push auf `main` ausgelöst
- **AND** sein terminal erfolgreicher Run weist exakt den angeforderten `change_head` aus
- **WHEN** ein regulärer Promote dieses Quellstands nach Staging vorbereitet wird
- **THEN** akzeptiert der Preflight die Main-E2E-Evidenz
- **AND** prüft er zusätzlich, dass die OCI-Revision des Ziel-Digests demselben `change_head` entspricht
- **AND** darf der Workflow erst nach beiden Nachweisen fortfahren

#### Scenario: Exakte Hotfix-E2E-Evidenz ist erfolgreich

- **GIVEN** der kanonische App-E2E-Workflow wurde auf dem aktuellen `main`-Controller ausdrücklich im Hotfix-Modus gestartet
- **AND** dessen Basis ist der verifizierte Production-Tag
- **WHEN** ein Hotfix-Promote diesen Head und den zugehörigen Digest nach Staging vorbereitet
- **THEN** bindet der Preflight die terminal erfolgreiche Evidenz an Controller-Revision, Modus, Ref, Head-SHA, Run-ID und Attempt
- **AND** prüft er unabhängig die OCI-Revision des Ziel-Digests gegen denselben Head
- **AND** darf der Workflow erst nach beiden Nachweisen fortfahren

#### Scenario: E2E-Evidenz fehlt oder ist nicht erfolgreich

- **WHEN** für `change_head` kein zulässiger kanonischer E2E-Lauf existiert oder dessen Ergebnis ausstehend, rot, abgebrochen beziehungsweise nicht auswertbar ist
- **THEN** stoppt der Staging-Promote vor Backup, Migration, Bootstrap und App-Deployment
- **AND** benennt die redigierte Diagnose Head-SHA, Evidenzstatus und nächste Aktion
- **AND** wird ein fehlender Nachweis weder als Warnung noch als impliziter Erfolg behandelt

#### Scenario: Evidenz stammt aus einem anderen Ausführungskontext

- **WHEN** ein E2E-Lauf als gewöhnlicher manueller Diagnoselauf, zeitgesteuert, in einem Pull Request, für einen nicht zugelassenen Branch oder für ein anderes Head-SHA ausgeführt wurde
- **THEN** lehnt der Staging-Preflight ihn als Release-Evidenz ab
- **AND** startet keine Remote-Mutation

#### Scenario: Production befördert den Staging-verifizierten Digest

- **WHEN** Production denselben zuvor erfolgreich in Staging verifizierten Digest übernimmt
- **THEN** bleibt die Staging-Parität samt Quellklasse der autoritative vorgelagerte Nachweis
- **AND** muss Production den App-E2E-Lauf nicht unabhängig ein zweites Mal ausführen

## ADDED Requirements

### Requirement: Studio-Versionen binden Kandidaten und verifizierte Production-Stände

Das System SHALL `studio-v<major>.<minor>.<patch>`-Tags als unveränderliche Namen für verifizierte Studio-Production-Commits verwenden. Vorabversionen SHALL denselben Commit wie ihr späteres stabiles Release bezeichnen können, ohne einen zweiten Image-Build auszulösen. Der Image-Digest bleibt die technische Deploy-Identität.

#### Scenario: Erste Version wird aus Live-Production abgeleitet

- **WHEN** `studio-v0.10.4` als erste Basis gesetzt werden soll
- **THEN** müssen Live-Digest, OCI-Revision, Commit und gebundene Config-Revision eindeutig geprüft sein
- **AND** wird bei fehlender oder widersprüchlicher Bindung kein Tag und kein stabiles GitHub-Release veröffentlicht

#### Scenario: Regulärer Kandidat wird veröffentlicht

- **WHEN** `studio-v0.11.0-beta.1` in Staging geprüft und derselbe Digest erfolgreich nach Production befördert wurde
- **THEN** darf `studio-v0.11.0` denselben Quellcommit bezeichnen
- **AND** wird das stabile GitHub-Release erst nach Live-Digest- und Runtime-Verifikation veröffentlicht

### Requirement: Gemeinsames Staging wechselt Release-Linien nur kontrolliert

Das System SHALL einen Wechsel des gemeinsamen Staging von einer neueren Beta auf einen Prod-basierten Hotfix ausschließlich als expliziten, fail-closed geprüften Vorgang im bestehenden geschützten `Promote`-Workflow zulassen. Die vorherige Staging-Parität SHALL dadurch ungültig werden.

#### Scenario: Beta läuft bereits in Staging

- **WHEN** das Staging-Live-Image kein Vorfahr des Hotfix-HEAD ist
- **THEN** verifiziert der Workflow die Live-OCI-Revision und gebundene Config-Revision, den Prod-Tag als Hotfix-Basis sowie den tatsächlich erforderlichen Wechsel
- **AND** hält er vorhandene Backup-, One-shot-, Postcondition-, Smoke- und Digest-Gates aufrecht
- **AND** erzeugt er erst nach erfolgreichem mutierenden Wechsel neue Parität für den Hotfix-Digest

#### Scenario: Schema oder Konfiguration ist nicht kompatibel

- **WHEN** der bereits angewendete Staging-Datenstand, ein Secret oder die Live-Config-Revision mit dem Hotfix-Image nicht nachweislich kompatibel ist
- **THEN** stoppt der Workflow vor jeder Mutation
- **AND** führt er weder ein automatisches Datenbank-Downgrade noch eine direkte Stack-Mutation aus

#### Scenario: Beta wird nach Hotfix erneut vorbereitet

- **WHEN** die zuvor pausierte Beta später wieder nach Staging soll
- **THEN** wird ihr Unterschied gegen den dann tatsächlich laufenden Hotfix-Stand geprüft
- **AND** ist eine neue erfolgreiche Staging-Parität erforderlich, bevor Production diesen Beta-Digest übernimmt
