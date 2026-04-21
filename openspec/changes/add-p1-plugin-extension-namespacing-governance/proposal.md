# Change: Namespacing-Governance für registrierte Plugin-Identifier ausbauen

## Why

Das Studio nutzt bereits fully-qualified Action-IDs, aber fuer andere registrierte Plugin-Identifier fehlt noch ein gleichermassen belastbarer Governance-Vertrag. Mit wachsender Zahl statischer Packages braucht der Host eine kanonische Regel, wie Plugin-Identitaet, Content-Typen, Admin-Ressourcen und Audit-Ereignisse namespace-sicher benannt und validiert werden, damit Kollisionen und uneinheitliche Benennung nicht spaeter in mehreren Teilvertraegen nachgezogen werden muessen.

## What Changes

- Definition einer kanonischen technischen Plugin-Identitaet mit genau einem owning namespace je Plugin-Package
- Einfuehrung verbindlicher Namespace-Regeln fuer registrierte Plugin-Identifier ausserhalb der bestehenden Action-ID-Governance
- Festlegung namespaceter Identifier fuer plugin-beigestellte Content-Typen, Admin-Ressourcen und Audit-Event-Typen
- Verankerung hostseitiger Ownership- und Kollisionsvalidierung fuer diese Identifier
- Abgrenzung zu separaten Folge-Changes fuer Extension-Tiers, Registrierungsphasen, Host-Guardrails, Search-Facets und i18n-Namespaces

## Impact

- Affected specs:
  - `monorepo-structure`
  - `routing`
  - `content-management`
  - `iam-auditing`
- Affected code:
  - `packages/sdk`
  - `packages/routing`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
