# Design: QS für eigenständig entwickelte Studio-Plugins

## Bestehende Pfade und belegte Lücke

Studio hat bereits Regeln und Prüfer für Types, Lint, Unit, Coverage, New Code, Komplexität, Architektur, Runtime, Dokumentation und Host-Integration. Die Projektplanung und Pfadannahmen beziehen sich überwiegend auf den Nx-Workspace. Das externe Referenz-Plugin besitzt Build, Typecheck, 34 Tests und Coverage-Floors, aber keinen GitHub-Workflow, kein Lint-Skript und keine vollständige automatische Anbindung an diese Regeln. GitHub meldete bei der Bestandsaufnahme null Workflows. Diese Feststellung ist kein Nachweis über Rulesets oder externe Organisationsdienste; deren konkreter Zustand ist vor ihrer Änderung zu lesen.

Die Auslagerung zeigte einen echten Fehlerfall: Ein Testwerkzeug konnte eine nicht deklarierte Vite-Abhängigkeit aus dem übergeordneten Studio-Verzeichnis beziehen. Erst der Umzug in einen Geschwisterpfad machte die fehlende Abhängigkeit sichtbar. Ein isolierter Consumer ist deshalb ein eigener Nachweis mit messbarem Nutzen.

## Entscheidung und Alternativen

Empfohlen: vorhandene Studio-Regeln als gemeinsame Quelle beibehalten, Plugin-QS im Plugin-Repository ausführen und die Host-Kompatibilität mit einem unveränderlichen Paket in echtem Studio prüfen. Die konkreten Check-Implementierungen werden nur dort um einen externen Root beziehungsweise öffentlichen Artefaktvertrag erweitert, wo der erste Verbraucher dies tatsächlich benötigt.

Nur eigene Unit-Tests im Plugin wären einfacher, würden aber Host-Grenzen und Paketfehler nicht nachweisen. Eine vollständige Kopie der Studio-Pipeline oder ein zusätzlicher QS-Orchestrator würde Regeln und Ownership duplizieren. Ein Core-Mock als alleinige Testumgebung würde gerade die relevante Integration ersetzen und wird nicht eingeführt.

## Gemeinsame Regelquelle und Profile

Die Anforderungen QS-01 bis QS-09 stehen im vorhandenen Plugin-Guide. Das Referenz-Repository führt eine Zuordnung zu diesen Anforderungen und deren echten Nachweisen, keine zweite normative Policy.

Grundanforderungen gelten für alle Plugins. UI-, Server-/Persistenz- und Job-/Import-/Export-Nachweise werden nur bei vorhandenen Fähigkeiten ausgelöst. Nichtanwendbarkeit muss am Manifest und am tatsächlichen Import-/Ausführungspfad nachvollziehbar sein; ein übersprungener Job allein ist kein Nachweis. Der Standard/Advanced-Zuschnitt bleibt der bestehende Plattformvertrag. Der referenzierte Speicher-/Audit-Adapter ist gesondert als öffentlicher Host-Vertrag zu prüfen, keine Erlaubnis für private Host-Imports.

## Drei Nachweise und Änderungsauslöser

| Nachweis | Eigentümer | Auslöser | Erfolgsbeleg |
| --- | --- | --- | --- |
| Plugin-QS | Plugin-Maintainer | Plugin-PR, relevante Toolchain-/Policy-/Abhängigkeitsänderung | vollständige Pflichtprüfungen für den konkreten Plugin-HEAD |
| Host-Kompatibilität | Plattformteam und Plugin-Maintainer | Plugin-Kandidat; Änderung öffentlicher SDK-/UI-/Host-Verträge; Studio-Dependency-Update | Paket-Digest plus Studio-/SDK-/UI-Stand und echte Host-Tests |
| Freigabe/Promotion | Paket-/Studio-Release-Verantwortliche | Veröffentlichung oder Übernahme einer Plugin-Version in Studio | dasselbe geprüfte Paket, vollständige Gate-/Review-Evidenz, explizite Freigabe |

Plugin-PRs prüfen das gepackte Kandidatenartefakt gegen einen festgelegten kompatiblen Host-Stand. Ändert Studio öffentliche Plugin-Verträge, wird die Referenz zusätzlich mit dem Host-Kandidaten geprüft; ein unverändertes Plugin-Repository allein löst sonst keinen Lauf aus. Ein Studio-Dependency-Update prüft genau das übernommene Paket. Keine unbegrenzte Kreuzproduktmatrix: Untergrenze und aktueller freigegebener Stand des deklarierten Vertrags sowie bei Vertragsänderungen der Kandidat sind die relevanten Fälle.

## Artefakte und Vertrauensgrenzen

Der Nachweis nennt Plugin-Commit, Paketname/-version, Paket-Digest, Studio-Commit, SDK-/UI-Versionen beziehungsweise deren unveränderliche Artefaktidentität, Toolchain/Policy-Stand und Gate-Ergebnisse. Branch-Namen, lokale `link:`-Pfade und grüne Läufe eines älteren HEAD ersetzen diese Identitäten nicht. Noch unveröffentlichte SDK-/UI-Pakete dürfen aus einem fest referenzierten Studio-Commit als CI-Artefakte bereitgestellt werden; ihre Laufzeit-Abhängigkeiten müssen vollständig mitlieferbar/installierbar sein. Das Plugin importiert weiterhin nur öffentliche Verträge.

