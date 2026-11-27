## 1. Erster Lieferabschnitt

- [ ] 1.1 Aktive Studio- und SSF-Routen, Aliase und Tabs mit servergespeisten Tabellen mit dem Seitenkatalog und den Plugin-Kompositionen abgleichen. Datenquellen, Abfrageparameter, Zugriffskontext, Mutation und lokale Ladeanzeige pro Tabelle erfassen.
- [x] 1.2 TanStack Query v5 auf React-Kompatibilität, Bundle und Lizenz prüfen. Den QueryClient über dem Outlet und den bestätigten Zugriffskontext über die bestehende Host- und Plugin-Anbindung bereitstellen. Scope-Wechsel, Cache-Lebensdauer, Abbruch und Fehlerverhalten gezielt prüfen.
- [x] 1.3 FAQ, Projekte, Jobs, Baustellen und generische Inhaltstabellen umstellen. Den bisherigen lokalen Cache der Inhaltsliste entfernen. Die bestehenden HTTP-, Polling- und Mutationspfade mit gezielten Tests absichern.
- [x] 1.4 Browser-Nachweis für Menüwechsel und Browser-Zurück mit verzögerter zweiter Antwort ausführen. Fehler, Fokus, leere Listen, Filterwechsel und Schreiboperationen absichern.

## 2. Weitere Tabellen

- [ ] 2.1 Verbleibende Fachlisten und Tabellen in Detailrouten aus dem Inventar umstellen.
- [ ] 2.2 Host-Tabellen in Administration, Kontodatenschutz, Medien, Schnittstellen und Monitoring umstellen.
- [ ] 2.3 Verbleibende Plugin-Tabellen in Abfallmanagement und aktiven Studio- und SSF-Profilen umstellen. Jede servergespeiste Tabelle einer migrierten Abfrage zuordnen.
- [ ] 2.4 Aktualisierung, Fehler und Invalidierung je Ladepfad prüfen. Die Nachweise um Organisations-, Konto- und Berechtigungswechsel, konkurrierende Anfragen und verspätete Antworten ergänzen.

## 3. Abschluss

- [x] 3.1 Betroffene Abschnitte der [Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) und [Querschnittlichen Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md) aktualisieren.
- [ ] 3.2 Verbleibende alte Listenpfade entfernen und den Abgleich mit Routen, Profilen und Tabellen abschließen. Gezielte Unit-, Typ- und Browser-Gates je Lieferabschnitt sowie vorhandene Bildreferenzen prüfen.

## Nachweisstand

- TanStack Query 5.108.4 ist MIT-lizenziert und unterstützt React 19. Die verwendeten Exporte ergaben in einer isolierten esbuild-Messung ohne React 33.450 Byte minifiziert und 10.060 Byte mit gzip.
- Sieben Chromium-Fälle mit verzögerter Antwort decken FAQ, Projekte und Schnittstellen über Browser-Zurück, Jobs über die Seitenleiste, Baustellen über beide Wege sowie Abfallarten über den Tabwechsel ab. Bei Baustellen und Jobs bleibt der Fokus auf dem Link in der Zeile erhalten. Bei FAQ aktualisieren sich Daten und Pagination.
- Der gemeinsame Cache ist in weiteren Fachlisten, Inhaltshistorien, Umfrage-Moderation, Abfallmanagement und Host-Tabellen eingebunden. Für den Abschluss fehlen der vollständige Abgleich der aktiven Profile sowie der Nachweis von Fehlerbehandlung und Mutation für jeden Tabellenpfad.
- Nach dem Frontend-Review zu #2292 sind elf Chromium-Fälle grün. Zusätzlich zu den Rückwechsel-Fällen prüfen sie den Platz der Seitenleiste beim vollständigen Neuladen, die Rückkehr nach einer Medienlöschung und die Schnittstellenreaktion auf 403 und 503. Integrationstests prüfen ausstehende Abrufe bei Mutation und Organisationswechsel sowie konkurrierende Änderungen in Gruppen- und Umfrageformularen.

- Vor dem Speichern einer Umfrage wird der aktuelle bearbeitbare Stand geprüft. Die Regressionstests prüfen hinzugefügte Antwortoptionen und umbenannte Fragen bei blockiertem Hintergrundabruf. Im Konfliktfall bleiben die lokalen Änderungen sichtbar.

- Beim vollständigen Reload liefern Übersicht, Changelog, Inhalte, Medien, Schnittstellen und Konto mit verifizierter Sitzung die Grundnavigation im ersten HTML. Unterseiten liefern auch den Breadcrumb. Das Changelog rendert seinen Server-Cache im Dokument. Fachlisten laden beim vollständigen Reload weiterhin anhand der bestätigten Abfrage und der aktuellen Rechte. Die Abnahme der ersten Datenanzeige für alle aktiven Profile bleibt offen.
