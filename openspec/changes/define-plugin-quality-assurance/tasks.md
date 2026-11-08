# Aufgaben

## 1. Definition – aktueller Auftrag

- [x] 1.1 Bestehende Studio-Regeln, Policies und externe Plugin-Gates lesend abgleichen.
- [x] 1.2 Gemeinsamen QS-Vertrag und risikobasierte Zusatzprofile im bestehenden Plugin-Guide als Entwurf definieren.
- [x] 1.3 Kritische Invarianten, Trigger in beiden Repositories, Artefaktidentitäten und Lieferabschnitte festhalten.
- [x] 1.4 README des Referenz-Repositories um eine ehrliche Zuordnung von Anforderungen, Nachweisen und Lücken ergänzen.
- [x] 1.5 OpenSpec, Dokumentationslinks und Dateiplatzierung prüfen; Querverweise in beiden Repositories auf Konsistenz prüfen.
- [x] 1.6 Inhaltliche Freigabe des QS-Vertrags vor technischer Einführung einholen.

## 2. Technische Einführung – freigegeben

- [x] 2.1 Passenden Studio-/SDK-/UI-Kandidaten committen, versionieren und als unveränderliche installierbare CI-Eingaben bereitstellen; keine uncommitteten lokalen Links als Bootstrap.
- [x] 2.2 Plugin-Gates für statische Qualität, Grenzen, Security, Verhalten, Coverage, New Code und Komplexität auf die vorhandenen Regeln ausrichten; externe Projektwurzeln im zuständigen vorhandenen Pfad unterstützen.
- [x] 2.3 Isolierten Clean-Install-/Paket-/Runtime-Consumer und echte Host-Kompatibilität des Kandidaten nachweisen, einschließlich Aktivierung, fehlendem Paket und relevanten Negativfällen.
- [x] 2.4 Tests für neue Gate-Logik, relevante arc42-Abschnitte 08/10 und normale Entwicklerbefehle zusammen mit der Implementierung aktualisieren.
- [ ] 2.5 GitHub-Workflow und erforderliche Statusprüfungen sowie Sonar-/Codecov-Projektbezüge nach konkret abgestimmtem Konto/Ziel einrichten; vollständige Läufe am exakten HEAD beobachten.
- [x] 2.6 Geprüftes Paket über Commit/Digest identifizieren; eine Freigabe darf keine ungeprüften neu erzeugten Bytes ersetzen. Keine NPM-Veröffentlichung oder Auslieferung ohne gesonderten Auftrag.

## 3. Abnahme als Musterlösung

- [ ] 3.1 Alle anwendbaren Anforderungen QS-01 bis QS-09 mit Artefakt-, Host- und Review-Nachweisen belegen.
- [ ] 3.2 Erforderliche manuelle UX-/Screenreader- und Fachabnahme durchführen; Nichtanwendbarkeit fachlich begründen.
- [ ] 3.3 Einen konkreten Referenz-Commit abnehmen und die README erst dann von Musterkandidat auf abgenommene Musterlösung umstellen.

Technischer Plugin-Nachweis: [GitHub-Lauf 42520182805](https://github.com/smart-village-solutions/sva-studio_plugin-application-overview/actions/runs/42520182805) für Plugin `7b462bf7dac6de621cb80b32980991377fb0eeff` gegen Studio `1f0f2aa20d190a90af9716b6c31a72ae87a99eed`. Plugin Quality, External Analysis und Studio Compatibility sind erfolgreich, einschließlich Runtime ohne Plugin. SonarCloud und beide Codecov-Statusprüfungen sind grün; Ruleset `26812006` ist aktiv. 2.5 bleibt bis zur terminalen Core-Gegenprüfung offen. Manuelle Musterabnahme bleibt separat.

Der GitGuardian-Testfund `39832393` ist inzwischen im Dashboard geschlossen; der erneut gestartete Check für denselben Plugin-HEAD ist erfolgreich. Alle zehn erforderlichen Plugin-Checks sind grün.
