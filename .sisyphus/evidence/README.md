# Evidence-Ablage

Diese Ablage ist für echte Evidence-Dateien gemäß
`docs/governance/evidence-and-acceptance-protocol.md` vorgesehen.

## Regeln

- Nur echte Nachweise ablegen, keine Platzhalter als "fertige" Evidence
- Dateinamen nach dem Schema `task-{N}-{scenario-slug}.{ext}`
- geeignete Formate: `.txt`, `.json`, `.log`, `.md`
- Evidence-Dateien nach Commit nicht löschen

## Empfohlene Dateien für Arbeitspaket 1.2

```text
task-12-data-classification-review.md
task-12-rls-role-verification.log
task-12-field-encryption-tests.log
task-12-log-redaction-audit.md
task-12-governance-export.json
task-12-consent-export.json
task-12-compliance-gates.log
task-12-retention-run.log
task-12-retention-alerting.md
task-12-incident-tabletop.md
task-12-acceptance-summary.md
```

Bis zur tatsächlichen Ausführung in Test, Staging oder Produktion bleiben diese
Dateien bewusst unangelegt. Vorlagen und Prüfanweisungen liegen unter
`docs/guides/`.
