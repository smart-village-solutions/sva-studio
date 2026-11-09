## ADDED Requirements

### Requirement: Vollständige isolierte E2E-Shards

Der bestehende E2E-Workflow SHALL die vollständige Testauswahl über vier isolierte Runner mit je einem Worker ausführen und erst nach validierter Vereinigung kompatible Freigabeevidenz erzeugen.

#### Scenario: Erfolgreiche vollständige Vereinigung

- **WHEN** alle vier Shards dieselbe Quelle und denselben Lauf nachweisen, das Auth-Setup jeweils besteht und ihre Chromium-Testmengen das vollständige Inventar disjunkt abdecken
- **THEN** kann die bestehende Main- oder kontrollierte Hotfix-Evidenz erzeugt werden

#### Scenario: Fehlende oder fremde Evidenz

- **WHEN** ein Shard fehlt, fehlschlägt oder eine fremde Quelle beziehungsweise ein abweichendes Inventar meldet
- **THEN** bleibt die Freigabe blockiert
