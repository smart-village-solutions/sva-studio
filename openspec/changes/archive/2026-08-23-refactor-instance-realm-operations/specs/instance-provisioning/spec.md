## ADDED Requirements

### Requirement: Interne Realm-Operationsprojektion bleibt bei Refactorings semantikgleich

Das System SHALL bei internen Refactorings der Instanz-Detailprojektion die
bestehende Realm-Schritt- und Primäraktionssemantik vollständig bewahren. Eine
interne Zerlegung darf weder öffentliche Verträge noch die sichtbare
Entscheidungsreihenfolge ändern.

#### Scenario: New-Realm-Schritte bewahren Zustand und Evidenz

- **WHEN** Registry-Vertrag, Preflight, Plan, Provisioning-Run und einzelne Keycloak-Artefakte in vollständigen, fehlenden, laufenden, blockierten, fehlgeschlagenen oder erfolgreichen Kombinationen vorliegen
- **THEN** bleiben Reihenfolge, Status, Summary und Action jedes New-Realm-Schritts unverändert
- **AND** bleiben `evidenceSource`, `checkedAt` und `requestId` derselben Registry-, Preflight-, Plan-, Run- oder Final-Validation-Evidenz zugeordnet

#### Scenario: Existing-Realm-Schritte bewahren Drift- und Reconcile-Semantik

- **WHEN** Live-Status fehlt oder vorliegt, Drift vorhanden oder abwesend ist und der letzte Run fehlt, fehlschlägt oder anderweitig abgeschlossen ist
- **THEN** bleiben Registry-Vertrag, Preflight, Live-Status, Driftanalyse, Vertragsreparatur, Reconcile und Ergebnisvalidierung in derselben Reihenfolge und mit denselben Statuswerten erhalten
- **AND** bleiben Reconcile-Action, Evidence Source, Timestamp und Request-ID unverändert zugeordnet

#### Scenario: Primäraktion bewahrt die feste Prioritätsreihenfolge

- **WHEN** mehrere mögliche New- oder Existing-Realm-Aktionen gleichzeitig aus Schrittzuständen, Signalen und Follow-up-Aktionen ableitbar sind
- **THEN** wählt die Instanz-Detailprojektion dieselbe erste Aktion mit derselben Action-ID, demselben Label und demselben Reason wie vor dem Refactoring
- **AND** bleiben Konfigurations-, Moduskonflikt-, Preflight-, Plan-, Execute-, Status-, Reconcile- und Follow-up-Prioritäten unverändert

#### Scenario: Fehlende oder Legacy-Evidenz bleibt fail-closed

- **WHEN** optionale Schritte, Preflight-, Plan-, Run- oder Keycloak-Evidenz `null`, `undefined`, unvollständig oder widersprüchlich vorliegt
- **THEN** bleibt die bisherige offene, blockierte oder statusprüfende Fallback-Ausgabe erhalten
- **AND** führt die interne Strukturierung keine optimistische Erfolgsannahme und keine neue Mutation ein
