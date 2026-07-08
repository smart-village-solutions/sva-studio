# WP-006 Nachweis: Consent-Enforcement und Export

Stand: `2026-05-25`

## Zweck

Dieses Zusatzprotokoll bündelt die drei formalen Kernnachweise aus der `48h`-Checkliste für `WP-006`:

1. blockierender Consent-Fall
2. erfolgreicher Export mit korrekter Berechtigung
3. Negativfall ohne Exportberechtigung

Es ergänzt das Hauptprotokoll [wp-006-datenschutz-compliance-abnahme-2026-05-25.md](./wp-006-datenschutz-compliance-abnahme-2026-05-25.md) und dient zugleich als führender Referenzpunkt für den Abgleich mit `WP-010`.

## Nachweismatrix

| Nachweisfall | Repo-seitige Evidenz | Fachliche Aussage | Status |
| --- | --- | --- | --- |
| Blockierender Consent-Fall | [packages/auth-runtime/src/legal-text-enforcement.test.ts](../../packages/auth-runtime/src/legal-text-enforcement.test.ts), [packages/auth-runtime/src/middleware-compliance.ts](../../packages/auth-runtime/src/middleware-compliance.ts), [apps/sva-studio-react/src/components/LegalTextAcceptanceDialog.test.tsx](../../apps/sva-studio-react/src/components/LegalTextAcceptanceDialog.test.tsx), [apps/sva-studio-react/src/lib/iam-api.test.ts](../../apps/sva-studio-react/src/lib/iam-api.test.ts) | Offene Pflichtzustimmungen blockieren geschützte IAM-Pfade fail-closed und führen den Benutzer in einen kontrollierten Akzeptanzfluss | Repo-seitig erfüllt; Zielumgebungsnachweis ist abgenommen |
| Erfolgreicher Export mit Berechtigung | [packages/iam-governance/src/legal-consent-export.ts](../../packages/iam-governance/src/legal-consent-export.ts), [packages/iam-governance/src/legal-consent-export.test.ts](../../packages/iam-governance/src/legal-consent-export.test.ts), [packages/auth-runtime/src/iam-governance/core.test.ts](../../packages/auth-runtime/src/iam-governance/core.test.ts), [apps/sva-studio-react/src/lib/iam-api.test.ts](../../apps/sva-studio-react/src/lib/iam-api.test.ts) | Berechtigte Benutzer können Consent-Nachweise kontrolliert und strukturiert exportieren | Repo-seitig erfüllt; lokaler Zielumgebungs-Export seit `2026-05-25` archiviert und erfolgreich |
| Negativfall ohne Exportberechtigung | [packages/iam-governance/src/legal-consent-export.test.ts](../../packages/iam-governance/src/legal-consent-export.test.ts), [packages/auth-runtime/src/iam-governance/core.test.ts](../../packages/auth-runtime/src/iam-governance/core.test.ts) | Consent-Nachweise sind nicht frei abrufbar, sondern an eine explizite Berechtigung gebunden | Repo-seitig erfüllt; Negativnachweis ohne Exportberechtigung ist abgehakt |

## Verdichtete End-to-End-Sicht

### 1. Blockierender Consent-Fall

- Serverseitiges Enforcement liefert bei offener Pflichtzustimmung deterministisch `403 legal_acceptance_required`.
- Die UI verarbeitet dieses Signal und öffnet den blockierenden Akzeptanzdialog.
- Der Pfad ist damit nicht nur als Fachlogik, sondern als zusammenhängender Runtime- und UI-Übergang nachgewiesen.

### 2. Erfolgreicher Exportfall

- Der Exportpfad verlangt `instanceId`, validiert optional `accountId` und unterstützt strukturierte Ausgabeformate.
- Die Exportdaten enthalten revisionsrelevante Felder wie `workspace_id`, `subject_id`, `legal_text_version`, `accepted_at`, `revoked_at` und `action_type`.
- Nach Korrektur der Migration [0044_iam_legal_text_targets.sql](../../packages/data/migrations/0044_iam_legal_text_targets.sql) ist der vorherige `503`-Blocker beseitigt.
- Damit ist die fachliche Aussage "Nachweise sind exportierbar, aber kontrolliert" nicht nur repo-seitig, sondern auch im lokalen Zielumgebungslauf technisch nachgewiesen.

### 3. Negativfall ohne Exportberechtigung

- Ohne `legal-consents:export` oder entsprechende System-Admin-Berechtigung wird der Export verweigert.
- Der Negativpfad ist fachlich wichtig, weil gerade dadurch der Datenschutz- und Compliance-Charakter des Arbeitspakets glaubwürdig bleibt.
- Der Negativpfad ist als fachlicher und technischer Berechtigungsnachweis abgenommen und ergänzt den positiven Exportfall zu einer vollständigen Export-Evidence.

## Lokale Evidence vom `2026-05-25`

- [iam-evidence-2026-05-25T21-26-25Z.md](./iam-evidence-2026-05-25T21-26-25Z.md): erster Lauf, dabei wurde der frühere `503`-Fehler im Exportpfad sichtbar.
- [iam-evidence-2026-05-25T21-29-40Z.md](./iam-evidence-2026-05-25T21-29-40Z.md): Nachverifikation nach Migrationsfix mit erfolgreichem positivem Export.
- Der positive Export ist lokal archiviert; der Negativpfad ohne Exportberechtigung ist ebenfalls als Abnahmebestandteil bestätigt.

## Abgleich mit `WP-010`

Für den Kundentermin sollte dieses Dokument als führender Nachweis für Consent-Enforcement und Export gelten. `WP-010` referenziert denselben Block, damit Rechtstext-, Akzeptanz- und Exportargumentation nicht auseinanderlaufen.

Gemeinsame Kernaussagen für `WP-006` und `WP-010`:

- offene Pflichtzustimmungen blockieren geschützte Funktionen
- Akzeptanzen werden revisionsrelevant protokolliert
- Exporte sind nur über einen berechtigten Pfad möglich

## Abschlussvermerk

- Der blockierende Consent-Fall ist in der Zielumgebung abgenommen.
- Der Negativnachweis ohne Exportberechtigung ist abgehakt.
- `WP-006` und `WP-010` referenzieren für Consent-Enforcement und Export denselben führenden Evidence-Block.
