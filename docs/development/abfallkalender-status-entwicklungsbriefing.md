# Entwicklungsbriefing: Verlässliche Statushinweise im Abfallkalender

**Stand:** 1. November 2026

**Adressat:** Entwicklung des Waste-Management-Plugins

**Bezug:** L19 im bestehenden Change `align-studio-ui-design-system`

**Status:** Technisch im Migrationsworktree umgesetzt; gezielte Unit-/Typ- und Browsernachweise liegen vor. Die vollständige manuelle Accessibility- und fachliche Abnahme bleibt offen.

## Auftrag und Ergebnis

Die bestehende Jahresübersicht soll vorhandene Termine weiterhin anzeigen und
verständlich erklären, wie belastbar die Anzeige ist. Ein Monat ohne Treffer
darf bei fehlenden Daten oder nicht berechenbaren Regeln nicht als sicher
terminfrei erscheinen. Bekannte Ursachen sollen konkret benannt werden.

Die vorhandene Terminberechnung um lokale Statusinformationen ergänzen und diese
in der breiten Jahresübersicht, der mobilen Monatsliste und der zusammenfassenden
Terminliste konsistent anzeigen. Vorhandene Berechnungsregeln bleiben erhalten;
es entsteht kein neuer serverseitiger Kalenderdienst.

## Ausgangslage vor der Umsetzung

- `TourYearCalendarDialog` verwendet bei fehlender Tour oder fehlendem
  Scheduling derzeit dieselbe leere Liste wie bei einer Berechnung ohne Treffer.
- `collectScheduledTourDates` liefert bei fehlendem Startdatum oder ungültigen
  Datumswerten keine regelmäßigen Termine. Eine nicht unterstützte oder nicht
  aufgelöste Wiederholung erzeugt ebenfalls keine regelmäßigen Termine.
- Einzeltermine werden unabhängig davon ergänzt. Deshalb kann eine Tour
  sichtbare Termine haben, obwohl ein weiterer Berechnungsanteil fehlt.
- Verschiebungen, einschließlich Eingängen aus dem Vorjahr, und Feiertagsregeln
  verändern die wirksamen Termine. Sie müssen bei Statusaussagen berücksichtigt
  werden.
- Feiertagsregeln ohne `scope` oder `strategy` werden aktuell nicht angewendet.
  Das belegt allein noch keinen Fehler: Relevanz und fachliche Bedeutung der
  Konfiguration müssen geprüft werden.
- Die mobile Leermeldung lautet derzeit „Für diesen Monat sind keine Termine
  vorhanden.“ Diese sichere Aussage ist durch ein leeres Ergebnis allein nicht
  gedeckt.

## Gewünschte Anzeige

Die Texte sind redaktionelle Vorgaben. Im Code ausschließlich Übersetzungsschlüssel
verwenden und Deutsch sowie Englisch ergänzen.

| Situation | Anzeige | Bedingung |
| --- | --- | --- |
| Ladevorgang läuft | „Termine werden geladen …“ | Tatsächlicher Ladezustand des bestehenden Datenpfads; nicht allein `scheduling === null`. |
| Berechnung möglich, keine Treffer | „Keine berechneten Termine in diesem Monat.“ | Daten liegen vor und die für diese Tour erforderlichen Anteile konnten ausgewertet werden. |
| Nachweislich außerhalb der Gültigkeit | „Außerhalb des Gültigkeitszeitraums.“ | Gültigkeitsmodell gilt für die Tour; Grenzen sind bekannt und wirksame Termine widersprechen der Aussage nicht. |
| Keine belastbare Berechnung möglich | „Termine können derzeit nicht berechnet werden.“ | Erforderliche Angaben fehlen, sind ungültig oder ein notwendiger Datenabruf ist fehlgeschlagen. Bekannte Ursache ergänzen. |
| Vorhandene Termine, Vollständigkeit eingeschränkt oder nicht belegbar | Termine anzeigen und „Die Terminübersicht ist möglicherweise unvollständig.“ | Mindestens ein auswertbarer Anteil liefert Termine, während ein weiterer erforderlicher Anteil nicht belastbar ausgewertet werden kann. |
| Berechnung möglich, Termine vorhanden | Bestehende Terminanzeige | Kein zusätzlicher Erfolgs-Badge pro Monat erforderlich. |

