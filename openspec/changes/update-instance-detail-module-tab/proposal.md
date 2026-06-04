# Change: Modul-Workspace als eigener Tab in der Instanz-Detailseite

## Why

Die bestehende Root-Admin-Modulverwaltung unter `/admin/modules` funktioniert fachlich, liegt aber getrennt von der operativen Instanzverwaltung. Für Root-Admins ist die Modulfreigabe einer konkreten Instanz damit ein Medienbruch: Befund, Konfiguration und Historie liegen auf der Instanz-Detailseite, die eigentliche Modulmutation aber auf einer separaten Sammelseite.

Der neue Root-Admin-Tab soll diese Lücke schließen, ohne den bestehenden zentralen Bereich `Module` abzuschaffen oder eine zweite fachliche Mutationslogik einzuführen.

## What Changes

- Erweitere die Root-Admin-Instanz-Detailseite `/admin/instances/:instanceId` um einen vierten Tab `Module`.
- Verlege die instanzgebundene Modulverwaltung für Root-Admins in einen gemeinsamen, wiederverwendbaren Workspace, der sowohl im neuen Detail-Tab als auch weiter auf `/admin/modules` genutzt wird.
- Ermögliche im neuen Tab für genau diese Instanz:
  - Modul zuweisen
  - Modul entziehen
  - IAM-Baseline neu aufbauen
  - Admin-Struktur initialisieren
- Halte `/admin/modules` als zentrale Sammelseite für Root-Admins weiterhin verfügbar.
- Führe keine neue Rechte- oder Backend-Logik ein; die bestehenden Root-only-Mutationen und Guards bleiben führend.

## Impact

- Affected specs:
  - `account-ui`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/instances`
  - `apps/sva-studio-react/src/routes/admin/modules`
  - `apps/sva-studio-react/src/hooks/use-instances.ts`
  - `apps/sva-studio-react/src/i18n/resources.ts`
- Affected arc42 sections:
  - keine normative Architekturwirkung; betroffene Betriebsdoku wird in `docs/guides/instance-module-management.md` nachgezogen
