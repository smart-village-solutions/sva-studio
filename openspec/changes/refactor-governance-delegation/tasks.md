## 1. Characterization

- [x] 1.1 Bestehende Delegations-Unit-Tests und Package-Types als Baseline ausführen.
- [x] 1.2 Pflichtfelder, UUID, Ticketzustände und Zeitgrenzen gegen den unveränderten Altcode charakterisieren.
- [x] 1.3 Account-Auflösung, Self-Approval, SQL-/Audit-Reihenfolge und Queryfehler gegen den unveränderten Altcode charakterisieren.

## 2. Implementierung

- [x] 2.1 Payload-Normalisierung und reine Delegationsentscheidung paketintern extrahieren.
- [x] 2.2 Account-Auflösung, Persistenz, Audit und Logging als explizites Executor-Wiring erhalten.
- [x] 2.3 Paket- und arc42-Dokumentation aktualisieren.

## 3. Verifikation

- [x] 3.1 Relevante Unit-, Type-, Lint-, Runtime- und Complexity-Gates ausführen.
- [x] 3.2 OpenSpec strict, File Placement, Changelog und `git diff --check` ausführen.
- [x] 3.3 Exakten Fallow-New-only-Audit mit allen eingeführten Zählern auf null nachweisen.
