## ADDED Requirements

### Requirement: Verzahnte Runtime- und Provisioning-Diagnose für Tenant-IAM

Das System SHALL Runtime-IAM-Fehler und Instanz-/Keycloak-Provisioning-Diagnosen so aufeinander beziehen, dass Tenant-Drift zwischen Registry, Realm, Clients, Secrets und Runtime-Konfiguration nicht in getrennten Diagnosewelten bearbeitet werden muss.

#### Scenario: Runtime-Fehler verweist auf tenant-spezifische Driftklasse

- **WHEN** ein Runtime-IAM-Fehler auf fehlende oder inkonsistente Tenant-Konfiguration hindeutet
- **THEN** ordnet das System den Fehler einer Drift- oder Provisioning-nahen Fehlerklasse zu
- **AND** kann diese Klasse mit bestehenden Keycloak-Preflight-, Plan- oder Run-Informationen korreliert werden

#### Scenario: Preflight und Runtime nutzen kompatible Diagnosebegriffe

- **WHEN** die UI oder der Betrieb denselben Tenant sowohl im Instanz-/Keycloak-Panel als auch in einem Runtime-IAM-Fehlerfall betrachtet
- **THEN** verwenden beide Pfade kompatible Diagnosebegriffe für Realm-, Client-, Secret-, Mapper- oder Tenant-Admin-Abweichungen
- **AND** müssen Operatoren die Ursache nicht aus widersprüchlichen Zustandsmodellen ableiten

#### Scenario: Runtime-Drift kann auf Provisioning-Evidenz verweisen

- **WHEN** ein Runtime-IAM-Fehler als `registry_or_provisioning_drift` klassifiziert wird
- **THEN** kann der Diagnosepfad auf vorhandene Preflight-, Plan- oder Run-Evidenz mit korrelierbarer Request-ID oder gleichwertigem Referenzanker verweisen
- **AND** bleibt für UI und Betrieb sichtbar, ob das Problem aus Runtime-Konfiguration, Provisioning-Blockern oder nachträglicher Drift stammt
