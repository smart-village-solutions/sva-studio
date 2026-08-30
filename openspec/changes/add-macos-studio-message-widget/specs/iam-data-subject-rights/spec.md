## ADDED Requirements

### Requirement: Betroffenenrechte umfassen Studio-Nachrichtenbelege

Das System MUST accountbezogene Studio-Nachrichtenbelege als personenbezogene Aktivitätsdaten in Betroffenenexporte und den konfigurierbaren DSR-Aufbewahrungsvertrag einbeziehen.

#### Scenario: Benutzer exportiert seine Daten

- **WENN** ein Benutzer oder berechtigter Administrator einen vollständigen Betroffenenexport anfordert
- **DANN** enthält der maschinenlesbare Export alle Gelesen-Belege des Accounts mit Instanz, Nachrichten-ID und Gelesen-Zeitpunkt
- **UND** gelten die bestehenden Autorisierungs-, Format- und Auditpflichten des DSR-Exports
- **UND** enthält der Beleg keinen duplizierten Nachrichtentext

#### Scenario: Aufbewahrungsfrist eines Belegs läuft ab

- **WENN** ein Gelesen-Beleg die validierte, konfigurierbare Aufbewahrungsfrist erreicht
- **UND** kein Legal Hold die Löschung blockiert
- **DANN** wird der Beleg durch die periodische Bereinigung gelöscht
- **UND** liefert der Feed keine Nachricht außerhalb derselben Frist aus
- **UND** wird die Bereinigung ohne Nachrichteninhalt auditierbar protokolliert

#### Scenario: Membership endet unter Legal Hold

- **WENN** eine Membership mit Gelesen-Belegen bei aktivem Legal Hold endet
- **DANN** blockiert der Governance-Workflow die Beleglöschung unabhängig von Membership-Entzug und Aufbewahrungsfrist
- **UND** bleiben die Belege ausschließlich für autorisierte DSR-/Governance-Prozesse erhalten
- **UND** wird die vorgemerkte Löschung nach Aufhebung des Holds ausgeführt

#### Scenario: Aufbewahrungsfrist wird verkürzt

- **WENN** ein Administrator die gemeinsame Aufbewahrungsfrist für Feed und Gelesen-Belege verkürzt
- **DANN** weist ein Dry Run die Anzahl und Altersverteilung der betroffenen Belege aus
- **UND** wird die Löschung erst nach expliziter Freigabe wirksam
- **UND** wird die Konfigurationsänderung als Audit-Ereignis protokolliert
