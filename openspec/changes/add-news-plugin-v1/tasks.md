## 1. OpenSpec und Architektur

- [ ] 1.1 Spec-Deltas für `content-management`, `routing`, `account-ui` und `monorepo-structure` anlegen
- [ ] 1.2 Betroffene arc42-Abschnitte identifizieren: §04, §05, §06, §08, §09, §11, §12
- [ ] 1.3 ADR für Plugin-SDK-Vertrag v1 unter `docs/adr/` anlegen und in §09 referenzieren

## 2. SDK und Plugin-Vertrag

- [ ] 2.1 `@sva/sdk` um `PluginDefinition`-Interface erweitern (id, displayName, routes, navigation, contentTypes, translations)
- [ ] 2.2 Registry-/Merge-Helfer für Plugin-Routen, Plugin-Navigation, Plugin-Content-Types und Plugin-Translations ergänzen
- [ ] 2.3 SDK-seitigen `usePluginTranslation(pluginId)`-Hook bereitstellen
- [ ] 2.4 Unit-Tests für SDK-Vertrag: Plugin-Registrierung (gültig, doppelte ID, leere ID), Nav-Merge, Route-Merge, Payload-Validation
- [ ] 2.5 Type-Tests (`expectTypeOf`) für `PluginDefinition`-Interface und öffentliche SDK-API

## 3. News-Plugin

- [ ] 3.1 Neues Workspace-Package `@sva/plugin-news` anlegen (Scope-Tag `scope:plugin` in `project.json`)
- [ ] 3.2 News-Content-Type `news` mit serverseitigem Zod-Payload-Schema definieren (teaser, body, imageUrl, externalUrl, category)
- [ ] 3.3 HTML-Sanitisierung für `body` implementieren (Allowlist-basiert, `sanitize-html`)
- [ ] 3.4 `externalUrl`- und `imageUrl`-Validierung mit Protokoll-Allowlist (`https:` only)
- [ ] 3.5 Plugin-Routen für Liste, Neu-Anlage, Bearbeitung und Löschen definieren
- [ ] 3.6 Plugin-spezifische Listen-UI mit Empty-State und Status-Anzeige erstellen
- [ ] 3.7 Plugin-spezifische Editor-UI für News erstellen (barrierefreie Formulare: Labels, Pflichtfeld-Kennzeichnung, Fehleranzeige)
- [ ] 3.8 Lösch-Flow mit Bestätigungsdialog und Erfolgsfeedback implementieren
- [ ] 3.9 Feedback-Mechanismen: Erfolgs-/Fehlermeldungen nach Create, Update, Delete (via `aria-live`-Region)
- [ ] 3.10 Unit-Tests für News-Plugin: Payload-Validierung (gültig + ungültig), Sanitisierung, Rendering, Delete-Flow

## 4. Studio-Integration

- [ ] 4.1 Plugin-Registrierung im Studio-Kern einführen (inkl. Translation-Merge)
- [ ] 4.2 Plugin-Routen in den bestehenden Route-Baum integrieren
- [ ] 4.3 Plugin-Navigation in die Shell integrieren (innerhalb bestehendem `<nav>`-Landmark, mit `aria-current="page"`)
- [ ] 4.4 Guards für Plugin-Routen: Studio-Kern wendet bestehende Account-/Content-Guards an; Liste: `content.read`, Create: `content.create`, Edit/Delete: `content.write`
- [ ] 4.5 Fokus-Management bei Plugin-Routenwechseln (Fokus auf Hauptinhalt/Seitenüberschrift, `document.title`-Update)
- [ ] 4.6 Unit-Tests für Studio-Integration: Plugin-Registrierung, Guard-Anwendung, Navigation-Rendering

## 5. Mainserver-Content-Wiederverwendung

- [ ] 5.1 Bestehende Mainserver-Content-API für `contentType = news` nutzbar machen (News-Payload-Schema serverseitig registrieren)
- [ ] 5.2 Serverseitiges Zod-Schema bei Create/Update anwenden; ungültiger Payload liefert HTTP 400
- [ ] 5.3 Historie, Statusmodell und Aktivitätslogs unverändert für News wiederverwenden
- [ ] 5.4 Integrationstests: valider/invalider Payload gegen Content-API, Berechtigungsprüfung

