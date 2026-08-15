# Plan 009: IAM-Acceptance-Orchestrierung modularisieren

## Status

- Status: DONE
- Priorität: P1
- Aufwand: L
- Risiko: HIGH
- Abhängigkeit: Plan 002 muss gemergt sein
- Kategorie: geschützte Acceptance-Evidenz

## Ziel und Ist-Zustand

`scripts/ci/run-iam-acceptance.ts` enthält eine 561 Zeilen große `main`-
Orchestrierung mit 49 zyklomatischer und 39 kognitiver Komplexität. Sie sammelt
geschützte IAM-Akzeptanzevidenz und darf weder Prüfschritte verlieren noch
Erfolg zu früh melden.

## Scope und Vorgehen

- aktuelle Szenarien, Reihenfolge, Exitcodes, Redaction und Evidenzdateien vorab
  charakterisieren,
- Konfigurationslesen, Szenarioausführung und Ergebnisaggregation trennen,
- terminalen Gesamterfolg weiterhin ausschließlich aus allen Pflichtprüfungen
  ableiten,
- keine Credentials in Logs, Fixtures oder PR-Evidenz aufnehmen,
- CLI-Vertrag und Workflow-Aufruf unverändert halten.

## Verifikation

- vorhandene und ergänzte IAM-Acceptance-Unit-Tests,
- Scripts-TSC, Runtime-/Security-nahe Checks, Complexity-Gate und Fallow,
- Workflow-/CLI-Vertragsprüfung ohne Zugriff auf echte Secrets.

## Fertig, wenn

- `main` nur noch Orchestrierung mit kleiner Komplexität enthält,
- jede Pflichtprüfung und Fehleraggregation einzeln getestet ist,
- Redaction und Exitstatus vollständig erhalten bleiben.

## STOP-Bedingungen

- ein geschütztes Environment oder Secret wäre für Unit-Verifikation nötig,
- bestehende Acceptance-Anforderungen widersprechen einander.

## Abschluss

- PR: #991
- Merge-Commit: `ac16466e20d8cf9141c7623b08bae57c5f1db6de`
- Ergebnis: `runIamAcceptance` von 49/39/561 auf 7/9/31
  (zyklomatisch/kognitiv/Funktionszeilen) reduziert; CLI-, Reihenfolge-,
  Redaction- und Fehlerverträge bleiben durch Characterization-Tests geschützt.
