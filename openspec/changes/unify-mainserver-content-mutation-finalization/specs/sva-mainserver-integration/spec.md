## ADDED Requirements

### Requirement: Bestätigte Mainserver-Mutationen verwenden dieselbe Ableitung für Historie und Referenz

Der Host MUST aus einem nach dem jeweiligen Fachvertrag geprüften Ergebnis dieselben Regeln zur Ableitung von Actor, Autor, Inhaberfolge und Provider-Referenz verwenden. Das gilt für alle redaktionellen Mainserver-Inhaltstypen mit Studio-Projektionspfad, wenn deren bestehender direkter oder journalgebundener Pfad eine Mutation an die IAM-Historienpersistenz übergibt. Provider-Nachweis, Berechtigung, Projektion und Wiederaufnahme richten sich nach dem bestehenden Vertrag des jeweiligen Pfads.

#### Scenario: Sofortige Nachbearbeitung und Wiederanlauf verwenden dieselben geprüften Fakten

- **WENN** der direkte Pfad und der vorhandene Wiederanlauf dieselben geprüften Fakten zu einer Studio-Mutation erhalten
- **DANN** leiten sie dieselbe externe Referenz und dieselbe Zuordnung von Actor und Autor ab
- **UND** dedupliziert die bestehende Persistenz für denselben Mandanten, dieselbe lokale Content-ID und dieselbe Mutationsreferenz

#### Scenario: Verifizierter Inhaberwechsel trifft auf neueren Inhaltsstand

- **WENN** der vorhandene Wiederanlauf für einen verifizierten Inhaberwechsel nur die Inhaberfolge nachführen darf
- **DANN** bleibt der ursprüngliche Actor vom Zielinhaber unterscheidbar
- **UND** bleiben neuere Inhaltsdaten, Autorenzuordnung und bestehende Referenzen erhalten
