## MODIFIED Requirements

### Requirement: Instanzgebundene Hierarchieauswertung

Das System SHALL Hierarchie- und Vererbungsentscheidungen strikt innerhalb der aktiven `instanceId` auswerten und die Organisationshierarchie als autoritative Eingangsgröße für effektive Permission-Vererbung bereitstellen.

#### Scenario: Hierarchiezugriff über Instanzgrenze

- **WHEN** eine Hierarchieauswertung Daten außerhalb der aktiven `instanceId` referenziert
- **THEN** werden diese Daten nicht in die effektive Berechnung einbezogen
- **AND** die Autorisierungsentscheidung bleibt instanzisoliert

#### Scenario: Organisationshierarchie speist Permission-Vererbung

- **WHEN** `POST /iam/authorize` oder `GET /iam/me/permissions` effektive Rechte im aktiven Organisationskontext berechnen
- **THEN** nutzt die Berechnungsstrecke die persistierte Organisationshierarchie derselben `instanceId`
- **AND** Parent-/Child-Beziehungen werden als autoritativer Vererbungsinput ausgewertet

## ADDED Requirements

### Requirement: Kanonisches Datenmodell für Organisationen und Geo-Hierarchie

Das System SHALL Organisationen und geografische Einheiten als separate, instanzgebundene Entitäten persistieren. Owner dieses Modells ist `iam-organizations` (Schreibzugriff); `iam-access-control` hat ausschließlich Lesezugriff über ein definiertes Interface.

**Datenbankschema (normativ):**

Organisationen:
- `id` UUID PK
- `instance_id` UUID NOT NULL (FK, instanzgebunden)
- `parent_id` UUID NULLABLE (FK → `organizations.id`, gleiche Instanz)
- `name` TEXT NOT NULL
- `type` TEXT NOT NULL (z. B. `municipality`, `district`)
- `external_key` TEXT NULLABLE (Verwaltungsschlüssel)
- Unique-Constraint: `(instance_id, external_key)` wenn external_key NOT NULL
- Soft-Delete via `deleted_at` TIMESTAMP

Geo-Hierarchie (Closure-Table):
- `ancestor_id` UUID NOT NULL (FK → `geo_nodes.id`)
- `descendant_id` UUID NOT NULL (FK → `geo_nodes.id`)
- `depth` INTEGER NOT NULL (0 = self)
- PK: `(ancestor_id, descendant_id)`

Geo-Knoten:
- `id` UUID PK
- `instance_id` UUID NOT NULL
- `key` TEXT NOT NULL (Format: `{ebene}:{schluessel}`, z. B. `district:09162`, `municipality:09162000`)
- `name` TEXT NOT NULL
- Unique-Constraint: `(instance_id, key)`
- Maximale Tiefe: 5 Ebenen; tiefere Einfügeversuche werden mit HTTP 422 abgewiesen

#### Scenario: Geo-Knoten-Einfügung überschreitet Tiefenlimit

- **WHEN** ein Geo-Knoten mit einer Vorfahren-Kette von mehr als 5 Ebenen eingefügt werden soll
- **THEN** lehnt das System die Operation mit HTTP 422 und einem dokumentierten Fehlercode ab
- **AND** die bestehende Hierarchie bleibt unverändert

### Requirement: Read-Interface für externe Konsumenten

Das System SHALL ein Read-Interface für Hierarchiedaten bereitstellen, über das `iam-access-control` und andere autorisierte Module Org- und Geo-Hierarchien abfragen können, ohne direkt auf die Datenbanktabellen zuzugreifen.

#### Scenario: Vorfahren-Abfrage für Org-Kontext

- **WHEN** `iam-access-control` im Recompute-Pfad alle Vorfahren einer Organisation benötigt
- **THEN** stellt `iam-organizations` diese Daten über ein Closure-Table-Query in maximal 1 DB-Roundtrip bereit
- **AND** die Antwort enthält `orgId`, `ancestorIds[]` und `depth`-Werte

#### Scenario: Geo-Hierarchie für Snapshot-Berechnung

- **WHEN** der Geo-Kontext eines Nutzers für den Permission-Snapshot berechnet wird
- **THEN** liefert `iam-organizations` alle relevanten Geo-Knoten (Vorfahren + Selbst) für den aktiven Geo-Scope
- **AND** das Ergebnis ist auf die aktive `instanceId` begrenzt
