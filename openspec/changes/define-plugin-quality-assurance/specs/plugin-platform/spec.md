## ADDED Requirements

### Requirement: QS-01 Reproduzierbare eigenständige Plugin-Prüfung

Alle Studio-Plugins MUST unabhängig vom Repository einen reproduzierbaren, einem konkreten Commit und Policy-Stand zugeordneten QS-Nachweis liefern. Externe Plugins MUST ihre Tests mit deklarierten Abhängigkeiten und expliziten öffentlichen Peer-Artefakten außerhalb des Studio-Verzeichnisbaums ausführen können.

#### Scenario: Fehlende Abhängigkeit im isolierten Consumer

- **WHEN** ein Plugin ein Werkzeug oder Runtime-Paket nur aus einem Studio-Elternverzeichnis auflösen kann
- **THEN** scheitert die isolierte Prüfung
- **AND** zählt ein erfolgreicher Entwicklerlauf im Studio-Baum nicht als CI- oder Freigabenachweis

#### Scenario: Unveränderliche Prüfeingaben

- **WHEN** ein Plugin-Kandidat geprüft wird
- **THEN** werden Plugin-SHA, Policy-/Toolchain-Stand und die verwendeten SDK-/UI-/Host-Artefakte festgehalten
- **AND** ersetzen lokale Links oder bewegliche Branch-Namen diese Identitäten nicht

### Requirement: QS-02 Gemeinsame statische Qualität und Plugin-Grenzen

Die bestehenden Studio-Regeln für Strict Types, Lint, Komplexität, Dependencies, Security und Plugin-Grenzen MUST den gesamten produktiven Plugin-Code und seine öffentlichen Exporte erfassen. Repository-Wechsel MUST NOT einen schwächeren Standard oder einen stillen Pfadausschluss bewirken.

#### Scenario: Quelle außerhalb der Monorepo-Globs

- **WHEN** Plugin-Code unter einer eigenständigen Repository-Wurzel statt `packages/plugin-*` liegt
- **THEN** wird er dennoch mit den anwendbaren Regeln geprüft
- **AND** gilt ein leerer Treffer eines Workspace-Globs nicht als erfolgreiche Boundary- oder Komplexitätsprüfung

#### Scenario: Private Host-Kopplung

- **WHEN** ein Plugin private Host-Pfade, reservierte Action-Namespaces oder duplizierte Basis-Controls verwendet
- **THEN** blockiert der bestehende beziehungsweise um den externen Root erweiterte zuständige Prüfer den betreffenden Verstoß gemäß dem gültigen Regelvertrag
- **AND** werden Advanced-Path- oder Ticket-Ausnahmen nicht aus der Repository-Nähe abgeleitet

### Requirement: QS-03 Verhaltensnachweise und Coverage

Neue Plugins MUST aussagekräftige Tests und mindestens 85 Prozent je Lines, Statements, Functions und Branches besitzen. Zusätzlich MUST die anwendbaren Studio-Regeln für New Code, Coverage-Regression, höhere Floors und begründete Ausnahmen gelten; fehlende Coverage-Berichte MUST scheitern.

#### Scenario: Gesamtquote verschleiert Regression

- **WHEN** die feste Gesamtquote erfüllt ist, aber New Code oder die zulässige Baseline-Regression die Studio-Policy verletzt
- **THEN** wird die Änderung nicht durch die Gesamtquote freigegeben

#### Scenario: Produktiver Pfad fehlt im Report

- **WHEN** produktive Plugin-Quellen oder erforderliche Coverage-Evidenz wegen des externen Pfads aus der Prüfung fehlen
- **THEN** scheitert der Nachweis statt einen grünen oder nicht anwendbaren Status zu melden

### Requirement: QS-04 UI-Qualität und zugängliche Bedienung

Plugins mit UI-Beiträgen MUST Studio-Designsystem, unterstützte Sprachen und den Projektstandard WCAG 2.1 AA berücksichtigen. Relevante Interaktionen, Viewports, Themes, Sprachwechsel und Fehler-/Berechtigungszustände MUST mit angemessenen automatischen und manuellen Nachweisen geprüft werden.

#### Scenario: Neue Auswahl- oder Dialoginteraktion

- **WHEN** ein Plugin ein neues kritisches Auswahl-, Dialog- oder Navigationsmuster einführt
- **THEN** werden Tastatur, Fokus, Labels und Status-/Fehlerkommunikation sowie passende manuelle Gegenproben geprüft
- **AND** reichen Screenshots oder ein isoliert grüner Axe-Lauf nicht als vollständige Abnahme aus

#### Scenario: Dokumentationsänderung ohne UI-Auswirkung

- **WHEN** eine Änderung ausschließlich Dokumentation ohne Laufzeit-/UI-Auswirkung betrifft
- **THEN** darf die nachvollziehbare Klassifizierung den Prüfumfang begrenzen
- **AND** werden Code-, Policy-, Toolchain- oder Dependency-Änderungen nicht unter dieser Ausnahme verborgen

### Requirement: QS-05 Server- und Dateninvarianten

Plugins mit serverseitigen oder persistenten Beiträgen MUST Node-Runtime, serverseitige Validierung/Autorisierung, Instanzisolation und ihre tatsächlichen Daten-/Audit-/Fehlergrenzen nachweisen. Zusätzliche Job-/Import-/Export-Prüfungen MUST am vorhandenen Beitrag orientiert sein.

#### Scenario: Direktaufruf ohne erforderlichen Kontext

