## ADDED Requirements

### Requirement: Technische Klassifikation und Organisations-Provisionierung sind auditierbar

Das System SHALL Änderungen der technischen Account-Klassifikation und Versuche zur organisationsbezogenen Mainserver-Provisionierung mit stabiler Operationsreferenz, Ergebnisphase und sicheren technischen Referenzen auditieren. Audit und Logs SHALL keine Secrets, Tokens oder rohen Mainserver-Antworten enthalten.

#### Scenario: Technisches Flag wird geändert

- **WHEN** ein Administrator `isTechnicalAccount` an einem Account ändert
- **THEN** enthält der Audit-Nachweis Actor, Instanz, Zielaccount sowie alten und neuen booleschen Wert
- **AND** enthält er keine unnötigen Klartext-PII

#### Scenario: Automatische Organisations-Provisionierung wird übersprungen

- **WHEN** nach lokaler Organisationserstellung keine Mainserver- oder Keycloak-Integration verfügbar ist
- **THEN** erfasst das System Organisation, Instanz, Auslöser `organization_create`, sicheren Status und Operationsreferenz
- **AND** stellt es die Organisationserstellung nicht als fehlgeschlagen dar

#### Scenario: Organisations-Provisionierung endet erfolgreich oder fehlerhaft

- **WHEN** automatische oder explizite Organisations-Provisionierung ausgeführt wird
- **THEN** enthält der Audit-Nachweis mindestens Actor beziehungsweise Systemauslöser, Organisation, technische Accountreferenz, Phase, sicheren Ergebniscode und Operationsreferenz
- **AND** unterscheidet er vollständigen Erfolg, Upstream-Fehler und `reconciliation_required`
- **AND** speichert er keine Application-Secrets, Bearer-Tokens oder rohe Upstream-Payloads

#### Scenario: Interne technische Accounterstellung bleibt dem Organisations-Actor zugeordnet

- **WHEN** Studio aufgrund einer mit `iam.org.write` autorisierten Organisationsaktion einen technischen Account erzeugt
- **THEN** dokumentiert Audit Actor, Zielorganisation, technische Accountreferenz, Zweck `organization_mainserver` und Operationsreferenz
- **AND** stellt es die interne Systemwirkung nicht als allgemeine Account-Create-Berechtigung dar

#### Scenario: Hard Delete löst eine Organisationsreferenz

- **WHEN** ein zugeordneter technischer Account privilegiert gelöscht wird
- **THEN** dokumentiert Audit Actor, Organisation, gelöste Accountreferenz und verbleibenden sicheren Provisioning-Zustand
- **AND** enthält es keine Organisations-Credentials oder sonstigen Geheimnisse
