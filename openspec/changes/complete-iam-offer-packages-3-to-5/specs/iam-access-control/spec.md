## ADDED Requirements

### Requirement: Gruppen als zusätzliche Quelle effektiver Berechtigungen

Das System SHALL Gruppen als instanzgebundene IAM-Entität auswerten und deren Zuweisungen in die effektive Berechtigungsberechnung einbeziehen.

#### Scenario: Gruppenmitgliedschaft erweitert effektive Rechte

- **WHEN** ein Benutzer einer Gruppe mit fachlich relevanten Berechtigungen zugewiesen ist
- **THEN** werden diese Gruppenrechte in `GET /iam/me/permissions` und `POST /iam/authorize` berücksichtigt
- **AND** die Herkunft der Berechtigung bleibt nachvollziehbar

#### Scenario: Konflikte zwischen Rollen und Gruppen bleiben deterministisch

- **WHEN** eine Rollenfreigabe und eine gruppenbasierte Restriktion denselben Zugriff betreffen
- **THEN** wird die finale Entscheidung nach einer dokumentierten Prioritätsregel berechnet
- **AND** identischer Kontext führt zu identischem Ergebnis und identischem Reasoning

### Requirement: Hierarchische Geo-Vererbung für ABAC-Scopes

Das System SHALL geografische Berechtigungen entlang definierter Geo-Hierarchien vererben und untergeordnete Restriktionen berücksichtigen.

#### Scenario: Übergeordneter Geo-Scope wirkt auf untergeordnete Einheiten

- **WHEN** eine Berechtigung für eine übergeordnete geografische Einheit vergeben ist
- **AND** die angefragte Ressource zu einer untergeordneten geografischen Einheit gehört
- **THEN** wird die Berechtigung auf Basis der Geo-Hierarchie vererbt
- **AND** die Entscheidung bleibt auf die aktive `instanceId` begrenzt

#### Scenario: Untergeordnete Geo-Restriktion überschreibt Parent-Freigabe

- **WHEN** eine übergeordnete Geo-Freigabe vorliegt
- **AND** für eine untergeordnete geografische Einheit eine restriktive Regel existiert
- **THEN** wird der Zugriff für diese untergeordnete Einheit verweigert
- **AND** die Antwort enthält einen nachvollziehbaren Denial-Reason

### Requirement: Strukturierte Permission-Persistenz für Autorisierung

Das System SHALL fachliche Berechtigungen in strukturierter Form persistieren, sodass die Autorisierungsberechnung nicht ausschließlich auf flachen `permission_key`-Strings basiert.

#### Scenario: Strukturierte Rollen-Permission wird gespeichert

- **WHEN** eine Rollen-Permission im IAM erfasst oder aus Seeds bereitgestellt wird
- **THEN** liegen mindestens `action`, `resource_type`, optional `resource_id`, `scope` und `effect` in maschinenlesbarer Form vor
- **AND** die Berechtigung bleibt auf die aktive `instanceId` begrenzt

#### Scenario: Bestehende Permission-Key-Daten bleiben während der Migration auswertbar

- **WHEN** noch nicht alle bestehenden Rollen-Permissions in die strukturierte Form migriert wurden
- **THEN** existiert ein definierter Migrations- oder Kompatibilitätspfad
- **AND** bestehende Autorisierungsentscheidungen brechen nicht ungesteuert weg

### Requirement: Effektive Berechtigungsauflösung über Organisationshierarchie

Das System SHALL effektive Berechtigungen entlang der Organisationshierarchie innerhalb der aktiven `instanceId` vererben.

#### Scenario: Parent-Berechtigung wirkt auf Child-Organisation

- **WHEN** ein Benutzer im aktiven Org-Kontext einer untergeordneten Organisation handelt
- **AND** eine passende `allow`-Berechtigung auf einer übergeordneten Organisation vorliegt
- **THEN** wird diese Berechtigung auf die untergeordnete Organisation vererbt
- **AND** `POST /iam/authorize` liefert eine reproduzierbare Freigabe

#### Scenario: Instanzfremde Hierarchie bleibt wirkungslos

- **WHEN** eine Hierarchieauswertung Parent- oder Child-Daten außerhalb der aktiven `instanceId` referenzieren würde
- **THEN** werden diese Daten nicht in die effektive Berechnung einbezogen
- **AND** die Entscheidung bleibt instanzisoliert

### Requirement: Restriktionen überschreiben vererbte Freigaben

Das System SHALL lokale Restriktionen auf untergeordneten Ebenen höher priorisieren als vererbte Freigaben aus Parent-Ebenen.

#### Scenario: Child-Restriktion blockiert Parent-Allow

- **WHEN** eine vererbte `allow`-Berechtigung aus einer Parent-Organisation vorliegt
- **AND** auf der untergeordneten Organisation eine passende Restriktion oder `deny`-Regel existiert
- **THEN** wird die effektive Berechtigung verweigert
- **AND** die Antwort enthält einen nachvollziehbaren Denial-Reason

### Requirement: Konsistente Auswertung von Org- und Geo-Scopes

