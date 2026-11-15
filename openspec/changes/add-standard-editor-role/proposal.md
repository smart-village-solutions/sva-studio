# Change: Standard Redakteur automatisch pro Mandant anlegen

## Why

Alle Mandanten benötigen eine löschbare redaktionelle Standardrolle ohne Administrationsrechte. Der bestehende Change `add-editor-role-baseline` deckt nur eine ausdrücklich ausgewählte manuelle MCP-Anlage für News, Veranstaltungen und POI ab; automatische Neuanlage und einmaliger Bestandsabgleich fehlen.

## What Changes

- Rolle `standard_editor` mit Anzeigename „Standard Redakteur“ bei der Erstellung neuer Mandanten automatisch anlegen, ohne Benutzerzuweisung.
- Bei allen bestehenden Mandanten im regulären Rollout einmalig per Datenmigration ergänzen. Vorhandene Rollen und Zuweisungen nicht überschreiben; Ergebnis je Mandant unabhängig zurücklesen.
- Alle verfügbaren Inhaltsmodule redaktionell bedienen: lesen, suchen, Vorschau, erstellen, Metadaten und Fachdaten bearbeiten, löschen, veröffentlichen, zurückziehen, planen, archivieren, wiederherstellen und Historie lesen; Push-Versand einschließen, soweit fachlich unterstützt.
- Bestehenden Ownership-Scope `organization` verwenden: Inhalte der aktiven eigenen Organisation ODER persönlich zugeordnete Inhalte desselben Mandanten. Ohne aktive Organisation gelten ausschließlich eigene persönliche Inhalte. Erstellerschaft allein ist kein Eigentumsnachweis.
- Medien und Kategorien mandantenweit lesen, erstellen, bearbeiten, verwenden und löschen; Referenzintegrität erhalten.
- Rolle löschbar halten und nach bewusster Löschung weder bei erneutem Start noch durch Modulabgleich wieder anlegen. Später verfügbare Inhaltsmodule bei noch vorhandener Standardrolle berücksichtigen.

## Grenzen

Ziel: Das vereinbarte Redaktionsprofil über die bestehenden IAM-, Mandantenanlage-, Modulabgleich- und Migrationspfade bereitstellen.

Nicht-Ziele: automatische Benutzerzuweisung, Benutzer-/Rollen-/Organisationsverwaltung, Modulkonfiguration, Schnittstellenverwaltung, Eigentumsübertragung, Revisionsverwaltung, neue globale Autorisierungsmodi oder eigenständige Verwaltungsdienste. Das bestehende Profil `editor` und dessen MCP-Auftrag bleiben unverändert.

Maximal betroffene Bereiche der späteren Umsetzung: bestehende Core-Permission-/Modulverträge, IAM-Repositories und Autorisierungsverbraucher, Mandantenanlage/Modulabgleich, Datenmigration sowie unmittelbar zugehörige Tests und Dokumentation. Dieser Auftrag erstellt ausschließlich den Change; Implementierung und produktive Mutationen sind nicht erfolgt.

## Impact

- Specs: `iam-access-control`, `instance-provisioning`.
- Bestehende Pfade: `packages/core`, `packages/data-repositories`, `packages/auth-runtime`, `packages/iam-admin`, `packages/data/migrations`, erforderliche Inhaltsmodul-Verträge und Mainserver-Aufrufe.
- Bei Umsetzung arc42 04 Lösungsstrategie, 05 Bausteinsicht, 06 Laufzeitsicht und 08 Querschnittskonzepte prüfen und betroffene Abschnitte aktualisieren.
- Vor DB-Änderungen `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` prüfen; bei Schemaänderungen beide fortschreiben.
- Regulärer Rollout ausschließlich gemäß `docs/guides/studio-rollout-process.md`.

## Status

Fachliche Festlegungen aus dem Dialog vom 15.11.2026 dokumentiert. Lokal umgesetzt und gezielt geprüft; technisches Review und Regressionen sind im Design dokumentiert. PR-/CI-Nachweis und späterer Rollout sowie Live-Abnahmen werden getrennt geführt.
