# ADR-009: Keycloak als zentraler Identity Provider

**Datum:** 27. Februar 2026
**Status:** ✅ Accepted
**Kontext:** IAM Identity-Basis (Child A: `setup-iam-identity-auth`)
**Entscheider:** SVA Studio Team

---

## Entscheidung

SVA Studio nutzt **Keycloak als zentralen Identity Provider (IdP)** fuer Authentifizierung und SSO.

Die Anwendung folgt einem **serverseitigen BFF-Muster**:

- OIDC-Flows und Token-Austausch laufen serverseitig in `@sva/auth`.
- Das Frontend nutzt nur die Endpunkte `/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout`.
- Session-Zustand wird serverseitig in Redis gehalten.
- Im Browser werden keine Access-/Refresh-Token im `localStorage` oder `sessionStorage` persistiert.
- Session-Transport erfolgt via HttpOnly-Cookie mit `SameSite=Lax` und `Secure` in Produktion.

Zusatzentscheidung fuer Mandantenkontext:

- `instanceId` wird als Identity-Claim in Tokens bereitgestellt und in den User-Kontext uebernommen.
- Die langfristige automatische Vergabe von `instanceId` erfolgt ueber nachgelagerte Provisioning-/Datenmodell-Changes.

## Kontext und Problem

Fuer das IAM-Programm wird eine belastbare Identity-Basis benoetigt, die folgende Anforderungen gleichzeitig erfuellt:

- Zentrale Authentifizierung mit OIDC und SSO
- Klare Trennung von Identity und fachlicher Autorisierung
- Gute Betriebsfaehigkeit (Session-Invalidierung, Logout, Refresh)
- Hohe Sicherheit im Browser-Kontext (keine Token-Persistenz im Client)
- Erweiterbarkeit fuer spaetere IAM-Stufen (RBAC, ABAC, Governance)

Ohne explizite Architekturentscheidung entsteht Inkonsistenz zwischen Frontend- und Backend-Auth-Strategie sowie ein hohes Risiko fuer unsichere Client-Token-Handhabung.

## Betrachtete Optionen

| Option | Kriterien | Bewertung | Kommentar |
|---|---|---|---|
| **A: Keycloak + serverseitiges BFF (entschieden)** | Sicherheit, SSO, Betriebsfaehigkeit, Erweiterbarkeit | 9/10 | Starker Fit fuer Child A und Folgeschritte |
| B: Browserseitige OIDC-Library + Token im Frontend | Einfachere UI-Integration, aber hoehere Exposition | 5/10 | Erhoehtes Risiko durch Client-Token-Handling |
| C: Eigene Auth-Implementierung ohne externen IdP | Kontrolle, aber hoher Aufwand/Risiko | 3/10 | Nicht wirtschaftlich, hoher Wartungsaufwand |
| D: Externer SaaS-IdP statt Keycloak | Schnell startbar, aber Plattformabhaengigkeit | 6/10 | Vendor-/Betriebs-Trade-offs, nicht aktueller Projektpfad |

### Warum die gewaehlte Option?

- ✅ OIDC/SSO ist standardisiert und in der Plattform bereits etabliert.
- ✅ BFF reduziert Angriffsoberflaeche im Browser und vereinfacht Security Controls.
- ✅ Session-/Logout-/Refresh-Logik ist serverseitig kontrollierbar und testbar.
- ✅ Die Entscheidung passt zur Child-A-Scope-Trennung (Identity jetzt, Autorisierung spaeter).

## Trade-offs & Limitierungen

### Pros

- ✅ Hohe Sicherheitskontrolle im Browser-Kontext
- ✅ Klare technische Trennung zwischen Identity und Autorisierung
- ✅ Gute Basis fuer Multi-Tenant-Kontext (`instanceId`)

### Cons

- ❌ Hoeherer serverseitiger Implementierungsaufwand (BFF + Session-Management)
- ❌ Abhaengigkeit von Keycloak-Betrieb und dessen Verfuegbarkeit
- ❌ Zusätzliche Betriebsaufgaben fuer Mapping/Provisioning von Claims

## Implementierung / Ausblick

- [x] OIDC-Flow ueber Keycloak implementiert (`@sva/auth`).
- [x] Login/Callback/Me/Logout-Endpunkte integriert.
- [x] Session-Transport via HttpOnly-Cookie umgesetzt.
- [x] `instanceId`-Claim in User-Kontext uebernommen.
- [ ] `instanceId`-Provisioning bei User-/Instanz-Anlage automatisieren (Folgearbeit, siehe Issue #89).
- [ ] Observability-Haertung gemaess Child-A-Tasks 1.7.x abschliessen.

## Scope-Abgrenzung

Diese ADR betrifft die Identity-Basis (Child A). Nicht Bestandteil dieser Entscheidung:

- RBAC-Entscheidungslogik (`add-iam-authorization-rbac-v1`)
- ABAC/Hierarchie/Cache (`add-iam-abac-hierarchy-cache`)
- Governance-Workflows (`add-iam-governance-workflows`)
- Vollstaendige IAM-Datenmodellierung (`add-iam-core-data-layer`)

## Migration / Exit-Strategie

Ein Wechsel des IdP bleibt moeglich, weil die App ueber BFF-Endpunkte gekoppelt ist. Ein potenzieller Spaeterwechsel betrifft primaer:

- OIDC-Client-/Discovery-Konfiguration
- Claim-Mapping
- Session- und Logout-Integration

Die Frontend-Vertragsoberflaeche (`/auth/*`) kann dabei stabil bleiben.

---

**Links:**
- OpenSpec Change: `openspec/changes/setup-iam-identity-auth/`
- Aufgabenliste: `openspec/changes/setup-iam-identity-auth/tasks.md`
- Folge-Issue: `https://github.com/smart-village-solutions/sva-studio/issues/89`
- Runtime-Flow: `docs/architecture/06-runtime-view.md`
