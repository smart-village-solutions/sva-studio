## MODIFIED Requirements
### Requirement: Administrativer Steuerungspfad fuer neue Instanzen

Das System SHALL einen administrativen Steuerungspfad fuer die Anlage und Verwaltung neuer Instanzen bereitstellen, bei dem die UI Registry-Zustand, Nutzer-Intent und Provisioning-Aufträge steuert, waehrend globale Keycloak-Mutationen in einem separaten Worker-Kontext ausgefuehrt werden.

#### Scenario: Instanzanlage ueber Studio-Control-Plane

- **WHEN** ein berechtigter Admin eine neue Instanz im Studio anlegt
- **THEN** speichert die UI den Registry-Eintrag und erzeugt bei Bedarf einen Keycloak-Provisioning-Auftrag
- **AND** fuehrt der interaktive Web-Request keine globale Keycloak-Mutation direkt aus
- **AND** zeigt die Detailansicht den Auftragsstatus, letzte Worker-Ergebnisse und naechste Schritte benutzerverstaendlich an

#### Scenario: Bestehender Realm wird ueber Worker abgeglichen

- **WHEN** ein Admin fuer eine Instanz im Modus `existing` ein Reconcile ausloest
- **THEN** wird ein idempotenter Keycloak-Provisioning-Run eingereiht
- **AND** liest ein separater Provisioning-Worker den Ziel-Realm, erkennt Drift und schreibt Plan-, Preflight- und Status-Snapshots zurueck
- **AND** bleibt die Instanz-Detailansicht auch dann benutzbar, wenn der Worker fehlschlaegt oder noch nicht gelaufen ist

### Requirement: Idempotenter Provisioning-Workflow

Das System SHALL neue Instanzen und Realm-Abgleiche ueber einen idempotenten, worker-basierten Provisioning-Workflow ausfuehren, der Auftragszustand, Teilfehler und technische Snapshots nachvollziehbar speichert.

#### Scenario: Auftrag wird eingereiht und seriell verarbeitet

- **WHEN** eine Keycloak-Provisioning-Aktion fuer eine Instanz ausgelöst wird
- **THEN** entsteht ein Provisioning-Run im Zustand `planned`
- **AND** claimt der Worker diesen Run exklusiv und seriell zur Abarbeitung
- **AND** fuehrt das System keine parallele technische Abarbeitung desselben Runs aus

#### Scenario: Worker schreibt technische Snapshots zurueck

- **WHEN** der Worker Preflight, Plan oder finalen Status eines Runs bestimmt
- **THEN** persistiert er diese Ergebnisse als nachvollziehbare Schritte im Provisioning-Run
- **AND** kann die UI diese Snapshots spaeter ohne direkten Global-Admin-Keycloak-Zugriff lesen
