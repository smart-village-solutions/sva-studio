## 1. Vertrag und Host-Anbindung

- [x] 1.1 `projects.project`, Admin-Ressource, Plugin-Registry und ausgeblendete direkte Navigation registrieren.
- [x] 1.2 Modul-IAM und Instanz-Bootstrap für `projects.read`, `projects.create`, `projects.update` und `projects.delete` ergänzen.
- [x] 1.3 Eine allgemeine External-Content-Referenz für `iam.contents` mit eindeutiger Quellzuordnung, Reconciliation-Status, RLS und migrationssicherem Rollback ergänzen; keine projektspezifische Referenztabelle anlegen.
- [x] 1.4 Den vorhandenen `Idempotency-Key`- und Mutationsworkflow für Projekt-Create wiederverwenden, die stabile Operations-ID als Mainserver-`externalId` transportieren und Replay, verlorene Antworten sowie Repair über `externalId` abdecken.
- [x] 1.5 Host-Fassade sowie GenericItem-Routen mit `PROJECT`-Abgrenzung, lokalem Content-Core, Statusspiegelung nach `payload.status`, deterministischer `visible`-/`publishedAt`-Abbildung, Autorenrichtlinie, serialisierten Updates, Autorisierung, CRUD, Studio-Soft-Delete und Reconciliation ergänzen.
- [x] 1.6 Alle Upstream-Seiten bis zum nachgewiesenen Ende lesen und erst danach Typ-/Löschfilterung, lokale Pagination und Projektion ohne Doppelanzeige anwenden.

## 2. Fachplugin

- [x] 2.1 `@sva/plugin-projects` als eigenständige Kopie von `@sva/plugin-generic-items` mit Manifest, Nx-Konfiguration, Übersetzungen und öffentlichem API-Vertrag erstellen.
- [x] 2.2 Fachmodell, Mapper und Validierung für Sprache, Titel, Kurzbeschreibung, Rich Text, hostseitigen Status, nur lesbares `Published`, `PublishedAt`, genau einen Autor als Organisation oder Person, Bildergalerie, Soft Delete und Metadaten implementieren.
- [x] 2.3 Liste sowie Create-/Edit-Seiten mit den Tabs `Basis`, `Inhalt` und `Einstellungen` umsetzen und fachfremde GenericItem-Felder ausblenden; keinen temporären Historien-Tab ergänzen.
- [x] 2.4 Medienbibliothek und Bild-Upload wiederverwenden sowie zugängliches Umsortieren, Alternativtexte, Lade-, Fehler- und Leerzustände bereitstellen.
- [x] 2.5 Read-Merge-Write-Updates implementieren, die verborgene GenericItem-Felder und unbekannte Payload-Schlüssel im Studio-Schreibpfad erhalten, und die fehlende Konfliktgarantie bei parallelen externen Änderungen dokumentieren.

## 3. Qualität und Dokumentation

- [x] 3.1 Unit-, Komponenten-, API-, Persistenz- und Host-Tests für Fachvertrag, UI, host-owned Lifecycle, Veröffentlichungsmetadaten, Autorenrichtlinie, External-Content-Referenz, Idempotenz, Reconciliation, IAM, Typabgrenzung, Projektion, vollständiges Paging, Studio-Soft-Delete und CRUD ergänzen.
- [x] 3.2 Einen E2E-Test für CRUD, Veröffentlichung, mehrere Bilder, Reihenfolge und Löschen ergänzen.
- [x] 3.3 Nach jedem Block die kleinsten relevanten Nx-Unit- und Type-Gates sowie bei Serveränderungen früh `pnpm check:server-runtime` ausführen.
- [x] 3.4 `docs/development/studio-db-schema-final.sql`, `docs/development/studio-db-schema.md` sowie relevante deutsche Fach- und arc42-Dokumentation aktualisieren und `pnpm check:file-placement` ausführen.
- [x] 3.5 `openspec validate add-featured-projects-plugin --strict` ausführen.
- [ ] 3.6 Vor PR-Freigabe nach Möglichkeit `pnpm test:pr` ausführen.
