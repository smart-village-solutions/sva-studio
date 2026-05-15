## ADDED Requirements
### Requirement: Boundary-Hotspots dürfen nicht durch Parallelimplementierungen kaschiert werden

Das System SHALL bei Refactors von Komplexitäts-Hotspots parallel gepflegte Implementierungen in benachbarten Schichten als Architekturproblem behandeln und auf eine führende Ownership zurückführen, wenn bereits fachliche Divergenz sichtbar ist.

#### Scenario: Boundary-Refactor entdeckt divergierende Doppelimplementierung

- **WHEN** ein Komplexitäts-Hotspot in einer zentralen oder kritischen Capability auf parallele Implementierungen derselben Verantwortung verweist
- **THEN** bewertet der Refactor diese Situation nicht nur als Dateisplitting-Aufgabe
- **AND** dokumentiert, welche Schicht die führende Ownership übernimmt
- **AND** entfernt oder delegiert mindestens eine der Doppelimplementierungen

#### Scenario: Root-API kritischer Packages wird auf stabile Verträge reduziert

- **WHEN** ein kritisches Package wegen `publicExports` als Hotspot auffällt
- **THEN** wird geprüft, welche Exporte echte Vertragsfläche und welche nur interne Helper sind
- **AND** bleiben interne Helper nicht ohne Bedarf im Root-Entry erhalten
- **AND** verschiebt der Refactor solche Hilfen auf interne Module oder engere Subpath-Entrypoints
