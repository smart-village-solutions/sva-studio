# TOM-Matrix Datenschutz und Compliance

## Zweck

Diese TOM-Matrix konkretisiert für SVA Studio die technischen und
organisatorischen Maßnahmen für Arbeitspaket 1.2 "Datenschutz und Compliance".
Sie dient als Referenz für Implementierung, Betrieb, Prüfung und Abnahme.

## Geltungsbereich

- IAM- und Governance-Funktionen des SVA Studio
- Verarbeitung personenbezogener oder sensibler Daten in Host- und
  serverseitigen Paketen
- Logging-, Audit-, Consent-, Retention- und Incident-Prozesse

Nicht im Detail abgedeckt sind in dieser Matrix externe
Auftragsverarbeitungsverhältnisse, Verträge oder unternehmensweite
Organisationsrichtlinien außerhalb des Repository-Kontexts. Diese müssen
ergänzend dokumentiert werden.

## Rollenmodell für diese Matrix

| Rolle | Verantwortung |
| --- | --- |
| Produkt / Fachverantwortung | fachliche Anforderungen, Freigabe von Zweck und Umfang der Verarbeitung |
| Engineering | technische Umsetzung, Tests, Doku und technische Korrekturmaßnahmen |
| Plattform / Betrieb | Scheduler, Laufzeitbetrieb, Monitoring, Alarmierung, Backups, Zugriff auf Zielsysteme |
| Security | Sicherheitsvorgaben, Härtung, Log-/Rollenprüfungen, Incident-Eskalation |
| Datenschutz / Legal | rechtliche Bewertung, TOM-Prüfung, Freigabe von Datenschutz-relevanten Abweichungen |
| Audit / Review | stichprobenartige oder formale Wirksamkeitsprüfung |

## Prüffrequenzen

| Kürzel | Bedeutung |
| --- | --- |
| kontinuierlich | durch Code, CI oder Runtime-Mechanismen bei jeder Ausführung |
| pro Änderung | bei jeder relevanten Änderung an Code, Schema oder Konfiguration |
| monatlich | mindestens einmal pro Monat |
| quartalsweise | mindestens einmal pro Quartal |
| anlassbezogen | bei Incident, Audit, Migration oder Risikoänderung |

## TOM-Matrix

| Kontrollbereich | Maßnahme / TOM | Ziel | Verantwortlich | Prüffrequenz | Repo-/Betriebsbeleg |
| --- | --- | --- | --- | --- | --- |
| Datenklassifizierung | Schutzklassen für PII, Tokens, Audit- und Strukturdaten definieren | einheitlicher Schutzbedarf und Mindestmaßnahmen | Produkt, Engineering, Datenschutz | pro Änderung | `docs/architecture/iam-datenklassifizierung.md` |
| Datenminimierung | Session- und Auditdaten auf minimale fachlich nötige Inhalte begrenzen | unnötige PII-Verarbeitung vermeiden | Engineering, Security | pro Änderung | `docs/architecture/08-cross-cutting-concepts.md` |
| Verschlüsselung ruhender Daten | Vertrauliche IAM-Felder nur als Ciphertext persistieren | Klartext-PII in DB verhindern | Engineering, Security | kontinuierlich, pro Änderung | `packages/core/src/security/field-encryption.ts`, `packages/auth-runtime/src/audit-db-sink.ts` |
| Schlüsseltrennung | Schlüsselmateriel nicht in DB, sondern über Runtime-Konfiguration führen | Trennung von Daten und Schlüsseln | Plattform, Security | pro Änderung, quartalsweise | `IAM_PII_ACTIVE_KEY_ID`, `IAM_PII_KEYRING_JSON`, Architektur-Doku |
| Zugriffsschutz | Rollen- und Scope-Prüfungen, kein privilegierter Direktpfad | unbefugten Zugriff verhindern | Engineering, Security | kontinuierlich, anlassbezogen | IAM-/Governance-Codepfade, RLS-/Rollenprüfung |
| Audit-Trail | Governance-, Auth- und Consent-Ereignisse strukturiert persistieren | Nachvollziehbarkeit und Revisionssicherheit | Engineering, Plattform | kontinuierlich | `iam.activity_logs`, `iam.platform_activity_logs`, Governance-Exports |
| Log-Redaction | Secrets, Tokens, E-Mails, Cookies und sensitive IDs redigieren | keine Klartext-PII in Logs | Engineering, Security | kontinuierlich, monatlich | `packages/monitoring-client/src/logging/redaction.ts` |
| Consent-Management | Rechtstext-Versionen, Akzeptanz, Widerruf und Exportpfade dokumentieren und persistieren | Nachweis von Einwilligungen und Rechtsgrundlagen | Produkt, Engineering, Datenschutz | kontinuierlich, pro Änderung | `packages/iam-governance/src/legal-consent-export.ts`, `packages/data/migrations/0017_iam_legal_acceptance_audit.sql` |
| Compliance-Gates | geschützte Pfade nur bei erfüllten Legal-/Governance-Voraussetzungen zulassen | Schutzmaßnahmen verbindlich erzwingen | Engineering, Security | kontinuierlich, pro Änderung | `packages/auth-runtime/src/middleware-compliance.ts` |
| Aufbewahrung und Löschung | PII fristgerecht anonymisieren und Auditdaten archivieren | Speicherbegrenzung, DSGVO-konformer Lifecycle | Engineering, Plattform, Datenschutz | täglich, monatlich | `docs/guides/iam-retention-automation.md`, Runtime-Logs |
| Monitoring und Alarmierung | Job-Fehler, Wachstum kritischer Tabellen, fehlgeschlagene Läufe alarmieren | Wirksamkeit im Betrieb sicherstellen | Plattform, Security | kontinuierlich, monatlich | Scheduler, Alarmregeln, Job-Logs |
| Incident-Bearbeitung | Eskalationspfade für Datenschutz-/Governance-Vorfälle definieren | schnelle Reaktion und dokumentierte Behandlung | Security, Datenschutz, Plattform | anlassbezogen, quartalsweise | `docs/guides/security-policy.md`, `docs/guides/iam-governance-runbook.md` |
| Evidence und Abnahme | Kontrollziele mit nachvollziehbaren Artefakten, Logs und Reports belegen | auditierbare Abnahme | Engineering, Audit, Datenschutz | pro Änderung, vor Abnahme | `docs/governance/evidence-and-acceptance-protocol.md`, `.sisyphus/evidence/` |

## Offene Ergänzungen außerhalb des Repos

Für eine formale Datenschutz- und Compliance-Abnahme müssen zusätzlich
mindestens folgende organisatorische Nachweise gepflegt werden:

- Benennung konkreter Rolleninhaber
- Freigabeprozess für Datenschutz und Legal
- Verzeichnis der Verarbeitungstätigkeiten
- Vertrags- und AVV-Nachweise
- Lösch- und Auskunftsprozess außerhalb reiner Codepfade
- produktionsnahe Betriebs- und Auditprotokolle
