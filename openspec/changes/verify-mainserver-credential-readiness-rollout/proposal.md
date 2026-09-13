# Change: Mainserver-Credential-Readiness im Rollout verifizieren

## Why

Die Korrektur aus `enforce-mainserver-credential-readiness` benötigt nach dem
Merge eine getrennte operative Abnahme. Diese darf den Implementierungs-Change
nicht mit Production-Zugriffen, Rollout-Steuerung oder allgemeiner
Observability-Infrastruktur aufhalten.

## What Changes

- Derselbe immutable Image-Digest wird über den kanonischen
  Build→Dev→Staging→Production-Pfad promotet.
- Staging weist die Readiness-Zustände ohne Credentialwerte oder vollständige
  Benutzeridentitäten nach.
- Production prüft Bad Belzig und Prignitz read-only und dokumentiert nur
  statusbezogene, redigierte Evidenz.

## Scope Boundaries

- Keine Code-, Schema-, Keycloak- oder Credential-Mutation.
- Keine Credential-Rotation und keine Passwortänderung.
- Keine neuen Metriken, Audit-Infrastruktur oder Recovery-Automation.
- Eine Write-Probe benötigt einen eigenen, ausdrücklich freigegebenen Change.

## Dependency

Dieser Change beginnt erst nach Merge von
`enforce-mainserver-credential-readiness`.
