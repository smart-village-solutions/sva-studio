# Betriebsnachweise Datenschutz und Compliance

## Zweck

Dieses Dokument beschreibt, welche Nachweise in Staging oder Produktion
erbracht werden müssen, die nicht allein aus dem Repository ableitbar sind.

## 1. Retention-Betriebsnachweise

Erforderliche Artefakte:

- Nachweis des Schedulers oder Cronjobs
- Log eines erfolgreichen Retention-Laufs
- Log eines fehlgeschlagenen Laufs oder Alarmtests
- Nachweis der Alarmierung bei Exit-Code ungleich `0`

Empfohlene Ablage:

- `.sisyphus/evidence/task-12-retention-scheduler.md`
- `.sisyphus/evidence/task-12-retention-run.log`
- `.sisyphus/evidence/task-12-retention-alerting.md`

Prüfpunkte:

1. `pnpm iam:retention:run` ist im Zielsystem tatsächlich geplant.
2. Laufzeit, Exit-Code und Ergebniszahlen werden protokolliert.
3. Alarmierung bei Fehlern ist nachvollziehbar ausgelöst oder getestet.
4. `iam.platform_activity_logs` wird gesondert überwacht, solange kein
   separater Archivierungspfad produktiv ist.

## 2. Governance- und Consent-Exportnachweise

Erforderliche Artefakte:

- JSON- oder CSV-Export aus Test oder Staging
- Nachweis, mit welcher Rolle der Export zulässig war
- geschwärzte oder synthetische Testdaten, keine echten PII

Empfohlene Ablage:

- `.sisyphus/evidence/task-12-governance-export.json`
- `.sisyphus/evidence/task-12-consent-export.json`
- `.sisyphus/evidence/task-12-export-access-review.md`

Prüfpunkte:

1. Export enthält die im Runbook geforderten Pflichtfelder.
2. Export erfolgt nur mit zulässiger Rolle.
3. Exportdaten sind für Audit nutzbar und enthalten keine unnötigen Klartextdaten.

## 3. RLS- und Rollenpfadnachweise

Erforderliche Artefakte:

- Prüfprotokoll für produktionsnahe DB-Rollen
- Nachweis, dass App-Runtime nicht mit `SUPERUSER` oder `BYPASSRLS` läuft
- Nachweis typischer Allow-/Deny-Szenarien

Empfohlene Ablage:

- `.sisyphus/evidence/task-12-rls-role-verification.log`
- `.sisyphus/evidence/task-12-rls-role-summary.md`

## 4. PII-freie Lognachweise

Erforderliche Artefakte:

- Stichprobe echter Logs oder OTEL-Events
- Suchprotokoll nach E-Mail-, Token-, Cookie- oder Secret-Mustern
- Bewertung der Treffer und getroffenen Redaction-Regeln

Empfohlene Ablage:

- `.sisyphus/evidence/task-12-log-redaction-audit.md`
- `.sisyphus/evidence/task-12-log-redaction-search.log`

## 5. Incident-/Tabletop-Nachweise

Erforderliche Artefakte:

- Tabletop-Protokoll mit Szenario, Rollen, Zeitlinie und Entscheidungen
- Lessons Learned und offene Maßnahmen

Empfohlene Ablage:

- `.sisyphus/evidence/task-12-incident-tabletop.md`

## 6. Abnahmeempfehlung

Eine vollständige Abnahme sollte erst ausgesprochen werden, wenn diese
Betriebsnachweise zusammen mit den Repo-seitigen Artefakten vorliegen.
