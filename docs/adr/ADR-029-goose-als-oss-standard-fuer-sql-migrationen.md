# ADR-029: `goose` als OSS-Standard für SQL-Migrationen

**Status:** Accepted
**Entscheidungsdatum:** 2026-04-01
**Entschieden durch:** SVA Studio Team
**GitHub Issue:** TBD
**GitHub PR:** TBD

---

## Kontext

Das Projekt verwaltet IAM-relevante Postgres-Schemaänderungen derzeit über rohe SQL-Dateien unter `packages/data/migrations/` sowie einen eigenen Shell-Runner (`packages/data/scripts/run-migrations.sh`). Dieses Modell hält SQL als Source of Truth bewusst nah an Postgres-spezifischen Konzepten wie Row Level Security, Rollen, Policies, Grants, Constraints und Triggern.

Für den aktuellen Projektstand reicht die reine Dateiausführung ohne echten Migrationsstatus jedoch nicht mehr aus. Mehrere lokale Profile, produktionsnahe Docker-Szenarien, Acceptance-/Swarm-Betrieb und IAM-kritische Datenhaltung erhöhen die Anforderungen an Nachvollziehbarkeit und Betriebssicherheit.

Konkrete Probleme des bisherigen Modells:

- fehlende maschinenlesbare Antwort auf die Frage, welche Migrationen in einer Umgebung bereits angewendet wurden
- keine eingebaute Drift-Erkennung für versehentlich nachträglich geänderte Migrationsdateien
- manuelle Betriebswege bleiben notwendig, aber ihr Ergebnis ist nicht ausreichend standardisiert überprüfbar
- Schema-Drift wird oft erst indirekt über Healthchecks, Schema-Guards oder Laufzeitfehler sichtbar

Zusätzliche Constraints:

- Open Source ist ein Muss; Open-Core- oder Source-Available-Modelle sind nicht ausreichend
- Postgres-spezifische SQL-Artefakte sollen weiterhin explizit und reviewbar bleiben
- das Tool muss zu pnpm/Nx/Docker-Skripten integrierbar sein, ohne den TypeScript-Stack zum DB-Schema-Owner zu machen
- das Projekt will kein ORM- oder Model-first-Migrationssystem als führendes Architekturpattern einführen

## Entscheidung

Das Projekt führt `goose` als verbindlichen OSS-Standard für versionierte SQL-Migrationen ein.

Kernpunkte der Entscheidung:

- `goose` wird das führende Werkzeug für Status, Versionierung und Ausführung von SQL-Migrationen
- SQL bleibt die maßgebliche Vertragsform für Schemaänderungen
- Postgres-spezifische Sicherheits- und Isolationsartefakte wie RLS, Policies, Rollen und Grants bleiben explizit in Migrationen formuliert
- bestehende Shell-/Nx-/Runtime-Pfade werden schrittweise auf `goose` umgestellt, statt dauerhaft einen projektindividuellen Tracker zu pflegen
- der bisherige rein dateibasierte Lauf ohne standardisierte Migrationshistorie wird mittelfristig ersetzt

## Begründung

### 1. Beste Passung zwischen OSS-Anforderung und Betriebsreife

Das Projekt benötigt ein Werkzeug mit echter OSS-Lizenz und gleichzeitig belastbarem Migrationsstatus. `goose` erfüllt beides: Es ist OSS-lizenziert und bietet ein etabliertes Modell mit `status`, `version`, `validate`, `up`, `down`, `up-to` und `down-to`.

### 2. SQL-first bleibt fachlich richtig

Für dieses Projekt sind viele Schemaartefakte sicherheits- und plattformspezifisch:

- Row Level Security
- Policies
- Rollen und Grants
- Postgres-Funktionen
- Constraints und Datenintegritätsregeln

Diese Artefakte sind in rohem SQL präziser, reviewbarer und langfristig stabiler als in einem ORM- oder TypeScript-generierten Abstraktionsmodell. `goose` stärkt den Betriebsrahmen um SQL, ohne SQL als führende Beschreibungsebene aufzugeben.

