# Design

## Context

Die bestehende IAM-Oberfläche trennt bereits Rollen, Gruppen, Benutzer und ein Transparenz-Cockpit. Für operative Rechtevergabe fehlt jedoch noch eine fachlich verständliche Arbeitsoberfläche, die Berechtigungen nicht nur als technische Permission-Keys, sondern entlang fachlicher Ressourcentypen und Scopes modelliert.

Der gewünschte Umfang umfasst:

- Export als eigenständiges Recht pro Ressource
- übertragbaren Datensatzbesitz
- Ownership als Regelmodell dafür, was mit "eigenen" Daten passieren darf
- Ownership-Übersteuerung ausschließlich durch Administratoren
- sofort wirksame Besitzübertragung ohne zusätzlichen Freigabeschritt
- Geltungsbereiche über:
  - Module
  - Datentypen
  - räumliche Kategorien
  - inhaltliche Kategorien
  - Organisationen
  - Instanzen

Die Lösung muss sich in die bestehende Admin-Informationsarchitektur einfügen, neue UI-Bausteine auf `shadcn/ui` aufbauen und dieselben serverseitigen Autorisierungsgrundlagen für operative Prüfungen, Vorschau und Szenario-Tests verwenden.

## Goals / Non-Goals

- Goals:
  - Rollenverwaltung als primären Einstieg für Rechtepflege definieren
  - eine verständliche Rechte-Matrix für CRUD-, Export- und Scope-Entscheidungen spezifizieren
  - Ownership als separates, fachlich lesbares Regelmodell definieren
  - den dafür notwendigen IAM-Contract für Scope-, Ownership- und Explainability-Daten explizit festlegen
  - UI-seitige Zustände für erlaubte, eingeschränkte und besitzabhängige Aktionen vereinheitlichen
  - die bestehenden Admin-Seiten und das IAM-Cockpit ergänzen statt ein Parallelmodul einzuführen
- Non-Goals:
  - keine abschließende Datenbank- oder API-Migration in diesem Change
  - keine neue Policy-Engine außerhalb der bestehenden IAM-Architektur
  - keine vollständige Modellierung aller möglichen ABAC-Sonderfälle
  - keine Implementation eines generischen Policy-Builders mit frei formulierbaren Regeln in v1

## Decisions

- Decision: Rechteverwaltung bleibt in `/admin/roles` verankert.
  - Rationale: Rollen sind der fachlich stabile Einstiegspunkt. Ein eigener Top-Level-Bereich `Permissions` würde das bestehende Admin-Modell fragmentieren.

- Decision: Die Rollen-Detailansicht wird zum zentralen Arbeitsbereich.
  - Rationale: Bestehende Rollenliste kann erhalten bleiben; die Detailbearbeitung ergänzt die vorhandene Struktur mit Tabs und Detailpanels.

- Decision: Berechtigungen werden primär als fachliche Matrix dargestellt.
  - Rationale: Anwender denken in "Inhalte lesen/bearbeiten/exportieren" statt in flachen Permission-IDs.

- Decision: Export bleibt ein eigenständiges Recht pro Ressource.
  - Rationale: Export ist fachlich und sicherheitstechnisch eigenständig und darf nicht implizit aus `read` abgeleitet werden.

- Decision: Ownership wird als separates Regelmodell neben CRUD/Export geführt.
  - Rationale: Besitz beschreibt nicht nur einzelne Aktionen, sondern Entscheidungshoheit über "eigene" Daten und muss deshalb sichtbar von Standardrechten getrennt bleiben.

- Decision: Ownership ist übertragbar.
  - Rationale: Fachliche Übergaben, Stellvertretung und organisatorische Wechsel müssen ohne Datenmigration oder Rollentausch möglich sein.

- Decision: Besitzübertragungen wirken sofort.
  - Rationale: Übergaben sollen operativ einfach und ohne zusätzlichen Governance-Wartezustand funktionieren; ein Freigabeschritt würde die erste Version unnötig verkomplizieren. Sofortwirkung setzt aber transaktionale Persistenz, sofortige Re-Evaluierung effektiver Rechte, Invalidation betroffener Permission-Snapshots und Audit-Evidenz voraus.

- Decision: Ownership-Overrides werden als separates, eng begrenztes Privileg modelliert.
  - Rationale: Ownership schützt fachliche Verantwortung und darf nicht pauschal aus allgemeiner Administration folgen. Override-Fähigkeit muss als eigener Capability-Typ mit Least-Privilege-, Audit- und Self-Override-Schutz geführt werden.

- Decision: Scope-Dimensionen werden explizit visualisiert.
  - Rationale: Rechte entstehen nicht nur aus Aktion und Ressource, sondern aus Modul-, Kategorie-, Organisations- und Instanzkontext.

