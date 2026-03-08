# ADR-015: CSRF-Schutz-Strategie für IAM-v1

**Status:** Accepted  
**Entscheidungsdatum:** 2026-03-04  
**Entschieden durch:** IAM/Auth + Frontend

## Kontext

Mit der Einführung mutierender IAM-v1-Endpunkte (`POST`, `PATCH`, `DELETE`) für User- und Rollenverwaltung muss ein einheitlicher, pragmatischer CSRF-Schutz umgesetzt werden.

Session-basierte Authentifizierung mit Cookies (`SameSite=Lax`) reduziert Risiken, ist jedoch allein nicht ausreichend für alle Browser-/Embed-Szenarien.

## Entscheidung

Wir erzwingen für alle mutierenden IAM-v1-Endpunkte zusätzlich den Header:

- `X-Requested-With: XMLHttpRequest`

Serverseitig wird dieser Header strikt validiert. Fehlt er oder ist er ungültig, antwortet der Endpoint mit `csrf_validation_failed`.

## Begründung

- Niedriger Implementierungsaufwand in API und UI.
- Gute Kompatibilität mit bestehenden Fetch-basierten Clients.
- Ergänzt `SameSite=Lax` um eine explizite Request-Herkunftsprüfung.

## Verbindliche Leitplanken

- Alle mutierenden IAM-Requests nutzen zentrale API-Utilities mit verpflichtendem CSRF-Header.
- Keine Endpoint-Ausnahme ohne dokumentierte Freigabe.
- Fehler dürfen keine sensitiven Details preisgeben.

## Alternativen

### Alternative A: Synchronizer-Token pro Request

- Vorteil: Höchste Sicherheit bei klassischer Form-basierten Angriffsfläche.
- Nachteil: Zusätzlicher State- und Lifecycle-Aufwand im aktuellen Stack.
- Ergebnis: vorerst verworfen.

### Alternative B: Nur `SameSite=Lax`

- Vorteil: minimaler Aufwand.
- Nachteil: Schutzgrad für einige Angriffs-/Embedding-Fälle unzureichend.
- Ergebnis: verworfen.

## Konsequenzen

### Positiv

- Einheitlicher CSRF-Mechanismus über alle IAM-v1-Writes.
- Einfach testbar auf API- und E2E-Ebene.

### Negativ

- Externe Clients müssen den Header explizit setzen.

## Verwandte ADRs

- `ADR-009-keycloak-als-zentraler-identity-provider.md`
- `ADR-016-idp-abstraktionsschicht.md`
