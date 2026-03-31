# Design

## Context

Die heutige IAM-UI verfügt bereits über drei relevante Bausteine:

- eine Rollenverwaltung unter `/admin/roles` mit Tabelle, Expand-Ansicht, Rollenmetadaten sowie Create/Edit/Delete-Flows
- ein IAM-Cockpit unter `/admin/iam` mit Tabs für Rechteübersicht, Governance und DSR
- vorhandene Authorize- und Permissions-Contracts mit strukturierten Feldern wie `action`, `resourceType`, `resourceId`, `organizationId`, `effect`, `scope`, `sourceRoleIds`, `sourceGroupIds`, Diagnosefeldern und allowlist-basierten Reason-Codes

Die größte Lücke liegt nicht in einer fehlenden Policy-Engine, sondern in der Bedienbarkeit: Rollenrechte sind in der Rollenansicht heute primär als rohe `permissionKey`-Liste sichtbar, während technische Prüffunktionen in einer anderen Ansicht liegen. Der Change adressiert deshalb die UI- und Integrationslücke auf Basis vorhandener Daten und vermeidet bewusst ein neues Ownership-, Transfer- oder Override-Modell, das vom heutigen Code- und Spec-Stand nicht getragen wird.

## Goals / Non-Goals

- Goals:
  - die bestehende Rollenverwaltung zu einem klareren Berechtigungsarbeitsbereich weiterentwickeln
  - vorhandene Rollen-Permissions fachlich lesbarer darstellen, ohne die Kompatibilität zu den aktuellen Contracts zu brechen
  - Rollenverwaltung und vorhandene IAM-Prüffunktionen besser miteinander verzahnen
  - Read-only- und Fehlzustände für System- und extern verwaltete Rollen normieren
  - Anforderungen für priorisierte Fachseiten wie Content so formulieren, dass sie auf dem bestehenden Autorisierungsmodell aufsetzen
- Non-Goals:
  - kein neues Ownership-Modell für Datensatzbesitz
  - keine neue Scope-Taxonomie mit verpflichtenden Feldern wie `module`, `dataType`, `spatialCategory` oder `contentCategory`
  - kein generischer Policy-Builder
  - keine Abkehr vom bestehenden `permissionKey`-/Compatibility-Modell im selben Schritt
  - keine Einführung eines separaten Top-Level-Admin-Moduls neben `/admin/roles` und `/admin/iam`

## Decisions

- Decision: Rechteverwaltung bleibt in `/admin/roles` verankert und erweitert die vorhandene Seite inkrementell.
  - Rationale: Die existierende Rollenverwaltung ist bereits produktiv anschlussfähig. Ein kompletter Informationsarchitektur-Umbau würde unnötig viel Bewegung erzeugen.

- Decision: Die Rollenliste bleibt Einstiegspunkt; Details werden als vertiefter Arbeitsbereich innerhalb derselben Seite oder desselben Flows spezifiziert.
  - Rationale: Das passt zum aktuellen Tabellen-/Expand-Muster und erlaubt eine iterative Umsetzung.

- Decision: Die UI nutzt vorhandene Rollen- und Permissions-Daten weiter und ergänzt sie um fachliche Lesbarkeit statt um ein neues Datenmodell.
  - Rationale: Der aktuelle Contract und das Rollen-API liefern schon genügend Informationen für eine erste verständlichere Darstellung.

- Decision: Technische `permissionKey`-Werte bleiben unterstützte Referenz, sind aber nicht mehr die primäre UI-Sprache.
  - Rationale: Administratoren benötigen fachliche Lesbarkeit, technische Details müssen für Debugging und Migration aber weiterhin zugänglich bleiben.

- Decision: Vorschau und Szenario-Prüfung bauen auf den bereits vorhandenen IAM-Cockpit- und Authorize-Pfaden auf.
  - Rationale: Die Prüffunktion existiert bereits. Der Change soll sie in die Rechteverwaltung integrieren, nicht duplizieren.

