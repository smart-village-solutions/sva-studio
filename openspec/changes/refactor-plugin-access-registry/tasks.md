## 1. Characterization

- [x] 1.1 Relevante Registry-Tests und Typecheck als Baseline ausführen.
- [x] 1.2 Access-Anforderungen für Kinds, Mengen, Modi, Module, Resource Context und jedes Capability-Feld kombinatorisch charakterisieren.
- [x] 1.3 Action-Registry für leere Actions, Duplikate, Namespaces, Aliase sowie konkurrierende Fehler und exakte Fehlercodes charakterisieren.

## 2. Implementierung

- [x] 2.1 Puren internen Access-Vergleich extrahieren und die bestehende Fassade darauf umstellen.
- [x] 2.2 Action-Registry-Validierung und -Materialisierung phasenweise intern extrahieren.
- [x] 2.3 Öffentliche Typen, Exports, Reihenfolge und Fehlerverträge unverändert halten.

## 3. Dokumentation und Qualität

- [x] 3.1 Arc42-Abschnitte 05 und 08 auf die interne Ownership und den stabilen Sicherheitsvertrag aktualisieren.
- [x] 3.2 Unit-, Type-, Lint-, Runtime-, Complexity-, OpenSpec-, File-Placement- und Changelog-Gates ausführen.
- [x] 3.3 New-only-Fallow-Audit vor Draft und nach jeder relevanten Revision mit allen Introduced-Zählern auf null belegen.
