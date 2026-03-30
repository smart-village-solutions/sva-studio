# ADR-023: Führender Session-Lifecycle, Forced Reauth und kontrolliertes Silent SSO

**Status:** Accepted
**Entscheidungsdatum:** 2026-03-26
**Entschieden durch:** IAM/Auth-Team
**GitHub Issue:** TBD
**GitHub PR:** TBD

---

## Kontext

SVA Studio verwendet ein BFF-Auth-Modell mit Keycloak als Identity Provider,
serverseitig gehaltenen OIDC-Tokens und browserseitig reinem `httpOnly`-
Session-Cookie. Auf `feat/auth-session-recovery` war bereits eine
`returnTo`-basierte Rückkehr nach Login vorhanden, aber drei Punkte waren
architektonisch nicht sauber festgelegt:

- Welche Zeit ist fachlich führend: Cookie, Redis-TTL oder Tokenablauf?
- Wie kann für einen einzelnen Benutzer deterministisch ein Re-Login erzwungen
  werden?
- Wie kann nach `401` ein stiller Reauth-Versuch erfolgen, ohne Logout-Semantik
  oder Token-Boundaries zu unterlaufen?

Gleichzeitig sollte das datensparsame Session-Modell aus ADR-009 und der
Privacy-Minimierung erhalten bleiben: Sessions tragen nur den Auth-Kern und
keine Profil-PII.

## Entscheidung

### 1. `Session.expiresAt` ist die führende fachliche Wahrheit

Die serverseitige Session verwendet `expiresAt` als maßgebliche Gültigkeitsgrenze.
Alle anderen Zeiten sind abgeleitet:

- Cookie-Laufzeit ist gleich oder kürzer als die verbleibende Sessiondauer.
- Redis-TTL ist rein technischer Aufbewahrungspuffer oberhalb der fachlichen
  Sessiondauer.
- Access-Token-Refresh darf `expiresAt` nur innerhalb der absoluten
  Session-Maxdauer fortschreiben.

Damit ist Redis kein fachlicher Wahrheitsraum und der Browser-Cookie kein
eigener Session-Entscheider.

### 2. Sessions werden versioniert und gegen Benutzerzustand validiert

Jede Session enthält mindestens:

- `issuedAt`
- `expiresAt`
- `sessionVersion`

Zusätzlich wird benutzerbezogener Reauth-Zustand getrennt geführt, z. B.:

- `minimumSessionVersion`
- `forcedReauthAt`
- Suppression für Silent SSO nach explizitem Logout

Bei jeder Session-Auflösung werden Sessiondaten und Benutzerzustand gemeinsam
ausgewertet. Dadurch können ältere Sessions deterministisch ungültig werden,
ohne dass Browser oder Clients Spezialwissen brauchen.

### 3. Forced Reauth erfolgt zweistufig

Das System führt einen internen Service
`forceReauthUser({ userId, mode, reason })` ein.

Unterstützte Modi:

- `app_only`: Alle Studio-Sessions eines Benutzers werden ungültig. Eine noch
  aktive Keycloak-SSO-Session bleibt bestehen.
- `app_and_idp`: Zusätzlich werden aktive Keycloak-User-Sessions per Admin-API
  beendet.

Diese Unterscheidung trennt fachliche App-Invalidierung sauber von echter
IdP-Abmeldung.

### 4. Silent SSO bleibt ein kontrollierter Recovery-Mechanismus

Silent SSO wird nicht als permanenter Hintergrund-Login eingeführt, sondern nur
als einmaliger Recovery-Versuch nach `401`.

Der Flow:

- nutzt den bestehenden BFF-Loginpfad mit `prompt=none`
- behält `state`, `nonce` und PKCE bei
- erzeugt bei Erfolg immer eine neue Session-ID
- wird nach explizitem Logout temporär unterdrückt

Damit bleibt das Sicherheitsmodell aus ADR-009 bestehen: Der Browser erhält
weiterhin keine Access- oder Refresh-Tokens.

## Begründung

1. Eine einzige fachliche Session-Wahrheit verhindert widersprüchliche Abläufe
   zwischen Cookie, Redis und Tokenablauf.
2. Versionierte Sessions plus Benutzerzustand sind präziser und robuster als
   TTL-basierte Workarounds für Rollenänderungen, Passwort-Resets oder
   Sicherheitsvorfälle.
3. Silent SSO als einmaliger Recovery-Versuch verbessert UX, ohne Logout oder
   explizite Reauth-Grenzen unsichtbar auszuhöhlen.
4. Die Trennung zwischen `app_only` und `app_and_idp` macht Sicherheits- und
   Betriebsfolgen einer Reauth-Entscheidung explizit.

## Alternativen

### Alternative A: Redis-TTL oder Cookie als führende Session-Wahrheit

**Vorteile:**

- technisch einfach

**Nachteile:**

- fachlich unpräzise
- Browser-Neustarts oder Redis-Retention würden Sessionverhalten indirekt
  bestimmen

**Warum verworfen:**

Die fachliche Gültigkeit gehört in die serverseitige Session und nicht in
Transport- oder Speichermechanismen.

### Alternative B: Silent SSO als permanentes Hintergrund-Polling

**Vorteile:**

- aggressive Session-Recovery ohne sichtbaren Login

**Nachteile:**

- schwer beherrschbare Logout-Semantik
- höhere Browser- und Cookie-Abhängigkeit
- unnötige Komplexität und potenzielle Schleifen

**Warum verworfen:**

Für das BFF-Modell ist ein einmaliger, kontrollierter Recovery-Versuch nach
`401` ausreichend und sicherer.

### Alternative C: Forced Reauth nur über Keycloak-Logout

**Vorteile:**

- einfaches mentales Modell

**Nachteile:**

- zu grob für App-spezifische Rechteänderungen
- erzwingt unnötig harte Re-Authentifizierungen

**Warum verworfen:**

Studio braucht sowohl app-lokale Invalidierung als auch den harten
Security-Pfad inklusive IdP-Logout.

## Konsequenzen

### Positive Konsequenzen

- deterministisches Sessionverhalten
- gezielter Re-Login pro Benutzer möglich
- kontrollierte Recovery nach Sessionablauf ohne Browser-Token
- bessere Auditierbarkeit von Session-Recovery und Forced Reauth

### Negative Konsequenzen

- mehr Komplexität im Session-Store und in den Handlern
- zusätzliche Browser-Fallbacks für fehlgeschlagenes Silent SSO notwendig
- mehr Doku- und Testpflege für Security-kritische Session-Pfade

## Verwandte ADRs

- [ADR-009](ADR-009-keycloak-als-zentraler-identity-provider.md): Keycloak als zentraler Identity Provider
- [ADR-016](ADR-016-idp-abstraktionsschicht.md): IdP-Abstraktionsschicht
- [ADR-017](ADR-017-modulare-iam-server-bausteine.md): Modulare IAM-Server-Bausteine
- [ADR-018](ADR-018-auth-routing-error-contract-und-korrelation.md): Auth-Routing-Error-Contract und Korrelation

## Gültigkeitsdauer

Diese ADR ist gültig, bis SVA Studio das BFF-Auth-Modell grundsätzlich verlässt
oder ein anderes Session-/Reauth-Modell beschließt.
