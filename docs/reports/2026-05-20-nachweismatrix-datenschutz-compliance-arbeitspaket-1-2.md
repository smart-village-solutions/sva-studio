# Nachweismatrix Arbeitspaket 1.2 Datenschutz und Compliance

## Zweck

Dieses Dokument bündelt die vorhandenen Nachweise für Arbeitspaket 1.2
"Datenschutz und Compliance" im SVA Studio. Ziel ist kein allgemeines
Policy-Papier, sondern eine prüffähige Matrix aus Anforderung, TOM,
Design-/Code-Beleg, Verifikation und verbleibender Restlücke.

## Bewertungsmaßstab

Ein Punkt gilt nur dann als belastbar nachgewiesen, wenn die Nachweiskette
vollständig ist:

1. fachliche oder regulatorische Anforderung
2. dokumentierte Soll-Regel oder Architekturvorgabe
3. technische Umsetzung im Code oder Schema
4. Verifikation durch Tests, Checks oder Exporte
5. betriebliche Evidence für den Wirkbetrieb

Fehlt einer dieser Bausteine, ist der Punkt nicht voll abnahmefest, sondern
nur teilweise nachgewiesen.

## Gesamtbild

Der aktuelle Stand zeigt eine tragfähige technische Grundlage für:

- Datenklassifizierung und Privacy-by-Design
- Verschlüsselung vertraulicher IAM-Felder
- Redaction sensibler Daten in Logs
- Auditierbare Governance- und Consent-Pfade
- automatisierte Retention- und Anonymisierungslogik

Für eine revisionssichere Abnahme des Arbeitspakets fehlen an mehreren Stellen
noch explizite Betriebs- und Ausführungsevidenzen, etwa Job-Logs,
Exportbeispiele, produktionsnahe Prüfnachweise oder eine formale TOM-Matrix
mit Verantwortlichkeiten.

## Nachweismatrix

