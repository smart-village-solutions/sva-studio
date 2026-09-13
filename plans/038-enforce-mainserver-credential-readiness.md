# Plan 038: Mainserver-Credential-Readiness erzwingen

## Ziel und Grenzen

Issue #1332 wird mit drei zusammenhängenden Änderungen behoben:

1. Credential-Writes gelten erst nach kanonischem Read-back als erfolgreich.
2. Projection-Consumer starten nur bei vollständigen Credentials.
3. Dauerhafte Credential-Fehler werden über den vorhandenen Sync-State
   frühestens nach 15 Minuten erneut geprüft.

Die Lösung bleibt principalgenau. Lokale Accounts, andere Principals und
vorhandene Snapshots bleiben verfügbar. Es entstehen keine neue Tabelle, kein
neuer Scheduler, kein automatischer IAM→Projection-Recovery-Hook, keine neuen
Metriken und keine allgemeine Audit-Infrastruktur.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** HIGH wegen Auth-/Consumer-Grenze
- **Status:** IN PROGRESS – Implementierung und lokale Gates abgeschlossen; PR ausstehend
- **Ausgangsstand:** `origin/main` bei `7e5056d39`, 13. September 2026
- **Branch:** `fix/1332-mainserver-credential-readiness`
- **Issue:** <https://github.com/smart-village-solutions/sva-studio/issues/1332>
- **OpenSpec:** `enforce-mainserver-credential-readiness`
- **Abgrenzung:** #1331 / PR #1356 ist gemergt; #1336 bleibt separat

## Invarianten

- `MSCR-01`: Keine Credentialwerte oder vollständigen Benutzeridentitäten in
  Status, Logs, API, Audit oder Betriebsnachweis.
- `MSCR-02`: Provisionierung ist erst nach passendem kanonischem Read-back
  Credential-erfolgreich.
- `MSCR-03`: Nicht bereite Credentials starten keinen Mainserver-Aufruf und
  keinen Principal-Fallback.
- `MSCR-04`: Fehler bleiben principalgenau, erhalten Accounts und Snapshots und
  werden persistent gedrosselt.

## Implementierung

### 1. Statusmatrix im vorhandenen Reader erhalten

- `packages/auth-runtime/src/mainserver-credentials.ts` behält die
  Unterscheidung von vollständig, beide fehlend und jeweils partiell bis zum
  Consumer bei.
- `mainserver-effective-credentials.ts` bildet persönliche und
  organisatorische Quellen auf `ready`, `missing`, `partial` und `unavailable`
  ab. `stale` entsteht nur beim Vergleich mit einer ausdrücklich erwarteten
  Version.
- Kanonische und Legacy-Attribute sind nur als vollständiges Paar gültig.
- Nur der interne `ready`-Zweig trägt Credentialwerte und Fingerprint.

**Tests:** fehlend, beide Partialvarianten, blank, gemischte Namen, Legacy-
Komplettpaar, kanonisches Komplettpaar, Provider-Ausfall und zwei Principals.

### 2. Provisioning-Write kanonisch zurücklesen

- Den vorhandenen Persistenzhelfer für Create, Einzel- und Bulk-
  Reprovisionierung wiederverwenden.
- Nach `updateUser` über den instanzgebundenen Reader zurücklesen.
- Erwarteten und gelesenen Fingerprint mit derselben Normalisierung
  vergleichen.
- Nur ein passender vollständiger Read-back meldet Mainserver-Erfolg.
- Fehlend, partiell, abweichend oder nicht lesbar erhalten stabile
  Readiness-Fehler. Der lokale Account und bestätigte Providererfolg bleiben
  erhalten.

**Tests:** Write-vor-Read-back, vollständiger Erfolg, partial, stale,
unavailable, Idempotenz und Bulk-Isolation.

### 3. Projection vor dem Upstream gaten

- Die vorhandene Projection-Source-/Binding-Grenze prüft Readiness vor dem
  ersten Token- oder GraphQL-Aufruf.
