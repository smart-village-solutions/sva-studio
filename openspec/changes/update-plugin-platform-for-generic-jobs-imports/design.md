## Context

Das Studio hat inzwischen mehrere tragfähige Host-Boundaries etabliert:

- statische Plugin-Registrierung über `createBuildTimeRegistry(...)`
- freie Plugin-Routen über hostmaterialisierte Routing-Factories
- Modul-IAM über `moduleIam`-Verträge und zentrale Registry-Zuschnitte
- serverseitige API-Routen über den typisierten Auth-/IAM-Route-Katalog

Für generische Plugin-Jobs und strukturierte Importe fehlt aber noch ein entsprechender Plattformvertrag. Fachchanges würden sonst dieselben Querschnittsfragen mehrfach neu schneiden.

## Goals

- allgemeine, pluginübergreifende Jobs und Importprofile als Host-Vertrag normieren
- Plugins nur Fachverträge registrieren lassen, nicht Runtime oder Persistenz selbst definieren lassen
- zentrale Persistenz-, Routing- und Sicherheitsgrenzen im Host verankern
- Monitoring- und UI-Anbindung optional offenhalten, ohne einen fertigen Vollausbau zu erzwingen

## Non-Goals

- keine fachliche Waste-UI
- kein verpflichtender Endnutzer-Wizard
- keine neue parallele Plugin-Initialisierung
- keine generische Fremdsystem-Synchronisationsplattform

## Decisions

### 1. Plugin-Beiträge bleiben Build-Time- und Host-gesteuert

Jobtypen und Importprofile werden als weitere Plugin-Beitragstypen modelliert, die durch den bestehenden Host-Build-Time-Registry-Pfad validiert und publiziert werden. Plugins liefern also weiterhin nur deklarative Beiträge; die Runtime bleibt hostgeführt.

Warum:
- Das passt zum bestehenden Registry- und Guardrail-Modell.
- Es vermeidet einen zweiten, konkurrierenden Plugin-Initialisierungspfad.

### 2. Jobs sind hostgeführt und zentral persistent

Pluginübergreifende Jobs werden als allgemeiner Studio-Vertrag mit zentraler Persistenz im Studio-Postgres modelliert. Fachplugins dürfen eigene Payloads, Typen und Ergebnisfelder registrieren, aber keine führende Jobplattform in externen Fachdatenbanken etablieren.

Warum:
- Jobs sind eine Querschnittsfähigkeit mit Governance-, Audit- und Betriebsbezug.
- Zentrale Persistenz passt zur vorhandenen Host-Verantwortung für Kontroll- und Governance-Daten.

### 3. Importprofile sind deklarativ, nicht runtime-autonom

Importprofile beschreiben pro Plugin und Importtyp mindestens Kennung, erlaubte Quellformate, Schema-/Mapping-Erwartungen und Validierungsvertrag. Sie registrieren keine eigene Import-Runtime. Der Host bleibt zuständig für Request-Vertrag, Jobstart, Statusmodell und spätere UI-Andockpunkte.

Warum:
- Das verhindert pluginweise Sonderplattformen.
- Fachliche Unterschiede bleiben dennoch explizit je Importprofil modellierbar.

### 4. API-Einbindung läuft über den typisierten Host-Route-Katalog

Operations-Endpunkte für Jobs und generische Importe werden nur über den bestehenden typisierten Runtime-Route-Katalog des Hosts publiziert. Ein fachlicher oder generischer Endpoint gilt erst dann als Teil des Systems, wenn er dort samt Handler-Mapping aufgenommen ist.

Warum:
- Das entspricht dem heutigen Runtime-Modell.
- Es macht fehlende Host-Einbindung deterministisch sichtbar.

### 5. Monitoring- oder Wizard-UI bleibt optionaler Andockpunkt

Der Plattform-Change darf UI-seitige Andockpunkte oder erste Host-Sichten vorbereiten, fordert aber keinen vollwertigen Monitoring-Bereich und keinen fertigen Import-Wizard als Lieferminimum.

Warum:
- Der aktuelle Workspace besitzt dort noch keine belastbare allgemeine Oberfläche.
- Die Plattform soll Fachchanges entkoppeln, nicht eine komplette neue Admin-Oberfläche erzwingen.

Für die erste Umsetzung bedeutet das ausdrücklich: Die Plattform darf produktiv nur über deklarative Beiträge, zentrale Persistenz, Host-API und interne Worker-Anbindung bestehen. Eine allgemeine Host-UI ist in diesem Change kein Lieferbestandteil.

## Package-Zuschnitt

- `packages/plugin-sdk`: neue deklarative Beitragstypen für Jobtypen und Importprofile, Registry-Validierung, Guardrails
- `packages/core`: gemeinsame Verträge für Jobstatus, Jobdetail, Importprofil-Metadaten und API-Shapes
- `packages/routing`: hostseitige Einbindung neuer Runtime-Endpunkte in die zentrale Routing-Wahrheit
- `packages/auth-runtime`: Handler, Validierung, Auth-/Actor-/Permission-Auflösung
- `packages/data-repositories`: zentrale Job-Persistenz und dazugehörige Queries/Mutationen
- `packages/server-runtime`: gemeinsame Hilfen für Fehlerabbildung, Logging und requestbezogene Host-Orchestrierung
- `apps/sva-studio-react`: nur soweit notwendig Host-Anbindung an registrierte Beiträge oder optionale erste UI-Einstiege

## Risks

- Zu viel UI-Scope würde den Plattform-Change unnötig aufblasen.
- Eine zweite Registry oder implizite Laufzeitregistrierung würde bestehende Guardrails unterlaufen.
- Externe Fachdatenbanken als führende Job-Persistenz würden Host-Governance und Betriebssicht fragmentieren.
