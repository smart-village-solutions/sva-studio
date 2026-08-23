# Change: Account-Import-Profilreparatur in reine Entscheidungslogik zerlegen

## Why

Die Profilreparatur beim tenantlokalen Keycloak-Import verbindet Fallback-Priorität, Mandantenbindung, Provider-Mutation und Reporting in einem kritischen Komplexitäts-Hotspot. Die bestehende fail-closed Semantik soll durch eine kleine reine Entscheidungseinheit überprüfbar werden, ohne den Import- oder Keycloak-Vertrag zu verändern.

## What Changes

- Eine reine interne Planungsfunktion bestimmt die unveränderte Priorität `Quellwert -> lokaler Seed -> Username als E-Mail` und die erforderlichen Reparaturfelder.
- Der bestehende Handler behält Lookup, exakt eine optionale Keycloak-Mutation, PII-freies Logging, Persistenz und Report-Reihenfolge bei.
- Characterization-Tests sichern Blank-, Partial-, Konflikt-, Fehler-, Reihenfolge-, Subject- und Instanzfälle vor und nach der Extraktion.
- Die beiden dokumentierten Fallow-Hotspots werden ohne Suppression, Schwellenänderung oder parallelen Importpfad beseitigt.

## Impact

- Affected specs: `iam-core`, `complexity-quality-governance`
- Affected code: `packages/auth-runtime/src/iam-account-management/user-import-sync-handler.ts` und kolokierte Tests
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`
- Breaking changes: keine
