# WP-006 Abnahmeprotokoll: Datenschutz und Compliance

## Ausgangslage

- Arbeitspaket: `WP-006`
- Titel: `Datenschutz und Compliance`
- Bezugsdatum dieses Protokolls: `2026-05-25`
- Dieses Protokoll bereitet die Kundenabnahme für die Datenschutz-, Consent- und Compliance-Pfade im IAM-Umfeld vor.
- Die Aussagen stützen sich auf vorhandene Architektur-, Governance-, Export- und Prüfdokumente sowie auf konkrete Implementierungs- und Testartefakte zu Tenant-Scope, Legal-Compliance-Gates, Exportberechtigungen und PII-Redaction.

## Abnahmescope

Für `WP-006` gelten in diesem Protokoll folgende Prüfpunkte als maßgeblich:

1. Relevante Datenschutz- und Compliance-Pfade sind im Tenant-Scope sauber abgesichert.
2. Rechtlich erforderliche Zustimmungen können technisch erzwungen und protokolliert werden.
3. Export- und Einsichtspfade für Zustimmungsnachweise sind berechtigungsgebunden.
4. PII wird in den relevanten IAM-Pfaden nicht unkontrolliert offengelegt.

## Ergebnis

`WP-006` ist zum Bezugsdatum `2026-05-25` **repo-seitig stark abgesichert und für die Kundenabnahme fachlich gut vorbereitet**.

Die technische Nachweislage für Tenant-Scope, Compliance-Gates, Consent-Audit, Exportberechtigungen und PII-Schutz ist substanziell. Für eine vollständig geschlossene formale Abnahme bleiben aber noch die bereits im Projektstatus benannten Restpunkte offen: der letzte Abgleich zwischen Compliance-Scope und finalem Rechtstext-/Consent-Flow sowie konsolidierte End-to-End-Nachweise für Enforcement und Export.

## Kurzfazit für den Kundentermin

- Datenschutz- und Compliance-Pfade sind nicht nur dokumentiert, sondern in Runtime-, Export- und UI-Pfaden tenantbezogen modelliert.
- Rechtstext- und Consent-Pfade besitzen technische Enforcement-Mechanismen und revisionsrelevante Auditfelder.
- Governance- und Consent-Exporte sind rollen- und berechtigungsgebunden angelegt.
- PII-Redaction und verschlüsselte Verarbeitung sensibler IAM-Daten sind repo-seitig deutlich nachweisbar.
- Für die formale Komplettfreigabe sollten die noch offenen Zielumgebungs- und End-to-End-Belege transparent benannt werden.

## Empfohlener Ablauf im Kundengespräch

1. Kurze Einordnung des Scopes von `WP-006`
2. Darstellung des Datenschutz-Cockpits und der tenantbezogenen Sichtbarkeit
3. Erläuterung der Legal-/Consent-Erzwingung in geschützten IAM-Pfaden
4. Darstellung von Export- und Einsichtspfaden einschließlich Rollenbindung
5. Erläuterung des PII-Schutzes in Audit-, Log- und Account-Pfaden
6. Abschluss mit Abnahmeeinschätzung und den noch offenen End-to-End-Nachweisen

## Gesprächsleitfaden

### 1. Tenant-Scope für Datenschutz- und Compliance-Pfade

Im Termin sollte gezeigt werden, dass Datenschutz- und Governance-Funktionen nicht global oder unscharf wirken, sondern an den aktiven Mandanten gebunden sind. Das betrifft sowohl Self-Service-Pfade des Benutzers als auch Admin-/Governance-Sichten.

**Repo-seitig gestützt durch:**

- [apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx](../../apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx)
- [apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx](../../apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx)
- [apps/sva-studio-react/src/routes/admin/-iam-page.tsx](../../apps/sva-studio-react/src/routes/admin/-iam-page.tsx)
- [apps/sva-studio-react/src/routes/admin/-iam-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/-iam-page.test.tsx)
- [apps/sva-studio-react/src/lib/iam-viewer-access.test.ts](../../apps/sva-studio-react/src/lib/iam-viewer-access.test.ts)
- [docs/guides/iam-governance-runbook.md](../guides/iam-governance-runbook.md)

