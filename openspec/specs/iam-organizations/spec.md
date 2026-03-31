# iam-organizations Specification

## Purpose
Diese Spezifikation beschreibt das instanzzentrierte Mandanten- und Organisationsmodell im IAM, den Wechsel des Organisationskontexts innerhalb einer Instanz sowie die technischen Leitplanken für lokale Postgres-Bereitstellung, RLS-basierte Instanzisolation und betriebssichere Migrationen/Seeds.
## Requirements
### Requirement: Multi-Org-Kontextwechsel im aktiven Instanzkontext

Das System MUST Benutzern mit mehreren Organisationszuordnungen den Kontextwechsel innerhalb der aktiven `instanceId` ermöglichen und den gewählten Organisationskontext belastbar für nachgelagerte Zugriffe bereitstellen.

#### Scenario: Benutzer wechselt Organisationskontext

- **WHEN** ein authentifizierter Benutzer Mitglied in mehreren Organisationen derselben Instanz ist
- **THEN** kann er den aktiven Organisationskontext wechseln
- **AND** der gewählte Kontext wird in der Session für nachgelagerte Zugriffe bereitgestellt

#### Scenario: Benutzer wählt unzulässigen Organisationskontext

- **WHEN** ein authentifizierter Benutzer einen Organisationskontext setzt, für den in der aktiven `instanceId` keine gültige Mitgliedschaft besteht
- **THEN** wird die Operation abgewiesen
- **AND** der bisherige gültige Organisationskontext bleibt erhalten

#### Scenario: Deaktivierte Organisation kann kein aktiver Kontext werden

- **WHEN** ein authentifizierter Benutzer einen deaktivierten Organisationskontext setzen will
- **THEN** wird die Operation abgewiesen
- **AND** ein weiterhin gültiger bisheriger Session-Kontext bleibt aktiv

### Requirement: Keine Persistenz- und RLS-Modellierung in Child A

Das System MUST in Child A keine vollständige Organisationspersistenz, RLS-Policy-Definition oder Hierarchieauswertung spezifizieren; diese liegen in Child B/D.

#### Scenario: Datenmodell außerhalb Child-A-Scope

- **WHEN** Anforderungen zu `iam.organizations`, RLS-Policies oder Hierarchie-Vererbung entstehen
- **THEN** werden diese in den zugehörigen Child-Changes (B/D) spezifiziert
- **AND** Child A bleibt auf Identity- und Kontextbereitstellung begrenzt

### Requirement: Instanzzentriertes Mandantenmodell

Das System SHALL `instanceId` als kanonischen Mandanten-Scope verwenden. Organisationen sind Untereinheiten innerhalb einer Instanz.

#### Scenario: Instanz mit mehreren Organisationen

- **WHEN** eine Instanz mehrere Organisationen enthält
- **THEN** können Benutzer innerhalb derselben Instanz einer oder mehreren Organisationen zugeordnet werden
- **AND** diese Zuordnungen bleiben auf die Instanz begrenzt

### Requirement: Lokale Postgres-Bereitstellung für IAM-Datenmodell

Das System SHALL eine reproduzierbare lokale Postgres-Bereitstellung über Docker für Entwicklung und Tests bereitstellen.

#### Scenario: Lokaler Start der IAM-Datenbank

- **WHEN** ein Entwickler die lokale IAM-Umgebung startet
- **THEN** ist die Postgres-Instanz erreichbar und health-checked
- **AND** das `iam`-Schema kann durch Migrationen erstellt werden

### Requirement: RLS-basierte Instanzisolation

Das System SHALL instanzüberschreitende Datenzugriffe auf Datenbankebene durch Row-Level-Security verhindern.

#### Scenario: Zugriff auf fremde Instanzdaten

- **WHEN** ein Request-Kontext auf `instanceId=A` begrenzt ist
- **AND** ein Datenzugriff auf Datensätze mit `instanceId=B` erfolgt
- **THEN** liefert die Datenbank keinen Zugriff auf diese Datensätze

### Requirement: Migrations- und Seed-Betriebssicherheit

Das System SHALL versionierte Migrationen mit Rollback-Pfad und idempotenten Seeds für IAM-Basisdaten bereitstellen.

