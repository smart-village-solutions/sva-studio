# Package-Gesamtübersicht

## 1. Fundament und gemeinsame Verträge

### `@sva/core`

`@sva/core` ist das fachliche Fundament des Monorepos. Das Package enthält framework-agnostische Kernlogik, die von vielen anderen Paketen genutzt wird. Dazu gehören unter anderem Content-Grundmodelle, Routing-Komposition, IAM-Verträge und Autorisierungslogik, Instanz- und Host-Regeln, Runtime-Profile sowie sicherheitsnahe Hilfsfunktionen wie Feldverschlüsselung und E-Mail-Redaction.

Wenn ein Paket fachliche Regeln braucht, die nicht an React, HTTP, Datenbank oder konkrete Infrastruktur gebunden sein sollen, dann gehören diese Regeln in der Regel nach `@sva/core`.

### `@sva/plugin-sdk`

`@sva/plugin-sdk` definiert den öffentlichen Vertrag für Plugins. Das Package beschreibt, wie Plugins ihre Routen, Admin-Ressourcen, Content-Typen, Übersetzungen und Berechtigungen an den Host melden. Es ist damit die zentrale Grenze zwischen Host-Anwendung und fachlichen Erweiterungen.

Plugins sollen Host-Funktionen nicht direkt aus App-Code oder aus `@sva/core` beziehen, sondern nur über die abstrahierten Verträge aus diesem Package.

## 2. Server-Runtime und technische Querschnittsfunktionen

### `@sva/monitoring-client`

`@sva/monitoring-client` bündelt die technische Observability-Anbindung. Das Package kapselt OpenTelemetry-Setup, Metriken, Logging-Redaction und serverseitige Monitoring-Helfer. Es hält die OTEL-Komplexität bewusst aus den Fachpackages heraus.

Die Aufgabe des Pakets ist nicht Fachlogik, sondern ein sauberer technischer Unterbau für Logs, Metriken und Laufzeitdiagnostik.

### `@sva/server-runtime`

`@sva/server-runtime` stellt die gemeinsame Server-Runtime für Node-basierte Teile des Systems bereit. Dazu gehören Logger, Request-Kontext, JSON-Fehlerantworten, Workspace-Kontext, OTEL-Bootstrap und Hilfen für Multi-Host-Konfiguration.

Das Package ist die technische Infrastruktur, auf die serverseitige Fachpackages aufbauen. Es soll bewusst fachfrei bleiben und keine IAM-, Routing- oder UI-Logik enthalten.

## 3. Datenzugriff und externe Integrationen

### `@sva/data-client`

`@sva/data-client` ist der client-sichere HTTP-Datenzugang. Das Package baut GET-basierte API-Zugriffe auf, validiert Antworten optional mit Zod und bringt einen einfachen Cache für lesende Anfragen mit.

Es ist für Browser- oder universal nutzbare Datenzugriffe gedacht, nicht für direkte Datenbankarbeit.

### `@sva/data-repositories`

`@sva/data-repositories` bündelt serverseitige Repository-Fassaden und datenbanknahe Operationen. Hier liegen Postgres-Zugriffe, migrationsnahe Typen sowie Repositories für IAM-, Instanz- und Medien-Persistenz.

Das Package ist die datenbanknahe Schicht unter den Fachservices. Es verarbeitet technische Datenzugriffe, aber nicht die eigentliche Geschäftslogik.

### `@sva/media`

`@sva/media` enthält das gemeinsame Medienmodell. Das Package definiert Typen, Standard-Presets und fachliche Grundregeln für Medienobjekte, ohne selbst Upload-, Storage- oder HTTP-Laufzeit zu enthalten.

Es ist damit ein kleines, fokussiertes Core-Package für mediennahe Verträge, das von Runtime- und Plugin-Paketen genutzt werden kann.

### `@sva/sva-mainserver`

