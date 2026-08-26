## ADDED Requirements

### Requirement: Automatische DataProvider-Konfliktauflösung bleibt auditierbar

Das System SHALL jeden erfolgreichen und abgelehnten automatischen Auflösungsversuch eines DataProvider-Konflikts PII- und secret-minimiert beobachtbar machen. Der Nachweis SHALL Instanz, technischen Principal-Typ, Credential-Fingerprint, DataProvider-ID, Ergebnis, sicheren Grundcode und die Anzahl historisierter Bindungen unterscheiden, aber keine Credentials, Tokens, Benutzernamen, E-Mail-Adressen oder rohe Identity-Antworten enthalten.

#### Scenario: Endgültig gelöschter Konkurrent wird historisiert

- **GIVEN** ein persönlicher DataProvider-Konflikt wird nach eindeutigem Nachweis automatisch aufgelöst
- **WHEN** Studio die Statusübergänge atomar persistiert
- **THEN** dokumentiert der Nachweis Erfolg, DataProvider, aktuelle Credential-Version und Anzahl der historisierten Bindungen
- **AND** behauptet er keinen externen Credential-Widerruf

#### Scenario: Unklarer Konkurrent verhindert die Auflösung

- **GIVEN** mindestens ein konkurrierender Principal ist aktiv, gesperrt, vorläufig gelöscht, organisatorisch oder nicht eindeutig klassifizierbar
- **WHEN** Studio den automatischen Auflösungsversuch ablehnt
- **THEN** dokumentiert es einen sicheren Grundcode und das fail-closed Ergebnis
- **AND** exponiert es keine personenbezogenen Konfliktdaten oder Secrets
