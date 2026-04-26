## 1. Specification

- [x] 1.1 Mapping zwischen fachlichen Content-Aktionen und primitiven Studio-Rechten spezifizieren
- [x] 1.2 Plugin-nahe Content-Aktionen in denselben Mapping-Vertrag einordnen
- [x] 1.3 UI-, API-, Diagnose- und Audit-Erwartungen fuer gemappte Aktionen dokumentieren
- [x] 1.4 Fehlende, ungueltige und nicht autorisierte Mappings als deterministische Denial-Faelle spezifizieren
- [x] 1.5 `openspec validate refactor-p2-iam-capability-mapping-for-content-actions --strict` ausfuehren

## 2. Implementation

- [x] 2.1 Capability-Mapping-Vertrag in IAM- oder SDK-nahem Package modellieren, ohne React-Abhaengigkeit
- [x] 2.2 Hostseitige Registry/Resolver-Funktion fuer Capability -> primitive Studio-Action implementieren
- [x] 2.3 Content-Aktionsregistrierung so validieren, dass mutierende Aktionen eine unterstuetzte Capability deklarieren
- [x] 2.4 Serverseitige Content-Action-Handler so umstellen, dass sie immer die aufgeloeste primitive Studio-Action ueber die zentrale Permission Engine autorisieren
- [x] 2.5 UI-Verfuegbarkeit aus demselben Mapping-Vertrag ableiten, aber serverseitige Autorisierung weiterhin als massgeblich behandeln
- [x] 2.6 Audit-Emission fuer Content-Aktionen additiv um Domain-Capability, primitive Action, Scope, Ergebnis und Denial-Grund erweitern
- [x] 2.7 Tests fuer Positiv-, Negativ-, Missing-Mapping-, Invalid-Mapping-, Audit- und Diagnosepfade ergaenzen
- [x] 2.8 Relevante Dokumentation und arc42-Abschnitte aktualisieren oder begruendete Nichtbetroffenheit dokumentieren

## 3. Validation

- [x] 3.1 Betroffene Unit-Tests ueber Nx ausfuehren
- [x] 3.2 Betroffene Type-Tests ueber Nx ausfuehren
- [x] 3.3 Bei serverseitigen Package-Aenderungen `pnpm check:server-runtime` gezielt ausfuehren
- [x] 3.4 Vor PR-Erstellung nach Moeglichkeit `pnpm test:pr` ausfuehren