`@sva/sva-mainserver` ist die Integrationsschicht zum externen SVA-Mainserver. Das Package trennt zwischen gemeinsam nutzbaren Typen und serverseitiger Laufzeitlogik für Konfiguration, Credential-Auflösung, OAuth2-Tokenabruf, GraphQL-Transport und Fehlerabbildung.

Immer wenn das Studio mit News-, Event- oder POI-Daten aus dem Mainserver arbeitet, ist dieses Package die zuständige Integrationsgrenze. Seit dem Boundary-Refactoring liegen hier auch die kanonischen serverseitigen Host-Verträge für News-, Event-, POI- und Schnittstellen-Requests; die App hält nur noch dünne Delegationsadapter.

## 4. Fachliche IAM- und Instanz-Services

### `@sva/iam-core`

`@sva/iam-core` ist der zentrale Ort für IAM-Grundverträge und Autorisierungsentscheidungen. Das Package bildet die fachliche Mitte für Berechtigungslogik, ohne selbst die komplette Runtime oder UI zu enthalten.

Es sorgt dafür, dass Rechteentscheidungen nicht in mehreren Fachmodulen unterschiedlich nachgebaut werden.

### `@sva/iam-admin`

`@sva/iam-admin` bündelt die operative IAM-Administration. Hier liegen Benutzer-, Rollen-, Gruppen- und Organisationslogik sowie Reconcile- und Keycloak-nahe Admin-Orchestrierung.

Dieses Package ist zuständig, wenn Administrationsfunktionen für Benutzer und Berechtigungen umgesetzt oder erweitert werden.

### `@sva/iam-governance`

`@sva/iam-governance` deckt Governance- und Compliance-Fälle im IAM-Bereich ab. Dazu gehören insbesondere DSR-Prozesse, Legal Texts, Export- und Audit-nahe Fachfälle.

Das Package trennt bewusst Governance-Logik von klassischer Benutzer- und Rollenverwaltung. Dazu gehört auch der kanonische Legal-Text-HTML-Sanitizer, den App- und Runtime-Consumer direkt aus diesem Package beziehen.

### `@sva/instance-registry`

`@sva/instance-registry` ist die Control-Plane für Instanzen, Hosts und Provisioning. Das Package verwaltet Instanzmodelle, Host-Klassifikation, Registry-Zustand, Provisioning und tenantbezogene Keycloak-Steuerung.

Wenn es um Mandantenbetrieb, Instanzdiagnostik oder Provisioning geht, ist dieses Package die führende fachliche Stelle.

### `@sva/auth-runtime`

`@sva/auth-runtime` ist die serverseitige Laufzeitschicht für Authentifizierung, Sessions und IAM-HTTP-Endpunkte. Das Package verbindet OIDC-Login, Session-Verarbeitung, Tenant-Auth-Konfiguration, Middleware und die Runtime-Handler für viele IAM-Fachbereiche.

Es sitzt im aktiven Request-Pfad und übersetzt Auth-Zustand und Fachlogik in konkrete HTTP-Endpunkte und Laufzeitverhalten.

## 5. Routing, UI und Plugins

### `@sva/routing`

`@sva/routing` ist die kanonische Routing-Bibliothek des Systems. Das Package bündelt Route-Factories, Pfade, Guards, Search-Normalisierung, Plugin-Routen und serverseitige Auth-Routen.

Die App selbst liefert nur Bindings und konkrete Seiten. Die eigentliche Routing-Struktur wird hier zentral definiert und zusammengesetzt.

### `@sva/studio-ui-react`

`@sva/studio-ui-react` ist die öffentliche React-UI-Bibliothek für Studio-Oberflächen. Das Package stellt wiederverwendbare UI-Primitives, Studio-Seitenbausteine, Tabellen, Surface-Komponenten und Formularhilfen bereit.

