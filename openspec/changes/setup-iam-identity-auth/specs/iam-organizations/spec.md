# Organizations Specification (Child A Scope)

## ADDED Requirements

### Requirement: Multi-Org-Kontextwechsel im aktiven Instanzkontext

Das System MUSS Benutzern mit mehreren Organisationszuordnungen den Kontextwechsel innerhalb der aktiven `instanceId` ermöglichen.

#### Scenario: Benutzer wechselt Organisationskontext

- **WHEN** ein authentifizierter Benutzer Mitglied in mehreren Organisationen derselben Instanz ist
- **THEN** kann er den aktiven Organisationskontext wechseln
- **AND** der gewählte Kontext wird in der Session für nachgelagerte Zugriffe bereitgestellt

### Requirement: Keine Persistenz- und RLS-Modellierung in Child A

Das System MUSS in Child A keine vollständige Organisationspersistenz, RLS-Policy-Definition oder Hierarchieauswertung spezifizieren; diese liegen in Child B/D.

#### Scenario: Datenmodell außerhalb Child-A-Scope

- **WHEN** Anforderungen zu `iam.organizations`, RLS-Policies oder Hierarchie-Vererbung entstehen
- **THEN** werden diese in den zugehörigen Child-Changes (B/D) spezifiziert
- **AND** Child A bleibt auf Identity- und Kontextbereitstellung begrenzt

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
