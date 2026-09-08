# Change: SSF-Runtime-Konfiguration im Studio bearbeitbar machen

## Why

Die SSF-Runtime liest inzwischen echte Konfigurationsdaten aus dem Studio.
Ohne eine Studio-Oberfläche lassen sich installationsweite Standards und
tenantlokale Abweichungen jedoch nur direkt in der Plugin-Datenbank pflegen.
System- und Tenant-Administratoren benötigen klar getrennte, sichere Editoren
für die bereits vereinbarten Texte, Sprachen und die Gesprächsspeicherung.

## What Changes

- Das SSF-Plugin erhält getrennte Root- und Tenant-Administrationsrouten.
- Der Root-`system_admin` pflegt installationsweite Standards für verfügbare
  Sprachen, Standardsprache, lokalisierte Erklärungstexte und Gesprächsspeicherung.
- Der `tenant_admin` sieht die geerbten Systemstandards und kann dieselben Werte
  gezielt für seinen Tenant überschreiben oder auf Vererbung zurücksetzen.
- Schmale Plugin-Admin-APIs verwenden bestehende SSF-Repositories,
  Validierungsgrenzen und getrennte Root-/Tenant-Berechtigungen.
- Die Tenant-Oberfläche zeigt die wirksame Konfiguration und Revision.
- Branding, Logo, Icon, Tenantname und Zeitzone sind nicht Teil dieses Changes.
  Tenantname und Zeitzone bleiben in der allgemeinen Instanzverwaltung;
  Branding wird nicht vorbereitet.

## Impact

- Affected specs: `ssf-runtime-configuration-ui` (neu)
- Affected code: `packages/plugin-ssf`, `apps/sva-studio-react`
- Dependencies: Runtime-Konfiguration, Plugin-Server-Dispatcher,
  Root-/Tenant-Ausführungskontext und Studio-Formularfundamente
