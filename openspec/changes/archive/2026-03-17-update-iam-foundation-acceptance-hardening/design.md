## Context

Die bestehenden IAM-Bausteine decken OIDC-Login, Session-Auflösung, JIT-Provisioning, Organisationshierarchie, Memberships und Admin-UI bereits weitgehend ab. Für die Angebotsabnahme fehlt jedoch ein standardisierter Nachweis, der exakt die vereinbarten Acceptance-Kriterien in einer echten Laufzeitumgebung prüft.

## Goals / Non-Goals

- Goals:
  - Wiederholbaren Abnahme-Flow für Paket 1 und 2 definieren
  - Laufzeitnachweis für Keycloak-Login, Claims-Vertrag und JIT-Sync sichern
  - Laufzeitnachweis für Organisations-CRUD, Membership-Zuweisung und UI-Sichtbarkeit sichern
  - Abnahmeberichte und Gate-Kommandos versionieren
- Non-Goals:
  - Neue Fachfeatures in IAM oder UI einführen
  - Mobile Content-Flows oder Paket 6 adressieren
  - Produktivbetriebs-Topologie verändern

## Decisions

- Decision: Paket 1 und 2 erhalten einen gemeinsamen Acceptance-Change.
  - Why: Beide Pakete hängen am selben Testumgebungs- und Login-Pfad und lassen sich effizient als gemeinsamer Liefernachweis härten.
- Decision: Der Nachweis wird als Runtime-Smoke plus Bericht modelliert.
  - Why: Nur so werden Keycloak, Session, Claims, Datenbank und UI gemeinsam geprüft.
- Decision: Ein dedizierter Seed- und Realm-Kontrakt ist Pflichtbestandteil.
  - Why: Ohne stabile Testdaten ist der Acceptance-Flow nicht reproduzierbar.

## Risks / Trade-offs

- Externe IdP-Abhängigkeit erhöht Testlaufzeit.
  - Mitigation: Smokes auf klar definierte Minimalfälle begrenzen.
- Berichtspflege kann veralten.
  - Mitigation: Berichtserzeugung an ausgeführte Gates koppeln.

## Migration Plan

1. Environment-Kontrakt für Test-Realm und Seed-Daten festlegen
2. Laufzeit-Smokes für Paket 1 definieren
3. Laufzeit-Smokes für Paket 2 definieren
4. Berichtsvorlage und Ablagekonvention festlegen
5. OpenSpec, Guides und arc42 referenzieren

## Open Questions

- Soll der Acceptance-Flow vollständig in CI laufen oder teilweise als manuelles Release-Gate mit dokumentiertem Bericht?
- Welche Test-Client-IDs und Claim-Namen gelten final als verbindlicher Vertrag?
