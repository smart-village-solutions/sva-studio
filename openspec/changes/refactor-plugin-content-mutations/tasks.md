## 1. Beitrag und Registry

- [x] 1.1 `ContentTypeDefinition` um die optionalen `mutations.delete`-/`mutations.status`-Verträge aus `design.md` erweitern: ID, vorhandener Principal-Typ, gegebenenfalls Zielstatus und `Promise<void>`; keine parallele Registry einführen.
- [x] 1.2 Fähigkeiten im bestehenden validierten Snapshot auf Content-Typ, Plugin-Namespace, deklarierte passende Action, Handler-Verfügbarkeit und zulässige eindeutige Zielstatus prüfen; Browser-Materialisierung bis zum Listen-/Dialogverbraucher erhalten. Keine Funktionskörperanalyse.
- [x] 1.3 Registry-Tests für gültige Beiträge, ungültige Zuordnung, doppelte Fähigkeiten sowie fehlende/entfernte Beiträge ergänzen; bestehende Guardrail-Diagnostikcodes und den Dynamic-Registration-Vertrag mit Namespace und Contribution-Identifier erhalten und prüfen.

## 2. Plugin-Mutationen

- [x] 2.1 Die acht bestehenden Löschpfade aus der Fähigkeitstabelle in `design.md` in ihre jeweiligen Plugin-Beiträge überführen; fehlende Beiträge als kontrollierten Fehler statt erfolgreichem No-op behandeln.
- [x] 2.2 Die fünf bestehenden Schnellstatuspfade samt Zielstatus aus der Fähigkeitstabelle in `design.md` in Plugin-Beiträge verschieben; Event-/POI-Handler auf vorhandene Detailclients mit `deviations` stützen und bei Abweichungen in unverändert zurückzuschreibenden Feldern vor `update*` kontrolliert abbrechen.
- [x] 2.3 Read-Merge-Write-Verhalten für Statuswechsel mit Assertions auf alle nicht betroffenen Felder absichern. Zusätzlich erfolgreiche, degradierte Event-/POI-Detailantworten testen: gefilterte `dates` beziehungsweise ein abweichendes zurückzuschreibendes POI-Feld mit Deviation führen zu keinem Update-Aufruf und zum bestehenden Fehlerpfad. Zusätzlich nicht blockierende Statusfeld-/Read-only-Deviations prüfen; Schreibwirkung anhand bestehender FormInput- und API-Mappings beurteilen, einschließlich Ersatzwerten und Leerungen. Keine zentrale neue Feldmatrix.
- [x] 2.4 Principal-Ermittlung im Host erhalten, denselben Principal für Event-/POI-Detailread und Update übergeben sowie Survey-Locale-/Status-/Update-Verträge und zusätzliche `enabledMainserverMutationActions`-Freigabe über die deklarierte Fähigkeit erhalten; Validierung, Serverautorisierung und Auditierung weiterhin über die bestehenden Host-/API-Pfade ausführen.

## 3. Host-Inhaltsliste

- [x] 3.1 Feste Plugin-Imports, Content-Type-Ketten und Dispatch-Switches für Löschen und Statuswechsel aus der Hostliste entfernen.
- [x] 3.2 Dialog und Einzelmutationen über die vorhandenen Beiträge orchestrieren; bestehende Zeilenrechte, deklarierte Actions und Principal unmittelbar vor Ausführung prüfen. Bestehenden IAM-Bulk-Pfad, Auswahlberechtigung, Teilfehler-/Retry-Verhalten und Refresh unverändert erhalten; keinen Plugin-Bulk-Dispatch ergänzen.
- [x] 3.3 Tests für fehlende Fähigkeiten, fehlende Berechtigung, gemischte Bulk-Ergebnisse und kontrollierte Fehler ergänzen.

## 4. Abschluss

- [x] 4.1 Gezielte Content-Listen-, Status-, Plugin-SDK- und betroffene Plugin-Tests sowie Typprüfungen ausführen.
- [x] 4.2 Browser-/Descriptor-Abwesenheitsmatrix für Plugin-Funktionshandler prüfen.
- [x] 4.3 Betroffene arc42-Abschnitte 04, 05 und 06 sowie Inhaltsmanagement-Dokumentation aktualisieren.
- [x] 4.4 `pnpm check:file-placement` und `openspec validate refactor-plugin-content-mutations --strict` ausführen; Nachweise und verbleibende Einschränkungen für den finalen PR-HEAD dokumentieren.

Die Checkmarks bezeichnen die lokale Umsetzung und Verifikation im vorgesehenen Worktree. Ein PR, dessen GitHub-Gates, Merge, Rollout und Live-Abnahme sind damit nicht nachgewiesen; die lokalen Ergebnisse stehen in `assurance.md`.
