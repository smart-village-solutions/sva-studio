## Context

Die Mainserver-Anbindung ist eine wiederverwendbare Querschnittsfunktion für
SVA Studio. Sie benötigt drei klar getrennte Verantwortlichkeiten:

- instanzgebundene Endpunktkonfiguration
- per-User-Credentials aus Keycloak
- serverseitige OAuth2-/GraphQL-Delegation

Gleichzeitig darf die Integration weder als Browser-Proxy noch als allgemeiner
Secret-Speicher im Studio umgesetzt werden.

## Goals / Non-Goals

- Goals:
  - dedizierte, testbare Integrationsschicht für den SVA-Mainserver
  - per-User-Delegation mit Keycloak-Attributen
  - instanzgebundene Endpunktkonfiguration in Postgres
  - klare Server-only-Grenze für Upstream-Zugriffe
  - strukturierte Fehlerabbildung und korrelierbare Logs
  - vollständige Logging-Instrumentierung aller Fehler- und Erfolgspfade
  - HTTP-Timeouts für alle Upstream-Aufrufe (Resilienz)
  - DB-Zugriff ausschließlich über `@sva/data`-Repository (keine eigene `pg`-Dependency)
- Non-Goals:
  - kein generischer GraphQL-Proxy für Browser oder externe Clients
  - keine Pflege der Mainserver-Credentials in der Studio-Datenbank
  - keine breite Modulverdrahtung über Diagnostik hinaus im ersten Schnitt
  - kein Multi-Replica-/Multi-Prozess-optimierter Shared Cache (Single-Process-Betrieb)
  - keine GraphQL-Schema-Versionierung über Header oder URL-Präfix (Mainserver unterstützt dies nicht)

## Decisions

- Decision: Eigenes Paket `@sva/sva-mainserver` statt Erweiterung von
  `@sva/auth` oder `@sva/data`.
  - Warum: Die Integration ist weder reine Identity- noch reine
    Persistenzlogik und benötigt eine stabile, wiederverwendbare API.
- Decision: Credentials kommen ausschließlich aus Keycloak-User-Attributen.
  - Warum: Das ist die vorhandene per-User-Quelle und vermeidet doppelte
    Secret-Ablagen.
- Decision: Endpunktkonfiguration liegt je Instanz in
  `iam.instance_integrations`.
  - Warum: Der Upstream-Endpunkt ist betriebliche Instanzkonfiguration und
    gehört nicht in User-Attribute oder globale Envs.
- Decision: Browser ruft nie direkt den externen Mainserver auf.
  - Warum: So bleiben Secrets, Tokens, CORS-Details und lokale
    Autorisierungsprüfungen serverseitig kontrollierbar.
- Decision: Nur kurzlebige In-Memory-Caches für Credentials und Tokens.
  - Warum: Das reduziert Latenz ohne neue persistente Secret- oder
    Token-Speicher einzuführen.
  - Hinweis: Ein LRU- oder TTL-basierter Eviction-Mechanismus mit `maxSize`
    begrenzt den Speicherverbrauch bei vielen gleichzeitigen Nutzern auf
    O(maxSize). Abgelaufene Einträge sollen proaktiv entfernt werden (Sweep),
    nicht nur lazy bei erneutem Zugriff.
- Decision: DB-Zugriff ausschließlich über `@sva/data`-Repository.
  - Warum: Das Mainserver-Paket soll keine eigene `pg`-Dependency und keinen
    eigenen Connection-Pool führen. Alle Datenbankzugriffe auf
    `iam.instance_integrations` laufen über das bestehende Repository in
    `@sva/data`. Das vermeidet doppelte Pools, Connection-Exhaustion und
    eine Umgehung der Data-Schicht.
- Decision: HTTP-Timeouts für alle Upstream-Aufrufe.
  - Warum: Ohne Timeout kann ein nicht reagierender Mainserver SSR-Threads
    unbegrenzt blockieren. `AbortSignal.timeout()` mit konfigurierbarem
    Wert (Default: 10 000 ms) schützt vor Thread-Starvation.
- Decision: Instanzkonfigurations-Cache in `@sva/data`.
  - Warum: Instanzkonfigurationen ändern sich selten (betriebliche
    Konfiguration). Ein TTL-Cache (z. B. 300 s) in der Repository-Schicht
    vermeidet eine vollständige DB-Transaktion pro Aufruf.

