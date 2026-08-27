## Context

Die lokale Projektdokumentation besitzt bereits wertvolle Inhalte und einige starke Einzelverträge: arc42 unter `docs/architecture/`, kanonische ADRs unter `docs/adr/`, den verbindlichen Studio-Rollout sowie spezialisierte CI-Prüfungen für File Placement, Rollout-Aussagen, OpenAPI und Datenbankschema. Das strukturelle Problem liegt nicht primär in fehlendem Inhalt, sondern in einer zu breiten Publikationsoberfläche und in unscharfen Ablagegrenzen.

Der Ausgangsstand `641a9a2f2` zeigt insbesondere:

- 832 versionierte Dateien unter `docs/`
- 366 Changelog-Dateien, 116 historische Plan-Dateien und 97 Report-Dateien
- 60 Dateien unter dem unspezifischen Sammelbegriff `docs/guides/`
- keine Bereichsindizes für `docs/development/`, `docs/guides/` und `docs/governance/`
- einen Wiki-Sync, der `docs/` vollständig kopiert und den Legacy-ADR-Ordner navigierbar macht
- keine allgemeine Prüfung relativer Dokumentationslinks, der Indexerreichbarkeit oder der Vollständigkeit des kanonischen ADR-Index

`docs/user-documentation/` bleibt der Studio-seitige Übergabevertrag zum eigenständigen Repository der Anwenderdokumentation. Dieser Change verändert weder deren Seiteninhalte noch Katalogsemantik, Sync-Vertrag oder Publikationsmodell.

## Goals / Non-Goals

### Goals

- Eine Person findet von `docs/README.md` aus die maßgebliche aktuelle Quelle nach Rolle und Zweck.
- Wiki und Repository verwenden dieselben kanonischen Einstiege.
- Das Wiki führt primär über konkrete Aufgaben und erst danach über Dokumentationsbereiche zur richtigen Quelle.
- Veröffentlichte Markdown-Dokumente werden als gerenderte Wiki-Seiten ausgeliefert und nicht auf Raw-Inhalte umgeleitet.
- Historische, generierte und evidenzbezogene Artefakte bleiben bei Bedarf versioniert, dominieren aber weder Navigation noch Wiki-Suche.
- Jede aktuelle Dokumentationsfläche besitzt einen klaren Zweck, eine bereichsbezogene Ownership und einen Pflege-Trigger.
- Strukturelle Drift wird früh und mit einem lokal reproduzierbaren Check erkannt.
- Die Migration bleibt in vier kleinen, voneinander abhängigen Delivery-Blöcken reviewbar.

### Non-Goals

- keine redaktionelle Überarbeitung sämtlicher vorhandener Dokumente in einem Durchgang
- keine Änderung der externen Anwenderdokumentation, ihres Starterpakets oder des Seitenkatalogs
- keine neue Dokumentationsplattform wie Docusaurus, MkDocs oder VitePress
- keine Änderung des kanonischen Studio-Rolloutpfads oder des Pfads `docs/guides/studio-rollout-process.md`
- keine Massenumschreibung historischer Reports, PR-Unterlagen, Staging-Dokumente, archivierter Pläne oder OpenSpec-Archive
- keine Einführung personenbezogener Dokument-Owner; Ownership bleibt rollen- oder domänenbezogen
- keine Pflicht zu flächendeckender YAML-Frontmatter in bestehenden Markdown-Dateien

## Documentation Model

### Aktuelle Wissensbasis

Die publizierte und navigierbare Wissensbasis besteht nach Abschluss aus diesen Verantwortungsbereichen:

| Bereich         | Verantwortung                                                  | Primärer Einstieg                         |
| --------------- | -------------------------------------------------------------- | ----------------------------------------- |
| `architecture/` | Systembild, arc42 und architekturspezifische Vertiefungen      | `docs/architecture/README.md`             |
| `adr/`          | kanonische Architekturentscheidungen                           | `docs/adr/README.md`                      |
| `development/`  | lokales Entwickeln, Testen und Beitragen                       | `docs/development/README.md`              |
| `operations/`   | Betrieb, Deployment, Diagnose, Recovery und Runbooks           | `docs/operations/README.md`               |
| `reference/`    | technische Verträge, Konventionen und stabile Nachschlagewerke | `docs/reference/README.md`                |
| `api/`          | maschinenlesbare API-Spezifikationen                           | Verlinkung aus `docs/reference/README.md` |
| `governance/`   | Delivery-, Review- und Projektregeln                           | `docs/governance/README.md`               |

