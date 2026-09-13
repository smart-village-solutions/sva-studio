# ADR-063: Fleet-Reconcile-Ownership und begrenzte Retry-Semantik

## Status

Vorgeschlagen am 13. September 2026.

## Kontext

Der Aktivierungsrichtlinien-Fleet-Reconcile gleicht bestehende Instanzen nach
einer neuen Plugin-Snapshot-Revision erneut mit den aktuellen IAM-Verträgen ab.
App und privilegierter Provisioner laden dafür denselben Runtime-Code. Ohne
eindeutige Prozess-Ownership könnten beide eine eigene prozesslokale Sicht als
fleetweite Metrik veröffentlichen. Außerdem dürfen transiente Konflikte nicht
durch gleichzeitig degradierte Instanzen auf einen langen Kontrolltakt
gebremst werden. Unerwartete Exceptions dürfen weder neue Metrikdimensionen
noch ungebundene interne Fehlermeldungen erzeugen.

## Entscheidung

- Im Standard-Deployment ist ausschließlich der App-Prozess mit
  `SVA_PLUGIN_OPERATION_WORKER_LANE=default` Owner des revisionsgebundenen
  Fleet-Reconcile. Der privilegierte Provisioner lädt Snapshot und Handler,
  startet aber keine zweite Fleet-Schleife.
- Ein Prozess beobachtet die prozesslokalen Fleet-Gauges erst, nachdem er den
  Reconcile tatsächlich übernommen hat. Ein reiner Import des Auth-Runtime-
  Moduls erzeugt deshalb keinen leeren oder konkurrierenden Fleet-Zustand.
- Jeder Fleet-Lauf bindet den vollständigen Runtime-Snapshot aus
  Aktivierungsrichtlinien, IAM-Verträgen, Tenant-Lifecycles und OIDC-
  Anforderungen als unveränderliche Ausführungssicht. Ändert sich die globale
  Snapshot-Generation während des Laufs, darf der alte Lauf weder Report noch
  Erfolgszeitpunkt veröffentlichen; die aktuelle Revision wird anschließend
  eigenständig gestartet.
- Fehlerberichte und Metriken verwenden nur die festgelegten `reason_code`-
  und `retry_class`-Werte. Unerwartete Abbrüche werden auf
  `plugin_activation_policy_reconcile_unknown` und `degraded` abgebildet.
- Transiente Sperrkonflikte sind `retryable`. Identische retrybare Fehler
  verwenden 1, 5 und danach höchstens 15 Minuten Backoff. Ausschließlich
  degradierte Fehler erhalten alle 30 Minuten eine Kontrollprobe. Enthält ein
  Lauf beide Klassen, bestimmt der kürzere retrybare Takt den nächsten Lauf.
- Diese Schleife bleibt prozesslokale Konvergenzhilfe. Persistente
  Plugin-Lifecycle-Jobs, ihre Retry-Deadlines und deren fachlicher Zustand
  bleiben der führende Recovery-Vertrag.

## Folgen

Fleet-Metriken haben im Standard-Deployment genau einen aktiven Produzenten.
Ein temporärer Lock-Konflikt kann die IAM-Konvergenz nicht für 30 Minuten
verzögern, während dauerhaft degradierte Zustände weiterhin kontrolliert und
ohne Warnungsflut geprüft werden. Nach einem Prozessneustart beginnt der
App-Owner erneut mit dem aktuellen Snapshot; es entsteht kein zusätzlicher
persistenter Fleet-Statusspeicher. Ein laufender Reconcile kann bei einem
Snapshot-Wechsel noch mit seiner gebundenen alten Sicht zu Ende laufen, aber
weder innerhalb des Laufs alte und neue Verträge mischen noch seinen Zustand
als Ergebnis der neuen Generation veröffentlichen.

Mehrere parallele Replikate derselben `default`-Lane benötigen vor einer
solchen Skalierung eine zusätzliche deploymentsweite Leader- oder
Metrikaggregationsentscheidung. Diese ADR beansprucht keine implizite
Single-Writer-Garantie über mehrere gleichartige App-Replikate.

## Verworfene Alternativen

- Reconcile in App und Provisioner parallel auszuführen erzeugt konkurrierende
  prozesslokale Zustände und uneindeutige Gauges.
- Alle Fehler bei gleichzeitig degradierter Instanz auf 30 Minuten zu setzen
  bremst behebbare transiente Konflikte unnötig aus.
- Rohe Exception-Namen oder -Texte als `reason_code` zu verwenden verletzt den
  begrenzten Observability-Vertrag und kann interne Details offenlegen.
- Ein neuer persistenter Fleet-Scheduler wäre für den revisionsgebundenen
  Konvergenz-Loop zusätzliche Ownership neben den vorhandenen Lifecycle-Jobs.

## Bezüge

- [ADR-036: Kanonischer IAM-Projektions- und Reconcile-Vertrag](./ADR-036-kanonischer-iam-projektions-und-reconcile-vertrag.md)
- [ADR-040: Graphile Worker als Standard für Hintergrundprozesse](./ADR-040-graphile-worker-als-standard-fuer-hintergrundprozesse.md)
- [ADR-058: Generischer Plugin-Tenant-Lifecycle und Readiness-Gate](./ADR-058-generischer-plugin-tenant-lifecycle-und-readiness-gate.md)
- [Plugin-Operations-Plattform](../development/plugin-operations-platform.md)
- [Plugin-Tenant-Lifecycle-Betrieb](../operations/plugin-tenant-lifecycle-operations.md)
- Issue #1331
