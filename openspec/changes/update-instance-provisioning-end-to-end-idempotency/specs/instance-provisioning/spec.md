## MODIFIED Requirements

### Requirement: Idempotenter Provisioning-Workflow

Das System SHALL Reconcile- und Execute-Mutationen für Instanz-Provisioning end-to-end idempotent verarbeiten, indem der `Idempotency-Key` vom API-Rand über Service-Logik bis zur persistierten Run-Erzeugung konsistent verwendet wird.

#### Scenario: Wiederholung mit gleichem Key und gleicher Payload erzeugt keinen neuen Run

- **WHEN** ein Request für dieselbe Instanz und denselben Provisioning-Intent mit identischem `Idempotency-Key` und identischer Payload erneut eingeht
- **THEN** erstellt das System keinen zusätzlichen Provisioning-Run
- **AND** liefert deterministisch den bereits vorhandenen Run zurück

#### Scenario: Wiederverwendung eines Keys mit abweichender Payload führt zu Konflikt

- **WHEN** ein Request denselben `Idempotency-Key` im gleichen fachlichen Scope wiederverwendet, aber eine fachlich abweichende Payload sendet
- **THEN** lehnt das System den Request deterministisch mit einem Konfliktfehler ab
- **AND** erzeugt keinen neuen Provisioning-Run

#### Scenario: Parallele Requests mit gleichem Key werden dedupliziert

- **WHEN** zwei nahezu gleichzeitige Requests mit identischem `Idempotency-Key` für denselben Scope eingehen
- **THEN** bleibt die persistierte Run-Erzeugung effektiv genau einmalig
- **AND** erhalten alle erfolgreichen Antworten eine konsistente Referenz auf denselben Provisioning-Run
