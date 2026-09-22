## 1. Bestehende Verträge anpassen

- [ ] 1.1 Vertragsrevision von Subjects entkoppeln; vollständigen Inhaltsvergleich
      für Staging, Read-back und Ready-Entscheidung erhalten und die bestehende
      Generation auch bei gleicher Revision und geänderten Rechten erhöhen
- [ ] 1.2 Projektions- und vorhandenen Lifecycle-Vertragsstand umstellen;
      alte bestätigte Versionen im Readiness-Leser ablehnen und Konvergenz
      über den bestehenden Vertragsdrift-Scheduler sowie Rollback nachweisen
- [ ] 1.3 Kanonische SSF-Ableitung für Create und Lifecycle gemeinsam verwenden;
      direkte Rollen, Gruppenrollen und bestehende Zuweisungsgrenzen einbeziehen

## 2. Account synchron abschließen

- [ ] 2.1 Bestehende Tenant-Sperre für Readiness-/Rollenauflösung bis Commit oder
      Kompensationsbehandlung verwenden; bei Sperrkonflikt begrenzt und sichtbar
      abbrechen, keine Realm-/Client-/Mapper-Prüfung im Create
- [ ] 2.2 Lifecycle-Source-Snapshot unter dieselbe Sperre ziehen, sodass ein
      paralleler Reconcile neue Benutzer nicht anhand eines alten Bestands bereinigt
- [ ] 2.3 Keycloak einmalig mit kanonischen Claims schreiben und erforderliche
      technische Rollen vor dem lokalen Commit zuweisen
- [ ] 2.4 Account, Mitgliedschaft, Rollen und Gruppen gemeinsam lokal speichern;
      fachlichen Status, Request-Idempotenz und Nicht-SSF-Verhalten erhalten
- [ ] 2.5 Delete-Kompensation auf den Zeitraum vor erfolgreichem Commit und die
      eindeutig angelegte ID beim selben Provider begrenzen; Folgepfade ausnehmen
- [ ] 2.6 Fehler einschließlich fehlgeschlagener Bereinigung im bestehenden
      übersetzten Formularfehler mit Korrelations-ID unmittelbar anzeigen
- [ ] 2.7 Directory-Benutzernachweis im vorhandenen Lesepfad auf aktive lokale
      Accounts mit Mitgliedschaft und effektiven SSF-Rechten umstellen;
      bestätigte aktuelle Mandantenreadiness weiterhin verlangen
- [ ] 2.8 Create-Reconcile-Aufruf samt ausschließlich davon abhängigen Teilen
      entfernen; direkte Verbraucher prüfen und Umfangsgrenze aus dem Design halten

## 3. Gezielte Nachweise und Dokumentation

- [ ] 3.1 Bestehende Unit-Tests für Reihenfolge, Vorbedingungen, Rollen/Gruppen,
      Status und Kompensation ergänzen; Fehler nach Commit löschen keinen Benutzer
- [ ] 3.2 Gezielt gleiche Revision bei geänderten Rechten, abweichenden Read-back,
      parallelen Create/Reconcile, alte Readiness vor erstem Reconcile und erste
      Directory-Sichtbarkeit nach Commit testen
- [ ] 3.3 Bestehende Tests für spätere Rechteänderungen, Mapper-Drift und Recovery
      prüfen; nur belegte Abdeckungslücken ergänzen
- [ ] 3.4 Keycloak-Integration für vollständige Claims sowie Staging-E2E
      Anlage → Directory → Token → SSF-Login → Gespräch durchführen;
      Staging-Nachweis an den exakten Image-Digest binden
- [ ] 3.5 Betroffene arc42-Abschnitte und aktuelle Bedien-/Fehlerdokumentation
      aktualisieren; kurze Liste tatsächlich entfernter Teile im PR festhalten
- [ ] 3.6 `pnpm check:server-runtime`, gezielte Nx-Unit-/Integrationstests und
      `pnpm check:file-placement` ausführen; OpenSpec strikt validieren
