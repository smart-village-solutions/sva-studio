## Kontext

Die bestehende Plugin-Architektur des Studios ist build-time-basiert, aber die Rollengrenzen zwischen Package und Host sind noch nicht vollständig formalisiert. Ohne klare Guardrails könnten Plugins schrittweise Sicherheits-, Routing- oder Audit-Verantwortung an sich ziehen.

## Entscheidungen

### 1. Plugins liefern nur deklarative Beiträge

Packages dürfen deklarieren, welche Routen, Content-Typen, Aktionen oder Admin-Ressourcen sie bereitstellen. Sie erzwingen jedoch keine Sicherheits- oder Laufzeitentscheidungen selbst.

### 2. Der Host bleibt alleinige Entscheidungsinstanz

Guard-Anwendung, Berechtigungsprüfung, Audit-Logging, Request-Grenzen, Validierungseinbindung und endgültige Route-Materialisierung bleiben ausschließlich Host-Verantwortung.

### 3. Bypässe sind explizit verboten

Der Vertrag verbietet pluginseitige Sicherheits- oder Routing-Bypässe, etwa direkte Host-Interna, separate Guard-Stacks oder eigene Audit-Pipelines.

## Nicht-Ziele

- Kein neues Autorisierungssystem
- Kein eigenständiger Plugin-Sicherheitsmodus
- Keine Delegation hostkritischer Verantwortung an Packages
