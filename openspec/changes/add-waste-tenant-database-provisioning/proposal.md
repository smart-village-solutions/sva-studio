# Change: Tenantbezogene Waste-Datenbanken automatisch provisionieren

## Why

Waste-Management soll seine Daten nicht mehr in einer gemeinsam konfigurierten Supabase-Datenbank führen. Jede Studio-Instanz benötigt stattdessen eine eigene PostgreSQL-Datenbank, ohne dass Tenant-Benutzer technische Interfaces oder Zugangsdaten verwalten müssen.

Die Modulzuweisung ist der fachliche Auslöser, darf aber nicht auf langlaufende Infrastrukturarbeiten warten. Deshalb braucht es einen nachvollziehbaren, idempotenten Provisionierungsprozess mit einem fail-closed Bereitschaftsstatus.

## What Changes

- Die Zuweisung von `waste-management` stößt einen asynchronen, idempotenten Provisionierungsjob für genau eine tenantbezogene Waste-Datenbank an.
- Der Provisionierer legt Datenbank, getrennte Rollen und Secrets an, führt Waste-Migrationen aus, prüft die Verbindung und schaltet das Modul erst danach auf `ready`.
- Das System materialisiert automatisch ein pluginverwaltetes PostgreSQL-Interface. Dieses bleibt für interne Auflösung und Betriebsdiagnose verfügbar, wird aber in der allgemeinen Interface-Verwaltung verborgen und kann über deren Benutzer-API nicht verändert werden.
- Die Waste-Oberfläche zeigt nur den technischen Bereitstellungsstatus und eine berechtigte Wiederholungsaktion; rohe Verbindungsdaten bleiben unsichtbar.
- Beim Entzug des Moduls werden Interface und Runtime-Zugriff deaktiviert, Datenbank, Daten und Sicherungen jedoch nicht automatisch gelöscht.
- Der bestehende Supabase-Bestand wird einmalig und ausschließlich in die provisionierte Waste-Datenbank von `bb-prignitz` importiert. Andere Tenants starten mit einem leeren, migrierten Schema.
- Backup, Restore, Audit und Diagnose werden um dynamisch provisionierte tenantbezogene Datenbanken erweitert.
- Die Umsetzung verwendet ausschließlich vorhandene Studio-Services und den bestehenden Job-Runner; es entsteht kein neuer dauerhaft laufender Service, Container, Port oder separater Stack.
- Das bestehende Deployment erhält einmalig das geschützte Provisionierer-Secret, die zugehörige PostgreSQL-Rolle, zentrale Migrationen und erweiterte Backup-Discovery. Danach ist keine Deployment-Anpassung pro Tenant erforderlich.

## Dependencies

- Der Change baut fachlich auf `migrate-waste-from-supabase-to-postgresql` auf. Dessen PostgreSQL-Datenmodell, Migrationsmechanik und einmaliger Export-/Importpfad müssen vor oder gemeinsam mit diesem Change integriert werden.
- Bei paralleler Entwicklung müssen überlappende Deltas in `waste-management` vor dem Archivieren zusammengeführt werden.

## Impact

- Affected specs: `waste-management`, `external-interface-registry`, `instance-provisioning`, `plugin-operations-platform`, `deployment-topology`
- Affected code: Modulzuweisung und Instanz-Registry, Plugin-Operations-Jobs, External-Interface-Registry und Resolver, Waste-Host-Fassade, Waste-Modulsettings, PostgreSQL-Provisionierung und Secret-Verwaltung, Public-Waste-Runtime, Backup-/Restore-Werkzeuge
- Deployment impact: keine neue Laufzeitkomponente oder Topologie; einmalige Erweiterung des vorhandenen Deployments um Provisionierer-Secret/-Rolle, zentrale Migrationen und Backup-Inventarisierung
- Affected data: zentrale Provisionierungs- und Interface-Metadaten sowie eine eigene PostgreSQL-Datenbank mit eigenen Rollen pro Waste-Tenant
- Affected arc42 sections: `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`
- Breaking behavior: Tenant-Benutzer konfigurieren das technische Waste-Interface nicht mehr selbst; Modulbereitschaft ist nach Zuweisung zunächst asynchron
