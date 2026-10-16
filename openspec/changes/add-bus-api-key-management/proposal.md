# Change: Bus-API-Keys in der zentralen Instanzverwaltung verwalten

## Why

Die Kunden-Keys des Bus-Servers werden bislang über einen technischen Admin-Zugang
verwaltet. Studio besitzt bereits persönliche Logins und eine zentrale Instanzverwaltung;
Plattform-Superadmins sollen diese Aufgabe dort unabhängig von einer einzelnen Person erledigen.

Dieser Change übernimmt die offenen Studio- und Integrationsaufgaben aus dem Bus-Change
`add-studio-api-key-management`. Dessen Bus-Implementierung ist als `0.7.3` veröffentlicht
und produktiv; die Studio-Implementierung und ihre Abnahme sind weiterhin offen.

## What Changes

- Im vorhandenen Instanzdetail `/admin/instances/$instanceId` unter „Betrieb“ entsteht
  der Bereich „Bus-API-Keys“ mit Liste, Erstellung, Sperrung und Reaktivierung.
- Ausschließlich Plattform-Superadmins mit `instance_registry_admin` auf dem Root-Host
  erhalten Zugriff. Jeder Server-Endpunkt erzwingt das erneut; Tenant-`system_admin`,
  Tenant-Module, Organisationen und fachliche Tenant-Permissions verleihen keinen Zugriff.
- Studio ruft den Bus-Server ausschließlich serverseitig auf; dessen bestehende
  Redis-Key-Registry bleibt führend. Die Funktion ist kein aktivierbares Tenant-Modul.
- `owner` wird aus dem ausgeschriebenen Instanznamen und `label` aus der exakten
  `instanceId` abgeleitet. Kunden-Kontakt-E-Mail und Erstellerinitialen sind Pflichtfelder.
- Das inklusive Gültigkeitsdatum ist mit Jahresende vorbelegt und frei auswählbar;
  `expiresAt` ist der Beginn des Folgetags in UTC.
- Klartext-Keys werden einmalig angezeigt; Audit, Fehlerbehandlung und manuelle Rotation
  nutzen die bestehenden Studio-Pfade und den bereits verfügbaren Bus-Vertrag.

## Non-Goals

Keine neue Frontend-App, kein neues Plugin oder Workspace-Package, keine zweite
Key-Registry, kein Bus-Login, kein Kunden-Self-Service und keine zusätzlichen Rollen.
Endgültiges Löschen, Metadatenbearbeitung, Ablauferinnerungen, automatische Client-Verteilung
und Pflege der bundeslandspezifischen Infodienste-Secrets sind nicht Teil dieses Changes.

## Impact

- Affected specs: `account-ui`, `iam-access-control`, `iam-auditing`.
- Affected code: bestehende Instanzdetailseite und Instanz-HTTP-Client, Root-Host-Routing,
  Registry-/Auth-Runtime, serverseitige Konfiguration, bestehender Plattform-Auditpfad, i18n.
- Affected arc42 sections: 03 Kontext, 04 Lösungsstrategie, 05 Bausteinsicht,
  06 Laufzeit, 07 Deployment und 08 Querschnittskonzepte; Fortschreibung bei Implementierung.
- Eine Datenmigration ist nicht vorab vorgesehen; nur ein belegter Bedarf im vorhandenen
  Auditvertrag darf eine Schemaänderung samt Snapshot-Pflege auslösen.

Die belegte Lücke ist ein autorisierter Studio-Bedienpfad für bereits produktiv verwaltbare
Bus-Keys; unmittelbarer Verbraucher ist das bestehende Root-Instanzdetail. Deshalb wird
dieser Pfad erweitert und die neue Bus-Anbindung darin gekapselt, statt ein weiteres Modul einzuführen.

## Verknüpfter, abgeschlossener Bus-Change

- [Bus-Release 0.7.3](https://github.com/smart-village-solutions/sva-bus-server/releases/tag/0.7.3)
- [Bus-Implementierung PR 14](https://github.com/smart-village-solutions/sva-bus-server/pull/14)
- [Bus-Archiv: add-studio-api-key-management](https://github.com/smart-village-solutions/sva-bus-server/tree/main/openspec/changes/archive/2026-10-16-add-studio-api-key-management)
- [Bus-Hauptspezifikation](https://github.com/smart-village-solutions/sva-bus-server/blob/main/openspec/specs/backend-platform/spec.md)

Die Aufteilung ist vom Nutzer am 16. Oktober 2026 beauftragt. Übernommene Produktentscheidungen
bleiben gültig; mit der Überführung wird keine Studio-Implementierung als erledigt erklärt.
