## Ausgangslage und Messung

Referenz: `origin/main` bei `64215aa9` am 02.10.2026. Der unveränderte Lauf
`pnpm complexity-gate` wertete 2.687 Dateien aus, meldete null unregistrierte
Findings und 445 registrierte Findings über alle vier Metriken. Davon sind
164 aktuelle `fileLines`-Überschreitungen. Das Register enthält 205
`fileLines`-Einträge; ältere oder bereits unter dem Limit liegende Einträge
sind kein aktueller Verstoß. Die PR-Planung zählt die **aktuellen Messwerte**,
nicht alle Registereinträge. Die Zahlen werden vor jeder Tranche erneut
ermittelt; parallele Arbeit kann sie verändern.

| Bereich | Aktuelle Dateien über Limit | PR-Startbudget | Startzuschnitt für Liefer-PRs |
| --- | ---: | ---: | --- |
| Core, Routing, Server-Runtime | 10 | 2 | Verträge/Exports; Routing und Runtime nach eigener Risiko- und Testgrenze |
| Studio-Frontend | 24 | 8 | Shell/Navigation; IAM-API; IAM-Cockpit; Rollen/Gruppen; Benutzerseiten; Organisationen/Auswahl; Instanzen/Schnittstellen; Content/Medien |
| Auth-Runtime, IAM-Admin, IAM-Governance | 37 | 5 | Account/Rollen; DSR/Governance; Auth/Session; Plugin-/Content-/Media-Pfade |
| Data-Repositories, Instance-Registry | 17 | 3 | Media/Operations; Instanz-Repository; Provisionierung/Keycloak |
| Plugin-SDK, Studio-UI | 7 | 2 | SDK-Vertragsfläche; bestehende UI-Primitives/Editoren |
| Fachplugins ohne Waste | 11 | 6 | Events; News; Generic Items; POI; Projects; Cockpit Cards |
| Waste-Plugin, -Runtime, -Contracts | 27 | 4 | Touren/Orte; Settings/Loader/Handler; öffentliche Verträge/Übersetzungen |
| SVA-Mainserver | 9 | 2 | Content-Routen; Service/Wiring; Typen und interne Mapper |
| Öffentlicher Waste-Kalender | 8 | 2 | öffentliche Daten-/Reminder-Pfade; Panels/Route |
| CI-/Ops-Skripte, Studio-MCP | 14 | 4 | Complexity/Coverage/Sonar; DB-/Runtime-Prüfer; Ops; MCP |
| **Gesamt** | **164** | **38** | |

Diese Tabelle ist eine vollständige Partition der aktuell gemessenen Befunde
nach bestehenden Ownership-Bereichen. Ein Bereich ist **kein** automatischer
PR: Die letzte Spalte benennt die fachlichen Schnittkandidaten. Das
Startbudget von 38 PRs wurde durch die konkrete Teilung von PR 06, PR 07 und PR 08
auf derzeit 46 einzeln beschriebene Aufgaben in `tasks.md` angepasst.
PR 06 wurde nach der Messung von 8.984 Zeilen über acht Dateien
in vier seriell bearbeitbare Teile 06a bis 06d aufgeteilt. Nach dem Merge
von 06c zeigte die erneute Messung für 06d 3.066 Zeilen über vier Dateien.
Die getrennten Benutzer- und Organisationsoberflächen werden daher als 06d1
und 06d2 nacheinander bearbeitet; der SearchableSelect bleibt beim
Organisationsabschnitt, der seine Filterfunktion direkt verwendet. Die Nummern
definieren eine serielle Reihenfolge, keine Quote:
Wenn neue Evidenz einen anderen Schnitt erfordert, wird die betreffende
Aufgabe vor ihrer Umsetzung konkret geändert. Ein Maximum geänderter Dateien
ersetzt die Risikoprüfung nicht.

Nach PR 06d2 ergab die Messung für PR 07 acht Dateien mit 6.959 Zeilen.
Sie liegen in unterschiedlichen Ausführungsgrenzen: Anlageassistent,
Betriebsmodelle mit Detailseite, serverseitige Speicherung mit Healthcheck,
API-Serverfunktionen, Dialoge und Instanz-Hook. Deshalb werden sie als
07a bis 07f in dieser Reihenfolge geliefert. Jeder Teil beseitigt
seinen benannten Befund und nutzt die bereits vorhandenen Pfadtests; die
Schnittstellenverträge bleiben dabei unverändert.

Vor PR 08 ergab die erneute Messung vier Dateien mit zusammen 3.607 Zeilen.
Content-Liste, Content-Editor, Waste-Import und Medien-Hook besitzen getrennte
Verbraucher und Ausführungsgrenzen. Sie werden als 08a bis 08d nacheinander
geliefert: Jede Änderung beseitigt ihren eigenen Befund, erhält die
betreffenden Bedien- und Datenverträge und besitzt einen eigenen Changelog.
Der separate Change `refactor-sva-studio-react-package-boundaries` bleibt
für die UI-Package-Konsolidierung zuständig.

## Lieferreihenfolge

1. **Pilot:** Je ein begrenzter Schnitt in `packages/server-runtime` und
   `packages/studio-ui-react`. Vorhandene Tests und Metriken dienen als
   Referenz. Nach beiden Reviews wird geprüft, ob der Zuschnitt verständlich
   und die Prüfzeit angemessen war.