Bei einem bekannten Ladefehler dessen vorhandenen Fehlerzustand verständlich
anzeigen. Ein fehlgeschlagener Abruf darf weder einen endlosen Ladezustand noch
eine bestätigte Leermeldung erzeugen. Eine Wiederholungsaktion nur verwenden,
wenn der bestehende Datenpfad sie bereits unterstützt.

### Konkrete Ursachen

- Bei einer regelmäßigen Tour mit erforderlichem, aber fehlendem Startdatum:
  „Für die regelmäßige Tour fehlt das Startdatum.“
- Bei einem belegbar nicht auflösbaren benutzerdefinierten Rhythmus:
  „Der hinterlegte Abholrhythmus kann derzeit nicht ausgewertet werden.“
- Bei einem fehlgeschlagenen Abruf der notwendigen Planungsdaten:
  „Die Planungsdaten konnten nicht geladen werden.“

Nur nachweisbare Ursachen nennen; keine rohen API-Fehler oder technischen
Kennungen als Meldung ausgeben. Ohne belastbare Ursache bleibt die allgemeine
Aussage stehen.

## Fachliche Regeln und Vorrang

1. **Tourarten unterscheiden.** Ein fehlendes Startdatum ist bei reinen
   Einzelterminen oder einer Tour ohne datumsbasierte Wiederholung nicht
   automatisch ein Fehler. Keine neue Pflichtangabe einführen.
2. **Vorhandene Termine erhalten.** Statushinweise dürfen berechenbare Termine,
   Einzeltermine oder wirksame Verschiebungen nicht ausblenden.
3. **Gültigkeit nicht pauschal ableiten.** Das vorhandene Gültigkeitsmodell nur
   für passende Tourarten anwenden. Ein Start-/Enddatumsvergleich allein darf
   keine wirksamen Einzel- oder Ersatztermine unterdrücken. Ohne ausreichenden
   Nachweis keine Aussage „außerhalb der Gültigkeit“ anzeigen.
4. **Fehlende Treffer und fehlende Aussagekraft trennen.** Ein leeres Array ist
   kein Nachweis einer vollständigen Berechnung. Auch die zusammenfassende
   Terminliste darf dann keine widersprechende Leermeldung zeigen.
5. **Probleme auf den belegbaren Bereich begrenzen.** Ursachen monatsgenau
   zuordnen, wenn ihre Reichweite bekannt ist. Ist nur das Jahr betroffen oder
   die monatsgenaue Reichweite unklar, einen verständlichen Hinweis auf dieser
   Ebene zeigen; keine erfundene Genauigkeit durch zwölf Warnungen erzeugen.
6. **Feiertagskonfiguration fachlich einordnen.** Vorhandene Statusfelder und
   fehlende Einstellungen prüfen. Ein Entwurf, eine leere Regelliste oder eine
   bewusst nicht angewandte Regel beweisen für sich keine unvollständige Tour.
   Relevanz für Tour, Zeitraum und wirksame Termine muss belegbar sein.
7. **Laden ist ein eigener Zustand.** Ladezustand, Abruffehler und fachlich
   unbekannter Stand bleiben unterscheidbar. Bei Tour-/Jahreswechsel gehören
   Termine und Hinweise stets zum gleichen aktuellen Kontext.

## Umsetzung im bestehenden Pfad

