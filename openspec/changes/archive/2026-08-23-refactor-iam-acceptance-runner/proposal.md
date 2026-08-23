# Change: IAM-Acceptance-Runner in fachliche Prüfschritte zerlegen

## Why

Der Runner bündelt Konfiguration, Keycloak-Preflight, Testdaten-Reset, Readiness, Browser-Login, Datenbanknachweise, Organisations-CRUD, UI-Smokes und Berichtsausgabe in einer einzigen langen Orchestrierungsfunktion. Die hohe Komplexität erschwert Änderungen an einem sicherheitskritischen, fail-closed Delivery-Gate.

## What Changes

- Der bestehende CLI-Einstieg bleibt erhalten und orchestriert weiterhin dieselben Pflichtprüfungen in derselben Reihenfolge.
- Reine Entscheidungs- und fachliche Prüfschritte werden in interne, typisierte Module unter `scripts/ci/` extrahiert.
- Prozessebene, Exitcodes, Fehlercodes, Berichtsausgabe und Secret-Redaction werden vor der Extraktion durch Characterization-Tests abgesichert.
- Es werden keine Zielumgebungen gestartet oder verändert und keine neuen Acceptance-Prüfungen eingeführt.
- Die kanonische Complexity-Baseline wird nur entsprechend tatsächlich behobener Findings reduziert.

## Impact

- Affected specs: `iam-organizations`, `complexity-quality-governance`
- Affected code: `scripts/ci/run-iam-acceptance.ts` und neue interne Acceptance-Runner-Module
- Affected tests: `scripts/ci/iam-acceptance.test.ts`, `scripts/ci/run-iam-acceptance.test.ts`
- Affected documentation: IAM-Acceptance-Runbook sowie arc42-Abschnitte 05, 08, 10 und 11
