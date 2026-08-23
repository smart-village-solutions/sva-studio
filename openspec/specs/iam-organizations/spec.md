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

Das System SHALL eine instanzgebundene Organisationsverwaltung über dedizierte Admin-Endpunkte bereitstellen. Löschungen bleiben für Organisationen mit untergeordneten Children gesperrt; löschbare Blatt-Organisationen werden physisch entfernt.

#### Scenario: Organisation anlegen

- **WHEN** ein berechtigter Administrator `POST /api/v1/iam/organizations` mit gültigen Daten aufruft
- **THEN** wird eine neue Organisation in der aktiven `instanceId` angelegt
- **AND** die Antwort enthält die gespeicherte Organisationsrepräsentation

#### Scenario: Organisation bearbeiten

- **WHEN** ein berechtigter Administrator `PATCH /api/v1/iam/organizations/:organizationId` mit gültigen Änderungen aufruft
- **THEN** werden Name, Parent oder freigegebene Metadaten aktualisiert
- **AND** die Instanzgrenze bleibt unverändert

#### Scenario: Organisation mit abhängigen Children kann nicht unkontrolliert gelöscht werden

- **WHEN** ein Administrator eine Organisation mit untergeordneten Organisationen löschen will
- **THEN** erzwingt das System eine definierte Konflikt- oder Schutzreaktion
- **AND** die Hierarchie bleibt konsistent

#### Scenario: Delete-Endpunkt löscht zulässige Blatt-Organisationen physisch

- **WHEN** ein berechtigter Administrator `DELETE /api/v1/iam/organizations/:organizationId` für eine zulässige Organisation ohne Children aufruft
- **THEN** wird die Organisation physisch gelöscht statt deaktiviert
- **AND** setzt das System vorher referenzierende Content-Organisationen kontrolliert auf `NULL`
- **AND** werden Memberships und organisationsgebundene Credentials über bestehende Löschregeln entfernt

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

#### Scenario: Membership-Attribute werden nachtraeglich aktualisiert

- **WHEN** ein Administrator für eine bestehende Organisationsmitgliedschaft `visibility` oder `isDefaultContext` ändert
- **THEN** werden nur die Membership-Attribute aktualisiert
- **AND** die fachliche Zuordnung des Accounts zur Organisation bleibt erhalten
- **AND** der Account besitzt danach hoechstens eine als Default markierte Organisationsmitgliedschaft innerhalb derselben Instanz

#### Scenario: User-zentrierte Read-Modelle koennen Organisationsmitgliedschaften aufloesen

- **WHEN** ein Administrator Benutzerdetails für einen Account lädt
- **THEN** liefert das Read-Model die Organisationsmitgliedschaften des Accounts inklusive Organisationsmetadaten und Membership-Attributen
- **AND** die Antwort eignet sich sowohl für die User-Detailseite als auch für konsistente Folge-Mutationen im selben Bedienfluss

### Requirement: Organisationsarten und Basispolicies

Das System SHALL Organisationen mit einem kontrollierten Organisationstyp und organisationsbezogenen Basispolicies modellieren. Zu den unterstützten Organisationstypen gehören ausdrücklich `association` für Vereine und `institution` für Institutionen. `content_author_policy` bleibt Teil der Organisationsrepräsentation und steuert neben der fachlichen Autorenschaft auch die Auflösung der effektiven Mainserver-Credentials im aktiven Organisationskontext.

#### Scenario: Unterstützte Organisation mit Typ anlegen

- **WHEN** ein Administrator eine Organisation mit einem unterstützten Organisationstyp anlegt
- **THEN** wird der Typ zusammen mit der Organisation gespeichert
- **AND** die Organisation bleibt für Hierarchie- und Filteroperationen nach Typ auswertbar

#### Scenario: Verein oder Institution anlegen und filtern

