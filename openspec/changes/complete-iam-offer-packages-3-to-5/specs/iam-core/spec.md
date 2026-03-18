## ADDED Requirements

### Requirement: Readiness-Nachweis für Redis-gestützte Autorisierung

Das System MUST die Betriebsbereitschaft der Redis-gestützten Autorisierungsstrecke explizit nachweisen.

#### Scenario: Readiness-Gate prüft Redis-Authorize-Pfad

- **WHEN** der System-Readiness-Check (`GET /health/ready`) ausgeführt wird
- **THEN** bestätigt er die Erreichbarkeit und Nutzbarkeit von Redis für den Permission-Snapshot-Pfad
- **AND** die Response enthält das Feld `cache_status: "empty" | "warming" | "ready"` für den Redis-Snapshot-Pfad
- **AND** ein Fehler im Redis-Authorize-Pfad macht den Readiness-Status `degraded` (Redis-Latenz > 50 ms ODER Recompute-Rate > 20/min) oder `failed` (Connection refused nach 3 Retries) sichtbar

#### Scenario: Redis-Warm-up nach Neustart

- **WHEN** Redis nach einem Neustart gestartet wird
- **THEN** loggt das System den Cache-Cold-Start-Zustand mit `cache_cold_start: true`
- **AND** der erste erfolgreiche Snapshot-Write nach dem Start wird als Betriebsereignis protokolliert
- **AND** der Readiness-Endpoint gibt `cache_status: "warming"` zurück bis die Rate der erfolgreichen Snapshots einen stabilen Zustand anzeigt

#### Scenario: Autorisierung bleibt bei Cache-Störung fail-closed

- **WHEN** Redis oder der Snapshot-Recompute in einem Autorisierungspfad ausfällt
- **THEN** gewährt das System keinen stillschweigenden Zugriff (HTTP 503)
- **AND** ein abgelaufener Snapshot darf nach TTL-Ablauf **nicht** als Notfall-Fallback verwendet werden
- **AND** der Fehlerzustand ist über strukturierte Logs und Betriebsmetriken nachvollziehbar

### Requirement: Server-seitiges Enforcement der Rechtstext-Akzeptanz

Das System MUST die Rechtstext-Akzeptanz-Prüfung server-seitig in einer TanStack Start Middleware durchführen, bevor jede geschützte Ressource ausgeliefert oder verarbeitet wird.

#### Scenario: Server-Middleware blockiert direkten API-Aufruf ohne Akzeptanz

- **WHEN** ein authentifizierter Benutzer mit offener Pflichtakzeptanz eine geschützte API-Route direkt aufruft (ohne Frontend-Interstitial)
- **THEN** antwortet das System mit HTTP 403 und einem strukturierten Fehlercode (`legal_acceptance_required`)
- **AND** kein fachlicher Inhalt wird ausgeliefert
- **AND** der Fehlerzustand ist über einen maschinenlesbaren Error-Code adressierbar

#### Scenario: Offene Pflichtversion blockiert fachlichen Zugriff

- **WHEN** ein authentifizierter Benutzer eine aktuelle Pflichtversion eines Rechtstexts noch nicht akzeptiert hat
- **THEN** erhält er keinen fachlichen Zugriff auf geschützte Anwendungspfade
- **AND** das System leitet ihn in einen dedizierten Akzeptanzflow

#### Scenario: Akzeptanz hebt die Sperre auf

- **WHEN** der Benutzer die geforderte Rechtstext-Version erfolgreich akzeptiert
- **THEN** wird die Akzeptanz revisionssicher gespeichert
- **AND** der Benutzer erhält anschließend Zugriff auf die ursprünglich angeforderte geschützte Anwendung (Deep-Link-Preservation via Session-State)

### Requirement: Fail-Closed bei unklarem Pflichttextstatus

Das System MUST bei unklarem oder fehlerhaftem Pflichttextstatus keinen stillschweigenden fachlichen Zugriff gewähren.

#### Scenario: Pflichttextstatus kann nicht bestimmt werden (DB-Timeout, unvollständige Antwort)

- **WHEN** das System beim Login den Status erforderlicher Rechtstexte nicht vollständig bestimmen kann (z. B. DB-Timeout, fehlende Versionsdaten, partiell unbekannte Kategorien)
- **THEN** blockiert das System den fachlichen Zugriff — jede nicht abschließend geprüfte Pflichtkategorie gilt als ausstehend
- **AND** der Benutzer erhält einen klaren Fehlerzustand mit lokalisiertem Hinweistext (`t('legalTexts.acceptance.errors.statusUnknown')`) und der Möglichkeit, die Seite neu zu laden
- **AND** der HTTP-Statuscode der Middleware-Antwort ist 503 bei technischen Fehlern, 403 bei bekannt ausstehender Akzeptanz