| Anforderung aus Arbeitspaket 1.2 | TOM / Kontrollziel | Design- und Policy-Beleg | Implementierungsbeleg | Verifikation / Prüfbarkeit | Status | Restlücke für belastbaren Umsetzungsnachweis |
| --- | --- | --- | --- | --- | --- | --- |
| Klare Regeln für den Umgang mit personenbezogenen und sensiblen Daten | Schutzbedarf klassifizieren und Mindestmaßnahmen verbindlich machen | [docs/architecture/iam-datenklassifizierung.md](../architecture/iam-datenklassifizierung.md) definiert Schutzklassen und Maßnahmen für PII, Tokens, Auditdaten und Rollenstrukturen | Querschnittsvorgaben in [docs/architecture/08-cross-cutting-concepts.md](../architecture/08-cross-cutting-concepts.md) verankern Privacy-, Encryption-, Retention- und Logging-Regeln | Dokumentenprüfung über Klassifizierungsmatrix und Cross-Cutting-Konzept möglich | Teilweise nachgewiesen | Es fehlt eine explizite Zuordnung aller produktiven Datenobjekte außerhalb IAM zu derselben Klassifizierungssystematik |
| Zugriff auf sensible Daten muss beschränkt und nachvollziehbar sein | rollen- und scope-basierte Zugriffe, kein unkontrollierter Direktzugriff, Audit bei Änderungen | [docs/architecture/iam-datenklassifizierung.md](../architecture/iam-datenklassifizierung.md) fordert Zugriffsbeschränkung, Audit und RLS; [docs/guides/iam-governance-runbook.md](../guides/iam-governance-runbook.md) beschreibt Governance-Triage und Eskalation | [packages/auth-runtime/src/audit-db-sink.ts](../../packages/auth-runtime/src/audit-db-sink.ts) setzt Laufzeitrolle `iam_app` und bricht bei `SUPERUSER`/`BYPASSRLS` ab; Governance-Exports in [packages/iam-governance/src/governance-compliance-export.ts](../../packages/iam-governance/src/governance-compliance-export.ts) | Unit-Tests für Audit-Sink vorhanden in [packages/auth-runtime/src/audit-db-sink.test.ts](../../packages/auth-runtime/src/audit-db-sink.test.ts) | Teilweise nachgewiesen | Ein expliziter Nachweis der wirksamen RLS-Policies und der erlaubten Rollenpfade im Zielsystem fehlt in diesem Report noch |
| Vertrauliche personenbezogene Daten dürfen nicht im Klartext persistiert werden | Application-Level Encryption mit Schlüsseltrennung außerhalb der Datenbank | [docs/architecture/08-cross-cutting-concepts.md](../architecture/08-cross-cutting-concepts.md) legt Column Encryption und externe Schlüsselverwaltung fest; [docs/architecture/iam-datenklassifizierung.md](../architecture/iam-datenklassifizierung.md) verlangt Ciphertext-only | AES-256-GCM-Verschlüsselung in [packages/core/src/security/field-encryption.ts](../../packages/core/src/security/field-encryption.ts); Nutzung im Audit-/Account-Pfad in [packages/auth-runtime/src/audit-db-sink.ts](../../packages/auth-runtime/src/audit-db-sink.ts) | Kryptographie-Tests in [packages/core/src/security/field-encryption.test.ts](../../packages/core/src/security/field-encryption.test.ts); Verschlüsselungsnachweis im Audit-Pfad in [packages/auth-runtime/src/audit-db-sink.test.ts](../../packages/auth-runtime/src/audit-db-sink.test.ts) | Weitgehend nachgewiesen | Für die Abnahme fehlt noch Betriebs-Evidence, dass die produktive Konfiguration mit gültigem Keyring aktiv ist und Rotation geregelt wird |
| Protokollierung darf keine Klartext-PII oder Secrets offenlegen | strukturierte Log-Redaction für Tokens, E-Mail-Adressen, Cookies, Session-IDs und Identitätsreferenzen | [docs/architecture/08-cross-cutting-concepts.md](../architecture/08-cross-cutting-concepts.md) fordert Redaction im Server-Runtime- und OTEL-Pfad; [docs/architecture/iam-datenklassifizierung.md](../architecture/iam-datenklassifizierung.md) verbietet Klartext-PII in Logs | Redaction-Implementierung in [packages/monitoring-client/src/logging/redaction.ts](../../packages/monitoring-client/src/logging/redaction.ts); Re-Export im Server-Runtime-Paket in [packages/server-runtime/src/logging/redaction.ts](../../packages/server-runtime/src/logging/redaction.ts) | Redaction-Tests in [packages/server-runtime/src/logging/redaction.test.ts](../../packages/server-runtime/src/logging/redaction.test.ts) | Weitgehend nachgewiesen | Es fehlt noch ein betrieblicher Stichprobennachweis aus realen Logs oder OTEL-Sinks, dass keine unredacteten PII-Felder austreten |
| Einwilligungen, Rechtstexte und Compliance-relevante Aktionen müssen revisionssicher nachvollziehbar sein | Consent- und Governance-Ereignisse vollständig, strukturiert und exportierbar speichern | [docs/guides/iam-governance-runbook.md](../guides/iam-governance-runbook.md) definiert Pflichtfelder für Nachweise; [docs/architecture/08-cross-cutting-concepts.md](../architecture/08-cross-cutting-concepts.md) fordert auditierbare Governance-Pfade | Revisionsrelevante Felder in Migration [packages/data/migrations/0017_iam_legal_acceptance_audit.sql](../../packages/data/migrations/0017_iam_legal_acceptance_audit.sql); Consent-Export in [packages/iam-governance/src/legal-consent-export.ts](../../packages/iam-governance/src/legal-consent-export.ts); Governance-Export in [packages/iam-governance/src/governance-compliance-export.ts](../../packages/iam-governance/src/governance-compliance-export.ts) | Exportlogik ist direkt test- und abfragbar; das Runbook definiert die Prüffelder für Audit-Nachweise | Weitgehend nachgewiesen | Für die Abnahme fehlen abgelegte Beispiel-Exports aus einer Test- oder Staging-Instanz sowie der Nachweis, wer auf diese Exporte zugreifen darf |
| Schutzmaßnahmen müssen an kritischen Stellen verbindlich erzwungen werden | Compliance-Gates dürfen nicht nur dokumentiert, sondern müssen im Request-Pfad erzwungen werden | [docs/architecture/08-cross-cutting-concepts.md](../architecture/08-cross-cutting-concepts.md) verlangt Governance-Gates und Legal-Akzeptanzflüsse | [packages/auth-runtime/src/middleware-compliance.ts](../../packages/auth-runtime/src/middleware-compliance.ts) erzwingt Legal-Text-Compliance für geschützte IAM-Pfade und definiert eng begrenzte Ausnahmen | Code ist direkt prüfbar; ergänzende Handler-/Flow-Tests existieren im IAM-Governance-Paket | Teilweise nachgewiesen | Es fehlt eine zusammenhängende Testevidence je geschütztem Business-Flow, z. B. "Zugriff ohne akzeptierte Rechtstexte wird blockiert" |
| Aufbewahrung und Löschung personenbezogener Daten müssen geregelt und technisch durchgesetzt werden | PII fristgerecht anonymisieren; Audit-Daten geregelt archivieren; irreversible Löschung kontrolliert durchführen | [docs/guides/iam-retention-automation.md](../guides/iam-retention-automation.md) beschreibt Retention-Logik; [docs/architecture/08-cross-cutting-concepts.md](../architecture/08-cross-cutting-concepts.md) fordert zweistufigen Löschprozess und Legal Hold | Operative Ausführung über `scripts/ops/run-iam-retention.mjs`, referenziert in [docs/guides/iam-retention-automation.md](../guides/iam-retention-automation.md); Archivtabellen-/Pfade werden in der Doku benannt | Nachvollziehbar über Script-Ausführung `pnpm iam:retention:run` und Monitoring-Vorgaben in der Doku | Teilweise nachgewiesen | Es fehlen konkrete Run-Logs, Scheduler-/Cron-Evidence, Alarmierungsevidence und ein Nachweis für den noch separat zu überwachenden Plattform-Audit-Pfad |
| Datenschutzrelevante Vorfälle und Governance-Abweichungen müssen bearbeitbar und eskalierbar sein | definierte Triage-, Export- und Eskalationswege für Security, DSB/Legal und Plattform | [docs/guides/security-policy.md](../guides/security-policy.md) definiert Melde- und Bearbeitungsprozess; [docs/guides/iam-governance-runbook.md](../guides/iam-governance-runbook.md) beschreibt Triage und Eskalation | Governance- und Consent-Exportpfade im IAM-Governance-Paket liefern die operativen Datenquellen | Dokumenten- und Endpunktprüfung möglich | Teilweise nachgewiesen | Es fehlt ein geübter Incident-/Tabletop-Nachweis oder eine dokumentierte Probe eines Datenschutz-/Governance-Vorfalls |
| Nachweise selbst müssen auditierbar und reproduzierbar sein | Evidence-Driven Acceptance mit dauerhafter Ablage der Prüfergebnisse | [docs/governance/evidence-and-acceptance-protocol.md](../governance/evidence-and-acceptance-protocol.md) definiert "No Evidence -> No Done", Dateinamensschema, Prüf- und Retention-Regeln | Das Repository enthält bereits Reports und Governance-Artefakte unter `docs/reports/`; das Protocol fordert zusätzlich eine Evidence-Ablage pro Szenario | Verifizierbar über Existenz, Inhalt und Git-Historie der Evidence-Dateien | Teilweise nachgewiesen | Für Arbeitspaket 1.2 fehlt noch eine dedizierte Evidence-Sammlung pro Kontrollziel, etwa Exporte, Logs, Testläufe und Abnahmeprotokolle unter einer konsistenten Evidence-Ablage |

