## ADDED Requirements

### Requirement: Plugin-Content-Historie wird ausschließlich durch den Host erzeugt

Das System SHALL Historieneinträge für Plugin-Content-Mutationen ausschließlich über host-owned Audit- und History-Pipelines erzeugen. Plugins dürfen History-Metadaten und lokalisierte Feldbezeichnungen beitragen, aber keine History- oder Audit-Datensätze direkt persistieren.

#### Scenario: Plugin-Inhalt wird über den Host geändert

- **WENN** eine hostvalidierte Plugin-Content-Mutation erfolgreich abgeschlossen wird
- **DANN** erzeugt der Host einen korrelierbaren Audit- und History-Nachweis mit Instanz, Inhalt, Content-Typ, Actor, Aktion und Ergebnis
- **UND** plugin-spezifische Payload-Werte werden nur allowlist-basiert und redigiert übernommen

#### Scenario: Plugin versucht die Host-Historie zu umgehen

- **WENN** ein Plugin einen direkten History-Schreibpfad registriert oder verwendet
- **DANN** lehnt der Host diesen Pfad vor der produktiven Materialisierung ab
- **UND** meldet einen stabilen Diagnosecode mit Plugin-Namespace und Contribution-ID

### Requirement: Mainserver-Studio-Historie bleibt in Erfolg und Herkunft wahrheitsgemäß

Das System MUST erfolgreiche sichtbare History-Einträge für Mainserver-Inhalte von abgelehnten und fehlgeschlagenen Versuchen trennen. Jeder Eintrag MUST als Studio-seitig identifizierbar sein und darf keine externe Vollständigkeit suggerieren.

Für Mainserver-Inhalte MUST der Host die bereits etablierte External-Content-Referenz und stabile Operationskorrelation wiederverwenden. Eine History-Implementierung darf weder eine zweite externe Identität noch ein paralleles Mutation-Journal anlegen.

#### Scenario: Provider-Erfolg wird historisiert

- **WENN** der Mainserver den fachlichen Erfolg einer über das Studio ausgelösten Mutation bestätigt
- **DANN** finalisiert der Host genau einen sichtbaren History-Eintrag
- **UND** korreliert ihn über stabile Request-, Trace- oder Mutationsreferenzen mit dem Audit-Ereignis

#### Scenario: Wiederholte Verarbeitung derselben Mutation

- **WENN** dieselbe erfolgreiche Mutation wegen Retry oder Wiederanlauf erneut verarbeitet wird
- **DANN** bleibt die sichtbare Historie idempotent
- **UND** erzeugt keinen zweiten fachlich identischen Erfolgseintrag

#### Scenario: Providerfehler wird auditiert

- **WENN** eine Mainserver-Mutation fehlschlägt
- **DANN** erfasst die Auditspur Ergebnis und redigierten Grund
- **UND** die sichtbare Inhaltshistorie enthält keinen falschen Erfolgseintrag