`docs/README.md` ist der einzige übergreifende Einstieg. Er enthält klickbare Links, rollenbezogene Lesewege, die Autoritätsgrenzen der Bereiche und einen separaten Hinweis auf nicht publizierte Artefakte. Flüchtige Workspace-Zahlen werden dort entweder automatisiert abgeleitet oder weggelassen. `docs/guides/studio-rollout-process.md` bleibt als einziger verbindlicher Kompatibilitätsanker unter `docs/guides/`; der Ordner ist danach kein allgemeiner Zielbereich für neue Dokumente mehr.

### Nicht navigierte Artefakte

Die bestehenden Pfade `docs/changelog/`, `docs/reports/`, `docs/pr/`, `docs/staging/` und `docs/superpowers/` bleiben wegen bestehender Generatoren, File-Placement-Regeln, Nachweise und historischer Referenzen zunächst erhalten. Sie sind ausdrücklich nicht normativ und werden nicht in die aktuelle Wiki-Publikationsfläche aufgenommen.

Der Legacy-Bestand `docs/architecture/decisions/` bleibt während der Migration nicht navigiert. Einzigartige noch gültige Entscheidungen werden vor einer späteren Entfernung in kanonische ADRs überführt; doppelte oder überholte Dateien werden nicht als aktuelle Quellen referenziert.

### Externe Anwenderdokumentation

`docs/user-documentation/` bleibt außerhalb der inhaltlichen Neuordnung. Der lokale Einstieg darf den Integrationsvertrag erklären und verlinken, behandelt Startermaterial, Katalog und externe Hilfeseiten aber nicht als Teil der lokalen Entwickler-, Architektur- oder Betriebsdokumentation. Der Wiki-Sync veröffentlicht diesen Bestand nicht als lokale Projektdokumentation.

## Ownership and Lifecycle

Jeder aktuelle Bereichsindex benennt:

- Zweck und Zielgruppen des Bereichs
- verantwortliche Rolle oder Domäne, nicht einzelne Personen
- welche Inhalte normativ, erklärend oder referenziell sind
- ereignisbasierte Pflege-Trigger, etwa „bei Änderung des Rollout-Workflows“ oder „bei neuer ADR“
- angrenzende Bereiche und die dort führende Quelle

Die Bereichsindizes verlinken jede aktuelle Markdown-Seite ihres Bereichs direkt oder über einen klar verlinkten Unterindex. Flächendeckende Frontmatter wird verworfen, weil sie bei einem großen Bestand viel mechanischen Änderungsaufwand und eine zweite Metadatenquelle erzeugen würde. Zeitbasierte „zuletzt geprüft“-Felder sind optional; maßgeblich sind überprüfbare Pflege-Trigger.

## Publication Contract

Der Wiki-Sync verwendet eine Positivliste für die aktuelle Wissensbasis. Die Positivliste liegt als versioniertes Manifest unter `config/documentation/wiki-publication-paths.txt`; der Workflow und der spätere Dokumentationscheck konsumieren denselben Vertrag. Der Workflow kopiert nicht mehr den vollständigen `docs/`-Baum. Während der Übergangsphase darf `docs/guides/` ausschließlich so lange publiziert werden, wie ein dortiger aktueller Inhalt bereits aus einem kanonischen Bereichsindex erreichbar und als noch nicht migriert gekennzeichnet ist. Mit PR 4 entfällt dieser Übergangspfad bis auf `docs/guides/studio-rollout-process.md`.

Wiki-Home und Sidebar werden aus denselben kanonischen Einstiegen wie `docs/README.md` erzeugt oder durch Vertragstests gegen diese geprüft. Die Sidebar verweist ausschließlich auf den kanonischen ADR-Bestand, niemals auf `docs/architecture/decisions/`.

### Live-Abnahme nach PR 4

Die Abschlussprüfung hat gezeigt, dass GitHub Wiki verschachtelte Repository-Pfade nicht als normale Wiki-Seiten behandelt. Ein Aufruf wie `/wiki/docs/README.md` antwortet mit einer Weiterleitung auf `raw.githubusercontent.com/wiki/.../docs/README.md`. Das betrifft die publizierten Markdown-Dokumente ebenso wie YAML-, SQL- und Mermaid-Dateien. `Home.md` und `_Sidebar.md` im Wiki-Root werden dagegen regulär gerendert.

