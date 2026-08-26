## ADDED Requirements

### Requirement: Lokale Projektdokumentation besitzt eine eindeutige Informationsarchitektur

Die lokale Projektdokumentation MUST aktuelle Architektur, Entscheidungen, Entwicklung, Betrieb, Referenz und Governance über eindeutig abgegrenzte Bereiche organisieren. `docs/README.md` MUST als einziger übergreifender Einstieg die führenden Bereichsindizes klickbar verlinken und ihre Autoritätsgrenzen erklären.

#### Scenario: Teammitglied sucht die führende Quelle

- **WHEN** ein Teammitglied Architektur-, Entwicklungs-, Betriebs-, Referenz- oder Governance-Wissen sucht
- **THEN** führt `docs/README.md` über einen klickbaren rollen- oder zweckbezogenen Pfad zum zuständigen Bereichsindex
- **AND** benennt dieser Bereich seine Zielgruppe, Autorität, Ownership und ereignisbezogenen Pflege-Trigger

#### Scenario: Workspace-Struktur verändert sich

- **WHEN** Nx-Projekte, Packages oder Apps hinzugefügt, entfernt oder umbenannt werden
- **THEN** enthält der Dokumentationseinstieg keine unkontrolliert veraltende manuelle Projektanzahl
- **AND** werden notwendige Bestandsangaben automatisiert abgeleitet oder auf stabile Architekturquellen verwiesen

### Requirement: Aktuelle Wissensbasis und historische Artefakte bleiben getrennt

Das Repository MUST aktuelle lokale Projektdokumentation von generierten, historischen, evidenzbezogenen und extern angebundenen Artefakten unterscheiden. Historische oder generierte Inhalte MAY versioniert bleiben, MUST aber als nicht normativ erkennbar sein und dürfen nicht wie aktuelle Bedien-, Entwicklungs- oder Architekturanleitungen navigiert werden.

#### Scenario: Zeitgebundener Nachweis bleibt erhalten

- **WHEN** ein Report, eine PR-Unterlage, ein Staging-Zwischenstand, ein Changelog-Eintrag oder ein historischer Plan aus Nachweisgründen im Repository verbleibt
- **THEN** bleibt das Artefakt außerhalb der aktuellen Navigations- und Wiki-Publikationsfläche
- **AND** verweist aktuelle Dokumentation nicht auf das Artefakt als führende normative Quelle

#### Scenario: Legacy-ADR überschneidet sich mit kanonischer ADR-Serie

- **WHEN** eine Datei unter `docs/architecture/decisions/` dieselbe Nummer oder Entscheidung wie eine ADR unter `docs/adr/` besitzt
- **THEN** ist ausschließlich `docs/adr/` als kanonischer ADR-Bestand navigierbar
- **AND** wird eine weiterhin gültige einzigartige Aussage vor Entfernung oder weiterer Historisierung in eine kanonische ADR übernommen

### Requirement: Wiki veröffentlicht nur die freigegebene aktuelle Wissensbasis

Der Wiki-Sync MUST eine versionierte, überprüfbare Positivliste aktueller lokaler Projektdokumentation verwenden und MUST denselben kanonischen Einstieg sowie dieselben ADR-Quellen wie das Repository anbieten. Workflow und Dokumentationscheck MUST denselben maschinenlesbaren Publikationsvertrag konsumieren. Der Sync MUST historische, generierte, PR-/Staging-bezogene und externe Anwenderdokumentationsbestände von der lokalen Wiki-Publikation ausschließen.

#### Scenario: Wiki wird aus Studio-Main synchronisiert

- **WHEN** ein Push nach `main` den Wiki-Sync ausführt
- **THEN** veröffentlicht der Workflow ausschließlich freigegebene aktuelle Dokumentationsbereiche
- **AND** verweisen Home und Sidebar auf `docs/README.md`, arc42 und `docs/adr/README.md`
- **AND** werden `docs/changelog/`, `docs/reports/`, `docs/pr/`, `docs/staging/`, `docs/superpowers/`, `docs/user-documentation/` und `docs/architecture/decisions/` nicht als lokale Wissensbasis publiziert

#### Scenario: Publikationsumfang wird geändert

