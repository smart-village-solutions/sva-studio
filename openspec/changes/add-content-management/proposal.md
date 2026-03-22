# Change: Inhaltsverwaltung mit Tabellen-, Detail- und Bearbeitungsansicht

## Why
Für SVA Studio fehlt eine verbindliche Spezifikation für die redaktionelle Verwaltung von Inhalten. Benötigt wird eine fachliche Inhaltsverwaltung mit Tabellenansicht, Erstellungs- und Bearbeitungsmaske, nachvollziehbarer Historie sowie klarer Anbindung an das Rollen- und Rechtemodul. Gleichzeitig soll `Inhalt` als wiederverwendbares Core-Element dienen, das für spezielle Datentypen kontrolliert über das SDK erweitert werden kann.

## What Changes
- Führt eine neue Capability `content-management` für Inhaltsliste, Detail-/Bearbeitungsansicht, Statusmodell und Historie ein
- Definiert ein fachliches Core-Inhaltsmodell mit `contentType`, `title`, `publishedAt`, `createdAt`, `updatedAt`, `author`, `payload`, `status` und `history`
- Beschreibt einen Admin-Flow mit Tabellenansicht, Button für neue Inhalte sowie separater Erstellungs- und Bearbeitungsansicht
- Verankert `Inhalt` als stabiles Core-Element in `packages/core` und beschreibt SDK-Erweiterungspunkte für typspezifische Felder, Validierung, UI und Aktionen
- Verankert die Inhaltsverwaltung in der zentralen IAM-Autorisierung, damit Lesen, Anlegen, Bearbeiten, Freigeben, Veröffentlichen, Archivieren und Historieneinsicht rollenbasiert steuerbar sind
- Ergänzt Audit- und Historienanforderungen, damit Änderungen an Inhalten und Statuswechsel revisionssicher nachvollzogen werden können
- Verankert lokal reproduzierbare und verifizierte DB-Migrationen als verbindlichen Teil der Umsetzung, um bekannte Fehler durch nicht getestete lokale Migrationspfade zu vermeiden

## Impact
- Affected specs: `content-management`, `iam-access-control`, `iam-auditing`
- Affected code: `apps/sva-studio-react/src/routes/admin/contents/*`, `apps/sva-studio-react/src/components/*`, `apps/sva-studio-react/src/lib/iam-api.ts`, `packages/core/src/content-management/*`, `packages/sdk/src/*`, `packages/auth/src/*`, `packages/data/migrations/*`
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/10-quality-requirements.md`
