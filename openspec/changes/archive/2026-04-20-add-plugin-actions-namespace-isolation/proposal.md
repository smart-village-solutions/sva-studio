# Change: Erweiterbare Plugin-Aktionen mit Namespace-Isolation einführen

## Why
Aktuell fehlen verbindliche Regeln, wie Plugin-Aktionen benannt, registriert und isoliert werden. Ohne klare Namespace-Isolation drohen Kollisionen zwischen Core- und Plugin-Aktionen sowie unbeabsichtigte Rechteausweitungen in Routing, UI und Autorisierung.

## What Changes
- Führt eine typsichere Action-Registry mit verpflichtendem Namespace-Schema für Plugins ein (`<pluginNamespace>.<actionName>`).
- Definiert Isolation-Regeln, sodass Plugins nur Aktionen im eigenen Namespace registrieren und ausführen können.
- Ergänzt SDK-Verträge für deklarative Action-Metadaten (Anzeige, Berechtigungsbezug, i18n-Key, optionales Feature-Flag).
- Ergänzt Runtime-Validierung für Kollisionen, unzulässige Namespace-Nutzung und ungültige Action-IDs.
- Definiert Governance für Migration bestehender un-namespaced Aktionen inklusive Kompatibilitätsphase.
- Ergänzt Observability- und Audit-Anforderungen für Action-Registrierung und Action-Ausführung.

## Impact
- Affected specs: `plugin-actions`, `routing`, `iam-access-control`, `iam-auditing`, `monorepo-structure`
- Affected code:
  - `packages/sdk` (Plugin-Action-Verträge, Typen)
  - `packages/core` (Action-Registry, Namespace-Validierung)
  - `packages/routing` (Action-zu-Route-Integration)
  - `apps/sva-studio-react` (UI-Action-Binding und i18n-Namespace)
  - serverseitige IAM-/Audit-Integrationen
- Affected arc42 sections:
  - 05 Bausteinsicht (Action-Registry + SDK Boundary)
  - 08 Querschnittliche Konzepte (Sicherheit, Namenskonventionen, Isolation)
  - 09 Architekturentscheidungen (Namespace-Strategie und Migration)
  - 12 Glossar (Begriffe zu Action-ID, Namespace, Owner)