- **WHEN** ein aktueller Dokumentationsbereich zur Wiki-Publikation hinzugefügt oder daraus entfernt wird
- **THEN** wird die Änderung im versionierten Publikationsmanifest vorgenommen
- **AND** prüfen Workflow-Vertrag und `pnpm check:docs` dieselbe Manifestdatei

### Requirement: Strukturelle Dokumentationsintegrität wird automatisiert geprüft

Das Repository MUST einen lokal reproduzierbaren, blockierenden Dokumentationscheck bereitstellen. Der Check MUST aktuelle relative Links, Erreichbarkeit über Bereichsindizes, kanonische ADR-Indexparität und die Wiki-Publikationsgrenzen prüfen und verständliche Pfad- sowie Zeilenhinweise ausgeben.

#### Scenario: Aktuelle Dokumentation verweist auf fehlendes Ziel

- **WHEN** eine aktuelle Markdown-Datei einen relativen Link auf eine nicht vorhandene Datei oder ein nicht vorhandenes Verzeichnis enthält
- **THEN** schlägt `pnpm check:docs` fehl
- **AND** nennt die Ausgabe Quelldatei, Zeile und fehlendes Ziel

#### Scenario: Neue aktuelle Seite ist nicht erreichbar

- **WHEN** eine aktuelle Markdown-Seite angelegt wird, aber weder direkt noch über einen Unterindex aus dem zuständigen Bereichsindex erreichbar ist
- **THEN** schlägt `pnpm check:docs` fehl
- **AND** fordert die Ausgabe die Einordnung in die kanonische Navigation

#### Scenario: ADR-Index driftet

- **WHEN** eine kanonische ADR-Datei und der Index unter `docs/adr/README.md` nicht übereinstimmen
- **THEN** schlägt `pnpm check:docs` fehl
- **AND** unterscheidet die Ausgabe zwischen fehlender Datei und fehlendem Indexeintrag

#### Scenario: Historischer Link ist defekt

- **WHEN** ein relativer Link ausschließlich in einem ausdrücklich historischen oder evidenzbezogenen Artefakt nicht mehr auflösbar ist
- **THEN** blockiert dieser Link den aktuellen Dokumentationscheck nicht
- **AND** bleibt die Ausschlussgrenze des Checks dokumentiert

### Requirement: Externe Anwenderdokumentation bleibt ein unabhängiger Vertrag

Die Neuordnung der lokalen Projektdokumentation MUST `docs/user-documentation/` als separaten Integrationsbereich behandeln und MUST Inhalte, Seitenkatalog, additive Synchronisation sowie unabhängige Publikation der externen Anwenderdokumentation unverändert lassen.

#### Scenario: Lokale Dokumentationsstruktur wird migriert

- **WHEN** aktuelle Studio-Dokumente zwischen Architektur-, Entwicklungs-, Betriebs- und Referenzbereichen verschoben werden
- **THEN** bleiben `docs/user-documentation/page-catalog.json`, Startermaterial und der Cross-Repository-Sync semantisch unverändert
- **AND** wird die externe Anwenderdokumentation nicht in die lokale Wiki-Navigation aufgenommen

### Requirement: Dokumentationsmigration erfolgt in überprüfbaren Delivery-Stufen

Die strukturelle Neuordnung MUST Publikationsoberfläche, Informationsarchitektur, Integritäts-Gate und Inhaltsmigration in getrennten sequenziellen Delivery-Stufen umsetzen. Jede Stufe MUST einen eigenständig prüfbaren Scope, eine Rollback-Grenze und grüne Repository-Gates besitzen, bevor die nächste Stufe beginnt.

#### Scenario: Inhaltsmigration beginnt

- **WHEN** aktuelle Dokumente aus `docs/guides/` oder losen Root-Pfaden verschoben werden
- **THEN** sind die Zielindizes bereits gemergt
- **AND** ist der blockierende Dokumentationscheck bereits aktiv
- **AND** liegt für jeden zu verschiebenden aktuellen Pfad eine überprüfte Zielzuordnung vor

#### Scenario: Folge-PR wird vorbereitet

- **WHEN** eine Delivery-Stufe gemergt wurde und die nächste Stufe beginnen soll
- **THEN** basiert der Folge-PR auf dem aktualisierten `origin/main`
- **AND** werden Bestandsdrift, offene Dokumentations-Changes und die Nachweise des Vorgängers erneut geprüft