### 3. Bessere Architektur als Eigenbau-Tracking

Ein eigener Migrationstracker auf Basis der bestehenden Shellskripte wäre kurzfristig möglich, würde aber projektindividuelle Betriebssemantik dauerhaft in Eigenverantwortung ziehen. Dazu gehören unter anderem:

- Statusmodell
- Driftregeln
- Locking-Strategien
- Fehler- und Recovery-Semantik
- CLI- und CI-Integration

Diese Verantwortung ist für ein Produktteam langfristig schlechter investierte Energie als die Nutzung eines etablierten OSS-Werkzeugs.

### 4. Bessere Passung als ultraleichtgewichtige Alternativen

Leichtere OSS-Tools wie `dbmate` sind attraktiv, fokussieren sich aber stärker auf Minimalismus. Für das Zielbild dieses Projekts ist ein robusteres, expliziteres Migrationsmodell wichtiger als maximale Leichtgewichtigkeit.

### 5. Gute Trennung zum TypeScript-Stack

`goose` ist nicht TypeScript-first, steht dem Stack aber nicht entgegen. Das ist in diesem Projekt ein Vorteil: Der TypeScript-/Nx-/App-Stack bleibt für Anwendungslogik verantwortlich, während DB-Migrationen als bewusst eigenständiges SQL-/Betriebsthema behandelt werden.

## Alternativen

### Alternative A: Bestehenden Shell-Runner beibehalten

**Vorteile:**

- ✅ kein Einführungsaufwand
- ✅ volle Kontinuität zum aktuellen Zustand
- ✅ rohe SQL-Dateien bleiben unverändert

**Nachteile:**

- ❌ kein standardisierter Migrationsstatus
- ❌ Drift wird zu spät erkannt
- ❌ hoher Anteil impliziten Betriebswissens
- ❌ schwache Skalierung für mehrere Umgebungen und reproduzierbare Deploys

**Warum verworfen:**

Der operative Reifegrad reicht für das Zielbild des Projekts nicht mehr aus.

### Alternative B: Eigenbau-Tracker auf dem bestehenden SQL-Runner

**Vorteile:**

- ✅ sehr gute Passung zum aktuellen Repo
- ✅ geringe Umstellung der bestehenden Dateien und Skripte
- ✅ volle Kontrolle über Integrationsdetails

**Nachteile:**

- ❌ dauerhaft eigene Verantwortung für Tracker- und Betriebslogik
- ❌ zusätzlicher interner Infrastrukturcode ohne Produktmehrwert
- ❌ Locking, Checksums, Recovery und Statusmodell müssten selbst gepflegt werden

**Warum verworfen:**

Die Architektur soll an dieser Stelle bewusst standardisieren statt eine proprietäre Teillösung zu pflegen.

### Alternative C: `dbmate`

**Vorteile:**

- ✅ OSS und leichtgewichtig
- ✅ SQL-first
- ✅ einfache Integration

**Nachteile:**

- ❌ stärker minimalistisch ausgerichtet
- ❌ geringerer funktionaler Zielabstand zum heutigen Shell-Runner
- ❌ für das gewünschte Betriebsniveau weniger überzeugend als `goose`

**Warum verworfen:**

Für das Projektziel ist ein robusteres, expliziteres OSS-Migrationsmodell sinnvoller.

### Alternative D: Flyway oder ähnliche Open-Core-/Source-Available-Tools

**Vorteile:**

- ✅ ausgereiftes Migrations- und Betriebsmodell
- ✅ gute Historie- und Statusfunktionen

**Nachteile:**

- ❌ nicht vereinbar mit dem Projekt-Constraint "OSS ist ein Muss"

**Warum verworfen:**

Das Lizenzmodell ist für dieses Projekt nicht akzeptabel.

### Alternative E: ORM-/Model-first-Migrationssystem

