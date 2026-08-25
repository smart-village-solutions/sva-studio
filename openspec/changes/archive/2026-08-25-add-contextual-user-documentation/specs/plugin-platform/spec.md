## ADDED Requirements

### Requirement: Plugin-Seiten nehmen am hostgeführten Dokumentationsvertrag teil

Der generische Plugin-Plattformvertrag MUST dokumentierbare freie Plugin-Routen mit einer stabilen, plugin-owned Dokumentations-ID oder einem zulässigen Ausschlussgrund beschreiben. Der Host MUST diese Metadaten validieren und in denselben Seitenkatalog aufnehmen wie hosteigene Routen.

#### Scenario: Freie Plugin-Seite deklariert Hilfe

- **WENN** ein Plugin eine freie produktive Seitenroute beiträgt
- **DANN** deklariert die Route eine namespacete Dokumentations-ID im Namespace des Plugins
- **UND** übernimmt der Host sie nach erfolgreicher Guardrail-Validierung in Route und Seitenkatalog

#### Scenario: Freie Plugin-Route umgeht den Vertrag

- **WENN** eine produktive freie Plugin-Route weder Dokumentations-ID noch zulässigen Ausschlussgrund enthält
- **DANN** lehnt die Plugin-Validierung den Beitrag mit einem stabilen Guardrail-Fehler ab

#### Scenario: Standard-Content-Plugin verwendet Admin-Ressourcen

- **WENN** ein Standard-Content-Plugin seine Seiten über registrierte Admin-Ressourcen materialisieren lässt
- **DANN** leitet der Host die Dokumentations-IDs aus der namespaceten Ressourcen-ID und dem Routentyp ab
- **UND** muss das Plugin keine parallelen freien Dokumentationsmetadaten deklarieren

#### Scenario: Plugin versucht eine fremde Dokumentations-ID

- **WENN** eine freie Plugin-Route eine Dokumentations-ID außerhalb ihres eigenen Namespace deklariert
- **DANN** lehnt der Host den Beitrag fail-closed als Namespace-Verletzung ab