Damit ist der bisherige Transportvertrag erfüllt, der Nutzbarkeits- und Renderingvertrag jedoch nicht. Task 6.3 kann erst abgeschlossen werden, wenn die veröffentlichte Wissensbasis über gerenderte Seiten erreichbar ist.

### Aufgabenorientierter Wiki-Einstieg

Die Wiki-Startseite beantwortet zuerst „Was möchtest du tun?“ und bietet direkte Pfade für:

- Studio lokal einrichten
- eine Änderung entwickeln und testen
- einen PR vorbereiten oder prüfen
- Studio nach Dev, Staging oder Production ausrollen
- einen Fehler oder Incident untersuchen
- Architektur und Entscheidungen verstehen
- IAM, APIs oder Datenmodelle nachschlagen
- Dokumentation erstellen oder pflegen

Jeder Aufgabenpfad verweist auf höchstens einen kanonischen Leitfaden oder Bereichsindex. Darunter folgen getrennt:

1. kritische Einstiege für Rollout, Incident Response, Security, Entwicklungsregeln, Architektur und ADRs
2. die Bereiche Entwicklung, Betrieb, Architektur, ADRs, Referenz/API und Governance mit jeweils einer kurzen Zweckbeschreibung
3. ein knapper Hinweis auf Wiki-Suche und Bereichsindizes als kuratierte Navigation

Flüchtige Seitenzahlen und eine vollständige Liste aller publizierten Dokumente gehören nicht auf die Startseite.

Die Sidebar bleibt auf Home, Aufgaben, die sechs Bereiche, Studio-Rollout und Incident Response begrenzt. Einzelne Unterseiten werden ausschließlich über Aufgabenpfade und Bereichsindizes erschlossen.

### Gerenderte Wiki-Publikation

`docs/` bleibt die einzige redaktionelle Quelle. Der Workflow erzeugt daraus eine abgeleitete Wiki-Publikation mit folgenden Regeln:

1. Jede publizierte Markdown-Datei erhält einen deterministischen, global eindeutigen Slug im Wiki-Root. Der Pfad `docs/development/testing-strategy.md` wird beispielsweise zu `development--testing-strategy.md`.
2. `README.md`-Dateien werden als Bereichseinstiege benannt, sodass Root- und Bereichsindizes nicht kollidieren.
3. Relative Links zwischen publizierten Markdown-Dateien werden auf die Ziel-Slugs umgeschrieben. Anker bleiben erhalten.
4. Links auf nicht publizierte Repository-Dateien werden als absolute Links auf die kanonische Datei im Studio-Repository ausgegeben.
5. YAML-, SQL- und Mermaid-Dateien sind ausdrücklich gekennzeichnete Quellartefakte und verweisen auf die Repository- beziehungsweise Raw-Ansicht. Bilder dürfen als Assets direkt geladen werden, gelten aber nicht als Wiki-Seiten.
6. Jede erzeugte Wiki-Seite enthält einen unaufdringlichen Herkunftshinweis mit Link zur kanonischen Quelldatei im Repository.
7. Manuelle Änderungen im Wiki sind nicht kanonisch und dürfen beim nächsten Sync überschrieben werden.

Die Transformation wird in einem framework-agnostischen, typsicheren Skript gekapselt. Der GitHub-Actions-Workflow orchestriert nur Checkout, Transformation, Verifikation und Push.

### Fehler- und Kollisionsverhalten

Die Publikation schlägt vor dem Wiki-Push fehl, wenn:

- zwei Quelldateien denselben Slug erhalten
- ein Link auf eine publizierte Markdown-Datei nicht transformiert werden kann
- Home oder Sidebar ein nicht erzeugtes Wiki-Ziel referenzieren
- eine normale Dokumentationsseite als Raw-Ziel ausgegeben würde
- eine im Manifest enthaltene Markdown-Datei keine gerenderte Zielseite erzeugt

Fehler nennen Quelldatei, Zeile und Ziel. Ein fehlgeschlagener Build verändert das Wiki nicht.

## Automated Integrity Contract

Ein neues Root-Skript `pnpm check:docs` prüft ausschließlich aktuelle lokale Projektdokumentation und deren Publikationsvertrag. Historische Artefakte werden nicht nachträglich auf vollständige Linkintegrität verpflichtet.

Der Check validiert mindestens:

1. relative Datei- und Verzeichnisziele in aktuellen Markdown-Dateien existieren
2. jede aktuelle Markdown-Seite ist aus `docs/README.md` über Bereichsindizes erreichbar
3. jede kanonische ADR-Datei unter `docs/adr/` ist im ADR-Index erfasst und jeder Indexeintrag besitzt eine Datei
4. Wiki-Home, Sidebar und Sync-Konfiguration verweisen nur auf erlaubte aktuelle Einstiege
5. ausgeschlossene Pfade werden nicht versehentlich in die Wiki-Publikationsfläche aufgenommen
6. `docs/user-documentation/` bleibt als externer Integrationsbereich von der lokalen Inhaltsmigration getrennt
7. Wiki-Slugs sind deterministisch und kollisionsfrei
8. Links zwischen publizierten Markdown-Seiten werden auf gerenderte Wiki-Ziele transformiert
9. Home und Sidebar verweisen ausschließlich auf erzeugte Wiki-Seiten
10. nur ausdrücklich gekennzeichnete Quellartefakte dürfen Raw-Ziele verwenden

Für korrektes Markdown-Parsing wird die bereits im Lockfile aufgelöste Unified-/Remark-Werkzeugfamilie als explizite Root-Dev-Dependency verwendet, statt einen eigenen unvollständigen Markdown-Linkparser zu pflegen. Der Checker selbst bleibt ein typsicheres TypeScript-Skript mit Vitest-Vertragstests und klaren Fehlern im Format `pfad:zeile: grund`.

Der Check läuft lokal, in `test:ci` und als blockierender Schritt in Repository Hygiene. Der bestehende advisory Anwenderdokumentationskatalog bleibt davon unberührt.

## Four-PR Delivery Design

### PR 1: Publikationsoberfläche und Einstiege korrigieren

**Ziel:** Sofort verhindern, dass historische oder externe Artefakte als gleichrangige aktuelle Dokumentation erscheinen.

**In Scope:**

- `docs/README.md` vollständig klickbar, rollenbezogen und ohne veraltete manuelle Workspace-Inventur gestalten
- bestehende aktuelle Einstiege sichtbar machen und nicht normative Bereiche klar abgrenzen
- die Positivliste unter `config/documentation/wiki-publication-paths.txt` als einzigen maschinenlesbaren Wiki-Publikationsvertrag anlegen
- Wiki-Sync von vollständigem `rsync docs/` auf dieses Manifest umstellen
- Wiki-Home und Sidebar auf `docs/README.md`, arc42 und `docs/adr/README.md` ausrichten
- `docs/user-documentation/`, Changelog, Reports, PR-/Staging-Unterlagen, Superpowers-Pläne und Legacy-ADRs aus der Wiki-Publikation ausschließen
- Workflow-Vertragstest für Positivliste und kanonischen ADR-Pfad ergänzen

**Out of Scope:** Datei-Moves, neue Zielordner, allgemeiner Linkchecker und redaktionelle Inhaltsbereinigung.

**Rollback:** ausschließlich Wiki-Sync und Einstiegsdokumente; keine Dokumentpfade ändern sich.

### PR 2: Informationsarchitektur und Ownership etablieren

**Ziel:** Die Zielstruktur und ihre Pflegeverantwortung verbindlich machen, bevor Inhalte verschoben werden.

**In Scope:**

- `docs/development/README.md`, `docs/operations/README.md`, `docs/reference/README.md` und `docs/governance/README.md` anlegen
- Zweck, Zielgruppe, Autorität, Ownership und Pflege-Trigger je Bereich dokumentieren
- `docs/governance/dokumentationsmigration.md` als befristeten Migrationsindex mit vollständiger Zuordnung jedes aktuellen Guide-Dokuments zum Zielbereich anlegen
- Dokumentationspflege in `AGENTS.md`, `DEVELOPMENT_RULES.md` und bei Bedarf `CONTRIBUTING.md` auf die Zielstruktur ausrichten
- die betroffenen arc42-Abschnitte 04, 08 und 11 aktualisieren

**Out of Scope:** Massenverschiebungen, CI-Blockierung und Inhaltsänderungen an der externen Anwenderdokumentation.

**Rollback:** neue Indizes und Regeln können unabhängig entfernt werden; bestehende Dokumentpfade bleiben stabil.

### PR 3: Automatischen Dokumentations-Gate einführen

**Ziel:** Neue strukturelle Drift verhindern, bevor die große Migration beginnt.

**In Scope:**