- Decision: Read-only-Regeln für System- und extern verwaltete Rollen werden explizit als eigener UI-Zustand behandelt.
  - Rationale: Dieser Zustand ist im aktuellen Code bereits vorhanden und muss spezifikativ klarer beschrieben werden.

- Decision: Neue oder überarbeitete UI-Bausteine nutzen `shadcn/ui` und bestehende Admin-Patterns.
  - Rationale: Das entspricht den Projektregeln und minimiert Design- und Accessibility-Drift.

## Proposed UI Architecture

### Rollenverwaltung

`/admin/roles` bleibt die zentrale Seite und umfasst weiterhin:

- Rollenliste mit Suche, Sortierung und Status
- Rollenmetadaten wie `externalRoleName`, `managedBy`, `roleLevel`, Sync-Status und Mitgliederzahl
- Aktionen zum Anlegen, Bearbeiten, Löschen und Reconcile

Der Berechtigungsarbeitsbereich wird inkrementell innerhalb der vorhandenen Seite ergänzt:

- ausgewählte oder expandierte Rolle als Detailkontext
- fachlich lesbare Berechtigungsdarstellung statt ausschließlicher Rohlisten
- technischer Detailbereich für `permissionKey`, Herkunft oder Debug-Hinweise nur ergänzend
- sichtbare Read-only-Hinweise für nicht editierbare Rollen
- Einstieg in bestehende Prüffunktionen, statt einer zweiten unabhängigen Vorschauimplementierung

### Berechtigungsdarstellung

Die UI priorisiert eine fachlich lesbare Gruppierung vorhandener Rechte. Je Berechtigung oder Berechtigungsgruppe werden mindestens sichtbar:

- fachliche Bezeichnung
- technische Referenz bei Bedarf
- Lesestatus oder Bearbeitbarkeit
- erkennbare Read-only- oder Konfliktzustände

Die erste Version muss keine vollwertige Matrix mit neuem Scope-Modell erzwingen. Zulässig sind auch:

- gruppierte Listen
- Abschnittskarten
- hybride Tabellen-/Detaildarstellungen

Entscheidend ist, dass die Darstellung aus heutiger Sicht auf dem bestehenden Rollen- und Permission-Modell aufbaut und nicht von zukünftigen Ownership- oder ABAC-Erweiterungen abhängig gemacht wird.

### Prüfintegration

Statt eines komplett neuen Vorschau-Backends nutzt die Rollenverwaltung die vorhandenen IAM-Prüfpfade:

- Verlinkung oder eingebetteter Einstieg zur bestehenden Szenario-Prüfung
- Wiederverwendung vorhandener strukturierter Diagnosefelder und Reason-Codes
- klare Trennung zwischen:
  - Rollenmetadaten
  - Rollen-Permissions
  - operativer Autorisierungsprüfung

## Fach-UI-Integration

Priorisierte Fachseiten wie Content sollen nicht auf ein neues Ownership-Modell warten. Der Change spezifiziert stattdessen:

- konsistente Behandlung von serverseitigem `forbidden`
- verständliche UI-Zustände für deaktivierte oder nicht erlaubte Aktionen
- optionale Wiederverwendung vorhandener Diagnose- und Rechteinformationen, sofern verfügbar

## Contract Reuse

Der Change setzt auf den heute vorhandenen Contract-Feldern auf:

- Rollen-Permissions und Rollen-Metadaten aus den bestehenden Rollen-APIs
- effektive Berechtigungen mit `action`, `resourceType`, optional `resourceId`, optional `organizationId`, optional `effect`, optional `scope`, `sourceRoleIds` und `sourceGroupIds`
- Authorize-Antworten mit `allowed`, `reason`, `diagnostics`, optional `denialCode` und `provenance`

Neue verpflichtende Ownership-, Transfer- oder Override-Felder werden in diesem Change nicht eingeführt.

