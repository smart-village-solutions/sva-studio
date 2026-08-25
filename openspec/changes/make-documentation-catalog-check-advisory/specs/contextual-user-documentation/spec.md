## MODIFIED Requirements

### Requirement: Der Seitenkatalog wird aus den kanonischen Routenquellen erzeugt

Das Studio SHALL aus statischen UI-Routen, tatsächlich materialisierten Admin-Ressourcenrouten und freien Plugin-Routen einen deterministischen, maschinenlesbaren Seitenkatalog erzeugen. Eine app-lokale parallele URL-Mapping-Tabelle DARF NICHT die Quelle des Katalogs sein. Abweichungen zwischen dem eingecheckten Katalog und den kanonischen Routenquellen SHALL die CI sichtbar diagnostizieren, DÜRFEN aber den App-Build oder den Deploymentpfad NICHT blockieren.

#### Scenario: Initiale Liste wird erzeugt

- **WENN** der Kataloggenerator auf dem aktuellen Studio-Stand ausgeführt wird
- **DANN** enthält der Katalog jede reguläre produktive Seite genau einmal
- **UND** jeder Eintrag enthält mindestens Seiten-ID, kanonisches Route-Pattern, Seitentyp und Owner

#### Scenario: Neue Route erweitert den Katalog

- **WENN** eine neue produktive Seite in einer kanonischen Routenquelle ergänzt wird
- **DANN** verlangt der Routenvertrag eine Dokumentations-ID oder einen Ausschlussgrund
- **UND** eine dokumentierte Seite erscheint nach der Generierung im Katalog

#### Scenario: Katalog driftet von der Route-Registry

- **WENN** der eingecheckte Katalog nicht deterministisch aus den aktuellen Routenquellen reproduziert werden kann
- **DANN** meldet eine eigenständige Studio-CI-Diagnose die Abweichung sichtbar
- **UND** nennt sie fehlende Klassifizierungen oder kollidierende IDs beziehungsweise Pfade
- **UND** blockiert die Abweichung weder den App-Build noch den Deploymentpfad
