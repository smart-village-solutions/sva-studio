## 1. Vorbereitung und Freigabe

- [x] 1.1 Figma-Konzept und aktualisierte Issues als Grundlage abgleichen; Pixelvorgaben von Interaktionsvorgaben unterscheiden.
- [x] 1.2 Bestehende Medienrouten, gemeinsame UI, SDK, Variantenverarbeitung, Registrierung und kanonische Schemahinweise lesen; bestehende Changes abgleichen.
- [x] 1.3 Neuen Change im getrennten Worktree mit Scope, Lieferabschnitten, Risiken und erforderlichen Nachweisen ausarbeiten.
- [x] 1.4 OpenSpec strikt validieren sowie Dokumentations- und Dateiplatzierung prüfen.
- [x] 1.5 Technischen Zuschnitt durch den Nutzer freigeben lassen; Freigabe am 18.11.2026 im Dialog erteilt.

## 2. Detailansicht und Fokusvertrag

- [x] 2.1 Tatsächlichen Zielanwendungs-Übergabepfad einschließlich Referenzauflösung/Mainserver prüfen und in `design.md` konkret abschließen; fehlenden Upstream-Vertrag ausdrücklich als Blocker ausweisen.
- [x] 2.2 Vorhandene Fokus-Read-/Update-Typen durchgängig ergänzen; PATCH, unabhängigen GET, Reset/Null und tatsächliche Verbraucherübergabe mit gezielten Tests absichern.
- [x] 2.3 Bestehende Fokusauswertung in der Pixelvariantenverarbeitung gegen die neue Grenze abgleichen und korrigieren; keine Neuberechnung des Bestands.
- [x] 2.4 Bestehende Bilddetailsektionen entlang des Wireframes neu anordnen; Bild vollständig, Informationen darunter, Technik nachgeordnet, Texte/Fokus mit einem Speicherabschluss.
- [x] 2.5 Direkte Punktbedienung für Maus/Touch und Tastatur auf der tatsächlichen Bildfläche einschließlich Randflächen, Orientierung, Resize und ungültigen Koordinaten umsetzen und gezielt prüfen.
- [x] 2.6 DE/EN, Fehler-/Speicherstatus und unverbindliche Beispielvorschauen aktualisieren; bestehende Inhalte und Referenzen unverändert nachweisen.

## 3. Kopie-Workflow und kompatibles Feedback

- [x] 3.1 Vorhandenen gemeinsamen Medienentwurf mit Stepper und Zurück-Navigation erweitern; Bildoperationen, Metadaten und passenden Fokus erhalten.
- [x] 3.2 Fokus auf dem exportierten Ergebnis bedienen; nach geänderten Bildoperationen kontrolliert zurücksetzen und erneut prüfen lassen; Marker separat exportfrei halten.
- [x] 3.3 Header/Footer außerhalb der Scrollfläche führen, auch im letzten Prüfschritt; kontextspezifischen Speicherabschluss und bestehende Warnungen erhalten.
- [x] 3.4 #2001 und #2154 aktuell reproduzieren; notwendige minimale Integrations-/Dialogfehler korrigieren und Regressionen gezielt absichern.
- [x] 3.5 #2156/#2157 gemeinsam über Inhalt und Referenzen untersuchen; belegte Fehler am bestehenden Speicher-/Projektionspfad korrigieren und unabhängigen Readback prüfen.
- [x] 3.6 Öffnen/Abbrechen ohne Kopie, erfolgreiches Speichern mit neuer ID, Fehler/Retry/Konkurrenz ohne Duplikate und unverändertes Original nachweisen; #1952 mit tatsächlicher Storageentscheidung und späterer Verarbeitung berücksichtigen.
- [x] 3.7 Bestehende Content-/Settings-/Waste-Verbraucher gezielt auf ihre jeweiligen Speicherverträge prüfen; kein vorzeitiger Content-Upload.

## 4. Sichere automatische Aufnahme