## 6. i18n und Übersetzungen

- [ ] 6.1 Plugin-i18n-Namespace `news` definieren (Key-Präfix `news.*`)
- [ ] 6.2 Alle UI-Labels, Aktionen, Status- und Fehlertexte als Translation-Keys anlegen (de + en)
- [ ] 6.3 Navigation-Label über `t('news.navigation.title')` statt hard-coded
- [ ] 6.4 `plugin-example` als Referenz ebenfalls auf i18n umstellen (harte Strings entfernen)

## 7. Barrierefreiheit

- [ ] 7.1 Editor-Formular: programmatische Labels (`<label>`/`aria-labelledby`), Pflichtfelder als `required`, Feldbeschreibungen via `aria-describedby`
- [ ] 7.2 Validierungsfehler: zugängliche Fehlermeldungen via `aria-describedby` am jeweiligen Feld
- [ ] 7.3 Statusmeldungen (Speichern, Löschen, Fehler) über `role="status"` oder `aria-live="polite"` ohne Fokusverschiebung
- [ ] 7.4 Keyboard-Navigation: alle interaktiven Elemente in Liste und Editor per Tastatur erreichbar, keine Tastaturfallen
- [ ] 7.5 Plugin-Ansichten respektieren die Heading-Hierarchie der Shell

## 8. Tests und Qualitätssicherung

- [ ] 8.1 `plugin-news` in `coverage-policy.json` mit Floors aufnehmen (Lines ≥ 70, Functions ≥ 60) — nicht exempt
- [ ] 8.2 E2E-Szenario 1: News-CRUD Happy Path (anlegen, bearbeiten, löschen)
- [ ] 8.3 E2E-Szenario 2: Navigation — News-Eintrag in Shell sichtbar, Klick führt zur Liste
- [ ] 8.4 E2E-Szenario 3: Auth-Guard — unautorisierter Zugriff auf `/plugins/news` wird blockiert
- [ ] 8.5 A11y-Regressionscheck: axe-core in Playwright für News-Plugin-Ansichten, Keyboard-Only-Flow
- [ ] 8.6 `routing`-Coverage prüfen (Baseline 36,84 % Lines, Floor 35 %) — Tests für Plugin-Route-Integration ergänzen
- [ ] 8.7 Module-Boundary-Validierung: `pnpm lint` bestätigt `scope:plugin` → `scope:sdk`

## 9. Dokumentation

- [ ] 9.1 `04-solution-strategy.md` — prüfen, ob Plugin-SDK-Boundary-Prinzip aktualisiert werden muss
- [ ] 9.2 `05-building-block-view.md` — Plugin-News als neuen Baustein aufnehmen, SDK-Vertrag dokumentieren
- [ ] 9.3 `06-runtime-view.md` — Laufzeitszenario „Plugin-Registrierung und News-CRUD" ergänzen
- [ ] 9.4 `08-cross-cutting-concepts.md` — Plugin-Erweiterbarkeit, Plugin-Content-Sanitisierung und Plugin-Guard-Vertrag als Querschnittskonzepte aufnehmen
- [ ] 9.5 `09-architecture-decisions.md` — ADR für Plugin-SDK-Vertrag v1 referenzieren, v1-Scope-Einordnung zu ADR-002
- [ ] 9.6 `11-risks-and-technical-debt.md` — Risiken aufnehmen: generische IAM-Rechte ohne Content-Type-Qualifier, untypisiertes `payload_json`, Bundle-statt-Runtime-Plugins
- [ ] 9.7 `12-glossary.md` — Neue Begriffe: Plugin-Vertrag, Plugin-Registrierung, contentType, PluginDefinition
- [ ] 9.8 Plugin-Entwickler-Guide unter `docs/guides/plugin-development.md` anlegen (SDK-Vertrag, Registrierung, Content-Type, Routing, i18n, Tests)
