## Context

Die ältere Instanz-Provisioning-Tabelle `iam.instance_provisioning_runs` besitzt bereits einen `idempotency_key` und dedupliziert nach `instance_id`, `operation` und Key. Der neuere Keycloak-Control-Plane-Pfad verwendet jedoch `iam.instance_keycloak_provisioning_runs`; dort werden Reconcile- und Execute-Aufträge als Worker-Runs persistiert, aber ohne Idempotenzspalte oder Payload-Fingerprint.

Am API-Rand ist der Header bereits verpflichtend. Ohne persistente Nutzung des Keys bleibt der Schutz unvollständig: ein Browser-Retry, ein doppelter Button-Klick oder ein Gateway-Retry kann denselben Keycloak-Auftrag mehrfach einreihen.

## Goals / Non-Goals

Goals:
- End-to-End-Idempotenz für Keycloak-Reconcile- und Execute-Run-Enqueue herstellen.
- Doppelte Worker-Runs für denselben fachlichen Auftrag bei Retry verhindern.
- Replay-Antworten deterministisch auf den bestehenden Run abbilden.
- Key-Reuse mit abweichendem fachlichem Payload als Konflikt behandeln.

Non-Goals:
- Keine Änderung der Keycloak-Schrittlogik im Worker.
- Keine Änderung der allgemeinen Instanzanlage über `iam.instance_provisioning_runs`.
- Keine Einführung eines neuen Queue-Modells.
- Keine Retention- oder Cleanup-Änderung außerhalb der neuen Idempotenzdaten.

## Decisions

- Decision: Der Deduplizierungs-Scope ist `instance_id + intent + idempotency_key`.
  Alternatives considered: `instance_id + idempotency_key` wäre zu breit und könnte verschiedene Intents blockieren. `instance_id + step_key + idempotency_key` wäre zu eng, weil Reconcile/Execute den Run als Auftrag und nicht als einzelne Worker-Step-Mutation modellieren.

- Decision: Der fachliche Payload-Fingerprint wird aus den enqueue-relevanten Eingaben gebildet.
  Alternatives considered: Nur den Key speichern. Verworfen, weil wiederverwendete Keys mit anderer Payload sonst still denselben oder einen neuen Auftrag erzeugen könnten.

- Decision: Replay liefert den bestehenden Run zurück; Payload-Mismatch liefert einen stabilen Konfliktfehler.
  Alternatives considered: Replay als `202 Accepted` ohne Run-Body. Verworfen, weil Clients den bestehenden Run für Polling und UI-Status benötigen.

## Risks / Trade-offs

- Risk: Falsch definierter Payload-Fingerprint erzeugt Scheinkonflikte.
  Mitigation: Fingerprint nur aus fachlich enqueue-relevanten Feldern bilden und Tests für optionale Felder ergänzen.

- Risk: Migration auf bestehender Tabelle erfordert Backfill für vorhandene Runs.
  Mitigation: Additive Migration mit nullable Backfill-Strategie oder sentinel-Werten für historische Runs; Unique Constraint erst für neue idempotente Runs wirksam machen.

- Risk: Parallel eintreffende Requests können auf Constraint-Konflikte laufen.
  Mitigation: Repository-Write-Pfad atomar per Insert/Upsert oder transaktionaler Konfliktauflösung implementieren.

## Migration Plan

1. DB-Migration für Idempotenzspalte(n), Payload-Fingerprint und eindeutige Deduplizierungsregel ergänzen.
2. Service-Inputs für Reconcile/Execute um `idempotencyKey` erweitern.
3. Repository-Create-Pfad auf atomare Deduplizierung umstellen.
4. API-Fehlermapping für Payload-Mismatch und konkurrierende Requests ergänzen.
5. Tests und betroffene Architektur-/Runbook-Dokumentation aktualisieren.