| Bereich | Zuständiger Ausgangspunkt |
| --- | --- |
| Datumsberechnung und Herkunft der Ergebnisse | `packages/plugin-waste-management/src/waste-management.tours.presentation.calendar.ts` |
| Feiertagsregeln und ihre Anwendbarkeit | `packages/plugin-waste-management/src/waste-management.tours.presentation.holidays.ts` |
| Gültigkeitsmodell | `packages/waste-management-contracts/src/waste-management/master-data-tour-validity.ts` – zunächst nur lesen |
| Kalender, Monatsdarstellung und Terminliste | `packages/plugin-waste-management/src/waste-management.tours-year-calendar.tsx` |
| Übergabe von Daten und Lade-/Fehlerzustand | `packages/plugin-waste-management/src/waste-management.tours-dialogs-panel.tsx` und dessen bestehender View-Model-/Datenpfad |
| Übersetzungen | Bestehende `plugin.translations.de.tours.details.ts` und `plugin.translations.en.tours.details.ts` im Plugin |

Die Statusermittlung gehört zur bestehenden fachlichen Auswertung und bleibt
ohne React testbar. React stellt das Ergebnis dar. Status und Terminmenge
müssen dieselben geprüften Voraussetzungen verwenden; keine zweite parallele
Terminberechnung und kein nachgebautes Regelwerk nur für Warnmeldungen anlegen.

Vor einer Änderung der Rückgabeform alle Verbraucher der bestehenden
Datumsfunktionen prüfen. Bestehende Verträge für Terminlisten, Verschiebungsdetails
und andere Verbraucher erhalten. Ergebnis-Metadaten lokal und bedarfsgerecht
ergänzen; keine pauschale Änderung externer API-/DB-Verträge.

Der Kalender erhält den tatsächlichen Lade-/Fehlerzustand aus dem bestehenden
Datenpfad. Keine neue Request-, Provider- oder Cache-Schicht nur für die Hinweise.
Fehlende Daten dürfen nicht durch leere Ersatzdaten als vollständig erscheinen.

## Gestaltung und Bedienung

- Bestehende semantische Rollen und gemeinsame UI-Komponenten verwenden;
  Standard-Theme in Light und Dark. Normale Leerzustände bleiben zurückhaltend.
- Bedeutung immer im Text ausdrücken; Farbe oder Icon ergänzen die Aussage.
  Keine Warnung allein durch Farbe vermitteln.
- Ein übergeordneter Hinweis für ein gemeinsames Problem genügt. Bei Bedarf
  betroffene Monate benennen; identische Ursachen nicht unnötig wiederholen.
- Statusänderungen zugänglich ankündigen, ohne den Fokus bei Berechnung oder
  Jahreswechsel ungefragt zu verschieben.
- Datum, ursprüngliches Datum bei Ersatzterminen und vorhandene berechtigte
  Verschiebungslinks bleiben in beiden Layouts erreichbar.
- 320, 390, 768, 1024, 1280 und 1728 px sowie lange deutsche/englische Texte,
  Textvergrößerung und geringe Höhe berücksichtigen.
- Figma-Referenz:
  [L19-Monatszustände und Kalenderbeispiele](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=193-18269).
  Die dortigen Zustände nur mit belegbaren Quellsignalen verbinden; dieses
  Briefing präzisiert die technische Aussagekraft der Entwürfe.

## Akzeptanzkriterien und Nachweise

Die vorhandenen Vitest-Tests gezielt erweitern, insbesondere
`waste-management.tours.presentation.test.ts` und
`waste-management.tours-year-calendar.test.tsx`. Die Statusermittlung mit echten
fachlichen Eingaben prüfen; reine Mocks der gewünschten Statusnamen reichen nicht.