**Für den Kunden fachlich relevant:**

- Datenschutzfälle und Governance-Sichten werden nur im passenden Instanzkontext angezeigt.
- Tenant-gebundene Löschregeln werden für Accounts ohne Tenant-Scope nicht angeboten.
- Export- und Governance-Funktionen hängen an einer expliziten Rollenmatrix und nicht nur an UI-Sichtbarkeit.

### 2. Rechtlich erforderliche Zustimmungen: Erzwingung und Protokollierung

Für die Abnahme ist zentral, dass offene Pflichtzustimmungen nicht bloß verwaltet, sondern an kritischen IAM-Pfaden technisch erzwungen werden. Gleichzeitig müssen Akzeptanzen mit belastbaren Pflichtfeldern protokolliert werden.

Die vorhandene Compliance-Middleware schützt insbesondere `/iam/authorize`, `/iam/me/permissions` und weitere IAM-Pfade, während nur eng begrenzte Ausnahmen für Login, definierte Legal-Text-Routen und bestimmte Governance-Operationen zugelassen sind. Ergänzend erweitert die Migrations- und Exportlogik die Consent-Auditspur um `workspace_id`, `subject_id`, `legal_text_version` und `action_type`.

**Repo-seitig gestützt durch:**

- [packages/auth-runtime/src/middleware-compliance.ts](../../packages/auth-runtime/src/middleware-compliance.ts)
- [packages/data/migrations/0017_iam_legal_acceptance_audit.sql](../../packages/data/migrations/0017_iam_legal_acceptance_audit.sql)
- [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.tsx)
- [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.test.tsx)
- [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx)
- [docs/guides/iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md)

**Abnahmefrage an den Kunden:**

- Ist ausreichend nachvollziehbar, dass offene Pflichtzustimmungen geschützte IAM-Funktionen wirksam blockieren und Akzeptanzen revisionssicher festgehalten werden?

**Führender Zusatznachweis:**

- [docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md](./wp-006-consent-enforcement-export-nachweis-2026-05-25.md)

### 3. Export- und Einsichtspfade für Zustimmungsnachweise

Im Termin sollte klar benannt werden, dass Nachweise nicht beliebig exportiert werden können. Für Consent- und Governance-Exporte sind eigene Rollen- und Berechtigungspfade vorhanden. Zusätzlich ist beim Consent-Export eine Rate-Limit-Logik hinterlegt, damit der Exportpfad nicht unkontrolliert missbraucht werden kann.

Für Governance-Exports sind JSON-, CSV- und SIEM-Formate vorgesehen. Der Export fokussiert pseudonymisierte Auditfelder wie `actor_pseudonym`, `target_ref`, `reason_code`, `request_id` und `trace_id`. Für Legal-Consent-Exporte wird die Berechtigung explizit über Rollen geprüft.

**Repo-seitig gestützt durch:**

- [packages/iam-governance/src/legal-consent-export.ts](../../packages/iam-governance/src/legal-consent-export.ts)
- [packages/iam-governance/src/governance-compliance-export.ts](../../packages/iam-governance/src/governance-compliance-export.ts)
- [apps/sva-studio-react/src/lib/iam-viewer-access.test.ts](../../apps/sva-studio-react/src/lib/iam-viewer-access.test.ts)
- [apps/sva-studio-react/src/routes/admin/-iam-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/-iam-page.test.tsx)
- [docs/guides/datenschutz-compliance-pruefprotokolle.md](../guides/datenschutz-compliance-pruefprotokolle.md)
- [docs/guides/datenschutz-compliance-betriebsnachweise.md](../guides/datenschutz-compliance-betriebsnachweise.md)

**Im Termin zeigen oder erläutern:**

- Datenschutz-Cockpit bzw. Governance-Sicht
- Export nur mit zulässiger Rolle
- Negativpfad ohne Exportrolle
- enthaltene Pflichtfelder und pseudonymisierte Exportstruktur

