## Kontext

Mit mehreren Plugin-Klassen wird es unpraktisch, alle Packages als gleich privilegierte Erweiterungen zu behandeln. Das Studio benötigt daher ein Zielbild für unterschiedliche Erweiterungstiefen.

## Entscheidungen

### 1. Packages werden nach Erweiterungstiefe klassifiziert

Normale Fachpackages, Admin-Erweiterungen und plattformnahe Packages erhalten unterschiedliche zulässige Host-Oberflächen.

### 2. Höhere Tiefe bedeutet strengere Governance

Je tiefer ein Package in Host-nahe Fähigkeiten eingreift, desto enger sind Vertrag, Review und Freigabe.

### 3. Die Governance ergänzt, ersetzt aber nicht Namespacing und Guardrails

Erweiterungstiefen bauen auf Registry-, Namespace- und Guardrail-Verträgen auf.

Die Reihenfolge ist verbindlich: Erweiterungstiefen werden erst sinnvoll definierbar, wenn der Build-time-Registry-Vertrag, die Host-Guardrails und die Namespace-Governance bereits festgezogen sind.
