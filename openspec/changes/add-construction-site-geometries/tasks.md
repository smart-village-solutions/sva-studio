## 1. Planung und technische Absicherung

- [x] 1.1 Funktionsumfang mit Nutzer klären: zunächst ausschließlich Bearbeitung und Speicherung im Studio.
- [x] 1.2 Bestehenden Studio-, Mainserver- und Legacy-CMS-Pfad lesend untersuchen; Datenverlust durch vollständigen Payload-Ersatz und vollständige Listenprojektion belegen.
- [x] 1.3 Datenformat, Schreibsemantik, Mengen-/Bytegrenzen, Fehlerfälle und geplante Nachweise dokumentieren.
- [x] 1.4 Nutzer hat die Reihenfolge technischer Prototyp → Figma → Produktivumsetzung sowie die lokale Mainserver-Korrektur in einem eigenen Worktree ausdrücklich freigegeben; kein Push oder Rollout.
- [x] 1.5 Im bestehenden Kartenpfad Terra Draw und Adapter mit MapLibre 6.9.0 im Browser nachweisen: Linien/Polygone erstellen, Eckpunkte bearbeiten, löschen, laden, Undo/Redo, Koordinatenliste, Draft-Synchronisation und Unmount.
- [x] 1.6 Reinen Polygonvalidator im Server-Runtime-Kontext prüfen und identische Client-/Server-Vertrags-Fixtures absichern.
- [x] 1.7 Nutzerfestlegung übernehmen: altes CMS wird nicht mehr für Baustellen verwendet. Mainserver-Abhängigkeit entfernen und Geometrie-Erhalt/-Löschung im Studio gegen die unveränderte Payload-Ersetzung nachweisen.

Die Studio-Umsetzung ist lokal abgeschlossen und verwendet den unveränderten Mainserver. Snapshot-/Route-/Service-Tests und ein echter Chromium-Roundtrip bestehen, einschließlich Entfernung des Schlüssels aus dem vollständigen Mutation-Payload und unabhängigem Lösch-Readback. Der zuvor getestete Legacy-Schutz im Mainserver ist nicht mehr Teil der Lieferung und bleibt ausschließlich als lokaler Versuch in dessen eigenem Worktree. Die Prüfung der tatsächlichen Zielumgebung bleibt Aufgabe 5.1.

## 2. Figma auf technisch belegter Grundlage vervollständigen

- [x] 2.1 Nach 1.5–1.7 Standort/Strecke/Fläche, Auswahl und Eckpunktbearbeitung als ergänzende Ansicht 44 im vorhandenen Figma-Designsystem ausarbeiten.
- [x] 2.2 Zeichnen/Abbrechen, Undo/Redo, Koordinatenalternative, Löschung, Fehler, Read-only, Kartenausfall und schmale Ansicht reviewbar darstellen; Light/Dark und editierbare Struktur visuell prüfen.
- [x] 2.3 Technische Darstellung und Mengenlimits mit synthetischen Strecken/Flächen, einschließlich langer Strecken, 390 px, Light/Dark und den Grenzen 10/500/1.000 prüfen; fachliche kommunale Originalfälle bleiben Teil von 5.2. Keine App-/Webdarstellung ergänzen.

## 3. Persistenz und Listenprojektion

- [x] 3.1 Mainserver unverändert lassen: Studio-Input `null` vor der Mutation in Schlüsselentfernung umsetzen; ausgelassene Geometrie aus dem Snapshot erhalten. Legacy-CMS-Erhalt entfällt aus dem Lieferumfang.
- [x] 3.2 Beide bestehenden Studio-Input-Verträge um optionale Geometrie ergänzen; unabhängige Validierung, Normalisierung nach sechs Dezimalstellen, UTF-8-Budget und Fremdversionssperre testen.
- [x] 3.3 Snapshot-/Payload-Mapping sowie Fingerprint, Request-Hash und unabhängigen Readback erweitern. Löschung ausdrücklich auf tatsächliche Schlüsselabwesenheit prüfen; unberührte Daten erhalten.
- [x] 3.4 Eigene kleine Listenprojektion und Listentyp im bestehenden Pfad verwenden; Payload/Geometrien ausschließlich in Detail-, Prewrite- und Recovery-Reads laden. Filter, Provider-Zugriff, Sortierung und Pagination gezielt absichern.
- [x] 3.5 Kleinste betroffene Unit-/Type-Gates und früh `pnpm check:server-runtime` ausführen; auf rotem Stand nicht in den nächsten Abschnitt wechseln.

## 4. Editor und Nachweise

- [x] 4.1 Bestehenden ConstructionSiteMap lokal für eine gemeinsame Karte samt Adapter erweitern; alte Punkt-Hook-Nutzung dort ersetzen, keine parallelen Kartenpfade behalten.
- [x] 4.2 Fertige Features und Koordinatenliste an denselben Formular-Draft anbinden. Unfertiges Zeichnen, Save-Sperre, Abbrechen, Undo/Redo, Navigationsschutz und Konfliktzustände integrieren.
- [x] 4.3 Studio-Komponenten, de/en-Texte, Fokus und Labels verwenden; Kartenfehler und deaktivierte Dienste ohne Datenverlust behandeln.
- [x] 4.4 Bestehende gezielte Unit-/Route-/Service-Tests um die Invarianten in design.md ergänzen; realen Browser-Roundtrip einschließlich Reload, Punkt-Erhalt, Geometrieänderung und vollständiger Löschung prüfen.
- [x] 4.5 Baustellenreferenz und arc42 `05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md` aktualisieren; neue und entfernte Konzepte auf notwendige Oberfläche prüfen.

## 5. Zielumgebung und Abnahme

- [ ] 5.1 In Dev/Staging tatsächliche Mainserver-Version und Datenbanklimits bestätigen und Studio-Anlage/Änderung/Löschung → unveränderte GenericItem-Mutation → unabhängigen Geometrie-Readback über die vollständige API prüfen.
- [ ] 5.2 Tastaturbedienung, schmale Ansicht, Read-only, Kartenausfall, ungültige/zu große Geometrien und vorhandene Baustellen mit kommunalen Originalfällen fachlich abnehmen; lokale technische Tests ersetzen diese Zielabnahme nicht.
- [ ] 5.3 Erst nach bestandenem Nachweis nach dem verbindlichen Studio-Rollout-Prozess freischalten. Technisch ausgeliefert, live geprüft und fachlich abgenommen getrennt dokumentieren.
