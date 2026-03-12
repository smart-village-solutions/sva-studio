# ADR-020: Kanonischer Auth-Host und Multi-Host-Grenze

**Status:** Accepted
**Entscheidungsdatum:** 2026-03-12
**Entschieden durch:** IAM/Plattform Team
**GitHub Issue:** TBD
**GitHub PR:** #157

---

## Kontext

Mit dem Instanz-Subdomain-Modell (`<instanceId>.<SVA_PARENT_DOMAIN>`) existieren mehrere Hostnamen, unter denen die Applikation erreichbar ist. OIDC-Flows (Login, Logout, Token-Exchange) erfordern stabile Redirect-URIs und Cookie-Domains. Es muss definiert werden, welcher Host als kanonischer Einstiegspunkt für Auth-Flows dient und wie die Applikation mit Auth-Anfragen auf Instanz-Hosts umgeht.

Anforderungen:

- Stabile OIDC-Redirect-URIs unabhängig vom Instanz-Host
- Konsistentes Cookie-Domain-Scoping
- Klare Fehlersignale bei Auth-Flows auf nicht unterstützten Hosts
- Keine Informationspreisgabe über den Ablehnungsgrund

## Entscheidung

Die **Root-Domain** (`SVA_PARENT_DOMAIN`) ist der **kanonische Auth-Host**.

### 1. OIDC-Discovery und Redirect-URIs

Alle OIDC-Redirect-URIs (Login Callback, Post-Logout) zeigen ausschließlich auf den kanonischen Auth-Host:

```
SVA_AUTH_REDIRECT_URI=https://<SVA_PARENT_DOMAIN>/auth/callback
SVA_AUTH_POST_LOGOUT_REDIRECT_URI=https://<SVA_PARENT_DOMAIN>/
```

Instanz-Hosts werden nicht als OIDC-Redirect-Ziele registriert.

### 2. Cookie-Domain-Scoping

Auth-Cookies (Session, CSRF) werden auf die Parent-Domain gesetzt (`Domain=.<SVA_PARENT_DOMAIN>`), sodass sie für den kanonischen Host und alle Instanz-Subdomains gültig sind.

### 3. Fail-closed für nicht unterstützte Auth-Flows

Auth-Endpunkte auf Instanz-Hosts (z. B. `foo.studio.smart-village.app/auth/login`) werden identisch abgelehnt:

- Status: `403`
- Body: `{ "error": "forbidden", "message": "Host not permitted for this operation" }`
- Header: `X-Request-Id` für Korrelation
- Kein erläuternder Ablehnungsgrund (identische Antwort für alle Fälle)

### 4. Multi-Host-Grenze

Die Applikation erkennt und verarbeitet genau zwei Host-Klassen:

- **Kanonischer Auth-Host** (`SVA_PARENT_DOMAIN`): Auth-Flows erlaubt, Instanz-Kontext = null
- **Instanz-Host** (`<instanceId>.<SVA_PARENT_DOMAIN>`): Fachliche Seiten erlaubt, Auth-Redirect zum kanonischen Host

Alle anderen Hosts werden abgelehnt (403).

## Begründung

1. Eine einzige OIDC-Redirect-URI vereinfacht die IdP-Konfiguration und vermeidet Wildcard-Redirects.
2. Cookie-Scoping auf die Parent-Domain ermöglicht SSO über Instanz-Hosts ohne Cookie-Duplizierung.
3. Identische 403-Antworten verhindern Host-Enumeration durch Angreifer.
4. Zwei klar definierte Host-Klassen halten die Routing-Logik überschaubar.

## Alternativen

### Alternative A: OIDC-Redirects pro Instanz-Host

**Vorteile:**
- Auth-Flows vollständig auf dem Instanz-Host möglich

**Nachteile:**
- Wildcard-Redirect-URIs im IdP erforderlich (Sicherheitsrisiko)
- Cookie-Isolation pro Subdomain erzwingt separaten Login pro Instanz

**Warum verworfen:**
Wildcard-Redirects widersprechen OIDC-Best-Practices und erweitern die Angriffsfläche.

### Alternative B: Kein Cookie-Sharing, isolierte Sessions pro Host

**Vorteile:**
- Striktere Isolation

**Nachteile:**
- Nutzer müssen sich pro Instanz-Host neu anmelden
- Schlechtere UX bei Wechsel zwischen Instanzen

**Warum verworfen:**
Für das aktuelle Nutzungsmodell (Wechsel zwischen Instanzen durch Betriebspersonal) nicht praktikabel.

## Konsequenzen

### Positive Konsequenzen

- Klare, sichere Auth-Grenze ohne Wildcard-Redirects
- Einmaliger Login für alle Instanzen über SSO
- Einfache IdP-Konfiguration (eine Redirect-URI)

### Negative Konsequenzen

- Auth-Flows auf Instanz-Hosts erfordern Redirect zum kanonischen Host
- Bei zukünftiger strikter Instanz-Isolation (separate Sessions) ist eine Änderung nötig

## Verwandte ADRs

- [ADR-011](ADR-011-instanceid-kanonischer-mandanten-scope.md): `instanceId` als kanonischer Mandanten-Scope
- [ADR-019](ADR-019-swarm-traefik-referenz-betriebsprofil.md): Swarm-/Traefik-Referenz-Betriebsprofil

## Gültigkeitsdauer

Diese ADR ist gültig, bis ein alternatives Auth-Hosting-Modell (z. B. pro-Instanz-IdP) beschlossen wird.