#### Scenario: Wiederholte Seed-Ausführung

- **WHEN** Seeds mehrfach ausgeführt werden
- **THEN** entstehen keine doppelten Basisrollen oder inkonsistenten Zuordnungen
- **AND** der Datenbestand bleibt konsistent

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

### Requirement: Hierarchisches Organisationsmodell innerhalb einer Instanz

Das System SHALL Organisationen als hierarchische Einheiten innerhalb der aktiven `instanceId` modellieren.

#### Scenario: Root- und Child-Organisation in derselben Instanz

- **WHEN** ein Administrator eine Organisation mit Parent-Referenz anlegt
- **THEN** referenziert der Parent eine Organisation derselben `instanceId`
- **AND** die Child-Organisation wird als untergeordnete Einheit der Parent-Organisation gespeichert

#### Scenario: Parent aus fremder Instanz wird abgewiesen

- **WHEN** eine Organisation mit einem Parent aus einer anderen `instanceId` verknüpft werden soll
- **THEN** wird die Operation abgewiesen
- **AND** die Daten bleiben unverändert

### Requirement: Zyklusfreie Organisationshierarchie

Das System MUST zyklische Beziehungen in der Organisationshierarchie verhindern.

#### Scenario: Organisation wird auf eigenes Child umgehängt

- **WHEN** ein Administrator versucht, eine Organisation auf einen ihrer Nachfahren als Parent umzuhängen
- **THEN** wird die Änderung abgewiesen
- **AND** ein Validierungsfehler beschreibt die Zyklusverletzung

### Requirement: Organisations-CRUD für Administratoren

Das System SHALL eine instanzgebundene Organisationsverwaltung über dedizierte Admin-Endpunkte bereitstellen.

#### Scenario: Organisation anlegen

- **WHEN** ein berechtigter Administrator `POST /api/v1/iam/organizations` mit gültigen Daten aufruft
- **THEN** wird eine neue Organisation in der aktiven `instanceId` angelegt
- **AND** die Antwort enthält die gespeicherte Organisationsrepräsentation

#### Scenario: Organisation bearbeiten

- **WHEN** ein berechtigter Administrator `PATCH /api/v1/iam/organizations/:organizationId` mit gültigen Änderungen aufruft
- **THEN** werden Name, Parent oder freigegebene Metadaten aktualisiert
- **AND** die Instanzgrenze bleibt unverändert

#### Scenario: Organisation mit abhängigen Children kann nicht unkontrolliert gelöscht werden

- **WHEN** ein Administrator eine Organisation mit untergeordneten Organisationen löschen oder deaktivieren will
- **THEN** erzwingt das System eine definierte Konflikt- oder Schutzreaktion
- **AND** die Hierarchie bleibt konsistent

#### Scenario: Delete-Endpunkt deaktiviert Organisation kontrolliert

- **WHEN** ein berechtigter Administrator `DELETE /api/v1/iam/organizations/:organizationId` für eine zulässige Organisation aufruft
- **THEN** wird die Organisation im ersten Schnitt kontrolliert deaktiviert statt physisch gelöscht
- **AND** bestehende Audit- und Referenzbezüge bleiben erhalten

### Requirement: Mehrfach-Zugehörigkeit von Accounts zu Organisationen

Das System SHALL Accounts mehreren Organisationen derselben Instanz zuordnen können.

#### Scenario: Account wird mehreren Organisationen zugeordnet

- **WHEN** ein Administrator einem Account mehrere Organisationen innerhalb derselben `instanceId` zuweist
- **THEN** werden alle gültigen Zuordnungen gespeichert
- **AND** der Account bleibt in jeder dieser Organisationen referenzierbar

#### Scenario: Instanzfremde Account-Zuordnung wird abgewiesen

- **WHEN** ein Account einer Organisation einer anderen `instanceId` zugeordnet werden soll
- **THEN** wird die Operation abgewiesen
- **AND** keine Zuordnung wird gespeichert

### Requirement: Organisationsarten und Basispolicies

Das System SHALL Organisationen mit einem kontrollierten Organisationstyp und organisationsbezogenen Basispolicies modellieren.