**Führender Zusatznachweis:**

- [docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md](./wp-006-consent-enforcement-export-nachweis-2026-05-25.md)

### 4. PII-Schutz in IAM-Pfaden

Der PII-Schutz ist repo-seitig an zwei Stellen gut sichtbar: erstens in der Redaction von Logdaten, zweitens in der verschlüsselten Verarbeitung sensibler Kontodaten im Audit-/Provisioning-Pfad. Dadurch wird verhindert, dass E-Mail-Adressen, Tokens, Passwörter oder vergleichbare Identitätsdaten unkontrolliert in Logs oder Persistenzpfade gelangen.

Die vorhandenen Tests decken Redaction für typische Secrets und Identitätsmarker ab. Zusätzlich zeigen die Audit-Sink-Tests, dass PII-Felder bei konfiguriertem Keyring verschlüsselt gespeichert werden und nicht im Klartext in den Persistenzpfad laufen.

**Repo-seitig gestützt durch:**

- [packages/server-runtime/src/logging/redaction.test.ts](../../packages/server-runtime/src/logging/redaction.test.ts)
- [packages/monitoring-client/src/logging/redaction.ts](../../packages/monitoring-client/src/logging/redaction.ts)
- [packages/auth-runtime/src/audit-db-sink.test.ts](../../packages/auth-runtime/src/audit-db-sink.test.ts)
- [docs/reports/2026-05-20-nachweismatrix-datenschutz-compliance-arbeitspaket-1-2.md](./2026-05-20-nachweismatrix-datenschutz-compliance-arbeitspaket-1-2.md)

**Abnahmefrage an den Kunden:**

- Ist nachvollziehbar, dass personenbezogene Daten in den relevanten IAM-Laufzeitpfaden geschützt, redigiert oder verschlüsselt behandelt werden?

## Kurzprotokoll

| Akzeptanzkriterium | Fachliche Aussage für die Abnahme | Bewertung |
| --- | --- | --- |
| Relevante Datenschutz- und Compliance-Pfade sind im Tenant-Scope sauber abgesichert | Self-Service-, Governance- und Deletion-Rules-Pfade sind tenantbezogen modelliert; Rollen- und Sichtbarkeitsmatrix verhindert unscharfen Zugriff | erfüllt |
| Rechtlich erforderliche Zustimmungen können technisch erzwungen und protokolliert werden | Compliance-Middleware schützt kritische IAM-Pfade; Consent-Auditfelder und Rechtstextpfade sind technisch angelegt | weitgehend erfüllt |
| Export- und Einsichtspfade für Zustimmungsnachweise sind berechtigungsgebunden | Governance- und Consent-Exporte besitzen explizite Rollen-/Berechtigungspfade, Rate-Limits und pseudonymisierte Exportfelder | weitgehend erfüllt |
| PII wird in den relevanten IAM-Pfaden nicht unkontrolliert offengelegt | Log-Redaction und verschlüsselte PII-Verarbeitung sind im Repo konkret implementiert und testseitig belegt | erfüllt |

## Abnahmeeinschätzung

Aus Repository-Sicht ist `WP-006` fachlich belastbar vorbereitet und im Kundentermin gut erklärbar. Besonders stark ist die Evidenz bei Scope-Trennung, Auditierbarkeit, Redaction und Exportdesign.

Für eine vollständig geschlossene formale Abnahme sollte aber nicht behauptet werden, dass bereits jede Zielumgebungs- und End-to-End-Evidence vollständig archiviert ist. Genau hier liegen die noch offenen Restpunkte des Arbeitspakets.

Für die Abnahmedurchsprache ist jetzt klar benennbar, welche drei Evidence-Blöcke den formalen Rest tragen: blockierender Consent-Fall, erfolgreicher Export mit Berechtigung und Negativfall ohne Exportberechtigung. Diese Bündelung liegt im Zusatzprotokoll [wp-006-consent-enforcement-export-nachweis-2026-05-25.md](./wp-006-consent-enforcement-export-nachweis-2026-05-25.md) vor und dient zugleich als führende Referenz für `WP-010`.

