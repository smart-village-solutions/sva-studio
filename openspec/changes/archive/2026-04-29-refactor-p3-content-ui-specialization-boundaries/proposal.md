# Change: Registrierte spezialisierte Content-Views für bestehende Content-Plugins konkretisieren

## Why

Die strategische Grenze zwischen host-owned Content-Kern und plugin- oder package-spezifischen Fach-Views ist im aktuellen Spec- und Architekturstand bereits weitgehend beschrieben. Offen ist aber noch der konkrete technische Vertrag, über den spezialisierte Listen-, Detail- und Editor-Bindings tatsächlich registriert, validiert und im Host materialisiert werden.

Aktuell existieren bereits mehrere spezialisierte Content-Plugins wie `@sva/plugin-news`, `@sva/plugin-events` und `@sva/plugin-poi`, aber es fehlt ein expliziter, überprüfbarer Registrierungsvertrag dafür, welche UI-Bausteine packagespezifisch geliefert werden dürfen und welche Verantwortung beim Host verbleibt. Ohne diesen Vertrag bleibt die gewünschte Grenze zwar dokumentiert, aber nicht präzise genug für mehrere parallele Fachdomänen oder eine konsistente Migration weiterer Content-Plugins.

## What Changes

- definiert einen dreistufigen Vertrag für Content-Plugin-UI:
  - Standardpfad für normale CRUD-artige Content-Plugins über host-owned `adminResources`
  - Spezialisierungspfad für eigene List-, Detail- und Editor-Views innerhalb dieses Host-Rahmens
  - Ausnahme-Pfad über freie `plugin.routes` nur für Nicht-CRUD-Sonderfälle
- erweitert den bestehenden Host-Vertrag so, dass `@sva/plugin-news`, `@sva/plugin-events` und `@sva/plugin-poi` ihre bestehenden spezialisierten Seiten über denselben kanonischen Ressourcen- und Routingpfad materialisieren können
- legt konkret fest, welche Verantwortungen beim Host bleiben und welche Spezialisierung Plugin-Packages liefern dürfen
- präzisiert die Fallback-, Validierungs- und Ablehnungsregeln, wenn ein Content-Typ keinen spezialisierten Binding liefert oder wenn ein Plugin fälschlich den Ausnahme-Pfad für normales CRUD verwendet
- definiert den Vertrag so, dass weitere Standard-Content-Plugins denselben Mechanismus wiederverwenden können, ohne neue hostseitige Sonderverdrahtung einzuführen
- ergänzt die nötigen Tests für Registrierungsvalidierung, Host-Fallbacks, Pfadwahl Standard vs. Ausnahme und die Referenzintegration aller drei bestehenden Content-Plugins

## Impact

- Affected specs:
  - `content-management`
  - `account-ui`
  - `routing`
- Affected code:
  - `packages/plugin-sdk`
  - `packages/core`
  - `apps/sva-studio-react`
  - `packages/routing`
  - `packages/plugin-news`
  - `packages/plugin-events`
  - `packages/plugin-poi`
  - `packages/studio-ui-react`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