| Fall | Erwartung |
| --- | --- |
| Datenabruf läuft / schlägt fehl | Lade- und Fehlerzustand unterscheidbar; niemals „keine Termine vorhanden“. |
| Vollständig auswertbare Tour, leerer Monat | Neutrale Meldung „Keine berechneten Termine …“. |
| Regelmäßige Tour ohne notwendiges Startdatum | Konkrete Ursache; keine sichere Leermeldung. |
| Reine Einzeltermine ohne Startdatum | Termine unverändert sichtbar; kein künstlicher Startdatumsfehler. |
| Einzeltermine vorhanden, erforderliche Wiederholung nicht auswertbar | Vorhandene Termine plus Hinweis zur möglichen Unvollständigkeit. |
| Ungültige Datumsangabe oder nicht auflösbarer Rhythmus | Nachweisbarer Grund; weder Absturz noch bestätigte Terminfreiheit. |
| Belegbar außerhalb der Gültigkeit | Passender Hinweis, ohne vorhandene Einzel-/Ersatztermine auszublenden. |
| Verschiebung über Monats- oder Jahresgrenze | Wirksamer Termin und Ursprungsdatum bleiben korrekt; Status widerspricht ihnen nicht. |
| Relevante gegenüber irrelevanter/unbeabsichtigt pauschal bewerteter Feiertagskonfiguration | Nur belegbar betroffene Auswertung kennzeichnen; keine pauschale Warnung aus leeren Listen oder Statusnamen. |
| Jahres-/Tourwechsel | Termine und Hinweise aktualisieren sich gemeinsam; kein veralteter Status aus dem vorherigen Kontext. |
| Mobile Liste, breites Gitter und zusammenfassende Terminliste | Inhaltlich gleiche Aussage und gleicher Funktionsbestand. |
| Bestehende vollständig auswertbare Referenzfälle | Datumswerte, Reihenfolge, Duplikatbehandlung, Verschiebungen und Links bleiben unverändert. |

Nach neuen Logikblöcken den kleinsten passenden Unit-/Type-Gate über Nx ausführen.
Vorhandene Ziele zuerst auflösen; Dateifilter als `--testFiles=...` verwenden.
Keine breiten lokalen Testläufe für diesen begrenzten Abschnitt ansetzen, wenn
gezielte Nachweise ausreichen. Passende Pflicht-Gates gelten bei tatsächlicher
Scope-Erweiterung weiterhin. Für die Dokumentation `pnpm check:file-placement`
und `pnpm check:docs` ausführen.

Zur Übergabe gehören die abgedeckten Ursachen samt Herkunft im Code, gezielte
Testergebnisse sowie eine manuelle Sichtprüfung der genannten Layout-/Sprachfälle.
Technische Umsetzung, manuelle Accessibility-Prüfung und fachliche Abnahme
getrennt ausweisen. L19 erst nach passendem Nachweis als umgesetzt kennzeichnen.

## Grenzen und Stoppbedingungen

- Keine Änderungen an Termin-, Feiertags- oder Verschiebungsregeln, keine neuen
  Berechnungen, Speicheraktionen, Berechtigungen, Datenbankmigrationen oder
  externen API-Feldern.
- Keine Migration des öffentlichen Abfallkalenders und keine Reaktivierung von
  Forest. Kein neuer generischer Statusdienst oder komponentenübergreifendes
  Framework.
- Reicht der bestehende Datenvertrag für eine behauptete Aussage nicht aus,
  diese Aussage nicht vortäuschen. Fehlenden Nachweis und betroffenen Fall
  dokumentieren. Eine notwendige Erweiterung von Fachregeln oder Backenddaten
  vor Umsetzung als gesonderte Entscheidung vorlegen.
- **L15 bleibt verbindlich:** Tagesauswahl wirkt sofort auf den Tourenentwurf;
  eine Aktion ohne Rücknahme dieser Änderungen heißt „Schließen“. Dauerhaft
  speichern erfolgt separat. Die noch offene Code-Umbenennung ist ein eigener
  begrenzter Folgefix, keine Voraussetzung für die Statusermittlung.
- **L18 bleibt verbindlich:** Das funktionslose Fax-Easteregg bleibt exakt
  unverändert und ist von der Designmigration ausgenommen.

## Zugehörige Unterlagen

