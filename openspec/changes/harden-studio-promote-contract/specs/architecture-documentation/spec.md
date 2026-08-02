## ADDED Requirements

### Requirement: Architektur dokumentiert den fokussierten Config- und Promote-Vertrag

Die Architekturdokumentation SHALL nachvollziehbar beschreiben, wie getrackte nicht-sensitive Remote-Konfiguration, geschützte Overrides, Shadow-Aktivierung, Candidate-Preflight und der bestehende Runtime-Secret-Vertrag vom Build bis zur Live-Verifikation zusammenwirken.

#### Scenario: Config- oder Preflight-Vertrag wird geändert

- **WHEN** ein PR Builder, Remote-Config-Schichten, Candidate-One-shot oder Promote-Modi verändert
- **THEN** aktualisiert er die betroffenen arc42-Abschnitte 06, 07, 08, 10 und bei Recovery-Wirkung 11
- **AND** verlinkt den kanonischen Rollout-Leitfaden statt einen zweiten Deploypfad zu definieren
- **AND** dokumentiert weder reale Secret-Werte noch lokale Override-Inhalte

### Requirement: Architektur dokumentiert Konvergenz, Agent-Kompatibilität und Fehlercodes

Die Architekturdokumentation SHALL die getrennten Swarm- und HTTP-Konvergenzphasen, den geschützten Backup-Agent-Capability-Vertrag sowie den strukturierten Logging- und Fehlercodevertrag darstellen.

#### Scenario: Operator diagnostiziert einen fehlgeschlagenen Promote

- **WHEN** ein Promote vor oder nach dem Deploy fehlschlägt
- **THEN** kann der Operator aus Fehlercode, Retryklassifikation und `nextAction` die zulässige Folgemaßnahme ableiten
- **AND** unterscheidet die Dokumentation Shadow-Abweichung, Candidate-Fehler, inkompatiblen Agenten, retryfähige Konvergenz, fachlichen Smoke-Fehler und Recovery-Fall
- **AND** bleibt die Diagnose frei von Secrets und PII
