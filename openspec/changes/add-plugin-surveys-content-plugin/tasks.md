## 1. Spezifikation und Zielmodell schärfen

- [x] 1.1 Delta fuer `content-management` finalisieren und die Integration von Surveys in `Inhalte` und `Neuer Inhalt` abschliessend absichern
- [x] 1.2 Delta fuer `sva-mainserver-integration` finalisieren und Survey-Read-/Write-/Moderationspfade vollstaendig beschreiben
- [x] 1.3 neue Capability `plugin-surveys` finalisieren und Panel-, Rechte- und Editor-Vertrag abschliessend verankern
- [x] 1.4 das Survey-Zielmodell gegen `docs/staging/2026-07/umfragen-wunsch-graphql-schema.md` bereinigen:
  - Statusmodell auf `DRAFT`, `ACTIVE`, `ARCHIVED`
  - `SCHEDULED` und `ENDED` entfernen
  - `allowsMultipleSubmissionsPerDevice` entfernen
- [x] 1.5 Moderations-, Overlay-, Loesch- und Exportregeln abschliessend in den Specs abbilden
- [x] 1.6 OpenSpec-Change strikt validieren

## 2. Plugin-Grundstruktur anlegen

- [x] 2.1 Nx-Library `packages/plugin-surveys` mit `scope:plugin` und Standard-Targets anlegen
- [x] 2.2 `package.json`, `project.json`, `tsconfig.json`, `tsconfig.lib.json`, `vitest.config.ts` und `plugin.manifest.json` nach Muster von News, Events und POI anlegen
- [x] 2.3 `README.md`, `src/index.ts` und `src/plugin.tsx` nach dem Standard-Content-Muster anlegen
- [x] 2.4 Survey-Content-Type, Survey-Plugin-ID, Standard-Action-IDs und Standard-Permissions fest verdrahten
- [x] 2.5 zusaetzliche Survey-Rechte fuer Moderation und Export gezielt und minimal ergaenzen
- [x] 2.6 plugin-lokale Grundtypen, Formmodelle und Validierungsvertraege fuer Surveys anlegen
- [x] 2.7 fruehe Unit- und Type-Tests fuer Plugin-Vertrag, Exporte und Typoberflaeche anlegen
- [x] 2.8 kleinsten relevanten Gate-Pfad fuer das neue Plugin frueh ausfuehren

## 3. Mainserver-Survey-Vertrag und Adapter umsetzen

- [x] 3.1 typed Survey-GraphQL-Adapter im host-owned Mainserver-Layer fuer Liste, Detail, Upsert, Ergebnisse und Freitext-Moderation definieren
- [x] 3.2 Survey-GraphQL-Dokumente gegen Snapshot und verifizierte Operationen anlegen oder aktualisieren
- [x] 3.3 das vereinfachte Survey-Zielmodell in Mainserver-Typen, DTOs und Mapping-Layern nachziehen
- [x] 3.4 `allowsMultipleSubmissionsPerDevice` aus Read-/Write-Mapping, Tests und Dokumentation entfernen
- [x] 3.5 Freitext-Freigabe als host-owned Mutationspfad modellieren
- [x] 3.6 Freitext-Loeschung als host-owned Mutationspfad modellieren
- [x] 3.7 deterministische Fehler- und Berechtigungsabbildung fuer Survey-Operationen definieren, inklusive Moderations- und Exportpfaden
- [x] 3.8 Unit- und Type-Tests fuer Survey-Adapter, Response-Mapping, Schema-Drift und Fehlerverhalten ergaenzen
- [x] 3.9 kleinsten relevanten Mainserver-/Types-/Runtime-Gate-Pfad nach diesem Block ausfuehren

## 4. Host- und Inhaltslisten-Integration herstellen

