## ADDED Requirements

### Requirement: Shared Studio UI besitzt die einzige Button-Basis

Das Workspace-Package `@sva/studio-ui-react` MUST alleiniger Owner der Studio-Button-Basis, ihrer Varianten, Größen, Tooltips und Accessibility-Zustände sein. Host-App und Plugins MUST diese Shared-Komponente konsumieren und dürfen keine parallele Button-Basis mit eigener Varianten- oder Zustandslogik führen.

#### Scenario: Host oder Plugin benötigt einen Button

- **WENN** Host-Code oder ein Plugin einen Standardbutton, Icon-Button oder buttonförmigen Link rendert
- **DANN** konsumiert der Code `Button` beziehungsweise `buttonVariants` aus `@sva/studio-ui-react`
- **UND** implementiert er keine lokale Basisvariante mit eigener visueller Sprache

#### Scenario: Bestehende lokale App-Komponente wird migriert

- **WENN** der zugängliche Buttonvertrag eingeführt wird
- **DANN** wird die parallele Button-Basis unter `apps/sva-studio-react` entfernt
- **UND** lokale Dialoge und übrige Verbraucher werden auf `@sva/studio-ui-react` umgestellt
- **UND** bleiben nach Abschluss keine Legacy-Aliase für `default`, `ghost` oder `outline` im öffentlichen Button-Variantentyp bestehen

#### Scenario: Neue parallele Button-Basis wird eingeführt

- **WENN** eine spätere Änderung in Host oder Plugins erneut eine lokale Button-Basis oder Legacy-Variantenlogik hinzufügt
- **DANN** schlägt ein statischer Boundary- oder Architekturtest fehl
- **UND** verweist der Fehler auf die kanonische Shared-Komponente
