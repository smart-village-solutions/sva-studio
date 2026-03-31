# ADR-027: Rechtstext-Fail-Closed und blockierter Session-Zustand

**Status:** Accepted
**Entscheidungsdatum:** 2026-03-31
**Entschieden durch:** SVA Studio Team

## Kontext

Pflicht-Rechtstexte müssen vor fachlichem Zugriff wirksam erzwungen werden. Ein reiner Frontend-Guard reicht nicht aus, weil API-Clients und Deep-Links geschützte Ressourcen sonst umgehen könnten.

## Entscheidung

Die Prüfung offener Pflicht-Rechtstexte erfolgt server-seitig vor geschützten Routen. Benutzer mit offener Pflichtakzeptanz erhalten einen blockierten Session-Zustand, in dem nur Akzeptanzstatus, Akzeptanzaktion und Logout erlaubt sind.

## Begründung

- Server-seitiges Enforcement verhindert Umgehungen durch direkte API-Aufrufe.
- Der blockierte Session-Zustand trennt Authentifizierung von fachlicher Freischaltung klar.
- Fail-Closed bei unklarem Pflichttextstatus schützt vor stiller Fehlfreigabe.

## Konsequenzen

### Positive Konsequenzen

- Konsistenter Schutz von UI, API und Deep-Link-Verhalten
- Klarer Akzeptanzflow mit revisionssicheren Nachweisen
- Technische und fachliche Abnahme können denselben Enforcement-Nachweis verwenden

### Negative Konsequenzen

- Höhere UX-Härte bei technischen Fehlern oder ungeklärtem Pflichttextstatus
- Zusätzliche Middleware- und Sessionlogik

### Mitigationen

- Lokalisierte Fehlerzustände und eindeutige Retry- oder Logout-Pfade
- Dokumentierte Test- und Berichtsnachweise für Interstitial, 403-Gates und Exporte

## Verwandte ADRs

- `ADR-018-auth-routing-error-contract-und-korrelation.md`
- `ADR-023-session-lifecycle-forced-reauth-und-silent-sso.md`
