## ADDED Requirements

### Requirement: Öffentlicher Runtime-Diagnostikvertrag für IAM

Das System SHALL Auth-, IAM- und Provisioning-nahe Laufzeitfehler über einen kompatiblen öffentlichen Diagnosevertrag mit stabilem Fehlercode, Fehlerklasse, handlungsleitendem Status, empfohlener nächster Handlung, `requestId` und allowlist-basierten Safe-Details ausgeben.

#### Scenario: Diagnosevertrag bleibt kompatibel und unterscheidbar

- **WHEN** ein Client einen IAM-nahen Laufzeitfehler erhält
- **THEN** bleibt ein stabiler Fehlercode für bestehende Integrationen erhalten
- **AND** ergänzt der Vertrag mindestens `classification`, `status`, `recommendedAction`, `requestId` und `safeDetails`
- **AND** können Clients Session-, Actor-, Keycloak-, Schema- und Registry-/Provisioning-Fehler fachlich unterscheiden