- [x] 4.1 Surveys in die fuehrende Inhaltsquelle der Seite `Inhalte` integrieren
- [x] 4.2 Surveys als normalen Eintrag in der gemischten Inhaltsliste sichtbar machen, ohne survey-spezifische Sondertabellen einzufuehren
- [x] 4.3 `Neuer Inhalt` um den Typ `Survey` oder `Umfrage` erweitern
- [x] 4.4 Host-Routing und Bindings fuer Survey-Create-, Edit- und Detailpfade im Standard-Content-Fluss verdrahten
- [x] 4.5 Content-List-, Routing- und Host-Integrations-Tests fuer den Survey-Typ ergaenzen
- [x] 4.6 kleinsten relevanten Gate-Pfad fuer Host- und Content-Integration ausfuehren

## 5. Survey-Editor-Rahmen und gemeinsame UI-Bausteine umsetzen

- [x] 5.1 Survey-Detailseite mit `StudioDetailPageTemplate` und stabiler Tab-Struktur `Basis`, `Inhalt`, `Moderation`, `Ergebnisse`, `Historie` anlegen
- [x] 5.2 Create- und Edit-Ansicht in denselben Editor-Rahmen fuehren
- [x] 5.3 nicht verfuegbare Tabs im Create-Fall mit Hinweiszustaenden statt ausgeblendeter Navigation darstellen
- [x] 5.4 flache Survey-Section-Card-Komponente(n) plugin-lokal anlegen, ohne shared UI-Grenzen zu verletzen
- [x] 5.5 Layout-Regeln technisch absichern:
  - keine Card-Verschachtelung
  - keine inneren Tabs
  - wiederholende Inhalte als Abschnitte innerhalb gemeinsamer Cards
- [x] 5.6 grundlegende Seiten-, Tab- und Hinweiszustands-Tests ergaenzen
- [x] 5.7 kleinsten relevanten UI-Gate-Pfad fuer den Editor-Rahmen ausfuehren

## 6. Tab `Basis` umsetzen

- [x] 6.1 Card `Identitaet` mit Titel und Statusfeld umsetzen
- [x] 6.2 Card `Laufzeit` mit `startAt`, `endAt` und Hinweis fuer unbefristete Surveys umsetzen
- [x] 6.3 Card `Zielgebiet` mit optionaler Auswahl im Stil bestehender Mehrfachauswahlen umsetzen
- [x] 6.4 Card `Metadaten` fuer Create-/Edit-Zustaende umsetzen
- [x] 6.5 Validierung und Formularbindung fuer den Tab `Basis` ergaenzen
- [x] 6.6 Unit-Tests fuer `Basis`-Tab und zugehoerige Feldlogik ergaenzen
- [x] 6.7 kleinsten relevanten Gate-Pfad fuer `Basis` ausfuehren

## 7. Tab `Inhalt` umsetzen

- [ ] 7.1 Card `Beschreibung` mit einfachen Textfeldern als Default anlegen
- [ ] 7.2 Card `Teilnahme und Sichtbarkeit` mit `isAnonymous`, `showResultsInApp` und `resultVisibility` umsetzen
- [ ] 7.3 Card `Hinweise` fuer Datenschutz- und Transparenzhinweise umsetzen
- [ ] 7.4 entscheiden und technisch abbilden, welche Textfelder `Textarea` bleiben und welche optional Rich-Text verwenden
- [ ] 7.5 Card `Fragen` mit plugin-lokalem `SurveyQuestionListEditor` anlegen
- [ ] 7.6 Inline-Bearbeitung fuer Fragen innerhalb derselben `Fragen`-Card umsetzen
- [ ] 7.7 Antwortoptionen als flache wiederholende Abschnitte innerhalb derselben `Fragen`-Card umsetzen
- [ ] 7.8 Sortierung von Fragen und Optionen ueber `position` umsetzen
- [ ] 7.9 alle vorgesehenen Fragetypen in der Editor-Logik und Validierung unterstuetzen
- [ ] 7.10 jede Loeschaktion fuer Fragen und Optionen ueber bestaetigende Dialoge absichern
- [ ] 7.11 Unit- und UI-Tests fuer Fragetypen, Inline-Bearbeitung, Sortierung und Loeschbestaetigung ergaenzen
- [ ] 7.12 kleinsten relevanten Gate-Pfad fuer `Inhalt` ausfuehren

