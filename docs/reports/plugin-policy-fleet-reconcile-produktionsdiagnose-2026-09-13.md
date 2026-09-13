# Produktionsdiagnose des Plugin-Policy-Fleet-Reconcile am 13. September 2026

## Zweck und Grenzen

Dieser Bericht hält die ausschließlich lesende Diagnose für Issue #1331 fest. Es wurden keine Stack-, Datenbank-, Rollen- oder Lifecycle-Zustände verändert. Aus Logs wurden nur bereits freigegebene Instanz-IDs und begrenzte Betriebsfelder ausgewertet; Secret-, Connection-String- und rohe Exception-Inhalte sind nicht Bestandteil des Berichts.

## Ausgerollter Stand

- Umgebung: Production, Quantum-Endpunkt `sva`, Stack `studio`
- Laufendes Studio-Image: `ghcr.io/smart-village-solutions/sva-studio@sha256:57ef8d75f67be32fa50d3d4ce67d89a6373517fb2960f91232fe39bce04aacf6`
- Build: GitHub-Actions-Lauf `34536634722`, Source-Commit `6196bcb984c0421380fb42f43d8f4401ad34cb48`
- Staging-Promotion: Lauf `34538532034`
- Production-Promotion: Lauf `34539114621`
- Der Source-Commit enthält `cd6ca8851efa9ae70ffd1e917c91aabf71225bb7` (`fix(waste): reconcile PostgreSQL roles with restricted provisioner`) als Vorfahren.

Damit ist das Entscheidungstor eindeutig: Ein erneuter Rollout des bereits enthaltenen Rollenfixes allein kann den aktuellen Fleet-Fehler nicht beheben.

## Beobachtung nach dem Deployment

Ausgewertetes Zeitfenster: `2026-09-10T22:56:00Z` bis `2026-09-13T12:22:59.277Z`.

- 3.681 Fleet-Warnungen
- durchgehend `instance_count = 6`
- durchgehend `reconciled_instance_count = 0`
- durchgehend Stage `reconcile_instance` für alle sechs Instanzen
- keine weitere Logzeile mit `permission denied to alter role`
- unveränderte betroffene Instanzen:
  - `bb-bad-belzig`
  - `bb-guben`
  - `bb-prignitz`
  - `de-musterhausen`
  - `de-studio-sandbox`
  - `hb-meinquartier`

Der frühere PostgreSQL-16-Rollenfehler ist nach diesem Nachweis nicht mehr die aktuelle Ursache. Der verbleibende Fehler entsteht im erzwungenen IAM-/Plugin-Lifecycle-Follow-up. Der bisherige Fleet-Catch verwirft dort die Ausnahme und schreibt keinen sicheren Ursachenwert; korrelierende Lifecycle-Logs mit einem belastbaren Fehlercode existieren im betrachteten Fenster nicht.

## Konsequenz für die Korrektur

Die nächste Version muss zuerst pro Instanz einen allowlist-basierten `reasonCode` sowie `retryClass = retryable | degraded` bis in Report, Zustandswechsel-Log und Metrik erhalten. Unbekannte Exceptions werden auf `plugin_activation_policy_reconcile_unknown` reduziert; rohe Fehlermeldungen bleiben verborgen. Erst der nächste kanonische Staging-Lauf kann damit die derzeit verdeckte gemeinsame Ursache benennen.

Identische Fehler dürfen anschließend nicht weiter minütlich warnen: retrybare Zustände verwenden 1/5/15 Minuten Backoff, degradierte Zustände eine 30-minütige Kontrollprobe und Recovery genau ein eigenes Signal.

## Noch ausstehender Produktionsnachweis

Dieser Bericht ist Diagnose-, kein Abnahmenachweis. Nach Merge und Build sind erforderlich:

1. Staging-Promotion des unveränderlichen Digests und Prüfung der sechs sicheren `reasonCode`-Ergebnisse.
2. Nachweis von `6/6 reconciled` oder eine neue, instanzgenau klassifizierte Fehlerursache.
3. Erst nach erfolgreichem Staging dieselbe Digest-Promotion nach Production.
4. Beobachtung über mindestens eine reguläre Kontrollprobe einschließlich Warnvolumen und Recovery-Signal.
