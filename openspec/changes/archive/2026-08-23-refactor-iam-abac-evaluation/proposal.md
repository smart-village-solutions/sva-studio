# Change: IAM-ABAC-Auswertung in reine Entscheidungsbausteine zerlegen

## Why

`evaluateAbacRules` bündelt Geo-, Organisations-, Zeitfenster-, Acting-as- und Force-Deny-Regeln in einer hochkomplexen Funktion. Die sicherheitskritische Entscheidungsreihenfolge ist dadurch schwerer reviewbar, obwohl der bestehende Vertrag deterministisch und fail-closed bleiben muss.

## What Changes

- Die bestehende ABAC-Auswertung wird entlang fachlicher Regelgrenzen in kleine reine interne Evaluatoren zerlegt.
- Characterization-Tests sichern Regelpriorität, Kombinationen, Reasons und Provenance vor der Extraktion ab.
- `evaluateAuthorizeDecision` bleibt der einzige öffentliche Einstiegspunkt; Allow-/Deny-, Scope-, Owner-, Organisations-, DataProvider-, Reason- und Provenance-Semantik bleiben unverändert.
- Die reduzierte Komplexität wird mit Fallow und dem kanonischen Complexity-Gate nachgewiesen; Suppressionen oder parallele Entscheidungswege sind ausgeschlossen.

## Impact

- Affected specs: `iam-access-control`, `complexity-quality-governance`
- Affected code: `packages/iam-core/src/authorization-engine.ts`, interne ABAC-Bausteine und zugehörige Unit-Tests
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`
- Breaking changes: keine
