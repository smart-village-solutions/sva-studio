## ADDED Requirements

### Requirement: Admin-Routen werden aus registrierten Ressourcen materialisiert

Das System SHALL Admin-Routen für registrierte Ressourcen aus einem deklarativen Host-Vertrag ableiten.

#### Scenario: Listen- und Detailpfade entstehen aus Ressourcendefinition

- **WHEN** der Host den Route-Baum für Admin-Ressourcen erzeugt
- **THEN** werden Listen-, Detail-, Erstellen- und Bearbeiten-Pfade aus der registrierten Ressource abgeleitet
- **AND** app-lokale Parallel-Registrierungen sind nicht erforderlich

#### Scenario: Guards bleiben hostgeführt

- **WHEN** eine registrierte Admin-Ressource Guard-Anforderungen beschreibt
- **THEN** materialisiert der Host diese Anforderungen im finalen Route-Baum
- **AND** das Package umgeht den Host-Guard nicht mit eigener Routing-Logik