- **WHEN** ein Administrator eine Organisation vom Typ `association` oder `institution` anlegt
- **THEN** akzeptieren API und Datenbank den gewählten Typ
- **AND** der Typ steht in den Organisationsformularen und Filtern zur Verfügung
- **AND** die deutsche Oberfläche zeigt „Verein“ beziehungsweise „Institution“ an
- **AND** die englische Oberfläche zeigt „Association“ beziehungsweise „Institution“ an

#### Scenario: Ungültiger Organisationstyp wird abgewiesen

- **WHEN** ein Administrator einen nicht unterstützten Organisationstyp speichert
- **THEN** wird die Operation mit einem Validierungsfehler abgewiesen
- **AND** die Daten bleiben unverändert

#### Scenario: Organisationsbezogene Autorenpolicy steuert auch Mainserver-Credentials

- **WHEN** ein Administrator für eine Organisation eine `content_author_policy` speichert
- **THEN** wird die Policy in der Organisationsrepräsentation persistiert
- **AND** nachgelagerte Module können diese Policy als organisationsbezogenen Kontext für Autorenschaft und Mainserver-Credential-Auflösung konsumieren

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

Das System MUST für die Organisations- und Membership-Funktionalität einen reproduzierbaren, fail-closed Abnahmenachweis in der vereinbarten Testumgebung bereitstellen. Der CLI-Runner MUST fehlende Konfiguration und fehlgeschlagene Pflichtprüfungen mit stabilem Fehlercode, Bericht und Exitcode 1 ausweisen, ohne Secretwerte zu protokollieren. Die Pflichtprüfungen MUST in der Reihenfolge Preflight, Testdaten-Reset, Readiness, Login/JIT, Organisations-/Membership-Nachweis und UI-Nachweis orchestriert werden.

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

#### Scenario: Fehlende Konfiguration bleibt fail-closed und redigiert

- **WHEN** mindestens eine erforderliche Acceptance-Umgebungsvariable fehlt
- **THEN** endet der CLI-Lauf mit `acceptance_config_missing` und Exitcode 1
- **AND** JSON- und Markdown-Bericht enthalten keine vorhandenen Passwort-, Client-Secret- oder Datenbank-Credential-Werte

#### Scenario: Pflichtprüfung schlägt fehl

- **WHEN** Preflight, Reset, Readiness, Login/JIT, Organisations-/Membership- oder UI-Nachweis fehlschlägt
- **THEN** werden nachgelagerte Nachweise nicht als erfolgreich ausgewiesen
- **AND** der autoritative `acceptance_*`-Fehlercode bleibt in Log und Bericht erhalten

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

### Requirement: Geschützter Mainserver-Credential-Speicher pro Organisation

Das System SHALL organisationsgebundene Mainserver-Credentials in einem dedizierten serverseitigen Speicher der Studio-Datenbank halten und nicht in `iam.organizations.metadata` ablegen. Die Application-ID ist organisationsgebunden lesbar; das Secret wird ausschließlich als Ciphertext gespeichert und über Read-Models nur als Zustandsinformation exponiert.

#### Scenario: Administrator speichert Mainserver-Credentials für eine Organisation

- **WHEN** ein berechtigter Administrator Mainserver-Credentials für eine Organisation der aktiven `instanceId` speichert
- **THEN** persistiert das System die Application-ID organisationsgebunden
- **AND** das Secret wird ausschließlich als verschlüsselter Ciphertext gespeichert
- **AND** generische Organisations-Responses enthalten nie das Klartext-Secret

#### Scenario: Organisationsdetail liefert nur einen write-sicheren Credential-Status

- **WHEN** ein berechtigter Administrator das Organisationsdetail lädt
- **THEN** enthält das Read-Model höchstens `mainserverApplicationId` und `mainserverApplicationSecretSet`
- **AND** der Response enthält kein Klartext-Secret und keinen generischen Secret-Dump

#### Scenario: Ausgelassenes Secret erhält den bestehenden Secret-Ciphertext

