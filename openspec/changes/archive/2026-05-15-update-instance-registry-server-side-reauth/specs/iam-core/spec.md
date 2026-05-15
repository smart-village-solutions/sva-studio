## ADDED Requirements
### Requirement: Serverseitiger Fresh-Reauth-Nachweis fuer sensitive Mutationen

Das System SHALL sensitive Mutationen nur dann als frisch re-authentisiert behandeln, wenn die Session eine serverseitig gebundene Reauth-Evidenz traegt.

#### Scenario: Session enthaelt aktuelle serverseitige Reauth-Evidenz

- **WHEN** ein Benutzer eine Re-Authentisierung erfolgreich ueber einen serverseitig kontrollierten Auth-Pfad abschliesst
- **THEN** speichert das System im Session- oder benutzerbezogenen Reauth-Zustand eine serverseitig gebundene Fresh-Reauth-Evidenz
- **AND** kann ein nachgelagerter Guard diese Evidenz gegen ein begrenztes Frischefenster pruefen

#### Scenario: Silent-SSO oder Token-Refresh erzeugen keine neue Fresh-Reauth-Evidenz

- **WHEN** eine Session nur ueber Silent-SSO, Token-Refresh oder einen anderen nicht-interaktiven Recovery-Pfad fortgesetzt wird
- **THEN** erzeugt das System dadurch keine neue Fresh-Reauth-Evidenz fuer sensitive Mutationen
- **AND** bleibt fuer den Fresh-Reauth-Guard allein eine explizit serverseitig kontrollierte Re-Authentisierung massgeblich

#### Scenario: Klientseitige Bestaetigung zaehlt nicht als Reauth-Nachweis

- **WHEN** ein Request nur einen Header, Query-Parameter oder sonstigen klientseitig gesetzten Marker fuer Reauth mitliefert
- **THEN** betrachtet das System diesen Marker nicht als hinreichenden Fresh-Reauth-Nachweis
- **AND** sensitive Mutationen duerfen dadurch nicht freigeschaltet werden

#### Scenario: Veraltete Reauth-Evidenz verliert ihre Gueltigkeit

- **WHEN** eine Session zwar serverseitige Reauth-Evidenz traegt
- **AND** diese Evidenz aelter ist als das konfigurierte Frischefenster fuer sensitive Mutationen
- **THEN** behandelt das System die Session fuer diesen Guard als nicht frisch re-authentisiert
- **AND** ein erneuter serverseitiger Reauth-Schritt ist erforderlich

#### Scenario: Nicht-Produktiv-Profile modellieren Abweichungen explizit

- **WHEN** ein lokales oder nicht-produktives Runtime-Profil von der produktiven Fresh-Reauth-Regel abweichen darf
- **THEN** ist diese Abweichung serverseitig explizit an das Profil gebunden
- **AND** dieselbe Abweichung ist in produktionsnahen Profilen nicht implizit aktiv
