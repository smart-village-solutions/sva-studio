## 1. Vorbereitung

- [ ] 1.1 Die Importgraphen und Descriptor-/View-Verbraucher der aktiven `studio`-/`ssf`-Profile vollständig inventarisieren; Überschneidungen mit #1509 und aktiven Plugin-Changes prüfen.
- [ ] 1.2 Baseline für Katalog-, Bootstrap-, Server- und Job-Tests sowie die beiden Profil-Builds erfassen; betroffene Nx-Projekte vor breitem affected-Run messen.
- [ ] 1.3 Proposal und Invarianten vor dem ersten Implementierungsblock reviewen und freigeben.

## 2. Gemeinsamer Descriptorvertrag

- [ ] 2.1 Manifest-/SDK-Vertrag um einen serverfähigen Descriptor-Entry-Point und typisierte Routenmetadaten ohne Browser-Komponente erweitern; vorhandene Snapshot-Validierung wiederverwenden.
- [ ] 2.2 Für die ausgewählten Profile Plugin-Descriptoren aus den bestehenden Definitionen extrahieren und Browser-Views gegen die validierten Route-IDs binden; ersetzte Metadatenpfade entfernen.
- [ ] 2.3 Die bestehenden Build-Inputs auf Descriptor-Module ergänzen; Profilfilter und fehlende/inkompatible Module fail-closed halten.
- [ ] 2.4 Den kleinsten echten SDK-/Katalog-Unit- und Type-Gate nach jedem abgeschlossenen Codeblock ausführen.

## 3. Server- und Worker-Consumer

- [ ] 3.1 Server-Dispatch und Aktivierungsbootstrap vom Browser-Snapshot auf den validierten serverfähigen Katalog umstellen.
- [ ] 3.2 Job-Runtime auf dieselbe Descriptor-Entscheidung umstellen und ihr Browser-Modulregister entfernen.
- [ ] 3.3 Echte Modulauflösung mit einem serverseitig nicht auswertbaren Browser-Entry-Point sowie die Disabled-/Incompatible-/Missing-Matrix für HTTP, Jobs, IAM und Lifecycle testen.

## 4. Abschluss

- [ ] 4.1 Gezielte Plugin-Katalog-, Bootstrap-, Server- und Job-Tests, `pnpm check:server-runtime`, passende Type-Gates und beide Profil-Builds ausführen; GitHub-Gates gelten für den finalen PR-HEAD.
- [ ] 4.2 Betroffene arc42-/Plugin-Dokumentation aktualisieren und hinzugefügte/entfernte Konzepte, Dateien und Ausführungspfade auf unnötige Oberfläche prüfen.
- [ ] 4.3 `pnpm exec openspec validate refactor-plugin-server-metadata --strict` und `pnpm check:file-placement` ausführen.
