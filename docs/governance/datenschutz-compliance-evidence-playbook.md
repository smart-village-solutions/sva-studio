# Evidence-Playbook Datenschutz und Compliance

## Zweck

Dieses Playbook beschreibt, wie Nachweise für Arbeitspaket 1.2 erzeugt,
abgelegt und für eine Abnahme gebündelt werden. Es ergänzt das generische
Evidence-Protokoll um konkrete Datenschutz- und Compliance-Kontrollziele.

## Grundsatz

Es werden nur echte Nachweise abgelegt. Vorlagen, Checklisten und Runbooks sind
Vorbereitungshilfen, aber keine Evidence im engeren Sinn.

## Kontrollziele

Für Arbeitspaket 1.2 werden mindestens folgende Kontrollziele separat
nachgewiesen:

1. Datenklassifizierung
2. Zugriffsschutz und Rollenpfade
3. Verschlüsselung vertraulicher Daten
4. PII-freie Protokollierung
5. Auditierbarkeit von Governance- und Consent-Vorgängen
6. wirksame Compliance-Gates in Business-Flows
7. Retention, Archivierung und Löschung
8. Incident- und Eskalationsfähigkeit

## Evidence-Ablage

Pfad:

```text
.sisyphus/evidence/
```

Empfohlene Dateinamen für dieses Arbeitspaket:

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

Die Nummer `12` ist hier ein Vorschlag für das Arbeitspaket 1.2. Falls in
eurem Plan bereits eine andere Task-Nummer vergeben ist, muss diese
konsistent verwendet werden.

## Evidence je Kontrollziel

| Kontrollziel | Mindest-Evidence |
| --- | --- |
| Datenklassifizierung | Review-Report mit Verweis auf Datenobjekte und Schutzklassen |
| Zugriffsschutz und Rollenpfade | SQL-/CLI-Prüfprotokoll aus Zielsystem oder Staging |
| Verschlüsselung | Testlauf-Log und Konfigurationsprüfung ohne Secret-Offenlegung |
| PII-freie Logs | Stichprobenbericht auf Basis echter Logdaten oder OTEL-Samples |
| Governance-/Consent-Audit | Beispiel-Export in JSON/CSV/SIEM plus Rollennachweis |
| Compliance-Gates | Testprotokoll echter Business-Flows mit Block-/Allow-Verhalten |
| Retention | Scheduler-Nachweis, Run-Log, Alarmierungsnachweis |
| Incident-Fähigkeit | Tabletop-Protokoll oder echter Incident-Report |

## Evidence-Paket für eine Abnahme

Vor einer Abnahme sollte mindestens abgelegt werden:

- Nachweismatrix
- TOM-Matrix
- alle zugehörigen Evidence-Dateien
- eine zusammenfassende `acceptance-summary`
- Verweise auf Tests, Exporte und Betriebsbelege

## Verbotene Scheinevidence

Nicht ausreichend sind:

- reine Behauptungen ohne Log, Export oder Testlauf
- leere Template-Dateien als angeblicher Nachweis
- Codeverweise ohne Verifikation
- Vorlagen für Staging/Prod, die nie ausgeführt wurden
- generische Aussagen wie "sollte funktionieren"
