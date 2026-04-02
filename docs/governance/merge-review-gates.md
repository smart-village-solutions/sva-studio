# Merge- und Review-Gates (Standardmodell)

## Ziel

Dieses Dokument definiert die verbindlichen Merge-Gates fuer das Trunk-plus-Stacked-Modell. `main` ist der einzige langlebige Integrationsbranch. Ein Merge nach `main` ist nur zulaessig, wenn alle Pflichtchecks und Review-Regeln erfuellt sind.

## Betriebsmodell

Die Regeln in diesem Dokument sind auf kleine Teams und wachsende Maintainer-Strukturen ausgelegt. Rollen sind funktionsbasiert definiert und koennen in fruehen Projektphasen von derselben Verantwortungsgruppe wahrgenommen werden. Verschaerfte organisatorische Trennung wird erst verbindlich, wenn ausreichend unabhaengige Reviewer verfuegbar sind und die zugehoerige Enforcement-Phase gem. `docs/governance/rollout-plan.md` aktiv ist.

## Required Checks (explizite Namen)

Die folgenden Status-Checks muessen im Branch-Schutz fuer `main` als **required** eingetragen sein:

| Check-Run-Name (Branch Protection) | Quelle | Muss gruen sein, wenn ... |
| --- | --- | --- |
| `Lint / lint` | Root-Command `pnpm test:eslint` | immer |
| `Unit / unit` | Root-Command `pnpm test:unit` | immer |
| `Types / types` | Root-Command `pnpm test:types` | immer |
| `Test Coverage / coverage` | Workflow `.github/workflows/test-coverage.yml`, Job `coverage` | immer |
| `App E2E / e2e` | Workflow `.github/workflows/app-e2e.yml`, Job `e2e` | Zielmodell: immer required. Der Workflow muss dafuer fuer alle PRs laufen und bei Nicht-Treffern fruehzeitig mit `success` enden. Solange `.github/workflows/app-e2e.yml` noch ueber `pull_request.paths` eingeschraenkt ist, darf der Check nicht als strikt required fuer alle PRs konfiguriert werden. |

Verbindliche Regel: Kein unspezifisches "CI ist gruen". Entscheidend sind genau die oben genannten Check-Namen.

Hinweis zur aktuellen Repository-Situation: `.github/workflows/app-e2e.yml` verwendet derzeit `pull_request.paths`. Damit ist die oben beschriebene Zielkonfiguration fuer `App E2E / e2e` noch nicht vollstaendig technisch durchgesetzt und muss vor harter Aktivierung angepasst werden.

## Review-Anforderungen

- Mindestanzahl Reviews fuer jeden PR nach `main`: **1** Approve (numerisch, hartes Minimum).
- Fuer kritische Pfade (`.github/workflows/**`, `packages/core/**`, `packages/auth/**`): Zielmodell **2** Approvals; verbindlich spaetestens ab verfuegbarer unabhaengiger Reviewer-Struktur und aktivierter Enforcement-Phase.
- Self-Approval zaehlt nicht.
- Stale-Approval wird bei neuem Commit invalidiert; ein neuer Approve ist erforderlich.
- Bis zur vollen organisatorischen Trennung gilt fuer kritische Pfade mindestens ein dokumentierter fachlicher Review durch die zustaendige Verantwortungsgruppe.

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
2. Ein PR beruehrt einen kritischen Pfad (`.github/workflows/**`, `packages/core/**`, `packages/auth/**`).
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
| 4 | Required Checks erneut ausfuehren (`Lint / lint`, `Unit / unit`, `Types / types`, `Test Coverage / coverage`, ggf. `App E2E / e2e`) | Incident Owner | 60 Minuten ab Detection |
| 5 | Incident-Notiz mit Ursache, SHA, Aktion und Follow-up veroeffentlichen | Incident Owner | 90 Minuten ab Detection |

SLA: `main` muss spaetestens nach **30 Minuten** wieder gruene Required Checks haben (Revert-first-Prinzip).

## Bypass-Regel

Es gibt keinen stillen Bypass. Eine Ausnahme ist nur gueltig, wenn alle Punkte dokumentiert sind:

1. Ticket/Issue-ID,
2. technische Begruendung,
3. explizite Freigabe durch Maintainer,
4. Ablaufdatum der Ausnahme,
5. PR-Kommentar mit Audit-Referenz.
