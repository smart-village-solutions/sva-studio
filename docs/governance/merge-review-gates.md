# Merge- und Review-Gates (Standardmodell)

## Ziel

Dieses Dokument definiert die verbindlichen Merge-Gates fuer das Trunk-plus-Stacked-Modell. `main` ist der einzige langlebige Integrationsbranch. Ein Merge nach `main` ist nur zulaessig, wenn alle Pflichtchecks und Review-Regeln erfuellt sind.

## Betriebsmodell

Die Regeln in diesem Dokument sind auf kleine Teams und wachsende Maintainer-Strukturen ausgelegt. Rollen sind funktionsbasiert definiert und koennen in fruehen Projektphasen von derselben Verantwortungsgruppe wahrgenommen werden. Verschaerfte organisatorische Trennung wird erst verbindlich, wenn ausreichend unabhaengige Reviewer verfuegbar sind und die zugehoerige Enforcement-Phase gem. `docs/governance/rollout-plan.md` aktiv ist.

## Required Checks (explizite Namen)

Die folgenden Status-Checks muessen im Branch-Schutz fuer `main` als **required** eingetragen sein:

| Check-Run-Name (Branch Protection) | Quelle | Muss gruen sein, wenn ... |
| --- | --- | --- |
| `Quality Gates / Lint` | Root-Command `pnpm test:eslint` | immer |
| `Quality Gates / Unit` | Root-Command `pnpm test:unit` | immer |
| `Quality Gates / Types` | Root-Command `pnpm test:types` | immer |
| `Runtime Gates / Coverage` | Workflow `.github/workflows/runtime-gates.yml`, Job `coverage` | immer |
| `Runtime Gates / Complexity` | Workflow `.github/workflows/runtime-gates.yml`, Job `complexity` | immer |
| `Runtime Gates / PR Integration` | Workflow `.github/workflows/runtime-gates.yml`, Job `integration-pr` | Pull Requests |
| `App E2E / App E2E` | Workflow `.github/workflows/app-e2e.yml`, Job `e2e` | immer required. Der Workflow laeuft fuer alle PRs und endet bei Nicht-Relevanz bewusst frueh mit `success`. |

Verbindliche Regel: Kein unspezifisches "CI ist gruen". Entscheidend sind genau die oben genannten Check-Namen.

Die PR-Gates folgen einem einheitlichen `affected-first`-Modell: Normale Paketänderungen laufen affected, globale Tooling-Dateien eskalieren gezielt auf volle Läufe, irrelevante PRs enden bewusst als No-op-Erfolg.

## Review-Anforderungen

- Mindestanzahl Reviews fuer jeden PR nach `main`: **1** Approve (numerisch, hartes Minimum).
- Fuer kritische Pfade (`.github/workflows/**`, `packages/core/**`, `packages/auth-runtime/**`, `packages/iam-admin/**`, `packages/iam-governance/**`, `packages/instance-registry/**`): Zielmodell **2** Approvals; verbindlich spaetestens ab verfuegbarer unabhaengiger Reviewer-Struktur und aktivierter Enforcement-Phase.
- Self-Approval zaehlt nicht.
- Stale-Approval wird bei neuem Commit invalidiert; ein neuer Approve ist erforderlich.
- Bis zur vollen organisatorischen Trennung gilt fuer kritische Pfade mindestens ein dokumentierter fachlicher Review durch die zustaendige Verantwortungsgruppe.

## Mindestinhalt jedes Pull Requests

Jeder PR muss unabhaengig von seiner Groesse so beschrieben sein, dass Scope, Risiko und Nachweis ohne Rueckfrage erkennbar sind. Erwartet werden mindestens:

- Ziel oder adressierte Anforderung
- Betroffene Projekte oder Packages
- Risikoeinstufung oder konkrete Risikobeschreibung
- Tatsaechlich ausgefuehrte Tests oder begruendete Abweichung
- Doku-Status und bei Bedarf Rollback-Hinweis

Fuer Aenderungen in kritischen Pfaden muss der PR-Text ausserdem erkennen lassen, warum die ausgewaehlten Tests dem Risiko angemessen sind. Das formale Schema dafuer steht in `../development/qs-mindeststandard-sva-studio.md`.