- **WHEN** ein berechtigter Administrator Organisations-Credentials aktualisiert
- **AND** der Update-Payload keine neue Secret-Eingabe enthält
- **THEN** bleibt der bestehende Secret-Ciphertext unverändert gespeichert
- **AND** nur die übrigen übermittelten Felder wie `mainserverApplicationId` werden aktualisiert

#### Scenario: Secret-Rotation ersetzt den bestehenden Ciphertext explizit

- **WHEN** ein berechtigter Administrator einen neuen nicht-leeren Secret-Wert für eine Organisation speichert
- **THEN** ersetzt das System den bestehenden Secret-Ciphertext atomar durch den neu verschlüsselten Wert
- **AND** das Read-Model exponiert weiterhin nur `mainserverApplicationSecretSet`

#### Scenario: Implizites Secret-Clearing ist nicht Teil des Vertrags

- **WHEN** ein Client versucht, ein Organisations-Secret durch einen leeren String, `null` oder einen äquivalenten Löschwert zu entfernen
- **THEN** interpretiert das System diesen Request nicht als Secret-Löschung
- **AND** der bestehende Secret-Ciphertext bleibt unverändert oder der Request wird als ungültig abgewiesen

### Requirement: Organisationsrichtlinie begrenzt den Mainserver-Erstellungsprincipal

Das IAM-System SHALL `content_author_policy` als serverseitige Begrenzung der beim Mainserver-Content-Create erlaubten Eigentümer-Principals auswerten. Es SHALL ausschließlich die aktive, serverseitig bestätigte Organisation berücksichtigen und keine andere Membership, Client-ID oder Anzeigenangabe als Organisationsprincipal verwenden. Es SHALL dafür keine zusätzliche generische Berechtigung zum Handeln als Organisation verlangen; maßgeblich sind die fully-qualified Create-Action mit Scope, aktive Organisation, Membership, Richtlinie und Credential-Verfügbarkeit.

Bei bestehenden eigenen oder organisatorischen Inhalten SHALL die dauerhafte DataProvider-Bindung zusammen mit der serverautoritativen Ressourcen-Capability den Mutationsprincipal bestimmen. Ein Policy- oder Membership-Wechsel SHALL persönliche Inhalte nicht auf die Organisation übertragen und Organisationsinhalte nicht auf den Actor übertragen. Die Autorenrichtlinie SHALL die Read-Sicht nicht begrenzen.

Der membership-gefilterte Self-Service-Contract `GET /api/v1/iam/me/context` SHALL die `contentAuthorPolicy` jeder darin enthaltenen Organisation liefern. Die Bestimmung verfügbarer Create-Principals und die ressourcenbezogene Principal-Auflösung für Bestandsmutationen SHALL kein administratives Organisationsleserecht und insbesondere kein `iam.org.read` verlangen. Alle Mainserver-Content-Typen und eigenständigen Schreibaktionen SHALL dieselben host-owned Resolver-Verträge verwenden.

#### Scenario: Organisation erlaubt beim Create nur den organisatorischen Principal

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_only'`
- **WHEN** das Studio die verfügbaren Erstellungsprincipals bestimmt
- **THEN** ist ausschließlich `organization` zulässig
- **AND** die Oberfläche bietet keinen persönlichen Principal an
- **AND** zeigt kein Principal-Dropdown

#### Scenario: Organisation erlaubt beim Create organisatorischen oder persönlichen Principal

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_or_personal'`
- **WHEN** das Studio die verfügbaren Erstellungsprincipals bestimmt
- **THEN** sind `organization` und `user` zulässig
- **AND** ist im Editor `organization` vorausgewählt und der Benutzer kann im Dropdown zu `user` wechseln
- **AND** die serverseitige Mutation validiert die Auswahl erneut

#### Scenario: Bestehende Organisationsressource verwendet die Organisation