Es ist bewusst UI-only: keine Routing-Logik, keine Datenpersistenz, keine IAM-Fachlogik, keine Server-Runtime. Wiederverwendbare Host-Listen- und Template-Bausteine wie `StudioDataTable` und `StudioListPageTemplate` gehören in dieses Package; die App liefert nur Labels, Daten und Navigation.

### `@sva/plugin-news`

`@sva/plugin-news` ist ein fachliches Plugin für News-Inhalte. Es erweitert das Studio um News-spezifische Listen-, Detail- und Editor-Ansichten und nutzt dafür die Verträge aus `@sva/plugin-sdk` sowie gemeinsame UI aus `@sva/studio-ui-react`.

Das Package zeigt das Zielmuster für produktive Fachplugins im Workspace.

### `@sva/plugin-events`

`@sva/plugin-events` ist das fachliche Plugin für Event-Inhalte. Es folgt demselben Grundmuster wie das News-Plugin und kapselt Event-spezifische API-, Typ-, Validierungs- und Seitenbausteine.

Seine Aufgabe ist nicht die allgemeine Plugin-Infrastruktur, sondern die konkrete fachliche Erweiterung für Events.

### `@sva/plugin-poi`

`@sva/plugin-poi` ist das fachliche Plugin für Points of Interest. Das Package enthält POI-spezifische Modelle, Validierung, API-Anbindung und UI-Bausteine.

Wie die anderen Fachplugins nutzt es die öffentliche Plugin-Grenze des Hosts, statt interne App- oder Core-Module direkt zu importieren.

### `packages/plugin-example`

`packages/plugin-example` ist aktuell kein ausgebautes Workspace-Package, sondern ein Platzhalterverzeichnis. Nach aktuellem Stand besitzt es keine reguläre Package-Struktur mit `package.json`, `project.json` oder `src/`.

Für die Architektur ist es daher derzeit kein aktiver Baustein, sondern eher ein möglicher Ansatzpunkt für spätere Beispiel- oder Template-Arbeit.

## 6. Kompatibilitäts- und Übergangspakete

### `@sva/data`

`@sva/data` ist ein historisches Kompatibilitäts- und Betriebs-Package. Neue Datenlogik soll nicht mehr hier entstehen. Stattdessen verweist das Package auf `@sva/data-client` und `@sva/data-repositories` und hält vor allem bestehende Re-Exports sowie Datenbank-Targets für Migrationen, Seeds und lokale Betriebsabläufe.

Es ist also kein modernes Zielpackage mehr, sondern ein kontrollierter Übergangs- und Betriebsanker.

### Entfernte Sammelfassade `@sva/sdk`

`@sva/sdk` war ein früheres Kompatibilitätspaket für gebündelte Plugin- und Runtime-Imports. Der aktive Workspace führt diese Fassade nicht mehr. Frühere Altpfade sind direkt auf `@sva/plugin-sdk`, `@sva/server-runtime`, `@sva/core` und `@sva/monitoring-client/logging` umgestellt.

## Empfohlene Lesereihenfolge für neue Entwicklerinnen und Entwickler

Wer das Monorepo verstehen will, sollte die Packages in dieser Reihenfolge lesen:

1. `@sva/core`
2. `@sva/plugin-sdk`
3. `@sva/server-runtime`
4. `@sva/data-client` und `@sva/data-repositories`
5. `@sva/iam-core`
6. `@sva/iam-admin`, `@sva/iam-governance`, `@sva/instance-registry`
7. `@sva/auth-runtime`
8. `@sva/routing`
9. `@sva/studio-ui-react`
10. `@sva/sva-mainserver`
11. `@sva/plugin-news`, `@sva/plugin-events`, `@sva/plugin-poi`
12. `@sva/data` nur noch als Kompatibilitäts- und Betriebs-Kontext

## Verwandte Dokumentation

- [Architekturübersicht](./README.md)
- [05 Bausteinsicht](./05-building-block-view.md)
- [Package-Zielarchitektur](./package-zielarchitektur.md)
- [IAM-Service-Architektur](./iam-service-architektur.md)