- [Figma-Briefing und Produktentscheidungen](./designsystem-figma-briefing.md)
- [Führende Lückenliste und bestehender Migrations-Change](../../openspec/changes/align-studio-ui-design-system/design.md)
- [Umsetzungs- und Abnahmestand](../../openspec/changes/align-studio-ui-design-system/tasks.md)
- [Testing-Strategie](./testing-strategy.md)


## Umsetzungsstand am 1. November 2026

Die vorhandene Jahresberechnung liefert zusätzlich lokale Ursachen und belegbar
außerhalb der Gültigkeit liegende Monate. Die bisherigen Listenverträge bleiben
erhalten. Ungültige Datumswerte werden nicht still normalisiert; gültige
Einzel-/Ersatztermine bleiben sichtbar. Fehlende Feiertagseinstellungen führen
nur bei einer nachweisbar betroffenen Terminberechnung zu einem Hinweis;
Entwurfsstatus oder leere Regellisten allein lösen keine Warnung aus.

Der bestehende Scheduling-Lader übergibt Lade- und Fehlerzustand an den Dialog.
Die Öffnungsaktion zeigt den Kalender bereits während des Abrufs. Ein gemeinsamer
Request-Zähler im vorhandenen Touren-State verhindert, dass überholte Antworten
beim erneuten Öffnen oder Laden den aktuellen Stand überschreiben. Gitter,
mobile Monatsliste und zusammenfassende Terminliste verwenden dieselben
Berechnungsergebnisse; ein gemeinsamer zugänglicher Statushinweis vermeidet
zwölf identische Warnungen. Alle Texte liegen auf Deutsch und Englisch vor.

Gezielte Nachweise im Worktree:

- Berechnung, Jahreskalender, Einzelterminauswahl, View-Model und Dialogübergabe:
  fünf Vitest-Dateien mit 44 bestandenen Tests.
- Nach Korrektur des Öffnungspfads: Aktionen, View-Model und bestehende Helfer
  mit 18 bestandenen Tests; darunter sofortiges Öffnen und veraltete Antworten.
  Der abschließende Lauf für Berechnung, Dialogübergabe und View-Model bestand
  mit 31 Tests und prüft auch konkurrierendes Übersichtsladen und Kalenderöffnen.
- Plugin-Typecheck bestanden; gezieltes Lint ohne Fehler. Bestehende Warnungen
  zu Non-null Assertions sowie einem ungenutzten Test-Spy bleiben unverändert.
- Zwei neue Chromium-Fälle über das bestehende App-E2E-Ziel bestanden:
  Teiltermine einschließlich Jahreswechsel sowie tatsächliches Laden und
  fehlgeschlagener Scheduling-Abruf. Der zusätzliche Auth-Setup-Fall bestand.
- Deutsche Teilansicht in Light/Dark bei 320, 390, 768, 1024, 1280 und 1728 px
  geprüft; vorhandene Overflow-/Markup-Checks und Axe-Prüfung auf schwere oder
  kritische Befunde bei 1280 px bestanden. Englische Datumsdarstellung ist
  gezielt als Unit-Fall geprüft; die vollständige manuelle Sprach-/A11y-Matrix
  bleibt offen.

Die lokale App läuft aus diesem Worktree über das bestehende Nx-Serve-Ziel und
Dev-Auth unter `http://studio.localhost:3000/`. Health- und eigentliche Startseite
antworten mit HTTP 200. Die Browsernachweise verwenden kontrollierte API-Fixtures;
echte Fach-/IAM-Datenbanken sind in dieser UI-Laufzeit nicht angebunden.
Es gab keine Datenbankmigration und keine Änderung an externen Systemen.
Die lokalen Nachweise wurden vor dem PR-Commit erhoben. Commit, Push und
Entwurfs-PR sind inzwischen durch den Nutzer beauftragt; die Nachweise ersetzen
keine GitHub-Gates am PR-HEAD und keine fachliche Produktabnahme.
