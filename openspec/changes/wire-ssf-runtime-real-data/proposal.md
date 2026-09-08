# Change: Echte SSF-Runtime-Daten verdrahten

## Why

Der interne SSF-Runtime-Endpunkt ist implementiert, bleibt im produktiven
Serverpfad aber wegen Platzhalter-Providern für Datenbankbereitschaft und
Autorisierungsrevision stets geschlossen. Außerdem fehlt dem generischen
Instanzprofil die für den Vertrag erforderliche Tenant-Zeitzone.

## What Changes

- Der Studio-Host liest SSF-Tenantbereitschaft und bestätigte
  `authorizationRevision` aus der SSF-Plugin-Datenbank.
- Handler und Host-Gates verwenden denselben lazy initialisierten SSF-DB-Pool.
- `iam.instances` und `InstanceRegistryRecord` erhalten eine generische
  Zeitzone; bestehende und neue Instanzen starten mit `Europe/Berlin`.
- Fehlende Konfiguration, unbekannte Tenantdaten und DB-Fehler bleiben
  fail-closed.

## Impact

- Affected specs: `ssf-runtime-configuration`, `instance-provisioning`
- Affected code: `packages/{core,data,data-repositories,auth-runtime,plugin-ssf}`,
  `apps/sva-studio-react`
- Affected arc42 sections: 05 Bausteinsicht, 08 Querschnittliche Konzepte
