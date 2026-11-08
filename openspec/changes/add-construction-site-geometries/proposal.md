# Change: Strecken und gesperrte Flächen im Studio bearbeiten und speichern

## Why

Die Baustellenmaske unterstützt bisher nur Standortpunkte. Redakteure sollen beim Erstellen und Bearbeiten zusätzlich Streckenverläufe und gesperrte Flächen erfassen können. Der Nutzer hat den Umfang auf **Bearbeitung und Speicherung im Studio** begrenzt; die technische Umsetzung soll vor der Vervollständigung des Figma-Entwurfs geklärt werden.

Der bestehende Change `add-construction-sites-plugin` schließt neue Fachfunktionen aus. Diese Erweiterung benötigt einen eigenen Geometrievertrag. Nach ausdrücklicher Vorgabe des Nutzers wird das alte CMS nicht mehr für Baustellen verwendet. Der bestehende Mainserver bleibt unverändert; das Studio erhält und entfernt Geometrien innerhalb des vollständigen Payloads, das dessen vorhandener Schreibpfad ersetzt.

## What Changes

- Erweitert den bestehenden Baustelleneditor um Linien und Polygone mit nachträglicher Änderung der Eckpunkte, Löschen sowie Rückgängig/Wiederholen. Vorhandene Standortpunkte bleiben eigenständige Angaben.
- Nutzt das vorhandene MapLibre mit Terra Draw und dem MapLibre-Adapter. Bedienelemente kommen aus dem Studio-Design-System; Koordinaten bleiben auch ohne Kartenbedienung bearbeitbar.
- Speichert ein versioniertes GeoJSON-Objekt unter `GenericItem.payload.constructionSiteGeometry`; kein neues Datenbankschema, keine zweite Datenhaltung und kein neuer Geodienst.
- Erweitert die bestehenden Studio-Verträge, Validierung, Konfliktprüfung und den unabhängigen Readback. Speichern erfolgt ausschließlich mit dem bestehenden Formular-Speichervorgang.
- Verwendet den unveränderten Mainserver-Schreibpfad: Das Studio übermittelt das vollständige Payload, erhält ausgelassene Geometrie aus dem aktuellen Snapshot und entfernt bei ausdrücklicher Löschung den Schlüssel vor dem Write.
- Trennt die Listenprojektion vom vollständigen Detaildatensatz, damit die Übersicht keine Geometrien aller Baustellen lädt.

## Nicht-Ziele und maximale betroffene Bereiche

- Keine Darstellung oder Bearbeitung in mobiler App oder Webversion; keine entsprechenden Änderungen an deren Repositories.
- Kein automatisches Routing, Einrasten an Straßen, GPS-Tracking, Dateiimport/-export, PostGIS, neue Kartenanbieter oder Geocoding-Dienste.
- Keine Löcher in Polygonen, Multi-Geometrien, Geometriesammlungen oder fachlichen Regeln pro Teilstrecke. Alle Formen gehören zur selben Baustelle und deren Zeitraum.
- Studio-Code maximal in `packages/plugin-construction-sites`, dem vorhandenen Baustellenpfad von `packages/sva-mainserver`, dessen bestehenden GraphQL-Dokumenten und den zugehörigen App-E2E-Tests. Keine neue Workspace-Bibliothek oder allgemeine Kartenplattform.
- Keine externe Implementierungsabhängigkeit im Mainserver. Der zuvor lokal erprobte Legacy-Schutz wird nicht weiterverfolgt und bleibt ausschließlich in dessen separatem lokalen Worktree; keine Übernahme, kein Push, kein Rollout.
- Die zuvor begonnenen Tabellen-/Toolbar-Arbeiten bleiben ein eigener Lieferumfang. Nach dem technischen Nachweis ergänzt Figma die reviewbare Ansicht 44 für den Baustelleneditor; die vorhandene Tabellenansicht 43 bleibt erhalten.

## Impact

- Betroffene Specs: `content-management`, `sva-mainserver-integration`.
- Architektur bei Umsetzung: `docs/architecture/05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md`; Bedienung und Grenzen in `docs/reference/construction-sites.md`.
- Datenmigration: keine. Bestehende Baustellen ohne Geometrie funktionieren weiter. Der Studio-Roundtrip erhält bestehende Angaben und wird gegen die unveränderte Mainserver-Semantik geprüft; die Pflege im alten CMS ist außerhalb des Umfangs.
- Status: **Studio-Umsetzung lokal abgeschlossen und gegen unveränderte Mainserver-Semantik getestet, Figma abgestimmt; Zielabnahme und Rollout offen**. Entscheidungen, Datenvertrag, Nachweise und Lieferreihenfolge stehen in [design.md](design.md), konkrete Aufgaben in [tasks.md](tasks.md).