- **WHEN** eine API anonym, mit fremder Instanz, deaktiviertem Modul oder unzureichenden Rechten direkt aufgerufen wird
- **THEN** verhindert der reale Host-Pfad den Zugriff beziehungsweise die Mutation
- **AND** ersetzt ein gemockter gültiger Plugin-Kontext diesen Negativnachweis nicht

#### Scenario: Auditfehler oder konkurrierende Revision

- **WHEN** eine persistente Mutation im tatsächlichen Host-Speicherpfad einen Auditfehler oder einen konkurrierenden Versionsstand trifft
- **THEN** weisen disposable Datenbank-/Integrationstests die vereinbarte atomare Rücknahme beziehungsweise den deterministischen Konflikt und anschließenden Readback nach
- **AND** bleiben andere Instanzen und aufbewahrte Daten bei Moduldeaktivierung geschützt

### Requirement: QS-06 Paketbasierte Host-Kompatibilität

Plugin-Kandidaten MUST als gepackte Artefakte über den regulären Manifest-/Katalogpfad in echtem Studio geprüft werden. Plugin-Änderungen, relevante öffentliche Host-Vertragsänderungen und Studio-Dependency-Updates MUST die jeweils erforderlichen Kompatibilitätsnachweise auslösen.

#### Scenario: Host-Vertrag ändert sich ohne Plugin-Commit

- **WHEN** Studio einen vom Referenz-Plugin genutzten SDK-/UI-/Host-Vertrag ändert
- **THEN** wird der Referenz-Kandidat mit dem neuen Host-Stand geprüft
- **AND** darf die fehlende Änderung im Plugin-Repository den Nachweis nicht unterdrücken

#### Scenario: Optionales Paket ist deaktiviert oder entfernt

- **WHEN** das optionale Plugin deaktiviert oder aus der vorgesehenen Auswahl/Installation entfernt wird
- **THEN** ist der zulässige Host-Build-/Start- und Zugriffsstatus belegt
- **AND** werden starre private Host-/Plugin-Abhängigkeiten als Befund behandelt

### Requirement: QS-07 Identität von geprüftem und freigegebenem Artefakt

Paketfreigaben MUST den Plugin-Commit, Name/Version, Digest, kompatiblen Host-/SDK-/UI-Stand und die Gate-/Review-Evidenz nachvollziehbar verbinden. Nur identische geprüfte Paketbytes dürfen veröffentlicht beziehungsweise in Studio übernommen werden.

#### Scenario: Paket wird nach den Tests neu erzeugt

- **WHEN** nach erfolgreicher Prüfung ein anderer Paketinhalt veröffentlicht oder übernommen werden soll
- **THEN** ist die vorherige Artefaktfreigabe ungültig, sofern Byte-Identität nicht nachgewiesen wird
- **AND** wird der neue Inhalt vor einer Freigabe erneut im erforderlichen Scope geprüft

#### Scenario: Paketinstallation und Rollout

- **WHEN** eine freigegebene Plugin-Version als Studio-Dependency übernommen wird
- **THEN** bleiben Registry-Veröffentlichung, Tenant-Aktivierung und Studio-Rollout getrennte Schritte mit den bestehenden Freigaben
- **AND** entsteht kein alternativer Studio-Deploypfad

### Requirement: QS-08 Verbindliche CI-, Review- und Merge-Evidenz

Anwendbare Pflichtprüfungen MUST am exakten finalen HEAD automatisch erfolgreich sein und über wirksame Merge-Regeln geschützt werden. Externe Analysen und fachliche Reviews MUST nach bestehender Studio-Governance bewertet werden; untrusted PR-Code MUST von privilegierten Release-Kontexten getrennt bleiben.

#### Scenario: Prüfung fehlt, ist veraltet oder abgebrochen

- **WHEN** ein erforderlicher Nachweis fehlt, nicht zum Kandidaten gehört oder keinen vollständigen erfolgreichen Abschluss hat
- **THEN** darf daraus kein positiver Gesamt- oder Merge-Status entstehen
- **AND** ersetzen lokale Läufe oder einzelne grüne Teilchecks den fehlenden Nachweis nicht

#### Scenario: Untrusted PR möchte Release-Zugriff

- **WHEN** fremder PR-/Fork-Code ausgeführt wird
- **THEN** erhält dieser Ausführungskontext keine Release-/Organisationsgeheimnisse und keine unbegründeten Schreibrechte
- **AND** bleibt das Veröffentlichen ein getrennter vertrauenswürdiger Vorgang

### Requirement: QS-09 Referenzstatus, Ownership und Policy-Pflege

Die Referenz MUST eine nachvollziehbare Zuordnung der Anforderungen QS-01 bis QS-09 zu tatsächlichen Nachweisen und Lücken besitzen. Die Bezeichnung abgenommene Musterlösung MUST an einen konkreten vollständig geprüften Commit und die gemeinsame Policy gebunden sein.

#### Scenario: Lokale Tests bestehen, automatische Gates fehlen

- **WHEN** lokale Plugin-Tests grün sind, aber anwendbare CI-, Host-, Artefakt- oder Review-Nachweise fehlen
- **THEN** bleibt das Repository Musterkandidat
- **AND** darf der Status nicht als vollständige Musterfreigabe dargestellt werden

#### Scenario: Gemeinsame Policy oder Ausnahme ändert sich

- **WHEN** eine relevante gemeinsame Regel oder eine begründete zeitlich beziehungsweise sachlich begrenzte Ausnahme geändert wird
- **THEN** prüfen Plattform- und Plugin-Owner die Auswirkungen auf die Referenz
- **AND** werden Regeln, Check-Implementierungen oder Review-Agenten nicht ungeprüft je Plugin dupliziert