- **GIVEN** eine aktive Organisation ist serverseitig bestätigt
- **AND** ein bestehender Inhalt ist konfliktfrei an den DataProvider dieser Organisation gebunden
- **AND** ein Benutzer löst mit passender Ressourcen-Capability eine Schreibaktion aus einer Liste oder einem Dialog aus
- **WHEN** das Studio den Mutationsprincipal bestimmt
- **THEN** verwendet es ohne zusätzliches Dropdown explizit `actingPrincipalType = organization`
- **AND** validiert der Server Content-Action, Scope, Membership, Ownership-Bindung und Organisations-Credentials erneut

#### Scenario: Eigenständige Aktion ohne Organisationskontext verwendet den Account

- **GIVEN** keine aktive Organisation ist serverseitig bestätigt
- **AND** ein Benutzer löst eine Schreibaktion außerhalb eines geöffneten Editors aus
- **WHEN** das Studio den Mutationsprincipal bestimmt
- **THEN** verwendet es ohne zusätzliches Dropdown explizit `actingPrincipalType = user`
- **AND** validiert der Server Content-Action, Scope und persönliche Credentials erneut

#### Scenario: Persönlicher Bestandsinhalt verwendet unabhängig von der Richtlinie den Account

- **GIVEN** ein bestehender Inhalt ist konfliktfrei an den persönlichen DataProvider des aktuellen Benutzers gebunden
- **AND** die aktive Organisation hat `content_author_policy = 'org_only'` oder `org_or_personal`
- **AND** der Benutzer löst mit passender Ressourcen-Capability eine Schreibaktion aus
- **WHEN** das Studio den Mutationsprincipal bestimmt
- **THEN** verwendet es ohne zusätzliches Dropdown explizit `actingPrincipalType = user`
- **AND** überträgt die Richtlinie den Inhalt nicht auf die Organisation

#### Scenario: Policy- oder Membership-Wechsel ändert Ownership nicht

- **GIVEN** ein persönlicher oder organisatorischer Inhalt besitzt eine konfliktfreie DataProvider-Bindung
- **WHEN** die Organisation ihre `content_author_policy` ändert oder die Mitgliedschaft des ursprünglichen Actors endet
- **THEN** bleibt der persönliche Inhalt dem persönlichen Principal zugeordnet
- **AND** bleibt der Organisationsinhalt der Organisation zugeordnet
- **AND** entsteht keine implizite Übertragung

#### Scenario: Organisationsredakteur liest die Autorenrichtlinie ohne Adminrecht

- **GIVEN** ein Benutzer ist Mitglied einer aktiven Organisation und besitzt die erforderliche fully-qualified Content-Action
- **AND** der Benutzer besitzt kein `iam.org.read`
- **WHEN** die Shell `GET /api/v1/iam/me/context` lädt
- **THEN** enthält seine Mitgliedschaft die `contentAuthorPolicy` dieser Organisation
- **AND** lädt keine Content-Seite ein administratives Organisationsdetail nach
- **AND** darf der Benutzer nicht allein dadurch Organisationslisten oder administrative Organisationsdetails lesen

#### Scenario: Aktiver Organisationskontext ist unvollständig

- **GIVEN** die Session enthält eine `activeOrganizationId`
- **AND** die referenzierte Organisation fehlt im Self-Service-Kontext, ist inaktiv oder besitzt keine gültige `contentAuthorPolicy`
- **WHEN** die Oberfläche den Mutationsprincipal bestimmt
- **THEN** liefert der zentrale Resolver einen blockierenden Kontextfehler
- **AND** deaktiviert die Oberfläche Create, Update, Statusänderung und Delete für alle Mainserver-Content-Typen
- **AND** bleibt die Inhaltsliste einschließlich Filtern, Pagination und zulässigen Leseaktionen verfügbar
- **AND** fällt sie nicht stillschweigend auf `actingPrincipalType = user` zurück

