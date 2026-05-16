## 1. OpenSpec und Architektur

- [ ] 1.1 Capability `exploratory-admin-testing` mit Anforderungen für lokale Stagehand-Admin-Exploration ergänzen
- [ ] 1.2 Architekturfolgen und Testabgrenzung in den betroffenen arc42-Abschnitten `05`, `08` und `10` fortschreiben

## 2. Runtime- und Projektintegration

- [ ] 2.1 Stagehand-Abhängigkeit und lokales Targeting in `apps/sva-studio-react/package.json` und `apps/sva-studio-react/project.json` ergänzen
- [ ] 2.2 Stagehand-Runtime für Env-Validation, Readiness und Login-Helfer unter `apps/sva-studio-react/stagehand/runtime/` anlegen
- [ ] 2.3 Reporting-Bausteine für Missionsstatus, Markdown-Bericht und Artefaktpfade unter `apps/sva-studio-react/stagehand/reporting/` anlegen

## 3. Pilot-Missionen

- [ ] 3.1 Erste read-mostly Mission `admin-users-overview` implementieren
- [ ] 3.2 Erste read-mostly Mission `admin-user-permissions-inspection` implementieren
- [ ] 3.3 Erste read-mostly Mission `admin-role-management-navigation` implementieren

## 4. Tests und Verifikation

- [ ] 4.1 Unit-Tests für Env-Parsing, Missions-Registry und Reporting zuerst als fehlschlagende Tests ergänzen
- [ ] 4.2 Betroffene Unit- und Type-Checks über Nx ausführen und grün bekommen
- [ ] 4.3 Doku für lokalen Lauf, benötigte Secrets und Artefakte unter `docs/development/` ergänzen
- [ ] 4.4 Optionalen lokalen Smoke-Lauf des neuen Targets mit echtem Stack dokumentiert ausführen, sofern die nötigen Secrets in der Umgebung vorhanden sind