## Alternatives considered

- Alternative: Mainserver-Client direkt in der App oder in React-Hooks.
  - Verworfen, weil Credentials und Fehlerpfad in den Browser diffundieren
    würden.
- Alternative: Zentrale Instanz-Credentials in der Studio-DB.
  - Verworfen, weil das gewünschte per-User-Modell verloren ginge.
- Alternative: Low-Level-Executor als öffentlicher Package-Export.
  - Verworfen, weil Feature-Code sonst zu leicht am kuratierten Adaptermodell
    vorbei arbeitet.
- Alternative: Direkter `pg`-Zugriff im Mainserver-Paket.
  - Verworfen, weil dies die Data-Schichtgrenze umgeht und einen separaten
    Connection-Pool erzeugt. Die Endpunktkonfiguration wird stattdessen über
    das `@sva/data`-Repository geladen.

## Risks / Trade-offs

- Risiko: Fehlende oder falsch gepflegte Keycloak-Attribute blockieren
  Downstream-Aufrufe.
  - Mitigation: deterministische Fehlercodes und separate Diagnostik.
- Risiko: In-Memory-Caches sind pro Prozess lokal.
  - Mitigation: kurze TTLs und idempotenter Token-Neuabruf.
  - Bewusster Trade-off: Multi-Replica-Betrieb ist nicht geplant. Bei Bedarf
    kann ein Redis-basierter Token-Cache als Follow-up ergänzt werden.
- Risiko: Das Mainserver-Schema kann vom Snapshot abweichen.
  - Mitigation: generierte Dokumente bleiben klein und diagnostikorientiert;
    breitere Fachadapter folgen mit separaten Operationen und Tests.
  - Mitigation (Follow-up): CI-basierter Schema-Snapshot-Vergleich mit
    `graphql-inspector` gegen Staging-Endpunkt. Der Mainserver unterstützt
    keine Schema-Versionierung — der Snapshot ist der einzige Schutz gegen
    Breaking Changes.
- Risiko: Nicht reagierender Mainserver blockiert SSR-Threads.
  - Mitigation: HTTP-Timeouts (`AbortSignal.timeout()`) für alle
    Upstream-Aufrufe (OAuth2 + GraphQL).
- Risiko: Unbegrenzte Cache-Größe bei vielen Nutzern.
  - Mitigation: LRU-/maxSize-Begrenzung für Credential- und Token-Caches.
    Abgelaufene Einträge werden proaktiv per Sweep entfernt.

## Datenklassifizierung

Die über den SVA-Mainserver abgerufenen Daten sind ausschließlich **öffentliche
Fachdaten** (News, Events, Points of Interest etc.). Es handelt sich nicht um
personenbezogene Daten im Sinne der DSGVO. Die Credentials (API-Key/Secret)
zur Authentifizierung am Mainserver sind hingegen schützenswert und verbleiben
ausschließlich in Keycloak-User-Attributen — sie werden nie in Logs, Browser
oder der Studio-Datenbank dauerhaft gespeichert.

## Error-Code-Stabilitätszusage

Die `SvaMainserverErrorCode`-Union ist Bestandteil des paketöffentlichen
Vertrags. Error-Codes werden ausschließlich additiv erweitert. Semantische
Änderungen an bestehenden Codes erfolgen nur über ein OpenSpec-Delta. Analog
zur bestehenden Stabilitätszusage des IAM-Authorization-Contracts.

## Migration Plan

1. Auth-Fassade für User-Attribute ergänzen.
2. DB-Konfiguration für `sva_mainserver` einführen (`@sva/data`-Repository).
3. Integrationspaket mit OAuth2, GraphQL und Diagnostik aufbauen (DB-Zugriff
   über `@sva/data`, keine eigene `pg`-Dependency).
4. HTTP-Timeouts und LRU-Cache-Begrenzung einführen.
5. Vollständige Logging-Instrumentierung aller Pfade (SDK Logger mit
   `workspace_id` als Pflichtfeld).
6. Erste App-Server-Funktion mit Audit-Trail verdrahten.
7. Tests, Coverage-Baseline, ADR und arc42-Abschnitte nachziehen.
8. Dockerfile um Build-Step für `sva-mainserver` erweitern.
9. Betriebsrunbook erstellen.