Das System SHALL Organisations- und Geo-Scopes gemeinsam in die finale Berechtigungsentscheidung einbeziehen, sofern beide für die angefragte Ressource relevant sind.

#### Scenario: Org-Scope erlaubt, Geo-Scope verweigert

- **WHEN** eine Rollen-Permission im aktiven Organisationskontext grundsätzlich passt
- **AND** der angefragte Geo-Kontext nicht im effektiven Scope enthalten ist
- **THEN** wird die Anfrage verweigert
- **AND** die Verweigerung ist deterministisch reproduzierbar

### Requirement: Erweiterte Snapshot-Berechnung für Scope-Kontexte

Das System SHALL Permission-Snapshots so berechnen, dass aktiver Org-Kontext, Organisationshierarchie und Geo-Scopes im Hit-Pfad ohne zusätzliche Datenbankzugriffe ausgewertet werden können.

#### Scenario: Snapshot enthält effektive Scope-Daten

- **WHEN** ein Snapshot für einen Benutzer-/Instanzkontext erzeugt wird
- **THEN** enthält der Snapshot die effektiven Berechtigungen inklusive relevanter Org- und Geo-Reichweite
- **AND** `POST /iam/authorize` kann im Cache-Hit-Pfad reine In-Memory-Checks ausführen

### Requirement: Erweiterte Invalidation bei Strukturänderungen

Das System SHALL Permission-Snapshots auch bei Änderungen an Hierarchie- und Scope-Strukturen invalidieren.

#### Scenario: Hierarchieänderung invalidiert effektive Berechtigungen

- **WHEN** Parent-/Child-Beziehungen, Memberships oder relevante Geo-Zuordnungen geändert werden
- **THEN** werden betroffene Snapshots invalidiert
- **AND** nachfolgende Authorize-Anfragen berechnen effektive Rechte auf Basis des neuen Zustands

### Requirement: Redis-basierte Permission-Snapshots

Das System SHALL effektive Berechtigungen als serialisierte Snapshots in Redis pro Benutzer-, Instanz- und Kontextscope verwalten.

#### Scenario: Cache-Miss schreibt Snapshot nach Redis

- **WHEN** für einen Benutzer-/Kontextscope noch kein gültiger Snapshot in Redis existiert
- **THEN** werden die effektiven Berechtigungen aus den führenden IAM-Daten berechnet
- **AND** der resultierende Snapshot wird in Redis gespeichert

#### Scenario: Cache-Hit lädt Snapshot aus Redis

- **WHEN** für einen Benutzer-/Kontextscope ein gültiger Snapshot in Redis vorliegt
- **THEN** wird die Autorisierungsentscheidung auf Basis des Redis-Snapshots getroffen
- **AND** der Endpunkt benötigt für den Hit-Pfad keine erneute Permission-Berechnung

### Requirement: Ereignisbasierte Invalidierung für Snapshot-Kontexte

Das System SHALL Redis-Snapshots bei relevanten Mutationen gezielt invalidieren.

#### Scenario: Rollen- oder Membership-Änderung invalidiert betroffene Snapshots

- **WHEN** Rollen, Gruppen, Memberships, Permissions oder Hierarchiebezüge eines Benutzers geändert werden
- **THEN** werden die betroffenen Redis-Snapshots invalidiert oder versioniert unbrauchbar gemacht
- **AND** die nächste Anfrage erzeugt einen Snapshot auf Basis des aktuellen Zustands

#### Scenario: Eventverlust wird durch Fallback begrenzt

- **WHEN** ein Invalidation-Event nicht verarbeitet wird
- **THEN** begrenzen TTL- und Recompute-Regeln die Dauer potenziell veralteter Entscheidungen
- **AND** ein dokumentierter Fallback-Pfad bleibt aktiv

### Requirement: Endpoint-nahe Performance-Verifikation für Authorize

Das System SHALL die Redis-gestützte Authorize-Strecke endpoint-nah unter Last verifizieren.

#### Scenario: Lastprofil wird mit Bericht nachgewiesen

- **WHEN** die Redis-gestützte Authorize-Strecke gegen das vereinbarte Lastprofil getestet wird (100 gleichzeitige Requests, lokales Netz)
- **THEN** werden mindestens Cache-Hit-, Cache-Miss- und Recompute-Szenarien gemessen
- **AND** die Abnahmegrenzen werden eingehalten: Cache-Hit p95 < 5 ms, Cache-Miss p95 < 80 ms, Recompute p95 < 300 ms
- **AND** die Ergebnisse werden versioniert als Bericht unter `docs/reports/` mit Pflichtfeldern (Testprofil, Messumgebung, Stichprobenzahl, p50/p95/p99) dokumentiert

### Requirement: API-Erweiterungskontrakt für Autorisierungsendpunkte

Das System SHALL die neuen Felder in `POST /iam/authorize` und `GET /iam/me/permissions` additiv und nicht-brechend ergänzen.

