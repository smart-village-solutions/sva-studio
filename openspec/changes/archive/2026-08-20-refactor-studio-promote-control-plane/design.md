## Context

`Promote` befördert einen einmal gebauten Image-Digest über Dev, Staging und Production. Staging und Production verwenden heute bereits den autoritativen Remote-Config-Builder, blockierende Main-E2E-, Candidate- und Backup-Capability-Gates sowie den zentralen Backup-Agenten. Der Workflow enthält trotzdem die früheren beobachtenden und temporären Pfade.

Zusätzlich kopiert der Workflow Controller-Dateien vor dem Checkout von `change_head` einzeln nach `${RUNNER_TEMP}`. Änderungen am Importgraphen mussten diese Liste mehrfach nachziehen. Git stellt bereits beide benötigten Revisionen bereit; ein zusätzlich gebautes Controller-Artefakt ist deshalb nicht erforderlich.

## Goals / Non-Goals

### Goals

- ausschließlich den aktuell betriebenen fail-closed Standardpfad erhalten
- Übergangs-, Shadow- und temporäre Backup-Pfade löschen
- Workflow- und Release-Revision ohne manuelle Dateiliste trennen
- Recovery auf eine klar begrenzte Production-Ausnahme reduzieren
- jede strukturelle Änderung separat über Dev, Staging und Production bestätigen

### Non-Goals

- neue Deploymentstrategie, Controller-Artefakt oder zweiter Rolloutpfad
- Änderung der Image-, Backup-, Migrations-, Bootstrap-, Paritäts- oder Runtime-Gates
- Datenbank-, App-, Restore- oder Backup-Agent-Änderungen
- automatische Löschung bestehender GitHub-Secrets während der Codeumstellung

## Decisions

### Decision: Abgeschlossene Übergänge werden gelöscht

Der Remote-Config-Builder verwendet ausschließlich das versionierte Remote-Profil und `PROMOTE_CONFIG_OVERRIDES`. Main-E2E, Candidate-Preflight und Backup-Capability-Prüfung sind in ihren vorgesehenen Umgebungen immer blockierend. Staging und Production verwenden ausschließlich den zentralen Backup-Agenten.

### Decision: Zwei Git-Checkouts ersetzen die Controller-Kopierliste

Der Release-Quellstand bleibt im normalen Workspace. Die Revision des ausgeführten Workflows wird vollständig unter `.promote-controller/` ausgecheckt. Controller-Skripte laufen aus diesem Checkout; Compose-, Profil-, Diff-, One-shot- und Deploy-Dateien stammen weiterhin aus `change_head`. Es gibt keinen zweiten Dependency-Install und keine Paketierung.

### Decision: Recovery ist nur eine initiale Production-Ausnahme

`promote_mode=recovery` bleibt als kompatibler Workflow-Input erhalten, ist aber nur für Production und mit dokumentiertem Grund zulässig. Ausschließlich die initiale Production-Readiness darf übersprungen werden. Alle nachfolgenden Gates bleiben blockierend; Recovery erzwingt Staging-Parität auch bei gleichem Digest.

### Decision: Umsetzung und Rückkehr erfolgen über Git

Die drei Blöcke werden getrennt gemergt und ausgerollt. Der nächste Block beginnt erst nach erfolgreicher Production-Abnahme. Eine Regression wird per `git revert` des jeweiligen Blocks zurückgenommen; direkte Runtime-Mutationen werden dadurch nicht zu einem regulären Rückweg.

## Risks / Trade-offs

- Das Entfernen ungenutzter Schalter reduziert kurzfristige Umschaltoptionen. Der aktive Zustand ist jedoch in Code und Git-Historie reproduzierbar.
- Zwei Checkouts erhöhen den Checkout-Umfang, beseitigen dafür die fehleranfällige manuelle Importgraph-Kopie.
- Recovery in Dev oder Staging entfällt. Staging bleibt dadurch immer der kanonische, Main-E2E-attestierte Pfad.
- Ein Git-Revert ersetzt keinen Datenbank-Rollback. Dieser Change verändert deshalb weder Schema noch Migrationsverhalten.

