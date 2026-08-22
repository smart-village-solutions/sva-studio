## ADDED Requirements

### Requirement: Inhalts-Detailseiten unterscheiden Principal-Laden und Principal-Fehler

Das System SHALL während der vorgelagerten Auflösung des Ressourcenprincipals einer bestehenden Inhalts-Detailseite einen regulären Ladezustand anzeigen. Erst eine fehlgeschlagene oder uneindeutige Auflösung SHALL als dauerhafter Fehler dargestellt werden. In beiden Zuständen SHALL die bestehende Fail-closed-Sperre für Schreibaktionen erhalten bleiben.

#### Scenario: Ressourcenprincipal wird geladen

- **WENN** eine Inhalts-Detailseite den Ressourcenprincipal des bestehenden Inhalts noch auflöst
- **DANN** zeigt die Oberfläche den gemeinsamen animierten Studio-Ladezustand
- **UND** zeigt sie keinen destruktiven Alert und keine Fehlermeldung
- **UND** rendert sie den Editor noch nicht

#### Scenario: Ressourcenprincipal wurde erfolgreich aufgelöst

- **WENN** die Principal-Auflösung einen eindeutigen persönlichen oder organisatorischen Principal liefert
- **DANN** beendet die Oberfläche den Ladezustand unmittelbar
- **UND** rendert den Editor mit dem aufgelösten festen Principal
- **UND** wartet sie nicht auf das Ende eines Animationszyklus

#### Scenario: Ressourcenprincipal kann nicht aufgelöst werden

- **WENN** die Principal-Auflösung fehlschlägt oder keinen eindeutigen zulässigen Principal liefert
- **DANN** beendet die Oberfläche den Ladezustand
- **UND** zeigt sie eine dauerhafte destruktive Fehlermeldung
- **UND** rendert sie den Editor nicht und hält Schreibaktionen fail-closed gesperrt