- Nicht bereite Zustände werden mit stabilem Fehlercode im vorhandenen
  Projection-Sync-State persistiert.
- Vorhandene partielle oder vollständige Snapshots bleiben lesbar; keine
  Finalisierung und kein Löschabgleich.
- Kein Root-, Shared-, Organisations- oder fremder persönlicher Fallback.
- Die öffentliche Mainserver-Fassade bleibt unverändert.

**STOP:** Ist ein zuverlässiges Gate ohne neue öffentliche Adapter-API nicht
möglich, wird das Design vor weiterer Umsetzung erneut freigegeben.

**Tests:** null Upstream-Aufrufe für nicht bereite Zustände, ready-Erfolg,
Zwei-Principal-Isolation und Snapshot-Erhalt.

### 4. Scheduler-Cooldown aus bestehendem Zustand ableiten

- Eine pure Funktion entscheidet aus `last_error_code`, `last_failed_at`,
  Trigger und Uhrzeit über die Fälligkeit.
- `missing`, `partial` und `stale`: frühestens nach 15 Minuten.
- `unavailable` und Netzwerkfehler: vorhandener kurzer technischer Retry.
- Manueller Refresh darf erneut prüfen, aber nicht das Gate umgehen.
- Nach Reprovisionierung greifen manueller Refresh oder die nächste fällige
  Probe; es gibt keinen neuen Recovery-Hook.

**Tests:** Fake Time, Scheduler vor/nach Fälligkeit, manueller Refresh und
Prozessneustart mit persistiertem Fehler.

### 5. Dokumentation und Lieferung

- Aktive Changes für Rollen und Ownership beim Rebase auf Konflikte prüfen.
- Gemäß Repository-Regel arc42 04, 05, 06 und 08 prüfen und nur betroffene
  Aussagen sowie das Mainserver-Runbook ändern.
- Keine neue allgemeine Audit-Funktion implementieren.
- Production-Verifikation und Rollout-Abnahme sind nicht Teil dieses Changes.
  Sie liegen im separaten Folge-Change
  `verify-mainserver-credential-readiness-rollout`.

## Gates

```bash
pnpm nx run auth-runtime:test:unit \
  --testFiles=src/mainserver-credentials.test.ts \
  --testFiles=src/mainserver-effective-credentials.test.ts

pnpm nx run auth-runtime:test:unit \
  --testFiles=src/iam-account-management/mainserver-user-provisioning.test.ts \
  --testFiles=src/iam-account-management/user-create-operation.test.ts \
  --testFiles=src/iam-account-management/user-reprovision-mainserver-handler.test.ts \
  --testFiles=src/iam-account-management/user-bulk-reprovision-mainserver-handler.test.ts

pnpm nx run sva-studio-react:test:unit:server \
  --testFiles=src/lib/iam-content-list-projection-reconciliation-paging.server.test.ts \
  --testFiles=src/lib/iam-content-list-projection-sync-persistence.server.test.ts

pnpm nx run auth-runtime:test:types
pnpm nx run sva-studio-react:test:types
pnpm check:server-runtime
pnpm exec openspec validate enforce-mainserver-credential-readiness --strict
pnpm check:docs
pnpm check:file-placement
```

Vor einem breiten Unit-Lauf wird der affected Scope gemessen. Vor dem initialen
Push wird nach Möglichkeit `pnpm test:pr` ausgeführt.

## Done

- [x] Provisionierung meldet Erfolg nur nach passendem Read-back.
- [x] Nicht bereite Credentials verursachen null Mainserver-Aufrufe.
- [x] Ein fehlerhafter Principal beeinflusst keinen zweiten.
- [x] Lokale Accounts und vorhandene Snapshots bleiben erhalten.
- [x] Dauerhafte Fehler werden nicht minütlich erneut versucht.
- [x] Fokussierte und verpflichtende lokale Gates sind grün.
- [ ] Exakter PR-HEAD ist durch die GitHub-Gates bestätigt.