**Vorteile:**

- ✅ stärkere TypeScript-Nähe
- ✅ teilweise gute Developer Experience für CRUD-lastige Schemata

**Nachteile:**

- ❌ schlechtere Passung zu RLS, Rollen, Policies, Grants und Postgres-spezifischer Logik
- ❌ verschiebt die führende Beschreibungsebene unnötig weg von SQL
- ❌ erhöht die Wahrscheinlichkeit eines gemischten, schwerer wartbaren Migrationsmodells

**Warum verworfen:**

Die fachlichen und sicherheitsrelevanten DB-Artefakte dieses Projekts sind SQL-first besser aufgehoben.

## Konsequenzen

### Positive Konsequenzen

- ✅ eindeutiger Migrationsstatus pro Umgebung
- ✅ standardisierterer Betriebsweg für lokale, Acceptance- und spätere Produktionsumgebungen
- ✅ SQL bleibt als führende, reviewbare Schema-Vertragsebene erhalten
- ✅ geringerer Bedarf an projektindividueller Migrationsinfrastruktur
- ✅ bessere Grundlage für Runtime-Doctor-, Smoke- und Deploy-Prüfungen

### Negative Konsequenzen

- ❌ bestehende Migrationsdateien müssen an das `goose`-Format und die Zielkonventionen angepasst oder in einen kompatiblen Pfad überführt werden
- ❌ Shellskripte, Nx-Targets, Runtime-Profile und Betriebsdoku müssen umgestellt werden
- ❌ das Team muss ein zusätzliches CLI und dessen Semantik lernen
- ❌ die Trennung zwischen TypeScript-App-Logik und SQL-Migrationslogik bleibt bewusst bestehen und fühlt sich nicht "TS-nativ" an

### Mitigationen

- Einführungsphase in klaren Schritten statt Big-Bang-Migration
- bestehende Schema-Guards und Validierungen zunächst beibehalten
- `goose`-Kommandos hinter pnpm-/Nx-Targets kapseln
- klare Repo-Konvention für neue Migrationen inklusive Review-Regeln dokumentieren

## Implementierungs-Roadmap

- [ ] `goose` als Tooling-Abhängigkeit bzw. reproduzierbaren CLI-Pfad festlegen
- [ ] Zielkonvention für Migrationsdateien und Verzeichnisstruktur dokumentieren
- [ ] bestehende `data:db:*`-Targets auf `goose` umstellen oder kompatibel kapseln
- [ ] bestehenden SQL-Bestand in einen `goose`-kompatiblen Pfad überführen
- [ ] lokalen Docker-/Runtime-Migrationspfad mit `goose` integrieren
- [ ] Acceptance-/Swarm-Runbooks auf den neuen Migrationspfad aktualisieren
- [ ] `doctor`- und Deploy-Prüfungen um echten Migrationsstatus ergänzen

## Verwandte ADRs

- [ADR-019](ADR-019-swarm-traefik-referenz-betriebsprofil.md): Swarm-/Traefik-Referenz-Betriebsprofil mit bewusst manuellem DB-Initialisierungspfad
- [ADR-010](ADR-010-verschluesselung-iam-core-data-layer.md): IAM-Datenhaltung mit sicherheitsrelevanten DB-Constraints
- [ADR-017](ADR-017-modulare-iam-server-bausteine.md): Modulare Trennung von fachlicher Logik und technischer Infrastruktur

## Externe Referenzen

- [pressly/goose](https://github.com/pressly/goose)
- [goose SQL migrations](https://github.com/pressly/goose?tab=readme-ov-file#sql-migrations)

## Gültigkeitsdauer

Diese ADR bleibt gültig, bis:

- ein anderes OSS-konformes SQL-Migrationswerkzeug die Anforderungen nachweislich besser erfüllt oder
- das Projekt seine DB-Architektur grundlegend von SQL-first auf ein anderes führendes Modell umstellt
