# Delta: iam-access-control

## ADDED Requirements

### Requirement: Mehrdimensionale Rechte-Scope-Modellierung

Das System SHALL Berechtigungen für Admin- und Fach-UI nicht nur über Aktion und Ressource, sondern zusätzlich über fachliche Scope-Dimensionen modellieren und auswertbar machen.

#### Scenario: Scope-Dimensionen sind strukturiert beschreibbar

- **WHEN** effektive Berechtigungen oder konfigurierbare Rollenrechte an die UI geliefert werden
- **THEN** können Scope-Informationen mindestens `module`, `dataType`, `spatialCategory`, `contentCategory`, `organizationId` und `instanceId` ausdrücken
- **AND** diese Dimensionen sind ohne clientseitiges Reverse-Engineering nutzbar
- **AND** Instanz- und Organisationsgrenzen bleiben serverseitig autoritativ und dürfen nicht ausschließlich aus UI-Kontext abgeleitet werden

#### Scenario: Erste Version verwendet eine definierte Starttaxonomie

- **WHEN** konfigurierbare Rollenrechte in der ersten Version bereitgestellt werden
- **THEN** unterstützt das System mindestens die Module `content`, `iam`, `interfaces`, `legal` und `organizations`
- **AND** es liefert dazu eine konsistente Startmenge fachlicher Datentypen als stabile technische IDs, die ohne freie Texteingabe in der UI auswählbar sind

#### Scenario: Cross-Instance- und unzulässige Cross-Org-Fälle werden nicht generalisiert

- **WHEN** Rollenrechte, Ownership-Regeln oder Besitzübertragungen außerhalb derselben `instanceId` oder außerhalb zulässiger Organisationsgrenzen angefragt werden
- **THEN** verweigert das System die Konfiguration oder Ausführung strukturiert
- **AND** die Ablehnung bleibt als Konflikttyp für die UI benennbar

#### Scenario: Export bleibt eigenständige Aktion

- **WHEN** eine Ressource exportiert werden soll
- **THEN** wird dies als eigenständige Aktion und Entscheidung behandelt
- **AND** ein vorhandenes Leserecht impliziert kein Exportrecht

### Requirement: Ownership als autorisierungsrelevantes Regelmodell

Das System SHALL Ownership als eigenständiges, übertragbares Regelmodell für Datensätze unterstützen, damit Entscheidungen über "eigene" Daten kontextabhängig ausgewertet werden können.

#### Scenario: Ownership wird als strukturierter Kontext berücksichtigt

- **WHEN** eine Autorisierungsentscheidung für einen besitzfähigen Datensatz getroffen wird
- **THEN** kann der Kontext zwischen aktuellem Nutzer, Besitzer und angefragter Aktion unterscheiden
- **AND** die Entscheidung kann ownership-bedingt erlauben oder verweigern

#### Scenario: Ownership ist übertragbar

- **WHEN** der Besitz eines Datensatzes an einen anderen berechtigten Nutzer übertragen wird
- **THEN** wird der neue Besitzkontext für nachfolgende Entscheidungen wirksam
- **AND** die Ownership-Regelung bleibt unabhängig von einer bloßen Rollenänderung modellierbar
- **AND** die Übertragung wirkt unmittelbar nach erfolgreicher Bestätigung

#### Scenario: Besitzübertragung ist transaktional und invalidiert betroffene Berechtigungsableitungen

- **WHEN** eine Besitzübertragung erfolgreich bestätigt wird
- **THEN** persistiert das System alten und neuen Besitzer, Ressource, Zeitpunkt und auslösenden Akteur atomar
- **AND** betroffene effektive Berechtigungsableitungen oder Snapshots werden unmittelbar neu bewertet oder invalidiert
- **AND** nachfolgende Prüfungen verwenden keinen veralteten Besitzkontext

#### Scenario: Ownership ist nicht auf einzelne Aktionen fest verdrahtet

- **WHEN** Fachregeln definieren, was ein Besitzer mit eigenen Daten tun darf
- **THEN** kann Ownership Entscheidungen für verschiedene Aktionen wie Lesen, Bearbeiten, Löschen oder Exportieren beeinflussen
- **AND** die Modellierung bleibt offen für weitere fachliche Aktionen

#### Scenario: Ownership-Overrides sind ein separates Privileg

- **WHEN** eine ownership-bedingt verweigerte Aktion übersteuert werden soll
- **THEN** ist ein Override nur für Rollen mit einem expliziten Override-Privileg zulässig
- **AND** nicht-administrative oder dafür nicht freigeschaltete Rollen können Ownership nicht brechen
- **AND** Self-Overrides sind ausgeschlossen

### Requirement: UI-taugliche Autorisierungsbegründungen für Scope- und Ownership-Konflikte

Das System SHALL strukturierte Autorisierungsbegründungen liefern, die in Admin- und Fach-UI verständlich für Scope- und Ownership-Konflikte aufbereitet werden können.

#### Scenario: Scope- und Ownership-Konflikte sind differenzierbar

- **WHEN** eine Anfrage wegen Instanz-, Organisations-, Kategorie- oder Ownership-Kontext verweigert wird
- **THEN** enthält die Entscheidung oder der Diagnosekontext genügend strukturierte Hinweise, um den Konflikttyp in der UI verständlich zu benennen
- **AND** die UI muss dafür keine unstrukturierte Rohdiagnose interpretieren

#### Scenario: Explainability bleibt auf allowlist-basierte Reason-Codes begrenzt

- **WHEN** Diagnose- oder Begründungsdaten an Admin- oder Fach-UI ausgeliefert werden
- **THEN** bestehen diese aus stabilen, dokumentierten Konflikt- und Reason-Codes statt aus unstrukturierten Rohdiagnosen
- **AND** fremde Identitätsdetails oder interne Policy-Strukturen werden dabei nicht offengelegt

#### Scenario: Vorschau und Szenario-Prüfung nutzen dieselben Entscheidungsgrundlagen

- **WHEN** ein Administrator eine Rolle oder ein Prüfszenario in der UI bewertet
- **THEN** basieren Vorschau und Szenario-Prüfung auf denselben strukturierten Entscheidungsfeldern wie operative Autorisierungsprüfungen
- **AND** Unterschiede zwischen Rollenrecht, Scope-Einschränkung und Ownership-Regel bleiben nachvollziehbar

#### Scenario: Kritische IAM-Änderungen erzeugen Audit-Evidenz

- **WHEN** Rollenrechte, Ownership-Regeln, Besitzübertragungen oder Overrides geändert oder ausgeführt werden
- **THEN** erzeugt das System eine nachvollziehbare Audit-Evidenz mit Aktion, betroffener Ressource, Actor, fachlichem Scope und Ergebnis
- **AND** diese Evidenz ist für Governance- und Incident-Zwecke auswertbar, ohne die UI auf Rohlogs zu zwingen