2. **Grundlagen:** `plugin-sdk`, `core` und `routing` nur entlang bestehender
   Konsumenten/Verträge bearbeiten. Wenn ein konkreter Vertrag mit einem
   späteren Bereich gekoppelt ist, werden beide im selben fachlichen PR
   behandelt oder die Grundlage zuerst abgeschlossen.
3. **Produktbereiche:** PR 05 bis PR 34 einschließlich 06a bis 06d2, 07a
   bis 07f und 08a bis 08d werden genau
   in der Reihenfolge von `tasks.md` bearbeitet. Ein Task wird erst nach Merge- und Gate-Nachweis
   abgeschlossen, bevor die nächste Nummer beginnt.
4. **Schlusslauf:** Nach PR 34 wird der vollständige Scope erneut gemessen.
   Ein Restbefund wird als konkret benannter weiterer PR-Task ergänzt und
   abgearbeitet, bevor der Change abgeschlossen wird.

## Regeln für jeden PR-Abschnitt

- Vor Codeänderungen das PR-Ziel in einem Satz, Nicht-Ziele, maximal betroffene
  Bereiche und den Satz der aktuell zu beseitigenden `fileLines`-Findings
  festhalten. Ausgangs-HEAD, Ist-/Soll-Zeilen und betroffene Tests notieren.
- Nur eine zusammenhängende Verantwortung pro PR. Mehrere Dateien und auch
  zwei eng gekoppelte Packages sind zulässig, wenn sie gemeinsam denselben
  Vertrag bilden. Unabhängige Bereiche werden nicht zur PR-Reduktion gebündelt.
- Vor einer Extraktion bestehende Modulgrenzen, Exporte, Plattformmittel und
  Tests prüfen. Tote oder doppelte Logik entfernen. Neue Module besitzen eine
  fachliche Aufgabe; reine Weiterleitungsdateien, zusätzliche öffentliche
  Fassaden und parallele Pfade sind kein Zielbild.
- Den ersetzten Code im selben PR löschen. Keine Änderung an Verhalten,
  Autorisierung, Validierung, Datenformaten, i18n oder Accessibility als
  „Refactor“ tarnen. Solche Änderungen gesondert planen und prüfen.
- Der PR beseitigt seine benannten `fileLines`-Befunde vollständig, ohne neue
  `fileLines`-, Funktions-, Cyclomatic- oder Export-Findings zu erzeugen. Ist
  das im gesetzten Scope nicht korrekt möglich, den Schnitt vor dem Push neu
  zuschneiden statt Limits oder Baseline zu lockern.
- Gezielte Characterization-Tests vor riskanten Verschiebungen; nach jedem
  Codeblock das kleinste echte Unit-/Type-Gate. Bei serverseitigen Änderungen
  die bestehenden Runtime-Pflichtprüfungen und bei Auth/Security/Datenpfaden
  die Spezial-Gates aus `DEVELOPMENT_RULES.md` Abschnitt 5.2 ausführen.
- Vor breiten lokalen Unit-Läufen den Nx-affected-Scope messen. CI prüft den
  finalen PR-HEAD; lokale Wiederholungen bleiben auf den geänderten Pfad
  begrenzt. `pnpm complexity-gate --base <base-sha>` dient dem PR-Signal,
  der vollständige Lauf dem Portfolio-Fortschritt.
- Nach nachgewiesener Behebung nur die betreffenden `fileLines`-Findings aus
  `trackedFindings` entfernen. Weitere Metriken derselben Datei bleiben
  registriert, solange sie aktuell überschritten sind. Keine
  `--update-baseline`-Ausführung als Teil dieses Programms.

## Abhängigkeiten und bestehende Changes

Vor jedem Liefer-PR `openspec list`, offene PRs und den aktuellen Code prüfen.
Insbesondere `refactor-sva-studio-react-package-boundaries`,
`refactor-cross-cutting-runtime-guardrails`,
`refactor-ci-gate-orchestration`, `refactor-waste-plugin-ownership` und
`refactor-events-detail-content-tab` berühren mögliche Zielbereiche. Ein
bereits laufender, fachlich passender Refactor darf ein Finding erfüllen;
dieses Portfolio eröffnet dafür keinen konkurrierenden Pfad. Der Status
„Complete“ im OpenSpec-Ordner ist ohne Merge-/HEAD-Prüfung kein Beleg.

## Risiken und Nachweis

- **Verhaltensdrift bei großen Dateien:** Bestehende Ein-/Ausgabe-, Fehler-
  und Berechtigungsfälle vor der Verschiebung charakterisieren; Review anhand
  des entfernten alten Pfads und gezielter Tests.
- **Verschobene statt beseitigte Komplexität:** Vorher-/Nachher-Metriken für
  alle betroffenen produktiven Dateien und alle vier Gate-Metriken vergleichen;
  keine neue Überschreitung akzeptieren.
- **Lange Integrationszeit:** PRs direkt auf aktuellem `main`, kein
  monatelanger Sammelbranch; den nächsten Schnitt nach jedem Merge neu messen.
- **Überlappende Arbeit:** Aktive Changes und PRs vor Beginn abgleichen.
  Überschneidungen zusammenführen oder zeitlich ordnen, nicht parallel
  dieselbe Datei refaktorieren.
- **Systemgrenzen in IAM/Waste/Mainserver:** Trust Boundaries, Failure Modes
  und kritische Invarianten je betroffenem Liefer-PR konkret festhalten. Bei
  neuer Architekturwirkung arc42 aktualisieren; keine schematische
  Gesamtdokumentation ohne konkrete Änderung.
