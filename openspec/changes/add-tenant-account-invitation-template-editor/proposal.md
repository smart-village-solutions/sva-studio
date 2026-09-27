# Change: Tenant bearbeitet seine Account-Einladungsvorlage

## Why

Die vorhandene Instanzvorlage kann bislang nur ein Plattformadministrator im Instanzdetail ändern. Ein berechtigter Tenant soll den Text für seine eigenen Nutzer im Studio pflegen können.

## What Changes

- `Benutzer -> Einladungsvorlage` zeigt die wirksame Vorlage und erlaubt einen instanzgebundenen Override samt Vorschau und Reset.
- Die neue verwaltete Permission `iam.invitationTemplate.manage` schützt Navigation, Route, Lesen und Schreiben. Bestehende `system_admin`-Rollen erhalten sie per Migration; danach ist sie delegierbar.
- Die Tenant-API bindet den Instanzbezug ausschließlich an die authentifizierte Session. Sie nutzt die bestehende Registry-Persistenz, Validierung und Revisionierung.

## Non-Goals

- Passwort-vergessen-E-Mails, freier HTML-Editor oder neuer Maildienst
- neues Plugin, neuer Versandpfad oder Änderung der Root-Host-Vorlagenverwaltung

## Impact

- Affected specs: `account-ui`, `iam-core`
- Affected code: IAM-Permissionkatalog und Migration, Auth-Runtime, Routing, Studio-UI
- Affected arc42 sections: 05, 06, 08

Die belegte Lücke ist die fehlende Tenant-Self-Service-Autorisierung und -Route. Direkter Verbraucher ist die neue Seite im Benutzer-Menü; die Root-Registry-API akzeptiert keinen Tenant-Host, daher erhält der vorhandene Auth-Runtime-Pfad einen engen Tenant-Endpunkt statt eines neuen Plugins oder Dienstes.