**Normatives JSON-Beispiel `POST /iam/authorize` Response:**
```json
{
  "decision": "allow",
  "reasoning": {
    "matched_permissions": [
      {
        "action": "content:read",
        "resource_type": "article",
        "effect": "allow",
        "source": "role",
        "role_id": "uuid-role",
        "inherited_from_org": "uuid-parent-org",
        "geo_scope": "district:09162"
      }
    ],
    "denial_reason": null,
    "denial_code": null,
    "cache_status": "hit"
  }
}
```

Bei Verweigerung enthält `denial_reason` einen maschinenlesbaren Code (z. B. `geo_scope_mismatch`, `deny_rule_override`, `instance_boundary_violation`) und eine lesbare Beschreibung.

**Normatives JSON-Beispiel `GET /iam/me/permissions` Response (Auszug):**
```json
{
  "permissions": [
    {
      "action": "content:write",
      "resource_type": "article",
      "effect": "allow",
      "source": "group",
      "group_id": "uuid-group",
      "group_name": "Presseteam",
      "org_scope": "uuid-org",
      "geo_scope": "municipality:09162000"
    }
  ],
  "snapshot_version": 7,
  "computed_at": "2026-03-17T10:00:00Z"
}
```

#### Scenario: Consumer mit strict-parse erhält unbekannte Felder

- **WHEN** ein Consumer `POST /iam/authorize` aufruft und neue optionale Felder im Response erscheinen
- **THEN** bleiben alle bisherigen Felder unverändert und rückwärtskompatibel
- **AND** neue optionale Felder sind additive Erweiterungen (kein breaking change)

### Requirement: Integrität von Redis-Permission-Snapshots

Das System MUST Redis-Snapshots gegen unbefugte Manipulation schützen.

#### Scenario: Snapshot wird vor dem Schreiben signiert

- **WHEN** ein Permission-Snapshot in Redis geschrieben wird
- **THEN** wird der Payload mit HMAC-SHA-256 signiert; der Schlüssel liegt außerhalb von Redis (z. B. Anwendungs-Secret)
- **AND** der Snapshot enthält ein `schema_version`-Feld und einen `signed_at`-Zeitstempel

#### Scenario: Signaturprüfung schlägt fehl

- **WHEN** ein aus Redis gelesener Snapshot eine ungültige oder fehlende Signatur aufweist
- **THEN** wird der Snapshot verworfen und wie ein Cache-Miss behandelt (Recompute)
- **AND** der Vorfall wird als strukturiertes Log-Event mit `integrity_check_failed: true` protokolliert

### Requirement: Strukturierte Logs für Autorisierungsentscheidungen

Das System SHALL alle Autorisierungsentscheidungen mit folgenden Pflichtfeldern protokollieren.

#### Scenario: Autorisierungsentscheidung wird geloggt

- **WHEN** `POST /iam/authorize` eine Entscheidung trifft
- **THEN** enthält der Log-Eintrag: `workspace_id`, `component`, `trace_id`, `request_id`, `cache_status` (`hit`|`miss`|`recompute`), `decision_source` (`role`|`group`|`org_inherit`|`geo_inherit`)
- **AND** PII-Felder wie `user_email`, `session_id` oder Klartextnamen sind verboten

### Requirement: Conflict-Testmatrix für Gruppen, Rollen, Org und Geo

Das System SHALL deterministische Entscheidungen für alle bekannten Konfliktfälle treffen. Die folgende Testmatrix ist normativ:

| Quelle A | Quelle B | Erwartetes Ergebnis | Begründung |
|----------|----------|---------------------|------------|
| Rolle: allow | Gruppe: deny (gleiche Ressource) | deny | deny vor allow |
| Gruppe: allow | Geo-Restriktion | deny | lokal vor vererbt |
| Org-Parent: allow | Org-Child: deny | deny | lokal vor Parent |
| Org-Parent: allow | Org-Child: kein Eintrag | allow | Vererbung greift |
| Geo-Parent: allow | Geo-Child: deny | deny | lokal vor Parent |
| Geo-Parent: allow | Geo-Child (3. Ebene): deny | deny | 3+-Ebenen denselben Regeln |
| Rolle: allow | Org-Child: deny + Gruppe: allow | deny | deny schlägt alle allow |
| permission_key-legacy: allow | Strukturiert: deny | deny | strukturiert vor legacy |

#### Scenario: Dreistufige Geo-Hierarchie mit Konflikten

- **WHEN** auf Ebene 1 (Bundesland) eine `allow`-Berechtigung vorliegt, Ebene 2 (Landkreis) keinen Eintrag hat und Ebene 3 (Gemeinde) eine `deny`-Regel trägt
- **THEN** wird die Berechtigung für Ebene 3 verweigert
- **AND** identischer Kontext führt immer zu identischem Ergebnis

#### Scenario: Mixed-State-Migration — partial permission_key und strukturiert

- **WHEN** 50 % der Rollen-Permissions noch als `permission_key`-String vorliegen und 50 % bereits strukturiert sind
- **THEN** werden beide Formate für dieselbe Autorisierungsentscheidung korrekt ausgewertet
- **AND** strukturierte Permissions haben bei Widerspruch Vorrang vor legacy-Strings
- **AND** die Entscheidung erzeugt kein inkonsistentes Reasoning
