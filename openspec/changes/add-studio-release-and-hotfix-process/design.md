# Design: Studio-Release-Linien im bestehenden Promote-Pfad

## Ausgangspunkt

- `Build` veröffentlicht Studio-Images nur für `main` und aktualisiert Dev automatisch.
- App-E2E läuft kanonisch nach `main`-Push; `Promote` verlangt für Staging genau diese Evidenz und zusätzlich die OCI-Revision des Zieldigests.
- Production verlangt dieselbe erfolgreiche Staging-Parität; der tatsächlich laufende Commit einer Zielumgebung muss derzeit Vorfahr von `change_head` sein.
- Jeder normale PR muss einen Changelog-Eintrag liefern; der vorhandene Generator nimmt die neuesten 20 Einträge nach PR-Nummer.

## Release-Identität und Veröffentlichung

Der Git-Tag ist ein unveränderlicher Name für den geprüften Quellcommit. Der Digest bleibt die technische Deploy-Identität. Die Release-Evidenz verbindet Tag, Commit, Digest, Staging-/Production-Run, Live-Config-Revision und Ergebnis, ohne Secrets oder PII. Ein Tag löst kein zweites Build und keinen Deploy aus. `latest` ist kein Release-Eingang.

Die erste `studio-v0.10.4` bezeichnet den verifizierten aktuellen Production-Stand. Ist dessen OCI-Revision, Digest oder Config-Revision nicht eindeutig nachweisbar, bleibt die Baseline offen. Spätere reguläre Kandidaten werden aus einem gewählten `main`-Commit gebaut; ein Beta-Tag zeigt auf diesen Commit. Die finale Version zeigt auf denselben Commit, und Production erhält denselben zuvor in Staging geprüften Digest. GitHub-Release-Notes werden erst anhand des tatsächlich ausgelieferten Vergleichs zur vorigen Production-Version freigegeben. Eine Version beschreibt den gesamten Studio-Deploy-Bundle-Stand, nicht nur die App-Oberfläche.

## Hotfix-Quellstand

Ein kurzlebiger `hotfix/studio-v<zielversion>-<thema>`-Zweig wird vom letzten verifizierten Production-Tag erstellt. Der Fix wird per PR und den für seinen Scope geltenden CI-Gates geprüft. Weil der alte Produktcommit die neuen Workflow-Trigger noch nicht besitzt, werden die vorhandenen `Build`- und App-E2E-Workflows ausdrücklich auf `main` als aktuellem Controller gestartet; ihre validierten Eingaben benennen Hotfix-Ref, Prod-Basistag und exakten Quell-SHA. Beide checken für Build beziehungsweise Test genau diesen SHA aus und lesen ihn zurück. Der Build bindet Build-Argumente, OCI-Revision und unveränderliche Tags aller im Hotfix-Modus veröffentlichten Images an diesen SHA; die Image-Verifikation läuft mit demselben erwarteten Quell-SHA statt mit dem Controller-SHA. Keines dieser Images verschiebt im Hotfix-Modus seinen `latest`-Alias; Dev wird nicht aufgerufen. Es gibt weder einen zweiten Image-Publisher noch einen Release-Workflow auf dem alten Branch.

Die Hotfix-E2E-Evidenz enthält Controller-Revision, `workflow_dispatch`-Event mit explizitem Hotfix-Modus, validierten Ref, Head-SHA, Run-ID/Attempt und terminales Testergebnis. Ein gewöhnlicher manuell gestarteter Diagnose-Lauf, Nightly-Lauf oder fremder Branch-Lauf bleibt unzulässig. Die überprüfte Basistag-/Branch-Bindung sowie der separate OCI-Digest-Nachweis verhindern, dass ein beliebiger Dispatch als Release-Evidenz gilt. Vor Production wird der Fix in `main` nachgeführt; dies ändert den zu promotenden Hotfix-Digest nicht.

Der Staging-Preflight unterscheidet genau zwei zulässige Quellen: kanonischer Main-Push oder expliziter Hotfix-Dispatch des aktuellen Controllers mit nachgewiesenem Production-Tag als Basis. Beide behalten den separaten OCI-Revisionsnachweis. Die Staging-Parität und Production-Prüfung binden zusätzlich die Quellklasse, damit ein Main-Lauf keinen Hotfix-Nachweis ersetzt und umgekehrt.

