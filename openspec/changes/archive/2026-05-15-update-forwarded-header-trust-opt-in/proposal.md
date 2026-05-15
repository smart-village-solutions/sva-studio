# Change: Expliziter Opt-in fuer vertrauenswuerdige Forwarded-Header

## Why
Die Auth-Runtime vertraut aktuell `X-Forwarded-*`- und `Forwarded`-Headern implizit in `production`, auch wenn kein ausdruecklicher Reverse-Proxy-Vertrag konfiguriert ist. Das weicht vom dokumentierten Betriebsmodell ab und oeffnet eine Trust-Boundary fuer host- und originabhaengige Auth-Entscheidungen.

## What Changes
- Stellt die Auth-Runtime auf einen fail-closed-Default um: Forwarded-Header werden nur noch bei explizitem Opt-in ueber `SVA_TRUST_FORWARDED_HEADERS=true|1` ausgewertet.
- Haelt fest, dass unset, leere oder ungueltige Werte kein Vertrauen in klientseitig gelieferte Forwarded-Header aktivieren.
- Lässt die bestehende Header-Priorisierung im explizit konfigurierten Reverse-Proxy-Betrieb unveraendert.

## Impact
- Affected specs: `iam-core`
- Affected code: `packages/auth-runtime/src/request-hosts.ts`, `packages/auth-runtime/src/config.ts`, `packages/auth-runtime/src/middleware-hosts.ts`, `packages/auth-runtime/src/iam-instance-registry/http.ts`
- Affected arc42 sections: `08-cross-cutting-concepts`