Ein Kandidatenpaket wird gepackt und in einen frischen Consumer außerhalb des Studio-Baums installiert. Build/Type-Consumer und Node-Server-Entry werden dort geprüft; die Browserbeiträge werden im echten Host geladen. Der Consumer darf keine Studio-Source-Aliase, zufälligen Elternabhängigkeiten, Root-Caches oder privaten Host-Imports benötigen. Deklarierte Peer-Pakete sind explizite, identifizierte Eingaben. React muss aus dem Consumer aufgelöst werden und darf nicht als zweite Laufzeitkopie mitgeliefert werden.

Fork-/PR-Code ist untrusted: keine Release-Tokens oder privaten Registry-Zugangsdaten in dessen Ausführungskontext, keine privilegierte `pull_request_target`-Ausführung fremder Quellen, minimale Workflow-Berechtigungen. Veröffentlichen und Studio-Rollout bleiben getrennt von normalen PR-Tests. Neue externe Dienste und Kontoberechtigungen sind vor Einrichtung konkret abzustimmen.

## Fehlerfälle und kritische Invarianten

| Invariante | Gegenprobe | Verantwortlicher Nachweis |
| --- | --- | --- |
| Kein grün durch ausgelassene Quellen oder veraltete Ergebnisse | produktive Datei außerhalb bisheriger Workspace-Globs; falscher Commit; fehlender LCOV-Report | Plugin-QS und Merge-Regeln |
| Keine zufälligen Elternabhängigkeiten | sauberer Runner/Consumer ohne Studio als Vorfahr; fehlendes Dev-/Runtime-Paket | Clean-Install-/Pakettest |
| Nur geprüfte Bytes werden freigegeben | Paket nach Tests neu erzeugt oder ersetzt | Digest-Prüfung und Release-Nachweis |
| Keine Umgehung von Sitzung, Modul oder Rechten | anonym, fremde Instanz, deaktiviert, Read-only, Update ohne Read, manipulierte Direkt-API | echte Host-Kompatibilität |
| Audit und Änderung sind atomar, Kontexte bleiben isoliert | echter Host-Adapter, Auditfehler, konkurrierende Revisionen, später Kontextwechsel | disposable Datenbank und Host-Integration |
| Optionales Plugin erzwingt keine privaten Core-Abhängigkeiten | deaktiviert und aus Auswahl/Installation entfernt; frischer Core-Build | Host-Installations-/Entfernungstest |
| UI-QS ist keine reine Screenshot-Sammlung | Tastatur, Fokus, Sprache, Theme, Fehlerzustände, gezielte Screenreader-Gegenprobe | automatische und passende manuelle UI-Nachweise |
| Keine Policy-Drift zwischen Repositories | Studio-Regel geändert, Plugin unverändert | referenzierter Policy-Stand und gezielter Kompatibilitätslauf |

## Bestandsaufnahme und verbleibende Abnahme

Die anfängliche Bestandsaufnahme bezog sich auf lokale, unveröffentlichte Host-/SDK-/UI-Erweiterungen. Die Einführung erzeugt öffentliche Peer-Artefakte aus einem sauberen Studio-Commit und prüft deren Digests. Die Version `0.0.1` allein ist weiterhin kein hinreichender Vertragsnachweis; Commit und Artefaktidentität bleiben erforderlich.

Portable bestehende Prüfer, isolierter Paket-Consumer, echte Redis-/Cookie-/API-/PostgreSQL-Tests und Browserprüfungen sind im Implementierungsstand zusammengeführt und lokal geprüft. Der vorhandene Studio-Runtime-Artefaktnachweis startet den ohne optionales Paket gebauten Host einschließlich Health- und Root-Prüfung erfolgreich. Der Studio-Workflow ruft denselben externen Workflow mit festen Plugin-/Host-SHAs auf; relevante Kompatibilitätsfehler blockieren den bestehenden erforderlichen App-Build-Check. SonarCloud unter `smart-village-app` und Codecov für das konkrete Plugin-Repository wurden ausdrücklich freigegeben. Vor Musterfreigabe bleiben vollständige terminale Remote-Gates samt Merge-Schutz sowie die gesonderte manuelle UI-/Fachabnahme nachzuweisen; fehlende Analysen zählen nicht als bestanden.

## Lieferabschnitte und Rücknahme

1. Diesen Vertrag und das Referenzprofil prüfen/freigeben; betroffene Policy-Owner benennen.
2. Einen kompatiblen SDK-/UI-/Host-Kandidaten unveränderlich bereitstellen und den isolierten Paket-Consumer herstellen.
3. Die erforderlichen bestehenden Prüfer auf das externe Plugin anwenden, Plugin-CI und echte Host-Kompatibilität nachweisen. Keine neue Kontrollschicht ausschließlich zum Aufruf anderer Kontrollschichten.
4. Required Checks und nötige externe Analyse-/Release-Anbindungen nach erfolgreicher technischer Verifikation einrichten; Referenz anhand der gesamten Matrix abnehmen.

Bis zur Abnahme heißt das Repository Musterkandidat. Die spätere Musterfreigabe nennt einen konkreten Commit und bleibt bei relevanten Änderungen erneut nachweispflichtig. Rücknahme bedeutet, Kandidat/Version nicht freizugeben beziehungsweise auf die letzte belegte Kombination zurückzugehen; weder Fachdaten löschen noch einen zweiten Rollout-Pfad einführen.
