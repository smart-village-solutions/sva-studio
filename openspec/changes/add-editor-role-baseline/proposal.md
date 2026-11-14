# Change: Redaktionsprofil über bestehendes persönliches MCP einrichten

## Why

Issue #1281 benötigt ein reproduzierbares Redaktionsprofil ohne Benutzerverwaltung. Der persönliche MCP besitzt Rollen-CRUD, aber noch keinen konkreten Profilauftrag für ausdrücklich ausgewählte Tenants und keinen Permissions-Lesezugriff zur Auflösung der tenantlokalen IDs.

## What Changes

- Ein schmales persönliches MCP-Tool richtet das fehlende Profil über vorhandene IAM-APIs ein; vorhandene Rollen werden nur verglichen und nie ergänzt oder ersetzt. Die vorhandene `system_admin`-Basis wird vorausgesetzt und nicht neu definiert.
- Unterstützt werden zunächst News, Veranstaltungen und POI mit Organisationsscope. Medien und Kategorien sind entsprechend ausdrücklicher Nutzerentscheidung instanzweit. Weitere Inhaltstypen werden nicht stillschweigend instanzweit freigegeben.
- Die sieben bestehenden News-/Events-/POI-Mutationsaufrufe erzwingen den vorhandenen exakten Ownership-Check. Der globale Resolvermodus bleibt unverändert.
- `content.publish` erhält die vorhandene Record-Scope-Klassifikation, damit eine Organisationszuweisung nicht auf `all` erweitert wird. History-, Revisions-, Benutzer-, Rollen-, Gruppen- und Ownership-Transfer-Rechte werden nicht vergeben.

## Grenzen und Nachweise

- Nur explizite konfigurierte Tenant-Kontexte; Plattformkontexte und doppelte IDs sind ungültig. Erfolg/Fehler werden je Kontext gemeldet. Keine produktiven Zuordnungen im Entwicklungsauftrag.
- Vor Mutation Rollen und Permissions lesen; bestehende gleichnamige Rollen bleiben unverändert. Nach Anlage unabhängig zurücklesen und alle gewährten Actions/Scopes prüfen. Unsicherer Ausgang bedeutet kein behaupteter Erfolg und keinen automatischen zweiten Write.
- Positive eigene Organisation, negative fremde Organisation und unverändertes `all`-Adminverhalten für den vorhandenen Ownership- und Publish-Pfad nachweisen. MCP-Tests decken mindestens zwei Testtenants, nicht ausgewählte Kontexte, individuell geänderte Rollen und Readback-Abweichungen ab.
- Neue Capability benötigt nur das MCP-Tool und seinen getesteten Profilablauf im vorhandenen Package. Kein Service, Template-CRUD, DB-Schema oder neue Autorisierungsabstraktion.

## Impact

- Specs: `iam-access-control`
- Code: `studio-mcp`, vorhandene Mutationsaufrufe in `sva-mainserver`, `iam-admin`-Permission-Metadaten
- arc42: 05 Bausteinsicht und 08 Querschnittskonzepte; bestehende ADR-067 wird hinsichtlich der nun verwendeten Routen präzisiert.
- Keine Änderung an Tenant-Isolation, Live-Rollenzuweisungen, Merge oder Rollout.