**Empfohlene Formulierung im Termin:**

> Das Arbeitspaket `WP-006` ist fachlich vorführbar und technisch in den relevanten Datenschutz- und Compliance-Pfaden substanziell abgesichert. Die finale formale Freigabe steht noch unter dem Vorbehalt des abschließenden Abgleichs mit dem finalen Rechtstext-/Consent-Flow sowie der konsolidierten End-to-End-Nachweise für Enforcement und Export.

## Repo-seitige Stützbelege

- Leit- und Nachweisdokumente:
  - [docs/guides/iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md)
  - [docs/guides/datenschutz-compliance-evidence-playbook.md](../guides/datenschutz-compliance-evidence-playbook.md)
  - [docs/guides/datenschutz-compliance-pruefprotokolle.md](../guides/datenschutz-compliance-pruefprotokolle.md)
  - [docs/guides/datenschutz-compliance-betriebsnachweise.md](../guides/datenschutz-compliance-betriebsnachweise.md)
- [docs/reports/2026-05-20-nachweismatrix-datenschutz-compliance-arbeitspaket-1-2.md](./2026-05-20-nachweismatrix-datenschutz-compliance-arbeitspaket-1-2.md)
- [docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md](./wp-006-consent-enforcement-export-nachweis-2026-05-25.md)
- Enforcement-, Audit- und Exportpfade:
  - [packages/auth-runtime/src/middleware-compliance.ts](../../packages/auth-runtime/src/middleware-compliance.ts)
  - [packages/data/migrations/0017_iam_legal_acceptance_audit.sql](../../packages/data/migrations/0017_iam_legal_acceptance_audit.sql)
  - [packages/iam-governance/src/legal-consent-export.ts](../../packages/iam-governance/src/legal-consent-export.ts)
  - [packages/iam-governance/src/governance-compliance-export.ts](../../packages/iam-governance/src/governance-compliance-export.ts)
- UI- und Rollennachweise:
  - [apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx](../../apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/-iam-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/-iam-page.test.tsx)
  - [apps/sva-studio-react/src/lib/iam-viewer-access.test.ts](../../apps/sva-studio-react/src/lib/iam-viewer-access.test.ts)
  - [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx)
- PII-Schutz:
  - [packages/server-runtime/src/logging/redaction.test.ts](../../packages/server-runtime/src/logging/redaction.test.ts)
  - [packages/monitoring-client/src/logging/redaction.ts](../../packages/monitoring-client/src/logging/redaction.ts)
  - [packages/auth-runtime/src/audit-db-sink.test.ts](../../packages/auth-runtime/src/audit-db-sink.test.ts)

## Offene Restpunkte

Für die formale Komplettfreigabe von `WP-006` bleiben aktuell noch diese Punkte separat nachzuziehen:

- Restabgleich zwischen Compliance-Scope und finalem Rechtstext-/Consent-Flow durchführen
- offene End-to-End-Nachweise für Enforcement und Export im Abnahme-Set konsolidieren
- finale Evidence-Dateien für `WP-006` und `WP-010` auf identische Referenzen harmonisieren

Zusätzlich zeigen die vorhandenen Datenschutz-Leitdokumente, dass für eine revisionssichere Außenprüfung ergänzende Betriebs-Evidence wie Exportbeispiele, produktionsnahe Rollen-/RLS-Prüfungen und echte Log-Stichproben weiterhin sinnvoll sind.

## Entscheidung

Für den aktuellen Projektstatus in [apps/project-report/src/data/project-status.json](../../apps/project-report/src/data/project-status.json) ist `WP-006` mit diesem Protokoll **sauber für den Kundentermin vorbereitet und statusseitig auf `acceptance` vertretbar**, aber **noch nicht vollständig formal geschlossen**, solange Consent-Flow-Abgleich und End-to-End-Evidence nicht konsolidiert vorliegen.
