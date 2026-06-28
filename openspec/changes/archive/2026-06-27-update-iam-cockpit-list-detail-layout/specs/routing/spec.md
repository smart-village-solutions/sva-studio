## ADDED Requirements

### Requirement: IAM-Cockpit-Detailrouten bleiben kanonisch und typsicher

Das Routing-System SHALL für das IAM-Cockpit kanonische Detailrouten für Governance- und Betroffenenrechtsfälle bereitstellen, ohne das bestehende search-param-basierte Übersichtsmodell von `/admin/iam` aufzugeben.

#### Scenario: Governance-Fall wird über kanonische Detailroute geöffnet

- **WENN** ein Administrator einen Governance-Fall aus `/admin/iam?tab=governance` öffnet
- **DANN** materialisiert das Routing eine kanonische Detailroute unter `/admin/iam/governance/:caseId`
- **UND** die Route verwendet einen typsicheren Path-Param für den Fallbezug

#### Scenario: DSR-Fall wird über kanonische Detailroute geöffnet

- **WENN** ein Administrator einen DSR-Fall aus `/admin/iam?tab=dsr` öffnet
- **DANN** materialisiert das Routing eine kanonische Detailroute unter `/admin/iam/dsr/:caseId`
- **UND** die Route verwendet einen typsicheren Path-Param für den Fallbezug

#### Scenario: IAM-Übersicht und Detailrouten bleiben fachlich getrennt

- **WENN** das Routing den IAM-Bereich materialisiert
- **DANN** bleibt `/admin/iam` die kanonische Übersichtsroute mit search-param-basierter Tab-Auswahl
- **UND** konkurrieren Governance- oder DSR-Details nicht als Parallelzustand innerhalb derselben Routeninstanz

#### Scenario: Rückweg aus Detailroute bleibt deterministisch

- **WENN** ein Benutzer eine Governance- oder DSR-Detailroute verlässt
- **DANN** kann das Routing ihn deterministisch in die fachlich passende IAM-Übersicht zurückführen
- **UND** der Rückweg verlangt keinen manuellen Neuaufbau des zugehörigen Tab-Kontexts
