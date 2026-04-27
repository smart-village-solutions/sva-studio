# ADR-037: Plugin-spezifische IAM-Rechte

**Status:** Accepted
**Entscheidungsdatum:** 2026-04-27
**Entschieden durch:** Studio/Architektur Team
**GitHub Issue:** Nicht vorhanden
**GitHub PR:** #335

## Kontext

Der Plugin-SDK-Vertrag v1 aus ADR-034 definierte Routen, Navigation, Content-Typen und Guard-Metadaten. Produktive Fachplugins nutzten dabei noch generische Content-Rechte wie `content.read`, `content.updatePayload` oder `content.delete`. Dieses Modell war für die ersten Plugin-Screens ausreichend, konnte aber fachliche Freigaben nicht sauber trennen: ein generisches Content-Update-Recht hätte News, Events und POI gleichermaßen freigeschaltet.

Das IAM-Modell aus ADR-012, ADR-013 und ADR-025 unterstützt bereits strukturierte Permissions und restriktive Entscheidungen. Es fehlte nur der explizite SDK-Vertrag, mit dem Plugins ihre eigenen Rechtefamilien deklarieren und Host, Routing, Navigation, Seeds und Admin-UI dieselben IDs verwenden.

## Entscheidung

- Plugins deklarieren fachliche Permissions über `PluginDefinition.permissions`.
- Permission-IDs folgen dem Format `<pluginId>.<actionName>`.
- `definePluginPermissions(namespace, definitions)` ist der kanonische SDK-Helfer für diese Deklaration.
- `content`, `iam`, `admin`, `core`, `system` und `platform` sind reservierte Namespaces und dürfen von Plugins nicht verwendet werden.
- Plugin-Routen, Navigation und Actions dürfen nur eigene, registrierte Permission-IDs referenzieren.
- Produktive Fachplugins verwenden keinen `content.*`-Fallback mehr.
- Die ersten produktiven Rechtefamilien sind `news.*`, `events.*` und `poi.*` mit den Aktionen `read`, `create`, `update` und `delete`.
- IAM speichert diese Rechte als normale strukturierte Permissions; `resourceType` entspricht dem Plugin-Namespace.
- Die Rollenverwaltung zeigt Plugin-Rechte als fachliche Ressourcengruppen, bleibt aber beim bestehenden Rollen-Permission-Speichervertrag.

## Begründung

Plugin-spezifische Rechte schließen Cross-Plugin-Freigaben aus und machen Rollen in der Admin-UI fachlich verständlicher. Die Entscheidung nutzt das bestehende IAM-Modell, statt eine parallele Plugin-Policy-Engine einzuführen. Die statische Build-time-Registry aus ADR-034 bleibt der passende Ort, um ungültige oder fremde Permission-Referenzen fail-fast zu stoppen.

## Konsequenzen

Positive Konsequenzen:

- Rollen können News, Events und POI getrennt freischalten.
- Plugin-Navigation, Route-Guards und Server-Fassaden prüfen denselben fachlichen Permission-Key.
- Neue Fachplugins erhalten einen generischen SDK-Vertrag ohne App-interne Sonderlogik.
- Build-time-Validierung verhindert reservierte Namespaces, fremde Plugin-Rechte und fehlende Registrierungen.

Negative Konsequenzen:

- Seeds und Persona-Zuordnungen müssen für jedes produktive Plugin explizit erweitert werden.
- Bestehende Tests und E2E-Mocks müssen die fachlichen Rechtefamilien kennen.
- `content.*` bleibt als Core-/Legacy-Vertrag erhalten und muss in Reviews klar von produktiven Plugin-Guards getrennt werden.

## Verworfene Alternativen

### 1. Weiterhin generische `content.*`-Guards verwenden

Verworfen, weil die Rechte zu breit wirken und fachliche Plugin-Isolation verhindern.

### 2. Plugin-Rechte nur in der UI auswerten

Verworfen, weil UI-Gates keine Autorisierungsgrenze sind. Die serverseitigen Mainserver-Fassaden müssen dieselben Permissions prüfen.

### 3. Separate Plugin-Policy-Engine einführen

Verworfen, weil das bestehende IAM-Modell bereits Rollen, strukturierte Permissions, Snapshots und deny-vor-allow-Entscheidungen bereitstellt.

## Konsequenzen für Umsetzung und Betrieb

- Rollout-Reihenfolge: Seeds/Migration einspielen, App deployen, Plugin-Smoke-Test ausführen.
- Smoke-Tests prüfen, dass Plugin-Routen mit `news.*`, `events.*` und `poi.*` erreichbar sind und keine produktiven `content.*`-Plugin-Guards mehr aktiv sind.
- Neue Plugin-PRs müssen Permission-Deklaration, Seed-/Rollenmodell, Admin-UI-Darstellung und serverseitige Autorisierung gemeinsam betrachten.

## Verwandte ADRs

- [ADR-012](ADR-012-permission-kompositionsmodell-rbac-v1.md)
- [ADR-013](ADR-013-rbac-abac-hybridmodell.md)
- [ADR-025](ADR-025-multi-scope-prioritaetsregel-fuer-iam.md)
- [ADR-034](ADR-034-plugin-sdk-vertrag-v1.md)