#### Scenario: Mehrere Mitgliedschaften verwenden exakt die aktive Organisation

- **GIVEN** ein Benutzer ist Mitglied mehrerer aktiver Organisationen
- **AND** `activeOrganizationId` referenziert genau eine dieser Organisationen
- **WHEN** die Oberfläche den Mutationsprincipal bestimmt
- **THEN** wertet sie ausschließlich die Richtlinie der referenzierten Organisation aus
- **AND** verwendet sie nicht die erste Organisation mit `isActive = true`

#### Scenario: Andere Membership ersetzt die aktive Organisation nicht

- **GIVEN** ein Benutzer ist Mitglied mehrerer Organisationen
- **AND** genau eine Organisation ist im Session-Kontext aktiv
- **WHEN** der Benutzer `actingPrincipalType = organization` auswählt
- **THEN** verwendet das System ausschließlich die aktive Organisation
- **AND** durchsucht es keine anderen Memberships oder Default-Kontexte nach Credentials

#### Scenario: Kein aktiver Organisationskontext beim Create

- **GIVEN** für den authentifizierten Benutzer ist keine Organisation aktiv
- **WHEN** das Studio die verfügbaren Erstellungsprincipals bestimmt
- **THEN** ist ausschließlich `user` auswählbar
- **AND** ein `organization`-Scope fällt für Content-Autorisierung auf `own` zurück

### Requirement: Organisationen erhalten optional einen provisionierten Mainserver-Zugang

Das System SHALL bei der Erstellung einer Organisation nach erfolgreichem lokalem Commit best-effort einen organisationsbezogenen Mainserver-Zugang über einen eindeutig zugeordneten Studio-/Keycloak-Account provisionieren, sofern die Integration konfiguriert ist. `iam.org.write` SHALL dafür einschließlich der eng begrenzten internen technischen Accounterstellung ausreichen. Die lokale Organisation SHALL unabhängig von Keycloak-, persönlichen Mainserver-Credentials und Mainserver-Verfügbarkeit erstellbar bleiben. Fehlende Zugänge SHALL später über eine explizite, idempotente Organisationsaktion provisionierbar sein.

#### Scenario: Organisation und externer Zugang werden erfolgreich erstellt

- **WHEN** ein berechtigter Administrator eine Organisation erstellt und Keycloak sowie Mainserver verfügbar sind
- **THEN** persistiert Studio zuerst die lokale Organisation
- **AND** erzeugt oder verwendet es genau einen zugeordneten Studio-/Keycloak-Account mit initial `isTechnicalAccount = true`
- **AND** provisioniert es über diesen Account den Mainserver-Zugang
- **AND** speichert es die zurückgegebenen Credentials geschützt für die Organisation
- **AND** wechselt der persistente Organisationszustand erst bei konfliktfreier DataProvider-Bindung auf `ready`

#### Scenario: Organisation wird ohne erreichbaren Mainserver erstellt

- **WHEN** die lokale Organisation gültig ist und Mainserver oder Keycloak nicht konfiguriert beziehungsweise nicht erreichbar sind
- **THEN** bleibt die lokal erstellte Organisation erfolgreich bestehen
- **AND** wird die Organisationserstellung nicht als fehlgeschlagen dargestellt
- **AND** bleiben fehlende Mainserver-Credentials als später behebbarer Zustand erkennbar

#### Scenario: Persönliche Bootstrap-Credentials fehlen

- **GIVEN** der handelnde Administrator besitzt `iam.org.write`, aber keine vollständigen persönlichen Mainserver-Credentials
- **WHEN** er eine Organisation erstellt
- **THEN** bleibt die lokal erstellte Organisation erfolgreich bestehen
- **AND** verwendet Studio keine Credentials der aktiven, der neuen oder einer anderen Organisation als Fallback
- **AND** bleibt der fehlende externe Zugang als später behebbarer Zustand sichtbar

