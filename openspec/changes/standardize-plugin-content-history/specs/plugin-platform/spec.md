## ADDED Requirements

### Requirement: Plugin-Contributions deklarieren ihre Historienpflicht

Die Plugin-Plattform MUST für jede Contribution deklarativ und hostvalidiert bestimmen, ob sie redaktionell veränderbare Datensätze besitzt und deshalb die host-owned History-Capability benötigt. Historienpflichtige Contributions ohne gültiges Binding MUST vor der Snapshot-Veröffentlichung fail-closed abgelehnt werden.

#### Scenario: Neues Content-Plugin deklariert veränderbare Datensätze

- **WENN** ein neues Plugin einen redaktionell veränderbaren Content-Typ registriert
- **DANN** verlangt der Host eine kompatible host-owned History-Capability
- **UND** prüft das Binding vor Admin- und Route-Materialisierung

#### Scenario: Historienpflichtiges Plugin besitzt kein Binding

- **WENN** ein Plugin veränderbare redaktionelle Datensätze registriert, aber keine gültige History-Capability besitzt
- **DANN** blockiert die Registry-Validierung die Contribution mit einem stabilen Diagnosecode
- **UND** veröffentlicht keinen Editor mit einem Platzhalter-Historienbereich

#### Scenario: Nicht historienpflichtige Contribution wird begründet klassifiziert

- **WENN** eine Contribution keine eigenen redaktionell veränderbaren Datensätze besitzt
- **DANN** darf sie mit einem hostvalidierten Grundcode als nicht historienpflichtig klassifiziert werden
- **UND** diese Klassifikation umgeht keine tatsächlich vorhandene Content-Mutation

### Requirement: Zukünftige Plugin-Templates verankern den History-Vertrag

Das System SHALL Plugin-Authoring-Dokumentation, Templates und vorhandene Generatoren so gestalten, dass neue Content-Plugins den gemeinsamen History-Vertrag standardmäßig verwenden und die zulässigen Ausnahmen explizit machen.

#### Scenario: Neues Content-Plugin wird erzeugt

- **WENN** ein Entwickler ein neues Content-Plugin über einen vorhandenen Template- oder Generatorpfad anlegt
- **DANN** enthält das Ergebnis die deklarative History-Capability, den gemeinsamen Read-Pfad und Contract-Tests
- **UND** keine pluginlokale History-Persistenz

#### Scenario: Plugin wird ohne Generator erstellt

- **WENN** ein manuell erstelltes Plugin in den Katalog aufgenommen wird
- **DANN** prüft dieselbe blockierende Registry- und CI-Validierung den History-Vertrag
- **UND** der manuelle Pfad bietet keine schwächere Ausnahme