## Merge-Methode pro Branch-Typ

| Branch-Typ | Erlaubte Merge-Methode | Regel |
| --- | --- | --- |
| `feature/*` | `Squash merge` | Standard nach `main`, linearer Verlauf |
| `fix/*` | `Squash merge` | Standard nach `main`, kleine reversible Changes |
| `chore/*` | `Squash merge` | Standard nach `main`, Wartung ohne Merge-Commit-Rauschen |
| `stack/*` | `Rebase and merge` in den direkten Parent-Branch | Kein Direktmerge nach `main`, solange Child-PRs offen sind |
| `epic/*` | kein Direktmerge nach `main` | Epic wird ueber untergeordnete PRs integriert; verbleibender Rest nur via `Squash merge` nach explizitem Maintainer-Entscheid |

## Merge-Queue-Policy

Merge Queue ist fuer PRs nach `main` aktiv, wenn mindestens **eines** der folgenden Aktivierungskriterien zutrifft:

1. Mindestens **2** PRs sind gleichzeitig `ready for merge`.
2. Ein PR beruehrt einen kritischen Pfad (`.github/workflows/**`, `packages/core/**`, `packages/auth-runtime/**`, `packages/iam-admin/**`, `packages/iam-governance/**`, `packages/instance-registry/**`).
3. Summe der geaenderten Dateien im PR ist **> 30**.

Queue-Verhalten:

- Nur PRs mit vollstaendig erfuellten Required Checks + Review-Regeln werden aufgenommen.
- Bei Queue-Fail (flaky oder echter Fail) wird der PR aus der Queue entfernt, als `queue-failed` markiert und muss nach neuem Gruen erneut eingereiht werden.
- Fallback bei Queue-Ausfall: serielle Maintainer-Merges (ein PR nach dem anderen), weiterhin mit identischen Required Checks und Review-Mindestwerten.
- In fruehen Projektphasen darf die Queue zunaechst selektiv fuer parallele oder risikoreiche Aenderungen genutzt werden; das Zielmodell bleibt davon unberuehrt.

## Broken-Main SOP (High Severity)

### Owner

- Primaerer Owner: Merge-Verursacher:in (Autor:in des zuletzt gemergten PRs) als Incident Owner.
- Sekundaerer Owner: On-Call Maintainer oder die aktuell zustaendige Verantwortungsgruppe, falls primaerer Owner nicht innerhalb der Reaktionszeit uebernimmt.

### Verbindliche Aktionen und Zeitbudget

| Schritt | Aktion | Owner | Max. Reaktionszeit |
| --- | --- | --- | --- |
| 1 | Incident ausrufen, Merge-Freeze auf `main` setzen | Primaerer Owner | 10 Minuten ab erstem roten Required Check auf `main` |
| 2 | Letzten fehlerausloesenden Merge **revertieren** (Standardpfad) | Primaerer Owner | 30 Minuten ab Detection |
| 3 | Falls Revert technisch unmoeglich: eng begrenzter Forward-Fix mit identischen Gates | Sekundaerer Owner | 45 Minuten ab Detection |
| 4 | Required Checks erneut ausfuehren (`Quality Gates / Lint`, `Quality Gates / Unit`, `Quality Gates / Types`, `Runtime Gates / Coverage`, `Runtime Gates / Complexity`, ggf. `Runtime Gates / PR Integration`, ggf. `App E2E / App E2E`) | Incident Owner | 60 Minuten ab Detection |
| 5 | Incident-Notiz mit Ursache, SHA, Aktion und Follow-up veroeffentlichen | Incident Owner | 90 Minuten ab Detection |

SLA: `main` muss spaetestens nach **30 Minuten** wieder gruene Required Checks haben (Revert-first-Prinzip).

## Bypass-Regel

Es gibt keinen stillen Bypass. Eine Ausnahme ist nur gueltig, wenn alle Punkte dokumentiert sind:

1. Ticket/Issue-ID,
2. technische Begruendung,
3. explizite Freigabe durch Maintainer,
4. Ablaufdatum der Ausnahme,
5. PR-Kommentar mit Audit-Referenz.
