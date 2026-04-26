# iam-server-modularization Specification

## Purpose
Beschreibt die Aufteilung des IAM-Server-Monolithen in fachlich fokussierte Module mit klar abgegrenzter Verantwortlichkeit. Ziel ist eine wartbare, testbare Modulstruktur für Benutzerverwaltung, Rollenverwaltung, Profilverwaltung, Bulk-Operationen, Feature-Flags, Rate-Limiting und Schemadefinitionen – mit eindeutigen öffentlichen APIs und gemeinsamer Hilfslogik in dedizierten Shared-Modulen.
## Requirements
### Requirement: Fachlich fokussierte IAM-Server-Module

Der IAM-Account-Management-Server und angrenzende IAM-Server-Hotspots MUST in mehrere fachlich fokussierte Module mit klar abgegrenzter Verantwortung aufgeteilt werden. Dazu gehören insbesondere Benutzerverwaltung, Rollenverwaltung, Profilverwaltung, Bulk-Operationen, Feature-Flags, Rate-Limiting und Schemadefinitionen.

#### Scenario: Rollenlogik wird erweitert

- **WHEN** neue Logik für Rollenverwaltung oder Rollen-Synchronisation eingeführt oder geändert wird
- **THEN** liegt diese Logik in einem dedizierten Rollen-Modul
- **AND** sie wird nicht erneut in allgemeinen Account-, Routing- oder Governance-Dateien eingebettet

#### Scenario: DSR- oder Governance-Logik wird geändert

- **WHEN** ein Flow für Betroffenenrechte oder Governance angepasst wird
- **THEN** erfolgt die Änderung in einem fachlich passenden DSR- oder Governance-Modul
- **AND** sie vergrößert nicht erneut fachfremde Monolith-Dateien

### Requirement: Klare öffentliche APIs und Modulgrenzen

Jedes IAM-Server-Modul MUST eine wohldefinierte öffentliche API-Schnittstelle besitzen. Interne Details dürfen nur über explizite Modul-Entry-Points konsumiert werden; breite Barrel-Exports ohne fachliche Grenze sind zu vermeiden.

#### Scenario: Anderes IAM-Modul benötigt Funktionalität

- **WHEN** ein anderes IAM-Modul auf fachliche Funktionalität zugreifen muss
- **THEN** nutzt es die dokumentierte öffentliche API des Zielmoduls
- **AND** es importiert keine internen Implementierungsdetails direkt aus beliebigen Dateien

#### Scenario: Exportfläche eines Moduls wächst

- **WHEN** die öffentliche API eines Moduls erweitert wird
- **THEN** ist die neue Exportfläche fachlich begründet
- **AND** der Modul-Entry-Point bleibt reviewbar und klar abgegrenzt

### Requirement: Gemeinsame Hilfslogik wird zentral gekapselt

Gemeinsame Hilfsfunktionen, insbesondere für Maskierung, Parsing, Validierung, Rate-Limit-Logik und Logging-/Request-Kontext, DÜRFEN NICHT mehrfach implementiert werden. Sie MUST in dedizierten Shared-Modulen gekapselt und von Fachmodulen wiederverwendet werden.

#### Scenario: Neues Modul benötigt Rate-Limit-Logik

- **WHEN** ein neues oder refaktoriertes IAM-Modul Rate-Limit-Verhalten benötigt
- **THEN** verwendet es die zentrale Shared-Implementierung
- **AND** es führt keine zweite, abweichende Rate-Limit-Logik ein

#### Scenario: Validierungslogik wird in mehreren Pfaden benötigt

- **WHEN** mehrere IAM-Endpoints dieselben Eingabe- oder Schemaprüfungen benötigen
- **THEN** liegt die Validierung in einem gemeinsamen Schema- oder Shared-Modul
- **AND** die Validierung wird nicht als kopierte Inline-Logik gepflegt

### Requirement: Risikobasierter Refactoring-Fahrplan

Die Modularisierung des IAM-Servers SHALL in einer risikobasierten Reihenfolge erfolgen. Die priorisierten Findings `QUAL-101`, `QUAL-103`, `QUAL-104`, `QUAL-108`, `QUAL-102`, `QUAL-109`, `QUAL-105`, `QUAL-106` und `QUAL-107` bilden die verbindliche Abarbeitungsreihenfolge, solange keine neue Risikobewertung dokumentiert wird.

#### Scenario: Umsetzung der ersten Tranche

- **WHEN** die Modularisierung begonnen wird
- **THEN** werden zuerst die Hotspots `iam-account-management.server.ts`, `iam-data-subject-rights.server.ts` und `iam-governance.server.ts` adressiert
- **AND** die Entscheidung ist mit den Tickets `QUAL-101`, `QUAL-103` und `QUAL-104` nachvollziehbar verknüpft

#### Scenario: Reihenfolge wird geändert

- **WHEN** von der priorisierten Abarbeitungsreihenfolge abgewichen werden soll
- **THEN** wird die geänderte Risikobewertung dokumentiert
- **AND** die betroffenen Tickets und Auswirkungen auf verbleibende Hotspots werden explizit benannt

### Requirement: Zielarchitektur orientiert sich an projektweiten Qualitätsgrenzen