- [x] 4.1 Konkrete serverseitige Sichtbarkeitsquelle, Quellidentität, begrenzten Byte-/Scanpfad, Finalisierung und Wiederaufnahme im bestehenden Pfad untersuchen und vor Aktivierung in `design.md` verbindlich festhalten.
- [x] 4.2 Vorhandene Registrierung um sicheren Aufnahmevorgang mit bestehenden Job-/Upload-/Recovery-Mechanismen erweitern; Scan-Sperre erst nach geschlossenem Vertrag ersetzen.
- [x] 4.3 Atomare Medienidentität/Quotenfinalisierung einschließlich paralleler Requests im vorhandenen Repositorypfad absichern; nötigenfalls Schemaänderung begründen und beide Schemadokumente aktualisieren.
- [x] 4.4 Aufnahme ausschließlich beim bewussten autorisierten Öffnen auslösen; gemeinsamer Detailrahmen mit Vorbereitung, bereit, Lesemodus, blockiert und fehlgeschlagen; stale Antworten bei Navigation verwerfen.
- [x] 4.5 Echte Integrationsnachweise für Scan an/aus, Quellwechsel/-verlust, unbekannte Sichtbarkeit, interne Dateien, fremde Instanz, Quoten-/Teilfehler und konkurrierende Wiederholung führen.
- [x] 4.6 Ersetzte manuelle Registrierungsdarstellung entfernen; Originale, vorhandene URLs und Einbettungen unverändert prüfen.

## 5. Abschluss

- [x] 5.1 Gezielt relevante Nx-Unit-/Type-/Lint- und Browsernachweise führen; spezielle Auth-/Security-/Runtime-/Datenintegritäts-Gates beibehalten.
- [x] 5.2 Sichtprüfung der betroffenen gemeinsamen UI und Bildreferenzen in Default/Forest, Light/Dark, schmal sowie 1280 × 720 und 1440 × 900; Tastatur/Fokus und letzte Hauptaktionen prüfen.
- [x] 5.3 Aktuelle Medien-/Anwenderdokumentation, gegebenenfalls Schema und betroffene arc42-Abschnitte fortschreiben.
- [x] 5.4 OpenSpec, Dokumentation, Dateiplatzierung und Diff prüfen; hinzugefügte/entfernte Pfade auf unnötige Oberfläche prüfen.
- [x] 5.5 Ergebnis je Issue und Lieferabschnitt mit tatsächlich geführten Nachweisen berichten; Umsetzung, Merge, Rollout und fachliche Abnahme unterscheiden.

## Geführte Nachweise und Grenzen

- Fokus-/Metadatenvertrag: bestehende Media-, SDK-, Shared-UI-, News-, Event-, POI-, Generic-Item-, Project- und Cockpit-Tests gezielt erweitert; Event-/POI-Payloads gegen den vorhandenen GraphQL-Snapshot sowie serverseitige Quellenerhaltung geprüft.
- Echter PostgreSQL-/Graphile-Lauf: 20 Tests bestanden, einschließlich acht paralleler Aufnahmen, einer Medien-ID/Session/Job, Quotenfehler, unabhängiger Fokus-Readbacks und unveränderter vorhandener Varianten/Referenzen.
- Echte lokale S3-/ClamAV-Dienste: neun Tests bestanden, einschließlich privater Eingang, geprüfter Ausgabe, späterem Quellwechsel und fortbestehender Scanpflicht nach Schalterwechsel. Es wurden ausschließlich wegwerfbare Testdienste und synthetische Dateien verwendet.
- Shared-UI: 117 gezielte Tests bestanden. Bibliotheks-/Detail-Hooks und Aufnahmezustände separat geprüft. 17 unmittelbar betroffene Projekte ohne Lintfehler; App-Typprüfung einschließlich bestehender Paket-Builds bestanden.
- Browser: Upload/Detail und fehlgeschlagener Transfer bestanden; echte Filerobot-Instanz einschließlich Zuschneidemenü, Export/Wiederöffnung, Fokusgeometrie, unverändertem Original, vier Themes/Modi, 1280 × 720, 1440 × 900, 320 px, Zoom und Axe bestanden. Die automatische Aufnahme wurde nach der Strict-Mode-Korrektur separat mit genau einem Aufruf bestätigt. Der erste Wiederholungslauf endete beim kalten Dev-Server vor dem Auth-Aufbau; die gleiche vorhandene Setup-Zeitgrenze wie im Editorlauf schließt diesen Infrastrukturabbruch aus.
- Finale Server-Runtime: 45 Aufgaben bestanden. Zusätzlich sechs Medien-Autorisierungsfälle, IAM-OpenAPI, Dokumentation, Dateiplatzierung, strikte OpenSpec-Validierung und Diff-Prüfung bestanden. Screenshots und Laufprotokolle liegen ausschließlich unter ignorierten Test-/Artefaktpfaden.
- Keine Pixelübernahme aus Figma, keine Bestandsmigration, keine automatische Änderung vorhandener Inhalts-Snapshots oder URLs, kein Scanner-Schalter in einer Zielumgebung. Kein Push, PR, Merge oder Rollout. Die tatsächliche Darstellung des Fokus in einer externen Zielanwendung und eine manuelle Screenreader-Abnahme sind nicht Teil dieses lokalen Nachweises.
