## Context

Löschregelfristen sind absolute Schwellwerte relativ zum letzten erfolgreichen Login eines Tenant-Accounts. Unkonfigurierte Tenants verwenden eine zentrale Baseline; explizit konfigurierte Tenants speichern eigene Werte in `iam.instance_deletion_rules`.

## Goals / Non-Goals

- Goals:
  - zentrale Baseline auf `365 / 730 / 1.095` Tage anheben
  - den gemeinsamen Referenzzeitpunkt in Admin- und Self-Service-Texten unmissverständlich benennen
  - explizite Tenant-Konfigurationen unverändert lassen
- Non-Goals:
  - keine Migration oder Überschreibung explizit gespeicherter Tenant-Regeln
  - keine Änderung der Lifecycle-Zustände oder der Verarbeitungshäufigkeit
  - keine physische Löschung durch den automatischen Lifecycle

## Decisions

- Decision: Die vorhandene zentrale Baseline-Konstante wird geändert. Dadurch gilt die neue Baseline auch für bereits bestehende Tenants ohne explizite Konfiguration.
- Decision: Alle drei Schwellen werden als absolute Tage seit dem letzten erfolgreichen Login formuliert; sie sind keine aufeinander aufbauenden Zusatzfristen.
- Decision: Der bestehende Seed für den Muster-Tenant bleibt eine explizite Tenant-Konfiguration und wird nicht automatisch überschrieben.
- Alternatives considered:
  - Defaults nur im Provisioning neuer Tenants speichern: verworfen, weil die zentrale Baseline einfacher ist und die Wirkung auf unkonfigurierte Bestands-Tenants akzeptiert wurde.
  - Bestehende explizite Werte migrieren: verworfen, weil bewusst gesetzte Tenant-Konfigurationen erhalten bleiben müssen.

## Risks / Trade-offs

- Unkonfigurierte Bestands-Tenants wechseln ebenfalls auf die neue Baseline. Das ist Teil der freigegebenen zentralen Änderung.
- Tests mit alten Beispielwerten dürfen nur dort geändert werden, wo sie die Baseline abbilden; frei konfigurierte Testwerte bleiben unverändert.

## Migration Plan

Es ist keine Datenmigration erforderlich. Die Runtime verwendet die neue Baseline nur, wenn keine explizite Regelzeile vorliegt. Ein Rollback besteht aus dem Zurücksetzen der Baseline-Konstante und der zugehörigen Texte und Spezifikationen.

## Open Questions

- Keine.