#### Scenario: Bereits erzeugter Account bleibt nach Upstream-Ausfall zugeordnet

- **GIVEN** Studio hat den zugeordneten Account erzeugt
- **WHEN** der nachgelagerte Mainserver-Aufruf fehlschlägt oder seine Antwort verloren geht
- **THEN** löscht Studio den Account nicht kompensierend
- **AND** behält es die eindeutige Organisationszuordnung für einen Retry bei

#### Scenario: Organisation wird später nachprovisioniert

- **GIVEN** eine Organisation besitzt keine vollständigen Mainserver-Credentials
- **WHEN** ein berechtigter Administrator die explizite Organisations-Provisionierung auslöst
- **THEN** verwendet Studio den bereits zugeordneten Account oder erzeugt ihn konfliktgeschützt genau einmal
- **AND** ruft es den bestehenden Mainserver-Benutzer-Provisioning-Vertrag auf
- **AND** verändert ein Fehlschlag weder die Organisation noch bereits gültige Credentials

#### Scenario: Parallele Provisioning-Requests verwenden eine Lease

- **WHEN** mehrere Requests dieselbe Organisation gleichzeitig provisionieren wollen
- **THEN** reserviert genau eine Operation den Zustand unter `(instanceId, organizationId)` mit einer zeitlich begrenzten Lease
- **AND** erzeugen parallele Requests keinen zweiten dauerhaft zugeordneten Account
- **AND** kann eine abgelaufene Lease übernommen werden, ohne eine vorhandene Zuordnung zu ersetzen
- **AND** bleiben laufende Zwischenstände bis zum terminalen Übergang im Zustand `provisioning`
- **AND** darf eine Operation Credentials und Zustandsübergänge nur bei passender Operationsreferenz und aktiver Lease persistieren
- **AND** darf ein früherer Lauf nach einer Lease-Übernahme weder Credentials überschreiben noch Erfolg melden

#### Scenario: Prozessabbruch nach Keycloak-Erstellung wird sicher wiederaufgenommen

- **GIVEN** ein Prozess endet nach Keycloak-Erstellung, aber vor vollständiger lokaler Zuordnung
- **WHEN** ein Retry die Operation übernimmt
- **THEN** darf er nur einen eindeutigen Account mit passender deterministischer Identität sowie `instanceId`, `organizationId` und `accountPurpose = organization_mainserver` übernehmen
- **AND** übernimmt er keinen nur anhand einer ähnlichen E-Mail gefundenen fremden Account

#### Scenario: Technisches Flag und Organisationszuordnung bleiben unabhängig

- **GIVEN** ein Account ist als Mainserver-Identität einer Organisation zugeordnet
- **WHEN** ein Administrator `isTechnicalAccount` an diesem Account ändert
- **THEN** bleibt die Organisationszuordnung unverändert
- **AND** löst die Änderung allein weder Provisionierung noch Credential-Rotation aus

#### Scenario: Hard Delete löst nur die technische Accountreferenz

- **GIVEN** ein technischer Account ist einer Organisation zugeordnet und keine Provisioning-Lease ist aktiv
- **WHEN** ein berechtigter Administrator den Account über den privilegierten Hard-Delete-Pfad löscht
- **THEN** wird die Accountreferenz instanzsicher auf `null` gesetzt
- **AND** bleiben gültige Organisations-Credentials und die organisationsbezogene DataProvider-Bindung erhalten
- **AND** bleibt eine vollständig versorgte Organisation `ready`

#### Scenario: Hard Delete während aktiver Provisionierung wird abgewiesen

- **GIVEN** für den zugeordneten technischen Account läuft eine aktive Organisations-Provisioning-Lease
- **WHEN** ein Administrator den Hard Delete auslöst
- **THEN** weist das System den Delete mit einem sicheren Konflikt ab
- **AND** löscht es den Account weder in Keycloak noch lokal