- Decision: Rechtepflege und Ownership-Transfers bleiben standardmäßig innerhalb derselben `instanceId` und zulässiger Organisationsgrenzen.
  - Rationale: Instanz- und Organisationsgrenzen sind sicherheits- und governance-relevante Grenzen. Cross-Instance- und unzulässige Cross-Org-Fälle würden den Scope unnötig erweitern und werden nicht in v1 generalisiert.

- Decision: Vorschau, Szenario-Prüfung und operative Autorisierung nutzen dieselben serverseitigen Entscheidungsfelder.
  - Rationale: So werden Drift zwischen UI-Vorschau und tatsächlicher Durchsetzung minimiert und Explainability auf denselben reason codes aufgebaut.

- Decision: UI zeigt nur allowlist-basierte Konflikt- und Reason-Codes.
  - Rationale: Die Oberfläche soll nachvollziehbar sein, aber keine Rohdiagnosen, fremden Identitätsdetails oder interne Policy-Strukturen preisgeben.

- Decision: Die Starttaxonomie ist eine kanonische Menge stabiler IDs im IAM-Contract; sichtbare UI-Bezeichnungen bleiben lokalisiert.
  - Rationale: Damit werden Headless- und Plugin-Fähigkeit gewahrt, während die UI weiterhin mit übersetzten Fachbegriffen statt internen Slugs arbeitet.

- Decision: Neue Bausteine nutzen `shadcn/ui`.
  - Rationale: Das entspricht den Projektregeln und hält visuelle und semantische Konsistenz mit bestehenden Admin-Flächen.

## Initial Taxonomy Proposal

Für die erste Version wird eine bewusst begrenzte, aber fachlich tragfähige Taxonomie vorgeschlagen.

### Module

- `content`
- `iam`
- `interfaces`
- `legal`
- `organizations`

Begründung:

- `content` deckt redaktionelle Kernarbeit ab und ist das wichtigste Fachmodul für die erste sichtbare Rechteintegration.
- `iam` bündelt Benutzer-, Rollen-, Gruppen- und Governance-nahe Verwaltungsfunktionen.
- `interfaces` bildet technische Anbindungen und deren Konfiguration ab.
- `legal` deckt Rechtstexte, Akzeptanzverwaltung und rechtlich sensible Redaktionsobjekte ab.
- `organizations` bildet Organisationsstruktur, Memberships und Kontextsteuerung ab.

### Datentypen

Für Modul `content`:

- `generic_content`
- `news`
- `event`
- `poi`
- `service`
- `construction_site`
- `job`

Für Modul `iam`:

- `user`
- `role`
- `group`
- `permission_bundle`

Für Modul `legal`:

- `legal_text`
- `legal_acceptance`

Für Modul `interfaces`:

- `interface_configuration`
- `interface_connection`

Für Modul `organizations`:

- `organization`
- `organization_membership`

Begründung:

- Die Taxonomie orientiert sich an bereits sichtbaren oder absehbaren Verwaltungs- und Inhaltsobjekten im Projektkontext.
- Sie ist klein genug für eine erste Rollenmatrix, aber groß genug, um die Scope-Architektur nicht nur auf ein einzelnes Content-Beispiel zu verengen.
- `permission_bundle` bleibt eine technische Start-ID im Contract. Ob daraus später ein eigener sichtbarer Fachbegriff wird, ist nicht Teil dieses Changes.

## Proposed UI Architecture

### Rollenverwaltung

`/admin/roles` bleibt die Übersichtsseite und wird um einen Detailarbeitsbereich erweitert:

- Rollenliste mit Suche, Sortierung und Status
- Detailpanel oder Detailroute für die gewählte Rolle
- Tabs:
  - `Allgemein`
  - `Berechtigungen`
  - `Zuweisungen`
  - `Vorschau`

### Berechtigungsarbeitsbereich

Der Tab `Berechtigungen` besteht aus vier Zonen:

1. Kontextfilter

- Instanz
- Organisation
- Modul
- Datentyp
- räumliche Kategorie
- inhaltliche Kategorie

1. Rechte-Matrix

- Zeilen: Ressourcentypen oder fachliche Datentypen
- Spalten:
  - `Lesen`
  - `Erstellen`
  - `Bearbeiten`
  - `Löschen`
  - `Exportieren`
- Die Matrix wird semantisch als Tabelle mit klaren Zeilen- und Spaltenbezügen spezifiziert; auf kleinen Viewports wird sie in ein alternatives Karten- oder Akkordeonmuster überführt.

1. Scope-Panel pro Matrixeintrag

- gesamte Instanz
- ausgewählte Module
- ausgewählte Datentypen
- ausgewählte Organisationen
- ausgewählte räumliche Kategorien
- ausgewählte inhaltliche Kategorien
- ausgewählte Datentypen
- aktive Einschränkungen werden auch in eingeklapptem Zustand als zusammenfassende Chips oder Kurztexte sichtbar gehalten

1. Ownership-Regeln

- Datensatz hat Besitzer
- Besitz kann übertragen werden
- Besitzer entscheidet über zulässige Aktionen auf eigenen Daten
- Übersteuerung nur durch Administratoren