Die modulare Zielarchitektur SHALL einzelne Dateien, Funktionen und Exportflächen auf projektweit gültige Grenzwerte ausrichten. Verbleibende Überschreitungen sind nur zulässig, wenn sie als bewusst dokumentierte Restschuld mit Ticketbezug geführt werden.

#### Scenario: Modul bleibt nach Refactoring über Grenzwert

- **WHEN** ein refaktoriertes Modul weiterhin einen projektweiten Grenzwert überschreitet
- **THEN** ist die Überschreitung mit einem verknüpften Refactoring-Ticket dokumentiert
- **AND** die verbleibende Restschuld ist für Reviewer nachvollziehbar begründet

#### Scenario: Neue Überschreitung entsteht

- **WHEN** durch die Modularisierung oder Folgeänderungen eine neue Grenzwertüberschreitung entsteht
- **THEN** wird sie nicht stillschweigend akzeptiert
- **AND** sie erhält vor Merge einen dokumentierten Nachweis oder wird im selben Change behoben

### Requirement: IAM-Server-Hard-Cut in Zielpackages

Der IAM-Server MUST von einer internen Modulstruktur in getrennte Zielpackages überführt werden. Authentifizierung, zentrale Autorisierung, IAM-Administration, IAM-Governance und Instanz-Control-Plane MUST getrennte Package-Verantwortlichkeiten erhalten.

#### Scenario: Authentifizierungslogik wird migriert

- **WHEN** Login, Logout, OIDC, Cookies, Session oder Auth-Middleware geändert werden
- **THEN** liegt die Implementierung in `@sva/auth-runtime`
- **AND** sie importiert keine IAM-Admin-, Governance- oder Instanz-Implementierungsdetails

#### Scenario: IAM-Admin-Logik wird migriert

- **WHEN** Benutzer, Rollen, Gruppen, Organisationen oder Reconcile-Logik geändert werden
- **THEN** liegt die Implementierung in `@sva/iam-admin`
- **AND** Autorisierungsentscheidungen werden über `@sva/iam-core` konsumiert

#### Scenario: Governance- oder DSR-Logik wird migriert

- **WHEN** DSR, Legal Texts, Audit-nahe IAM-Fälle oder Governance-Flows geändert werden
- **THEN** liegt die Implementierung in `@sva/iam-governance`
- **AND** PII-Verarbeitung ist dort explizit klassifiziert und getestet

#### Scenario: Instanz-Control-Plane wird migriert

- **WHEN** Instanzmodell, Host-Klassifikation, Registry, Provisioning oder Platform-Keycloak-Control-Plane geändert werden
- **THEN** liegt die Implementierung in `@sva/instance-registry`
- **AND** sie wird nicht als Unterfunktion von `@sva/auth-runtime` oder `@sva/iam-admin` umgesetzt

### Requirement: Zentrale Autorisierungsinvariante

Das System MUST zentrale Autorisierungsentscheidungen ausschließlich über `@sva/iam-core` treffen. Fachpackages MUST diesen Vertrag konsumieren und dürfen keine zweite Berechtigungsauflösung gegen eigene Tabellen, Keycloak-Rollen oder kopierte Rollenlogik einführen.

#### Scenario: Fachpackage prüft Berechtigung

- **WHEN** `@sva/iam-admin`, `@sva/iam-governance` oder `@sva/instance-registry` eine geschützte Operation ausführt
- **THEN** ruft es den Autorisierungsvertrag aus `@sva/iam-core` auf
- **AND** fehlender oder unvollständiger Autorisierungskontext führt fail-closed zu einer Ablehnung

#### Scenario: Neue Berechtigungsregel entsteht

- **WHEN** eine neue fachliche Berechtigungsregel benötigt wird
- **THEN** wird der zentrale Autorisierungsvertrag erweitert
- **AND** Fachpackages duplizieren die Entscheidung nicht lokal

### Requirement: IAM-PII-Verarbeitung nach Zielpackage

Das System MUST IAM-bezogene PII-Verarbeitung nach Zielpackage begrenzen. `@sva/iam-admin` und `@sva/iam-governance` MAY Klartext-PII verarbeiten, wenn Autorisierung und Entschlüsselungsvertrag erfüllt sind; andere Zielpackages dürfen PII nur entsprechend ihrer dokumentierten Rolle verarbeiten.

#### Scenario: Benutzerprofil wird verwaltet

- **WHEN** Benutzerprofil-PII für Administration benötigt wird
- **THEN** erfolgt die Klartextverarbeitung in `@sva/iam-admin`
- **AND** Repositories liefern persistente Daten ohne eigenständige fachliche Entschlüsselungsentscheidung

#### Scenario: DSR-Fall benötigt Klartextdaten

- **WHEN** ein Betroffenenrechte-Flow personenbezogene Daten benötigt
- **THEN** erfolgt die Klartextverarbeitung in `@sva/iam-governance`
- **AND** der Zugriff ist über `@sva/iam-core` autorisiert und testbar

#### Scenario: Instanz-Registry verarbeitet Registry-Daten

- **WHEN** `@sva/instance-registry` Instanz- oder Hostdaten verarbeitet
- **THEN** verarbeitet sie keine personenbezogenen Daten im Klartext
- **AND** personenbezogene IAM-Daten bleiben in den autorisierten IAM-Fachpackages