#### Scenario: Kommunale Organisation mit Typ anlegen

- **WHEN** ein Administrator eine Organisation vom Typ `municipality` oder einem äquivalenten unterstützten Typ anlegt
- **THEN** wird der Typ zusammen mit der Organisation gespeichert
- **AND** die Organisation bleibt für Hierarchie- und Filteroperationen nach Typ auswertbar

#### Scenario: Ungültiger Organisationstyp wird abgewiesen

- **WHEN** ein Administrator einen nicht unterstützten Organisationstyp speichert
- **THEN** wird die Operation mit einem Validierungsfehler abgewiesen
- **AND** die Daten bleiben unverändert

#### Scenario: Organisationsbezogene Autorenpolicy wird gesetzt

- **WHEN** ein Administrator für eine Organisation eine `content_author_policy` speichert
- **THEN** wird die Policy in der Organisationsrepräsentation persistiert
- **AND** nachgelagerte Module können diese Policy als organisationsbezogenen Kontext konsumieren

### Requirement: Lesefähiges Hierarchie-Read-Model

Das System SHALL Organisationsdaten in einem für Admin-Views geeigneten Read-Model bereitstellen.

#### Scenario: Organisationsliste enthält Strukturinformationen

- **WHEN** ein Administrator die Organisationsliste lädt
- **THEN** enthält jeder Eintrag mindestens Parent-Referenz, Tiefe oder äquivalente Strukturinformationen
- **AND** Child- und Membership-Zähler stehen für die Oberfläche zur Verfügung
- **AND** Organisationstyp und Basispolicies sind für Filterung oder Detailansichten verfügbar

#### Example: Read-Model für Organisationsliste

```json
{
  "organizations": [
    {
      "organizationId": "9d44d4f2-8c78-4d44-9f1d-6f6fe44d1001",
      "organizationKey": "lk-musterkreis",
      "displayName": "Musterkreis",
      "parentOrganizationId": null,
      "organizationType": "county",
      "contentAuthorPolicy": "org_only",
      "isActive": true,
      "depth": 0,
      "hierarchyPath": [],
      "childCount": 2,
      "membershipCount": 4
    },
    {
      "organizationId": "9d44d4f2-8c78-4d44-9f1d-6f6fe44d1002",
      "organizationKey": "gemeinde-musterstadt",
      "displayName": "Musterstadt",
      "parentOrganizationId": "9d44d4f2-8c78-4d44-9f1d-6f6fe44d1001",
      "organizationType": "municipality",
      "contentAuthorPolicy": "org_or_personal",
      "isActive": true,
      "depth": 1,
      "hierarchyPath": [
        "9d44d4f2-8c78-4d44-9f1d-6f6fe44d1001"
      ],
      "childCount": 1,
      "membershipCount": 3
    }
  ]
}
```

### Requirement: Membership-Metadaten für Organisationskontext

Das System SHALL Organisationszuordnungen mit Metadaten für Default-Kontext und interne/externe Sicht modellieren.

#### Scenario: Default-Kontext für Multi-Org-Account festlegen

- **WHEN** ein Administrator oder der IAM-Service eine Organisationszuordnung als Default-Kontext markiert
- **THEN** ist innerhalb derselben `instanceId` höchstens eine Zuordnung pro Account als Default markiert
- **AND** der Default-Kontext bleibt für spätere Session-Initialisierung lesbar

#### Scenario: Mitgliedschaft als extern kennzeichnen

- **WHEN** eine Organisationszuordnung als extern markiert wird
- **THEN** bleibt diese Kennzeichnung an der Membership gespeichert
- **AND** nachgelagerte UI- und Governance-Funktionen können interne und externe Zuordnungen unterscheiden

#### Example: Membership-Repräsentation mit Default-Kontext

```json
{
  "organizationId": "9d44d4f2-8c78-4d44-9f1d-6f6fe44d1002",
  "accountId": "0c2b5cbe-a8c0-4c87-a143-020f51488c41",
  "membershipType": "internal",
  "isDefaultContext": true,
  "assignedAt": "2026-03-09T09:12:00.000Z"
}
```