- `scripts/ci/check-documentation.ts` mit getrennten, testbaren Kernfunktionen implementieren
- explizite Markdown-Parser-Dependencies hinzufügen
- Fixtures und Vitest-Tests für gültige Links, fehlende Ziele, Index-Unerreichbarkeit, ADR-Parität und Wiki-Ausschlüsse ergänzen
- bestehende aktuelle Linkfehler und ADR-Indexabweichungen als Teil der Gate-Aktivierung beheben
- `check:docs` in `package.json`, `test:ci` und Repository Hygiene blockierend verdrahten
- Fehlerausgabe und lokale Reparaturanleitung dokumentieren

**Out of Scope:** historische Linkfehler und semantische Bewertung fachlicher Dokumentinhalte.

**Rollback:** Gate-Verdrahtung kann zurückgenommen werden, ohne Publikations- oder Dokumentpfade zu verändern; der Checker bleibt separat testbar.

### PR 4: Aktuelle Inhalte kontrolliert migrieren

**Ziel:** Den unscharfen Sammelbereich `docs/guides/` und lose Root-Dokumente auflösen.

**In Scope:**

- jedes im PR-2-Migrationsinventar als aktuell klassifizierte Dokument per `git mv` nach `development/`, `operations/`, `reference/`, `api/` oder `architecture/` verschieben; ausgenommen bleibt der kanonische Rollout-Leitfaden an seinem verbindlichen Pfad
- Überschneidungen vor dem Verschieben zusammenführen, statt parallele aktuelle Quellen zu konservieren
- alle Referenzen in aktueller Dokumentation, Root-Guidance, aktiven OpenSpec-Changes, Scripts und Workflows aktualisieren
- historischen Bestand nicht massenhaft umschreiben; notwendige Abweichungen im Migrationsnachweis dokumentieren
- `docs/guides/` als allgemeinen Ablageort auflösen und nur den kanonischen Rollout-Leitfaden als stabilen Kompatibilitätsanker behalten
- Legacy-ADRs endgültig aus aktueller Navigation und Validierung ausschließen; einzigartige aktive Aussagen in kanonische ADRs übernehmen
- Wiki-Positivliste und Bereichsindizes auf den finalen Zielbaum reduzieren

**Out of Scope:** fachliche Neufassung aller migrierten Dokumente und Löschung versionierter Evidenzbestände.

**Rollback:** ein maschinenlesbarer Move-Nachweis beziehungsweise eine überprüfbare Alt-/Neu-Pfadliste ermöglicht die gezielte Rückführung; keine Produkt- oder Runtime-Artefakte sind betroffen.

## Sequencing and Merge Rules

1. PR 1 muss vor PR 2 gemergt sein, damit die sichtbare Oberfläche bereits bereinigt ist.
2. PR 2 muss vor PR 3 gemergt sein, weil der Gate die dort definierten Indizes und Bereichsgrenzen validiert.
3. PR 3 muss vor PR 4 gemergt sein, damit die Migration unter dem finalen Integritäts-Gate erfolgt.
4. Jeder PR wird nach dem Vorgänger neu von `origin/main` abgezweigt.
5. Jeder PR erhält nach Vergabe seiner PR-Nummer den verpflichtenden Eintrag `docs/changelog/entries/pr-<nummer>.json`.
6. Ein Merge oder die Umsetzung des Folge-PRs erfolgt nicht allein aufgrund eines lokalen grünen Checks; die normalen Review- und CI-Gates bleiben maßgeblich.

### Abschlusskorrektur nach PR 4

Die vier geplanten Delivery-Blöcke bleiben historisch und fachlich unverändert. Der in der Live-Abnahme gefundene Raw-Redirect wird in einem separaten Korrektur-PR behoben, weil der bestehende Wiki-Exit-Vertrag noch nicht erfüllt ist.

Der Korrektur-PR umfasst ausschließlich:

- die aufgabenorientierte Wiki-Startseite und kompakte Sidebar
- die deterministische Wiki-Slug- und Linktransformation
- die Kennzeichnung und Verlinkung nicht renderbarer Quellartefakte
- fokussierte Vertrags- und Transformationstests
- die Erweiterung von `pnpm check:docs` um die gerenderte Publikationsgrenze
- den Live-Nachweis nach dem Merge

Er verändert weder die kanonischen Dokumentpfade unter `docs/` noch die externe Anwenderdokumentation oder den Studio-Rolloutvertrag.

