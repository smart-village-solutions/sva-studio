# Change: Modul-Workspace als eigener Tab in der Instanz-Detailseite

## Why

Die bestehende Root-Admin-Modulverwaltung unter `/admin/modules` funktioniert fachlich, liegt aber getrennt von der operativen Instanzverwaltung. Fuer Root-Admins ist die Modulfreigabe einer konkreten Instanz damit ein Medienbruch: Befund, Konfiguration und Historie liegen auf der Instanz-Detailseite, die eigentliche Modulmutation aber auf einer separaten Sammelseite.

Der neue Root-Admin-Tab soll diese Luecke schliessen, ohne den bestehenden zentralen Bereich `Module` abzuschaffen oder eine zweite fachliche Mutationslogik einzufuehren.

## What Changes

- Erweitere die Root-Admin-Instanz-Detailseite `/admin/instances/:instanceId` um einen vierten Tab `Module`.
- Verlege die instanzgebundene Modulverwaltung fuer Root-Admins in einen gemeinsamen, wiederverwendbaren Workspace, der sowohl im neuen Detail-Tab als auch weiter auf `/admin/modules` genutzt wird.
- Ermoegliche im neuen Tab fuer genau diese Instanz:
  - Modul zuweisen
  - Modul entziehen
  - IAM-Baseline neu aufbauen
  - Admin-Struktur initialisieren
- Halte `/admin/modules` als zentrale Sammelseite fuer Root-Admins weiterhin verfuegbar.
- Fuehre keine neue Rechte- oder Backend-Logik ein; die bestehenden Root-only-Mutationen und Guards bleiben fuehrend.

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