### Requirement: Sichere mutierende Organisations-Endpunkte

Das System MUST mutierende Organisations- und Kontext-Endpunkte mit den bestehenden IAM-Sicherheitsleitplanken betreiben.

#### Scenario: Mutierender Organisations-Endpunkt ohne gültigen CSRF-Contract

- **WHEN** ein mutierender Organisations- oder Org-Kontext-Endpunkt ohne den erforderlichen `X-Requested-With`-Header aufgerufen wird
- **THEN** wird die Operation abgewiesen
- **AND** keine Mutation an Organisationen, Memberships oder aktivem Organisationskontext wird gespeichert

#### Scenario: Instanzfremde Mutation wird protokolliert und blockiert

- **WHEN** ein Request versucht, eine Organisationsmutation außerhalb der aktiven `instanceId` auszuführen
- **THEN** wird die Operation fail-closed abgewiesen
- **AND** ein sicherheitsrelevanter Audit- oder Betriebsnachweis mit korrelierbarer Request-Identität wird erzeugt

### Requirement: Auditierbare Organisationsereignisse ohne Klartext-PII

Das System SHALL Organisationsmutationen und Org-Kontextwechsel auditierbar machen, ohne Klartext-PII in Logs oder Audit-Payloads zu persistieren.

#### Scenario: Organisation wird geändert

- **WHEN** eine Organisation erstellt, geändert, deaktiviert oder eine Membership angepasst wird
- **THEN** erzeugt das System einen korrelierbaren Audit-Nachweis und einen strukturierten Betriebslog gemäß bestehendem IAM-Dual-Write-Muster
- **AND** die Einträge enthalten keine Klartext-E-Mail-Adressen oder sonstige unzulässige PII

#### Scenario: Org-Kontext wird gewechselt

- **WHEN** ein Benutzer erfolgreich den aktiven Organisationskontext wechselt
- **THEN** ist der Kontextwechsel nachvollziehbar protokolliert
- **AND** Log- und Audit-Einträge referenzieren zulässige IDs statt Klartext-PII

### Requirement: Performantes Organisations-Read-Model

Das System SHALL Organisationslisten, Detailansichten und Kontextoptionen über ein für Admin- und Session-Flows effizientes Read-Model bereitstellen.

#### Scenario: Organisationsliste wird ohne N+1-Hierarchieabfragen geladen

- **WHEN** ein Administrator die Organisationsliste der aktiven Instanz lädt
- **THEN** liefert das Backend Parent-, Zähler- und Typinformationen in einem lesefähigen Read-Model
- **AND** die Oberfläche muss diese Informationen nicht über rekursive Folgeaufrufe zusammensetzen

#### Scenario: Org-Kontextwechsel beeinflusst Authorize-Leitplanke nicht regressiv

- **WHEN** der Organisationskontext gesetzt oder gelesen wird
- **THEN** bleibt der Contract auf einen leichten Kontextpfad begrenzt
- **AND** die bestehende Leistungsleitplanke für `POST /iam/authorize` wird durch den Change nicht regressiv verschlechtert

#### Example: Session-basierter Org-Kontext

`GET /api/v1/iam/me/context`

```json
{
  "activeOrganizationId": "9d44d4f2-8c78-4d44-9f1d-6f6fe44d1002",
  "organizations": [
    {
      "organizationId": "9d44d4f2-8c78-4d44-9f1d-6f6fe44d1001",
      "organizationKey": "lk-musterkreis",
      "displayName": "Musterkreis",
      "organizationType": "county",
      "isActive": true,
      "isDefaultContext": false
    },
    {
      "organizationId": "9d44d4f2-8c78-4d44-9f1d-6f6fe44d1002",
      "organizationKey": "gemeinde-musterstadt",
      "displayName": "Musterstadt",
      "organizationType": "municipality",
      "isActive": true,
      "isDefaultContext": true
    }
  ]
}
```

`PUT /api/v1/iam/me/context`

```json
{
  "organizationId": "9d44d4f2-8c78-4d44-9f1d-6f6fe44d1001"
}
```

### Requirement: Automatisierter Organisations- und Membership-Abnahmenachweis

