# ADR-021: Per-User-SVA-Mainserver-Delegation

**Status:** Accepted
**Entscheidungsdatum:** 2026-03-14
**Entschieden durch:** IAM/Integrations-Team
**GitHub Issue:** TBD
**GitHub PR:** TBD

---

## Kontext

SVA Studio benötigt eine zentrale, wiederverwendbare Schnittstelle zum externen
SVA-Mainserver. Diese Integration ist für mehrere Studio-Module relevant, greift
aber auf benutzerspezifische Credentials zu: API-Key und Secret liegen bereits
pro Benutzer als Keycloak-Attribute vor. Gleichzeitig ist der Mainserver-
Endpunkt instanzgebunden und darf nicht hart verdrahtet oder im Browser
exponiert werden.

Anforderungen:

- per User delegierte OAuth2-/GraphQL-Aufrufe an den SVA-Mainserver
- instanzgebundene Konfiguration des Upstream-Endpunkts
- keine Secrets, Tokens oder direkten GraphQL-Zugriffe im Browser
- klar abgegrenzte Workspace-Schnittstelle für mehrere Studio-Module
- korrelierbare Logs ohne Preisgabe sensibler Daten

## Entscheidung

Die Mainserver-Anbindung wird als dediziertes Paket
`packages/sva-mainserver` mit dem Importpfad `@sva/sva-mainserver`
umgesetzt.

### 1. Klare Paketgrenze

`@sva/sva-mainserver` stellt client-sichere Typen und Verträge bereit.
Serverseitige Adapter und Diagnostik werden ausschließlich über
`@sva/sva-mainserver/server` exportiert.

Der rohe GraphQL-Executor bleibt intern im Paket und wird nicht als generischer
Proxy für App- oder UI-Code freigegeben.

### 2. Per-User-Credentials aus Keycloak

API-Key und Secret werden serverseitig aus Keycloak-User-Attributen des
aktuellen Benutzers gelesen:

- `sva_mainserver_api_key`
- `sva_mainserver_api_secret`

Die Credentials werden nicht in Session, Redis oder Postgres gespiegelt.

### 3. Instanzgebundene Endpunktkonfiguration

Die Studio-Datenbank hält je `instanceId` genau eine aktive Mainserver-Zeile in
`iam.instance_integrations` mit:

- `provider_key = 'sva_mainserver'`
- `graphql_base_url`
- `oauth_token_url`
- `enabled`
- Prüf- und Aktualisierungsmetadaten

### 4. Strikte Server-Side-Delegation

Browser, React-Hooks und UI-Komponenten sprechen nie direkt mit dem externen
SVA-Mainserver. Alle Aufrufe laufen über TanStack-Start-Server-Funktionen oder
vergleichbare serverseitige Studio-Handler.

Vor jedem Downstream-Aufruf prüft Studio lokale Rollen und Instanzkontext.

### 5. Kurzlebige Laufzeit-Caches

- Credential-Cache: in-memory, TTL 60 Sekunden
- Token-Cache: in-memory pro `(instanceId, keycloakSubject, apiKey)` bis
  `expires_in - skew`

Persistente Token-Speicherung ist ausgeschlossen.

## Begründung

1. Eine dedizierte Integrationsschicht verhindert, dass OAuth2- und
   GraphQL-Details in mehreren Modulen dupliziert werden.
2. Per-User-Delegation respektiert das Berechtigungsmodell des Mainservers,
   ohne Studio zu einem zentralen Secret-Speicher auszubauen.
3. Die Trennung zwischen Keycloak-Attributen und instanzbezogener
   Endpunktkonfiguration hält Verantwortlichkeiten sauber: Identity in
   Keycloak, Betriebskonfiguration in Postgres.
4. Reine Server-Side-Delegation vermeidet Secret-Leaks, CORS-Probleme und
   unerwünschte direkte Browser-Abhängigkeiten vom Mainserver.
5. Kurzlebige In-Memory-Caches reduzieren Latenz, ohne neue persistente
   Angriffsflächen zu schaffen.

## Alternativen

### Alternative A: Direkte Browser-Anbindung an den SVA-Mainserver

**Vorteile:**

- weniger Studio-Serverlogik

**Nachteile:**

- Secrets oder Tokens müssten browsernah verfügbar werden
- keine verlässliche lokale Autorisierung vor dem Upstream-Aufruf
- schwierigeres Logging, Tracing und Error-Mapping

**Warum verworfen:**

Verletzt die Sicherheits- und Boundary-Anforderungen.

### Alternative B: Zentrale Studio-Secrets pro Instanz statt per User

**Vorteile:**

- einfacheres Laufzeitmodell

**Nachteile:**

- verliert die gewünschte per-User-Delegation
- erhöht den Betriebsdruck auf Studio als Secret-Owner
- passt nicht zur vorhandenen Ablage der Credentials in Keycloak

**Warum verworfen:**

Widerspricht dem beschlossenen Berechtigungs- und Betriebsmodell.

### Alternative C: Integration direkt in `packages/auth`

**Vorteile:**

- weniger Pakete

**Nachteile:**

- `packages/auth` würde IdP- und Downstream-Integrationslogik vermischen
- öffentliche Oberfläche von `@sva/auth` würde unnötig wachsen

**Warum verworfen:**

Eine eigene Integrationsschicht ist klarer, testbarer und wiederverwendbarer.

## Konsequenzen

### Positive Konsequenzen

- wiederverwendbare, testbare Mainserver-Schnittstelle für mehrere Module
- keine Browser-Exposition von Secrets oder Tokens
- saubere Trennung zwischen Identity, Persistenz und Upstream-Integration
- deterministische Fehlerabbildung und korrelierbare Logs

### Negative Konsequenzen

- zusätzliche Paket-, Migrations- und Dokumentationspflege
- Downstream-Aufrufe benötigen funktionierende Keycloak-Attribute und
  Instanzkonfiguration
- In-Memory-Caches sind pro Prozess lokal und nicht zwischen Instanzen geteilt

## Verwandte ADRs

- [ADR-009](ADR-009-keycloak-als-zentraler-identity-provider.md): Keycloak als zentraler Identity Provider
- [ADR-011](ADR-011-instanceid-kanonischer-mandanten-scope.md): `instanceId` als kanonischer Mandanten-Scope
- [ADR-016](ADR-016-idp-abstraktionsschicht.md): IdP-Abstraktion für Keycloak-nahe Zugriffe
- [ADR-017](ADR-017-modulare-iam-server-bausteine.md): Modulare Server-Bausteine

## Gültigkeitsdauer

Diese ADR ist gültig, bis ein anderes Integrationsmodell für den SVA-Mainserver
(z. B. zentrale Instanz-Credentials oder direkte Backend-Kopplung) beschlossen
wird.