## 8. Tab `Moderation` umsetzen

- [ ] 8.1 Moderationsansicht nach Fragen gruppieren und pro Frage eine eigene Haupt-Card erzeugen
- [ ] 8.2 innerhalb jeder Fragen-Card eine Tabelle fuer Freitextantworten mit gekuerzter Textdarstellung umsetzen
- [ ] 8.3 Schieberegler fuer die oeffentliche Sichtbarkeit analog zu bestehenden Visibility-Einstellungen umsetzen
- [ ] 8.4 Klick auf gekuerzten Text als Overlay fuer den Volltext umsetzen
- [ ] 8.5 Loeschaktion pro Freitextantwort mit expliziter Bestaetigung umsetzen
- [ ] 8.6 Create-Hinweiszustand fuer noch nicht verfuegbare Moderation umsetzen
- [ ] 8.7 Unit- und UI-Tests fuer Gruppierung, Visibility-Toggle, Overlay und Loeschpfad ergaenzen
- [ ] 8.8 kleinsten relevanten Gate-Pfad fuer `Moderation` ausfuehren

## 9. Tab `Ergebnisse` umsetzen

- [ ] 9.1 Card `Uebersicht` mit kompakten Kennzahlen aufbauen
- [ ] 9.2 Card `Frageergebnisse` mit aggregierten Ergebnissen pro Frage umsetzen
- [ ] 9.3 Freitextantworten in `Ergebnisse` read-only und nur nachgeordnet ueber aufklappbare Bereiche anzeigen
- [ ] 9.4 zwei getrennte Exportaktionen bereitstellen:
  - ohne Freitexte
  - mit Freitexten
- [ ] 9.5 Exportformate `CSV`, `JSON`, `Excel` und `XML` fuer beide Exportpfade umsetzen oder hostseitig anbinden
- [ ] 9.6 Create-Hinweiszustand fuer noch nicht verfuegbare Ergebnisse umsetzen
- [ ] 9.7 Unit- und UI-Tests fuer Ergebnisdarstellung und Exportpfade ergaenzen
- [ ] 9.8 kleinsten relevanten Gate-Pfad fuer `Ergebnisse` ausfuehren

## 10. Tab `Historie` umsetzen

- [ ] 10.1 Historien-Tab nach dem Muster der Referenzmodule fuer Surveys anbinden
- [ ] 10.2 Create-Hinweiszustand fuer noch nicht vorhandene Historie umsetzen
- [ ] 10.3 Tests fuer Historienzustand und Fallbacks ergaenzen
- [ ] 10.4 kleinsten relevanten Gate-Pfad fuer `Historie` ausfuehren

## 11. Abschluss, Dokumentation und Gesamtvalidierung

- [ ] 11.0 Stelle mittels Fallow und pnpm test:pr sicher, dass wir keine Quality Gates brechen und keinen neuen Technical Debt einführen. Behebe Findings ggf.
- [ ] 11.1 `README.md` des Plugins mit Architekturrolle, Boundaries, UI-Struktur und Integrationspunkten vervollstaendigen
- [ ] 11.2 relevante Entwicklungsdokumentation fuer Survey-Modul und Mainserver-Vertrag aktualisieren
- [ ] 11.3 die im Proposal genannten Architekturabschnitte `05`, `08` und `09` gezielt aktualisieren oder die Abweichung begruendet dokumentieren
- [ ] 11.4 OpenSpec-Change nach dem finalen Stand erneut strikt validieren
- [ ] 11.5 kleinsten real relevanten PR-Gate-Pfad fuer Plugin, Host und Mainserver ausfuehren