### Vorschau

Der Tab `Vorschau` bietet:

- lesbare Zusammenfassung "Diese Rolle kann"
- lesbare Zusammenfassung "Diese Rolle kann nicht"
- Szenario-Prüfung für Aktion, Ressource und Scope
- Begründungen für Allow- und Deny-Entscheidungen
- verpflichtender Änderungsreview vor dem Speichern mit Diff neu hinzugekommener oder entfallender Rechte und betroffener Zuweisungen

### Fach-UI-Integration

Fachseiten wie Content müssen dieselbe Logik sichtbar verwenden:

- Aktionen werden nicht nur nach Server-`403` behandelt
- UI kennt Zustände:
  - erlaubt
  - deaktiviert mit Begründung
  - verborgen, wenn fachlich irrelevant
  - blockiert durch Ownership
- die Zustände werden als normierte Zustandsmatrix definiert und nicht nur über Farbe, Icons oder Tooltips vermittelt

## Required Components

- `RoleDetailTabs`
- `RolePermissionMatrix`
- `PermissionScopePanel`
- `OwnershipRulesCard`
- `RoleAssignmentImpactCard`
- `RolePreviewPanel`
- `PermissionScenarioTester`
- `InlineAuthorizationHint`
- `OwnershipTransferDialog`
- `PermissionConflictBadge`

Alle neuen Komponenten bauen auf `shadcn/ui`-Primitives wie `Tabs`, `Card`, `Table`, `Badge`, `Alert`, `Dialog`, `Popover`, `Tooltip`, `Checkbox`, `Select` und `Command` auf.

## Content- und Terminologieprinzipien

- Der IAM-Contract verwendet stabile technische IDs wie `content` oder `permission_bundle`.
- Die UI verwendet für sichtbare Labels, Hilfetexte und Statusmeldungen ausschließlich lokalisierte Fachbegriffe über Translation-Keys in `de` und `en`.
- Für v1 werden die Begriffe `Besitz`, `Besitzregel`, `Geltungsbereich` und `Übersteuerung` als primäre deutsche UI-Sprache verwendet; `Ownership`, `Scope` und `Override` bleiben technische Begriffe in Spezifikation und Contract.

## Risks / Trade-offs

- Mehrdimensionale Scopes können schnell überladen wirken.
  - Mitigation: progressive disclosure, Standardfälle zuerst, erweiterte Bereiche einklappbar.

- Ownership und Rollenrechte können für Nutzer semantisch verschwimmen.
  - Mitigation: separater Ownership-Bereich mit eigener Sprache, Warnhinweisen und Vorschau.

- Fach-UI kann inkonsistent werden, wenn nur Admin-Flächen angepasst werden.
  - Mitigation: die Spezifikation verlangt sichtbare Aktionszustände auch in betroffenen Fachmodulen.

- Ein zu freies Policy-Modell würde Implementation und Usability entkoppeln.
  - Mitigation: v1 bleibt strukturiert und formularbasiert, kein generischer Rule-Builder.

- Vorschau und operative Entscheidung können auseinanderlaufen, wenn unterschiedliche Datenquellen verwendet werden.
  - Mitigation: beide Wege nutzen denselben serverseitigen Entscheidungs-Contract und dieselben allowlist-basierten reason codes.

- Ownership-Transfers und Overrides sind missbrauchsanfällig.
  - Mitigation: separater Override-Capability-Typ, Audit-Evidenz, kein Self-Override, zulässige Instanz- und Organisationsgrenzen.

## Migration Plan

1. Rollen-UI um Detailarbeitsbereich und Permission-Matrix erweitern
2. IAM-Contract für Scope-, Ownership- und Explainability-Felder als gemeinsame Grundlage für UI, Vorschau und Szenario-Prüfung festlegen
3. Ownership-Modell und Transfer-Interaktionen mit Audit-, Boundary- und Override-Guardrails spezifizieren und danach technisch anbinden
4. Fach-UI-Aktionszustände für priorisierte Module angleichen
5. Dokumentation und arc42-Referenzen aktualisieren

## Resolved Decisions

- Initiale Modul-Taxonomie:
  - `content`
  - `iam`
  - `interfaces`
  - `legal`
  - `organizations`
- Initiale Datentyp-Taxonomie:
  - Content: `generic_content`, `news`, `event`, `poi`, `service`, `construction_site`, `job`
  - IAM: `user`, `role`, `group`, `permission_bundle`
  - Legal: `legal_text`, `legal_acceptance`
  - Interfaces: `interface_configuration`, `interface_connection`
  - Organizations: `organization`, `organization_membership`
- Ownership-Overrides sind ein separates, eng begrenztes Privileg.
- Besitzübertragungen sind sofort wirksam.
- Besitzübertragungen bleiben auf zulässige Instanz- und Organisationsgrenzen beschränkt.
- Vorschau, Szenario-Prüfung und operative Autorisierung nutzen denselben serverseitigen Entscheidungs-Contract.