### Requirement: Organisations-Provisioning besitzt einen persistenten aktuellen Zustand

Das System SHALL den aktuellen organisationsbezogenen Mainserver-Zustand kanonisch mit `not_provisioned`, `account_ready`, `provisioning`, `verification_required`, `ready`, `failed` oder `reconciliation_required` persistieren. `ready` SHALL vollständige Credentials und eine konfliktfreie aktuelle DataProvider-Bindung voraussetzen. Audit SHALL Zustandsübergänge dokumentieren, aber nicht die aktuelle Zustandsquelle ersetzen.

#### Scenario: Bestehende manuelle Credentials benötigen Verifikation

- **GIVEN** eine Organisation besitzt vor Einführung des Zustandsautomaten vollständige manuell gepflegte Credentials
- **WHEN** der Zustand migriert wird
- **THEN** erhält die Organisation `verification_required`
- **AND** rotiert oder ersetzt Studio die Credentials nicht automatisch

#### Scenario: Gewöhnliches Organisations-Update lässt gültige Credentials unverändert

- **GIVEN** eine Organisation besitzt vollständige, verifizierte Credentials im Zustand `ready`
- **WHEN** ein Update lediglich dieselbe Application-ID wiederholt und kein neues Secret liefert
- **THEN** führt Studio keinen Credential-Schreibzugriff aus
- **AND** bleiben Zustand, Verifikationszeitpunkt und DataProvider-Bindung unverändert

#### Scenario: Manuelle Credential-Änderung konkurriert mit aktiver Lease

- **GIVEN** für die Organisation läuft eine nicht abgelaufene Provisioning-Lease
- **WHEN** parallel eine tatsächliche manuelle Credential-Änderung gespeichert werden soll
- **THEN** weist Studio die Änderung mit einem Konflikt ab
- **AND** bleiben Lease, Operationsreferenz, Phase und Credentials des laufenden Provisionings unverändert

#### Scenario: Retry vervollständigt vorhandenen Zustand vor Neuprovisionierung

- **GIVEN** eine Organisation befindet sich in `verification_required` oder `reconciliation_required`
- **WHEN** ein Administrator die explizite Provisionierung erneut auslöst
- **THEN** versucht Studio zuerst vorhandene Accountzuordnung, Credentials und Binding zu vervollständigen
- **AND** synchronisiert verifizierte Organisations-Credentials vor `ready` erneut auf den zugeordneten technischen Keycloak-Account
- **AND** provisioniert oder rotiert es nicht blind neu

### Requirement: Organisationslisten werden vor der Pagination global sortiert

Das System MUST Organisationslisten innerhalb des autorisierten Instanzumfangs zuerst filtern, danach deterministisch sortieren und erst anschließend paginieren. Es MUST standardmäßig `displayName asc` verwenden und die serverseitig unterstützten Felder `displayName`, `parentDisplayName`, `childCount`, `membershipCount` und `isActive` auf den vollständigen Trefferbestand anwenden.

#### Scenario: Administrator sortiert eine gefilterte Organisationsliste

- **GIVEN** eine Organisationsliste enthält mehr Treffer als auf eine Seite passen
- **AND** ein Such-, Typ- oder Statusfilter ist aktiv
- **WHEN** der Administrator ein unterstütztes Sortierfeld und eine Sortierrichtung auswählt
- **THEN** wendet das Backend Filterung und Sortierung auf die vollständige autorisierte Treffermenge an
- **AND** berechnet es erst danach die angeforderte Seite
- **AND** stellt es fehlende Elternwerte unabhängig von der Richtung ans Ende
- **AND** stabilisiert es gleiche Sortierwerte mit `ID asc`

#### Scenario: Organisationsliste verwendet einen sichtbaren alphabetischen Default

