## 1. Spezifikation

- [ ] 1.1 `monorepo-structure` auf ein optionales Beispiel-Plugin statt eines aktiven Workspace-Bestandteils ausrichten
- [ ] 1.2 `routing` so schaerfen, dass produktive Host-Plugin-Integration nicht vom Beispiel-Plugin abhaengt
- [ ] 1.3 `architecture-documentation` um die Entfernung des Beispiel-Plugins und den noetigen Doku-Abgleich erweitern

## 2. Umsetzung

- [ ] 2.1 Package `packages/plugin-example` aus dem Workspace entfernen
- [ ] 2.2 App- und Host-Referenzen auf `@sva/plugin-example` entfernen, inklusive Plugin-Liste, Imports, Tests und Mocking
- [ ] 2.3 `package.json`-, `tsconfig`-, Nx- und sonstige Workspace-Referenzen auf `plugin-example` bereinigen
- [ ] 2.4 Dokumentation und Reports mit aktiven Referenzen auf das Beispiel-Plugin aktualisieren oder bereinigen

## 3. Qualitaet und Dokumentation

- [ ] 3.1 Betroffene Unit- und Type-Tests anpassen oder entfernen
- [ ] 3.2 Relevante Nx-Targets fuer betroffene Projekte ausfuehren
- [ ] 3.3 Betroffene Architektur- und Entwicklerdokumentation auf konsistente Plugin-Landschaft pruefen

## 4. Validierung

- [ ] 4.1 `openspec validate remove-plugin-example-package --strict` erfolgreich ausfuehren
