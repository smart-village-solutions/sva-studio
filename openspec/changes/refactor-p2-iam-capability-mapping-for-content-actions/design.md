## Kontext

Mit mehr fachlichen Inhalts- und Admin-Aktionen wächst das Risiko, dass Berechtigungslogik direkt an Fachaktionen gekoppelt wird. Stattdessen soll ein explizites Mapping auf primitive Studio-Rechte die Sicherheitslogik konsistent halten.

## Entscheidungen

### 1. Fachaktionen werden auf primitive Rechte abgebildet

Aktionen wie Publish, Archive oder Bulk-Edit bleiben fachliche Begriffe, werden aber nicht direkt zur letzten Sicherheitsprimitive.

### 2. Das Mapping ist zentral und erklärbar

Die Permission Engine, UI und Audit-Pfade konsumieren dieselbe Mapping-Semantik.

Host-Standards für Admin-Ressourcen wie Bulk-Aktionen oder Revisionen bleiben dabei reine UI- und Ablaufstandards. Sie verwenden dieses Mapping, ersetzen es aber nicht durch eine ressourcenspezifische Sicherheitslogik.

### 3. Fachliche Vielfalt erhöht nicht die Zahl primitiver Rechte beliebig

Neue Fachaktionen werden bevorzugt auf vorhandene Rechte gemappt, statt die Sicherheitsprimitive unkontrolliert zu vermehren.