## Arc42-Referenzen

Die Architekturwirkung dieses Changes ist gegen die folgenden arc42-Abschnitte unter `docs/architecture/` zu prüfen und fortzuschreiben:

- `04-solution-strategy.md`
  - Rechteverwaltung bleibt ein inkrementeller Ausbau der bestehenden Admin-UI statt eines neuen Top-Level-Moduls.
- `05-building-block-view.md`
  - Der Rollenarbeitsbereich bleibt in `/admin/roles` verankert und nutzt bestehende Rollen-, Permissions- und IAM-Cockpit-Bausteine.
- `06-runtime-view.md`
  - Relevante Laufzeitszenarien sind Rollenansicht → Prüfeinstieg, Rollenänderung → serverseitige Verweigerung sowie Fach-UI-Aktion → verständliche Forbidden-Rückmeldung.
- `08-cross-cutting-concepts.md`
  - Betroffen sind i18n, Accessibility, Read-only-States, Fehlerkommunikation und Explainability.
- `10-quality-requirements.md`
  - Der Change verlangt verifizierbare Anforderungen für Unit-, Integrations-, E2E-, Accessibility-, Responsive- und i18n-Prüfungen.

Wenn die spätere Implementierung diese Dateien nicht ändert, muss die Abweichung im Umsetzungs-PR begründet werden.

## Terminologie

- `fachliche Berechtigungsanzeige`
  - Lokalisierte, für Administratoren verständliche Bezeichnung oder Gruppierung einer Berechtigung. Sie ist die primäre Sprache der UI.
- `technische Referenz`
  - Ergänzende Anzeige eines bestehenden technischen Werts wie `permissionKey`, `action` oder `resourceType` für Debugging, Support oder Migration.
- `Read-only`
  - Sichtbarer Zustand für Rollen oder Aktionen, die aufgrund von `isSystemRole`, `managedBy != studio` oder serverseitigen Regeln nicht bearbeitet werden dürfen.
- `deaktiviert`
  - Temporär nicht ausführbarer Zustand innerhalb einer grundsätzlich editierbaren Oberfläche, etwa wegen fehlender Eingaben oder unvollständiger Auswahl.
- `serverseitig verweigert`
  - Ergebnis einer tatsächlich ausgeführten Aktion oder Prüfung, bei der der Server einen strukturierten Denial-, Konflikt- oder Forbidden-Kontext zurückliefert.
- `Reason-Code`
  - Stable, allowlist-basierte Kennung zur verständlichen Begründung von Entscheidungen oder Verweigerungen.
- `Diagnosefeld`
  - Strukturiertes Zusatzfeld aus Authorize- oder Permissions-Antworten, das Admin- und Fach-UI bei Explainability unterstützt, ohne interne Policy-Details offenzulegen.

## Risks / Trade-offs

- Eine inkrementelle Weiterentwicklung kann visuell weniger "neu" wirken als ein vollständiger Redesign-Ansatz.
  - Mitigation: klare fachliche Gruppierung, bessere Begrifflichkeit und stärkerer Fokus auf Prüfeinstiege.

- Die bestehende Datenstruktur kann fachliche Darstellung nur begrenzt unterstützen.
  - Mitigation: Der Change erlaubt fachliche Mapping-Schichten in der UI, ohne sofort einen Backend-Umbau zu verlangen.

- Rollenverwaltung und IAM-Cockpit können weiterhin getrennt wirken.
  - Mitigation: Der Change schreibt die Verknüpfung der vorhandenen Prüffunktionen mit der Rollenverwaltung verbindlich fest.

- Fachseiten könnten weiterhin bei generischen `403`-Zuständen stehen bleiben.
  - Mitigation: Der Change verlangt konsistentere Zustände in priorisierten Fach-UI-Flächen, ohne nicht vorhandene Ownership-Semantik vorzutäuschen.
