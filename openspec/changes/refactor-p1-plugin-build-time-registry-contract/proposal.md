# Change: Build-time-Plugin-Registry als kanonischen Host-Vertrag schärfen

## Why

Die aktuelle Plugin-Einbindung des Studios geht bereits in Richtung statischer Host-Registrierung, ist aber noch nicht als belastbarer Build-time-Vertrag für alle Admin- und CMS-Erweiterungen ausdefiniert. Konkret existieren heute mehrere lose gekoppelte Inventarisierungspfade (z.B. in `apps/sva-studio-react` und `packages/routing`), die beim Hinzufügen eines neuen Plugin-Beitrags manuell synchron gehalten werden müssen. Für den weiteren Ausbau des Studios als package-basiertes CMS braucht es eine einzige kanonische Registry, aus der der Host Routen, Navigation, Content-Typen und i18n deterministisch materialisiert.

Dieser Refactor ist P1, weil P2-Folgeschritte (Admin-Ressourcen, Content-Guardrails) sonst einen dritten Registrierungspfad einführen würden und der Vertrag nachträglich erheblich schwerer zu schärfen wäre.

## What Changes

- Konsolidierung der bestehenden Plugin-Einbindung auf einen expliziten Build-time-Registry-Vertrag
- Definition eines stabilen Host-Modells für statische Package-Beiträge ohne Runtime-Loading
- Klärung, welche Plugin-Beiträge der Host build-seitig materialisiert und welche explizit ausgeschlossen bleiben
- Vereinheitlichung der Registrierungsbegriffe für Navigation, Admin-Ressourcen, Content-Typen und Übersetzungen
- Klarstellung, dass Guard-Anwendung Host-Verantwortung bleibt und kein deklarativer Plugin-Beitrag ist
- Dokumentation der Materialisierungspfade zwischen `packages/sdk`, `packages/routing` und `apps/sva-studio-react`

## Impact

- Affected specs:
  - `monorepo-structure`
  - `routing`
  - `content-management`
- Affected code:
  - `packages/sdk`
  - `packages/routing`
  - `packages/auth` (Action-Registry-Namespace trägt Guard-Semantik)
  - `apps/sva-studio-react`
  - `packages/plugin-example`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
- Related decisions:
  - [ADR-034 – Plugin SDK Vertrag v1](../../docs/adr/ADR-034-plugin-sdk-vertrag-v1.md) (Basis; dieser Change konkretisiert und erweitert ADR-034)