## Gemeinsames Staging bei abweichenden Linien

Ein Hotfix auf Prod-Basis kann kein Nachkomme des bereits laufenden Staging-Beta-Commits sein. Ein zulässiger Linienwechsel muss deshalb vor der ersten Mutation den aktuellen Staging-Digest und dessen gebundene Config-Revision lesen, den Ziel-Digest gegen den Prod-Tag prüfen und den vollständigen Unterschied der tatsächlich laufenden Revision zum Ziel bewerten. Die bisherige Beta-Parität verliert ihre Gültigkeit. Der Wechsel verwendet ausschließlich den geschützten `Promote`-Workflow mit vorhandenen Backups, Migrations-/Bootstrap-Gates, Konvergenz und Smokes; er ist kein genereller Bypass des Abstammungschecks.

Ein bereits angewendeter, mit dem Hotfix-Image nicht nachweislich kompatibler Schema- oder Datenstand stoppt den Wechsel. Ebenso blockieren unklare Config-Revision, Secrets-Kompatibilität oder ein nicht sicherer Rückweg. Es gibt weder ein automatisches DB-Downgrade noch eine direkte Stack-Mutation. Nach dem Hotfix muss ein pausierter Beta-Kandidat erneut mit dem dann live laufenden Staging-Stand geprüft und frisch promotet werden. Falls das gemeinsame Staging den Wechsel nicht sicher leisten kann, erfordert eine isolierte Hotfix-Prüfumgebung eine gesonderte begründete Entscheidung; sie wird hier nicht vorweg eingerichtet.

## Changelog und GitHub-Releases

Der bestehende `docs/changelog/entries/pr-<nummer>.json`-Pfad bleibt Quelle für nutzerrelevante Texte. Das PR-Gate prüft vorhandene Einträge, verlangt aber keinen künstlichen Text für rein technische PRs. Die Auswahl für GitHub-Release-Notes wird an den ausgelieferten Commit-Bereich gebunden; PR-Nummern sind keine Release-Grenze. Die bisherige Darstellung einzelner PR-Einträge im Studio-Dashboard entfällt. Wiederholte oder nachträglich gemergte Änderungen dürfen nicht doppelt erscheinen. Ein Hotfix-Release enthält nur die seit dem vorherigen Production-Tag ausgelieferte Korrektur. Technische Änderungen bleiben im vollständigen GitHub-Vergleich sichtbar.

Der Build erzeugt weiter eine an den Quellcommit gebundene Auswahl als technische Prüfung, liefert sie aber nicht mehr an den Studio-Server aus. Für Release Notes verwendet der Generator den ausgecheckten Quellstand. Beim späteren Übernehmen des Fixes nach `main` bleibt der ursprüngliche Changelog-Eintrag derselben Korrektur erhalten; ein neuer PR-Eintrag für dieselbe Wirkung darf sie nicht doppelt ankündigen. Für das nächste reguläre Release nach einem Hotfix reicht Git-Abstammung als Auswahlregel nicht aus: Der Vergleich berücksichtigt den zuletzt tatsächlich ausgelieferten Production-Stand und bereits veröffentlichte Korrekturen auch bei verzweigten Historien.

Eine optionale PR-Klassifizierung darf nur eingeführt werden, falls das vorhandene Eintrags-/Diff-Signal für das Gate nicht ausreicht. Die Implementierung erweitert zunächst bestehende Validatoren und Generatoren; sie legt keinen parallelen Changelog-Katalog an.

## Grenzen und verworfene Wege

- `main` für einen Quickfix direkt nach Prod zu befördern würde unreife Features mitnehmen.
- Ein GitHub-Tag auf `main` erzeugt keinen Hotfix-Quellstand und repariert die aktuellen E2E-/Staging-Gates nicht.
- Eine zweite kanonische Deploy-Pipeline oder direkte Infrastrukturmutation würde Backup- und Paritätsverträge umgehen.
- Eine fortgesetzte Anzeige einzelner PRs im Studio-Dashboard würde die Release-Grenze für Nutzer verwischen.