## Bewertung der Aussage "Haftungssicherheit" / "rechtssicherer Wirkbetrieb"

Die vorhandenen Artefakte belegen, dass das Repository die wesentlichen
technischen und konzeptionellen Grundlagen für datenschutzkonformen Betrieb
bereits weitgehend vorbereitet hat. Besonders belastbar nachweisbar sind
der Schutz vertraulicher IAM-Daten durch Verschlüsselung, Redaction in Logs,
strukturierte Auditpfade sowie definierte Governance- und Retention-Konzepte.

Nicht vollständig nachgewiesen ist allein durch den aktuellen Repo-Stand jedoch
die Aussage, dass damit bereits eine vollständige "Haftungssicherheit" oder ein
abschließend "rechtssicherer Wirkbetrieb" erreicht ist. Dafür braucht es
zusätzliche Betriebs-, Organisations- und Abnahmeevidenz außerhalb des reinen
Quellcodes.

## Fehlende Nachweise für eine belastbare Abnahme

Die folgenden Artefakte sollten ergänzend erzeugt oder gebündelt werden:

- formale TOM-Matrix mit Verantwortlichkeiten, Geltungsbereich und Prüffrequenz
- Exportbeispiele für Governance- und Consent-Nachweise aus Test oder Staging
- protokollierte Testläufe für Legal-Compliance-Gates und DSR-/Retention-Pfade
- Betriebsnachweise für `pnpm iam:retention:run` inklusive Scheduler, Logs und Alarmierung
- RLS-/Rollenprüfbericht für produktionsnahe Datenbankrollen
- Stichprobenprüfung realer Logs oder OTEL-Daten auf wirksame PII-Redaction
- Nachweis einer Datenschutz-/Governance-Incident-Übung oder eines Tabletop-Tests
- Evidence-Dateien pro Kontrollziel nach dem Schema aus [docs/governance/evidence-and-acceptance-protocol.md](../governance/evidence-and-acceptance-protocol.md)

## Empfehlung für die Verwendung dieses Dokuments

Dieses Dokument eignet sich als:

- Ausgangspunkt für ein Abnahmegespräch zu Arbeitspaket 1.2
- Basis für eine förmliche TOM- und Nachweismappe
- Checkliste für noch fehlende Audit- und Betriebsbelege

Für eine externe oder formale Prüfung sollte diese Matrix zusammen mit den
konkret erzeugten Evidence-Dateien, Testprotokollen und Betriebsbelegen
vorgelegt werden.
