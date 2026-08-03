# Change: Eigenständiges Projekte-Plugin ergänzen

## Why

Featured Projects benötigen im Studio eine eigenständige redaktionelle Fachfläche mit eigenen Berechtigungen. Das vorhandene Generic-Items-Plugin stellt die erforderlichen Felder und Medienbausteine grundsätzlich bereit, exponiert aber zahlreiche für Projekte nicht benötigte Bereiche und besitzt keinen passenden Projekte-API-Vertrag.

## What Changes

- Ein neues eigenständiges `@sva/plugin-projects` wird einmalig aus dem vollständigen Generic-Items-Plugin abgeleitet und kann danach unabhängig weiterentwickelt werden.
- Projekte werden als `GenericItem` mit dem unveränderlichen technischen Diskriminator `genericType: "PROJECT"` gespeichert und ausschließlich als `projects.project` projiziert.
- Die fachliche API enthält ausschließlich Featured Projects. Sie besitzt weder ein `Type`- noch ein `Translations`-Feld und verknüpft verschiedene Sprachfassungen nicht miteinander.
- Der hostseitige Content-Core bleibt führend für Lifecycle, Veröffentlichung, Autorenschaft, Ownership, Validierung und Historie. Für den unveränderten Mainserver-Transport werden Projektstatus zusätzlich unter `payload.status` gespiegelt sowie `visible` und `publishedAt` deterministisch daraus abgeleitet. Bestehende Generic Items, FAQ und Kacheln werden nicht migriert.
- Das Fachmodell umfasst eine frei eingebbare Sprache, Titel, Kurzbeschreibung, Rich Text, eine optionale geordnete Bildergalerie, den hostseitigen redaktionellen Status, den daraus abgeleiteten Veröffentlichungsstatus und Veröffentlichungszeitpunkt, genau einen sichtbaren Autor als Organisation oder Person, den Löschstatus sowie systemverwaltete IDs und Zeitstempel.
- Nicht benötigte GenericItem-Felder bleiben in der Projekte-Oberfläche verborgen. Bereits vorhandene Werte solcher Felder bleiben bei Aktualisierungen unverändert erhalten.
- Das Plugin erhält die Actions `projects.read`, `projects.create`, `projects.update` und `projects.delete`.
- Als erster Nutzer einer wiederverwendbaren Mainserver-Content-Brücke führt der Change eine host-owned externe Content-Referenz zwischen `iam.contents` und Mainserver-Datensätzen sowie einen Reconciliation-Status ein. Create nutzt den vorhandenen Idempotenzvertrag und eine stabile `externalId`; es entsteht kein projektspezifisches Parallel-Journal.
- Die standardisierte Historienansicht folgt bewusst im nachgelagerten Change `standardize-plugin-content-history`. Bis dahin besitzt der Projekte-Editor keinen Historien-Tab und keine temporäre History-Persistenz.

## Impact

- Betroffene Spezifikationen: `content-management`, `plugin-platform`, `sva-mainserver-integration`.
- Betroffener Code: neues Workspace-Package, Plugin-Registry, Modul-IAM-Vertrag, Instanz-Bootstrap, Host-Fassade, GenericItem-Routen, allgemeine External-Content-Referenz, bestehender Idempotenz- und Mutationsworkflow, Inhaltsprojektion und Medienzuordnung.
- Betroffene Daten: `iam.contents`, neue allgemeine External-Content-Referenzen und der DB-Schema-Snapshot; keine projektspezifische History-Tabelle.
- Betroffene arc42-Abschnitte: [05 Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [06 Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) und [08 Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md).

## Nicht im Scope

- Verknüpfte Übersetzungen, automatische Sprach-Fallbacks oder eine feste Liste erlaubter Sprachkürzel.
- Anhänge, Kontakte, Adressen, Termine, Öffnungszeiten, Preise oder strukturierte externe Links.
- Eine dauerhafte Vererbung oder Laufzeitkopplung an `@sva/plugin-generic-items`.
- Eine Migration oder Verhaltensänderung bestehender Generic Items, FAQ und Kacheln auf den neuen redaktionellen Status.
- Eine Änderung des externen Mainserver-GraphQL-Schemas oder die Zusicherung, dass externe Mainserver-Clients Studio-Konventionen wie `payload.status` und `payload.deleted` einhalten.
- Konfliktfreie Schreibzusammenführung mit parallelen externen Änderungen; der unveränderte GenericItem-Vertrag bietet weder Revision noch `If-Match`.
- Eine sichtbare Inhaltshistorie, `content.readHistory` oder ein Historien-Tab; diese werden ausschließlich durch `standardize-plugin-content-history` ergänzt.
- Änderungen an öffentlichen App- oder Web-Clients.