Empfohlene Branches sind `docs/curate-documentation-publication`, `docs/establish-documentation-information-architecture`, `chore/add-documentation-integrity-gate` und `docs/migrate-local-documentation`. Die Namen sind nicht Teil des Runtime-Vertrags, machen aber Reihenfolge und Scope in GitHub nachvollziehbar.

## Alternatives Considered

### Sofortige Massenmigration in einem PR

Verworfen. Sie vermischt Publikationslogik, Navigation, Tooling und hunderte Linkänderungen. Review, Rollback und Fehlerzuordnung wären unnötig schwer.

### Neue Dokumentationsplattform

Verworfen. Das Problem ist die Informationsarchitektur, nicht das Markdown-Rendering. Eine neue Plattform erhöht Abhängigkeiten und Ownership, ohne die Autoritäts- und Archivgrenzen automatisch zu lösen.

### Verschachtelte Pfade unverändert ins GitHub Wiki kopieren

Nach der Live-Abnahme verworfen. GitHub liefert diese Pfade als Raw-Inhalte aus; ein erfolgreicher Git-Push erzeugt deshalb noch keine nutzbare Wiki-Seite.

### Vollständigen Seitenkatalog auf der Wiki-Startseite anzeigen

Verworfen. Mehr als 200 gleichrangige Links verschieben das Orientierungsproblem nur auf die Startseite. Aufgabenpfade und Bereichsindizes reduzieren die Auswahl, ohne Inhalte zu verstecken.

### Nur einen besseren `docs/README.md` schreiben

Verworfen. Ein einmalig guter Index driftet erneut, solange Wiki-Sync, Bereichsgrenzen, ADR-Parität und Linkintegrität nicht automatisiert abgesichert sind.

## Risks / Trade-offs

- **Viele Linkänderungen in PR 4:** PR 2 liefert vorher die vollständige Zuordnung, PR 3 aktiviert den Gate, und `git mv` hält Dateihistorie nachvollziehbar.
- **Historische Links bleiben teilweise defekt:** Historische Bestände werden bewusst nicht massenhaft geändert. Der aktuelle Gültigkeitsbereich des Checkers wird dokumentiert.
- **Positivliste kann neue aktuelle Bereiche vergessen:** `check:docs` prüft Bereichsindex und Wiki-Publikationsvertrag gemeinsam.
- **Vier PRs benötigen disziplinierte Reihenfolge:** Jeder PR besitzt klare Exit-Kriterien und wird erst nach Merge des Vorgängers gestartet.
- **Neue Parser-Dev-Dependencies:** Es werden bestehende, bereits indirekt verwendete Standardbausteine explizit gemacht; Lizenz, Version und Lockfile-Diff werden im PR geprüft.
- **Flache Slugs verlieren die sichtbare Ordnerhierarchie:** Aufgabenpfade, Bereichsindizes und der Herkunftshinweis bewahren den Kontext; deterministische Bereichspräfixe verhindern Namenskollisionen.
- **Transformierte Links können vom Repository-Markdown abweichen:** Die Transformation bleibt rein abgeleitet und wird mit Fixtures für relative Links, Anker, Assets und nicht publizierte Ziele geprüft.
- **GitHub-Wiki-Verhalten kann sich ändern:** Ein Live-Nachweis prüft nach dem Merge gerenderte Einstiege und verbietet Raw-Redirects für Markdown-Seiten.

## Validation Strategy

- OpenSpec: `/opt/homebrew/bin/openspec validate restructure-local-project-documentation --strict`
- Dokumentstruktur: `pnpm check:docs` ab PR 3
- Repo-Regeln: `pnpm check:file-placement`
- Rollout-Aussagen: `pnpm check:rollout-docs`
- Scripts: `pnpm exec tsc -p tsconfig.scripts.json --noEmit`
- fokussierte Tests: das Nx-/Vitest-Target für die neuen `scripts/ci/check-documentation*.test.ts`-Dateien
- Format/Diff: `git diff --check`

## Approval and Exit

Die vier geplanten Folge-PRs dürfen erst nach Review und Freigabe dieses OpenSpec-Changes umgesetzt werden. Der Change ist erst abschlussfähig, wenn diese vier PRs und der aus der Live-Abnahme abgeleitete Korrektur-PR gemergt sind, die finale Struktur auf `main` den Dokumentations-Gate besteht und die Wiki-Publikation ausschließlich die freigegebene aktuelle Wissensbasis als gerenderte, aufgabenorientiert navigierbare Seiten enthält.