## Migration Plan

1. Übergangspfade entfernen und denselben Digest über Dev, Staging und Production bestätigen.
2. Controller-Kopierliste durch zwei Checkouts ersetzen und erneut vollständig promoten.
3. Recovery-Vertrag vereinfachen und den normalen Standardpfad erneut vollständig promoten.
4. Erst danach ungenutzte GitHub-Variablen separat entfernen; die bisherigen Werte für einen Git-Revert dokumentiert halten.

### Ausgangsnachweis für PR 1

- Ausgangs-Commit: `c7abb7c997feda418ec8c58c2225fff3a18822ae`
- letzter erfolgreicher Production-Promote: Run `32304245487`, Status `passed`
- gebundener Image-Digest: `sha256:1b761a1537c4266fca21baf96a7fde1b0f76a948c8caabeb3684581cc727e55f`
- gebundene Config-Revision: `a6349d63cc858bdc1713ffeb6c5bf4c886aac3ef2826ab4de0a6d0bfb3d6175e`

### Ausgangsnachweis für PR 2

- Ausgangs-Commit: `3c9be1c305cb7a076790db434172a85640265d36`
- erfolgreicher Dev-Promote: Build-Run `32414894734`, Attempt `2`, Status `passed`
- erfolgreicher Staging-Promote: Run `32417352434`, Status `passed`
- erfolgreicher Production-Promote: Run `32419078441`, Status `passed`
- gebundener Image-Digest: `sha256:fe287a3a8851b007a89f923304d056ac7faa3e40af84ce982a24018c905125b0`
- gebundene Production-Config-Revision: `a6349d63cc858bdc1713ffeb6c5bf4c886aac3ef2826ab4de0a6d0bfb3d6175e`

### Abnahme für PR 2 und Ausgangsnachweis für PR 3

- Merge-Commit: `b0f834ce4fcfe51cc4958315211bdc43e44563fd`
- erfolgreicher Build und Dev-Promote: Run `32423391141`, Attempt `1`, Status `passed`
- erfolgreicher Staging-Promote: Run `32424413071`, Attempt `1`, Status `passed`
- erfolgreicher Production-Promote: Run `32424677339`, Attempt `1`, Status `passed`
- gebundener Image-Digest: `sha256:db6322ce5e1b1c85d55ddaea02f2dccdd53699051309c18647be94ea10ecd883`
- gebundene Production-Config-Revision: `a6349d63cc858bdc1713ffeb6c5bf4c886aac3ef2826ab4de0a6d0bfb3d6175e`

### Abnahme für PR 3

- Merge-Commit: `f1215803097746a12595d444b6aa3ff22cd1e672`
- erfolgreicher Build und Dev-Promote: Run `32427819235`, Attempt `1`, Status `passed`
- erfolgreiche kanonische Main-E2E-Evidenz: Run `32427818963`, Status `passed`
- erfolgreicher Staging-Promote: Run `32428697220`, Attempt `1`, Status `passed`
- erfolgreicher Production-Promote im Standardmodus: Run `32428928260`, Attempt `1`, Status `passed`
- gebundener Image-Digest in allen drei Umgebungen: `sha256:32c39bf59dc2838fb7651af327d5a0a2542bd186595453bdac9879198b1f1aac`
- gebundene Production-Config-Revision: `a6349d63cc858bdc1713ffeb6c5bf4c886aac3ef2826ab4de0a6d0bfb3d6175e`
- Production-Nachweis: initiale Readiness, Staging-Parität, Agent-Capability, Candidate-Preflight, beide Backups, Konvergenz, Runtime-Smoke sowie Digest-/Config-Verifikation erfolgreich

## Open Questions

Keine. Die drei Umsetzungsblöcke und ihre Reihenfolge sind freigegeben.
