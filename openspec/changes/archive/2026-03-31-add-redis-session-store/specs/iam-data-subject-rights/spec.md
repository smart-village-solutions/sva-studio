## ADDED Requirements

### Requirement: Session- und Login-State-Löschung als Teil von Betroffenenrechten
Das System SHALL bei Datenschutz- oder Sicherheitslöschungen alle operativen Session- und Login-State-Daten eines Benutzers aktiv entfernen und sich nicht allein auf TTL-Ablauf verlassen.

#### Scenario: Datenschutzbedingte Löschung eines Benutzers
- **WHEN** eine zulässige Löschung personenbezogener Daten für einen Benutzer wirksam wird
- **THEN** entfernt das System alle aktiven App-Sessions dieses Benutzers aus dem Redis-basierten Session-Store
- **AND** entfernt noch vorhandene Login-State-Objekte desselben Benutzers oder zugehöriger Login-Flows
- **AND** die Entfernung erfolgt aktiv und nicht erst beim natürlichen TTL-Ablauf

#### Scenario: Sicherheitsbedingte sofortige Session-Löschung
- **WHEN** eine Sicherheits- oder Governance-Entscheidung die sofortige Entfernung aller App-Sessions eines Benutzers verlangt
- **THEN** invalidiert das System die aktiven Sessions und zugehörigen Login-States unverzüglich
- **AND** nachfolgende Requests mit zuvor gültigen Session-Artefakten werden abgewiesen

### Requirement: Nachweisbare Lösch- und Compliance-Berichte für Session-Daten
Das System SHALL für Session- und Login-State-Löschungen nachvollziehbare Ergebnisnachweise bereitstellen.

#### Scenario: Löschlauf erzeugt Ergebnisnachweis
- **WHEN** ein Datenschutz- oder Sicherheitslöschlauf Session- und Login-State-Daten entfernt
- **THEN** stellt das System einen maschinenlesbaren Ergebnisnachweis mit mindestens Benutzerreferenz, betroffener Instanz, Anzahl entfernter Sessions, Anzahl entfernter Login-States und Ergebnis bereit
- **AND** der Nachweis enthält keine Klartext-Tokens, keine rohen Session-IDs und keine Klartext-PII

#### Scenario: Teilweise erfolgreiche Löschung
- **WHEN** ein Löschlauf operative Session-Daten nur teilweise entfernen kann
- **THEN** weist der Ergebnisnachweis die unvollständige Bereinigung explizit aus
- **AND** der Vorgang bleibt für Audit und Betrieb nachverfolgbar