Das System MUST für die Organisations- und Membership-Funktionalität einen reproduzierbaren Abnahmenachweis in der vereinbarten Testumgebung bereitstellen.

#### Scenario: Organisations-CRUD wird im aktiven Instanzkontext nachgewiesen

- **WHEN** der Paket-2-Abnahmeflow ausgeführt wird
- **THEN** werden Erstellen, Lesen, Aktualisieren und Deaktivieren einer Organisation im aktiven Instanzkontext erfolgreich geprüft
- **AND** Parent-/Child-Beziehungen und Hierarchiefelder werden im selben Flow verifiziert

#### Scenario: Membership-Zuweisung und Default-Kontext werden nachgewiesen

- **WHEN** der Paket-2-Abnahmeflow eine Account-zu-Organisation-Zuweisung ausführt
- **THEN** ist die Membership über API und Datenbank nachweisbar vorhanden
- **AND** der Default-Kontext des Accounts ist korrekt gesetzt oder aktualisiert

#### Scenario: Admin-UI spiegelt Organisations- und Membership-Daten korrekt wider

- **WHEN** der Paket-2-Abnahmeflow die Admin-Oberfläche prüft
- **THEN** sind Benutzerliste, Organisationsstruktur und Membership-Zuweisung sichtbar korrekt
- **AND** der Abnahmebericht dokumentiert den erfolgreichen UI-Nachweis

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

### Requirement: Fachlicher Schlüsselraum für Geo-Knoten

Das System SHALL für geografische Einheiten einen kanonischen, fachlich lesbaren Schlüsselraum verwenden, der zwischen Persistenz, Read-Modell, Snapshots und Diagnoseausgaben konsistent bleibt.

#### Scenario: Geo-Schlüssel folgt dem kanonischen Format

- **WHEN** ein Geo-Knoten angelegt, gelesen oder in einem Scope-Kontext referenziert wird
- **THEN** verwendet das System das Format `{ebene}:{schluessel}`
- **AND** `ebene` stammt aus einem normierten Vokabular wie `country`, `state`, `district`, `municipality`, `borough`
- **AND** `schluessel` ist der fachliche Verwaltungsschlüssel der jeweiligen Ebene

#### Scenario: Technische Surrogatschlüssel bleiben intern

- **WHEN** `iam-access-control` oder `account-ui` Geo-Kontexte anzeigen oder serialisieren
- **THEN** verwenden sie den fachlichen Geo-Schlüssel statt interner Datenbank-IDs als primären Referenzwert
- **AND** Datenbank-IDs bleiben ein internes Persistenzdetail

### Requirement: Kanonisches Geo-Read-Modell für Vorfahren und Nachfahren

Das System SHALL ein Geo-Read-Modell bereitstellen, das Vorfahren, Nachfahren und Knotenmetadaten deterministisch und in einem stabilen Antwortformat liefert.

#### Scenario: Read-Modell liefert Vorfahrenkette für einen Geo-Knoten

- **WHEN** ein autorisierter Konsument die Vorfahren eines Geo-Knotens abfragt
- **THEN** enthält die Antwort mindestens `nodeId`, `key`, `name`, `type`, `ancestorIds[]`, `ancestorKeys[]` und `maxDepth`
- **AND** die Reihenfolge der Vorfahren ist stabil von der Wurzel zum Zielknoten

#### Scenario: Read-Modell liefert Nachfahren für vererbbaren Geo-Scope

- **WHEN** `iam-access-control` alle untergeordneten Geo-Einheiten für einen geerbten Scope benötigt
- **THEN** liefert das Read-Modell die Nachfahren derselben `instanceId` in maximal 1 DB-Roundtrip
- **AND** jede Zeile enthält mindestens `ancestorId`, `descendantId`, `depth`, `descendantKey` und `descendantType`

#### Scenario: Instanzfremde Geo-Knoten bleiben aus dem Read-Modell ausgeschlossen

- **WHEN** ein Read-Modell-Aufruf Geo-Knoten einer anderen `instanceId` einschließen würde
- **THEN** werden diese Datensätze nicht zurückgegeben
- **AND** der Konsument erhält ausschließlich Daten des aktiven Instanzkontexts

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