- **GIVEN** die Organisationsliste wird ohne gültigen expliziten Sortierwert geöffnet
- **WHEN** das System die erste Seite lädt
- **THEN** sortiert das Backend nach `displayName asc`
- **AND** zeigt die Tabelle den Anzeigenamen als aktive Sortierung
- **AND** ordnet sie nicht still nach Hierarchietiefe

#### Scenario: Flache alphabetische Liste täuscht keine Baumstruktur vor

- **WHEN** Organisationen global alphabetisch über mehrere Seiten sortiert werden
- **THEN** rückt die Namensspalte Einträge nicht anhand ihrer Hierarchietiefe ein
- **AND** bleiben übergeordnete Organisation und Hierarchieinformationen in den vorgesehenen Feldern erkennbar

#### Scenario: Übersetzter Organisationstyp ist nicht scheinbar alphabetisch sortierbar

- **WHEN** die Organisationsliste lokalisierte Typbezeichnungen anzeigt
- **THEN** bietet die Typ-Spalte keine Sortieraktion an
- **AND** sortiert das Backend sie nicht nach technischen Enum-Werten

#### Scenario: Ungültige Organisationssortierung wird abgewiesen

- **GIVEN** ein direkter Organisationslisten-Request enthält ein unbekanntes Sortierfeld oder eine unbekannte Richtung
- **WHEN** der Runtime-Handler den Request validiert
- **THEN** antwortet er mit `400 invalid_request`
- **AND** führt das Read-Model kein ungeprüftes SQL-Fragment aus

### Requirement: Mehrfachzuordnung von Accounts

Das System SHALL Administratoren in der Organisationsansicht eine zugängliche Mehrfachauswahl
anbieten, um mehrere noch nicht zugeordnete Accounts in einem Arbeitsgang auszuwählen und der
Organisation zuzuordnen.

#### Scenario: Mehrere Accounts auswählen und zuordnen

- **WHEN** ein Administrator mehrere verfügbare Accounts auswählt und die Zuordnung ausführt
- **THEN** werden die ausgewählten Accounts nacheinander über die bestehende Zuordnungsoperation hinzugefügt
- **AND** die Auswahl unterstützt Tastaturbedienung und vermittelt ihren Mehrfachauswahlzustand an assistive Technologien
- **AND** der gewählte Standardkontextwert gilt für alle ausgewählten Accounts

#### Scenario: Eine Zuordnung schlägt fehl

- **WHEN** eine Zuordnung innerhalb einer Mehrfachauswahl fehlschlägt
- **THEN** bleiben der fehlgeschlagene sowie alle noch nicht versuchten Accounts ausgewählt
- **AND** bereits erfolgreich zugeordnete Accounts werden aus der Auswahl entfernt
- **AND** der Administrator kann die verbleibende Auswahl erneut absenden

### Requirement: Mitgliedschaftssichtbarkeit nicht bearbeiten

Das System SHALL die technische Sichtbarkeit von Organisationsmitgliedschaften nicht in den
Organisations- und Account-Formularen zur Bearbeitung anbieten. Das bestehende API- und
Datenbankfeld bleibt aus Kompatibilitätsgründen erhalten.

#### Scenario: Neue Mitgliedschaft über die Oberfläche zuordnen

- **WHEN** ein Administrator eine neue Organisationsmitgliedschaft über die Oberfläche anlegt
- **THEN** enthält das Formular keine Sichtbarkeitsauswahl
- **AND** die Oberfläche übermittelt keinen expliziten Sichtbarkeitswert
- **AND** der Server verwendet den bestehenden Standardwert `internal`

#### Scenario: Bestehende Mitgliedschaft bearbeiten

- **WHEN** ein Administrator eine bestehende Organisationsmitgliedschaft in der Organisations- oder Accountansicht bearbeitet
- **THEN** kann ausschließlich der Standardkontext geändert werden
- **AND** die gespeicherte technische Sichtbarkeit wird durch diese Bearbeitung nicht verändert

