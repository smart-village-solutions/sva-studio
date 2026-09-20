## 0. Freigabe- und Vertrags-Preflight

- [x] 0.1 Am vorgesehenen Mainserver-Zielstand bestätigen, dass der vorhandene Kategorien-Read `dataTypes` als nicht-nullbare Stringliste liefert; keine Mainserver-Änderung vorbereiten.
- [x] 0.2 Proposal und Design einschließlich der bewusst akzeptierten Studio-only-Schutzgrenze freigeben, bevor Produktcode geändert wird.

## 1. Gefilterte Studio-Auswahl

- [x] 1.1 Die bestehende Active-only-GraphQL-Abfrage im Studio-Integrationspackage um das vorhandene Feld `dataTypes` erweitern und dessen Antwort als erforderliche Stringliste validieren, ohne die Management-Abfrage oder den Mainserver zu ändern.
- [x] 1.2 `GET /api/v1/mainserver/categories` um genau einen optionalen `dataType`-Parameter erweitern; leere, mehrfache und nicht unterstützte Werte vor dem Upstream-Aufruf mit dem vorhandenen `invalid_request`-Vertrag ablehnen. Bei gültigem Filter genau einen Active-only-Read ausführen und Kategorien mit leerer Typenliste oder exakter Mitgliedschaft zurückgeben.
- [x] 1.3 News, Events und POI senden in ihren bestehenden API-Funktionen fest `news_item`, `event_record` beziehungsweise `point_of_interest`; keine Registry, Factory oder neue gemeinsame Clientabstraktion einführen.
- [x] 1.4 Bei Lade- oder Antwortvalidierungsfehlern keine ungefilterte Ersatzliste anzeigen. Bereits gespeicherte, nicht angebotene Kategorien bleiben sichtbar und entfernbar, werden aber nicht erneut auswählbar.

## 2. Gezielte Nachweise

- [x] 2.1 Route- und Service-Tests decken den parameterlosen Vertrag, alle drei Filter, ungültige Parameter, genau einen Upstream-Read sowie leere, einzelne, mehrere, nicht passende und fehlende oder ungültige `dataTypes` ab.
- [x] 2.2 API- und Editor-Tests belegen die feste Zuordnung je Plugin, den vorhandenen lokalisierten Ladefehler sowie sichtbare und entfernbare historische Werte.
- [x] 2.3 Je einen Browserflow für News, Events und POI prüfen; dabei ausschließlich den Studio-Auswahlpfad als bestanden bewerten, nicht eine serverseitige Integritätsgarantie.

## 3. Dokumentation und Abschlussgates

- [x] 3.1 Betroffene Nutzer- oder Vertragsdokumentation aktualisieren, sofern sie den Kategorien-Read oder die Editor-Auswahl beschreibt; die Studio-only-Grenze ausdrücklich beibehalten.
- [x] 3.2 Einen nutzerverständlichen Changelog-Eintrag zur gefilterten Kategorieauswahl ergänzen.
- [x] 3.3 Früh die kleinsten gezielten Unit-/Type-Gates der geänderten Projekte sowie für das Studio-Serverpackage `pnpm check:server-runtime` ausführen; vor PR-Freigabe zusätzlich `pnpm check:file-placement`, den strikten OpenSpec-Check und die proportionalen Nx-Gates gemäß `DEVELOPMENT_RULES.md` ausführen.
