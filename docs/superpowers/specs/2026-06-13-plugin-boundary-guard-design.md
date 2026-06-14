# Plugin Boundary Guard Design

## Kontext

Das Workspace-Zielbild für Studio-Plugins ist eine klare Kapselung gegen interne Host- und Core-Packages. Plugins sollen einheitlich aussehen und sich einheitlich in den Host integrieren, ohne dass neue fachliche oder technische Kopplungen in `@sva/core` oder andere interne Pakete einsickern.

Gleichzeitig ist der aktuelle Workspace ein Brownfield:

- bestehende Plugins enthalten bereits einzelne Altlasten oder Sonderfälle
- neue Plugin-Arbeit darf nicht durch ein zu starres Drittanbieter- oder Runtime-Regime unnötig ausgebremst werden
- die Architekturgrenze soll deshalb sichtbar, technisch erfassbar und später verschärfbar sein, ohne sofort alle Altfälle zu blockieren

## Ziele

- Plugin-Packages unter `packages/plugin-*` dürfen nur über `@sva/plugin-sdk` und `@sva/studio-ui-react` an interne Workspace-Funktionalität andocken.
- Neue Plugin-Features dürfen keine neuen direkten Abhängigkeiten auf `@sva/core`, andere Host-Packages, App-Code oder andere Plugins einziehen.
- Bestehende Abweichungen sollen technisch sichtbar und detailliert dokumentiert werden.
- Die Regel soll Refactorings ermöglichen statt verhindern: bekannte Altlasten bleiben zunächst tolerierbar, neue nicht dokumentierte Kanten werden später gezielt blockierbar.

## Nicht-Ziele

- Kein generelles Verbot externer NPM-Abhängigkeiten für Plugins
- Kein sofort blockierender CI-Gate im ersten Rollout
- Keine automatische Refactoring-Empfehlung oder Auto-Fix-Logik im Guard
- Keine Pruefung von Host-Integrationsdateien ausserhalb von `packages/plugin-*`
- Keine Bewertung transitativer Re-Exports hinter `@sva/plugin-sdk`

## Architekturregel

### Erlaubte direkte Plugin-Abhängigkeiten

Plugins dürfen direkt importieren aus:

- `@sva/plugin-sdk`
- `@sva/studio-ui-react`
- externen NPM-Paketen
- Peer-Dependencies wie `react`, `react-dom` und `@tanstack/react-router`

### Nicht erlaubte direkte Plugin-Abhängigkeiten

Direkte Plugin-Importe auf andere interne Workspace-Ziele gelten als Verstöße oder als explizit dokumentierte Übergangsausnahmen. Dazu gehören insbesondere:

- `@sva/core`
- `@sva/auth-runtime`
- `@sva/data-*`
- `@sva/iam-*`
- `@sva/routing`
- `@sva/server-runtime`
- `@sva/sva-mainserver`
- `@sva/studio-module-iam`
- `apps/**`
- andere Plugin-Packages

Wenn ein Plugin Host-Funktionalität benötigt, soll diese über `@sva/plugin-sdk` oder `@sva/studio-ui-react` öffentlich bereitgestellt werden, nicht über Direktimporte in interne Pakete.

## Guard-Scope

Der technische Guard prüft ausschließlich Quellcode unter `packages/plugin-*`.

Er prueft:

- direkte Package-Imports
- relative Importe, wenn sie aus dem Plugin-Package heraus auf fremde Workspace-Ziele zeigen
- `import`
- `import type`
- Re-Exports

Er prueft nicht:

- App-Bindings oder Host-Wiring in `apps/sva-studio-react`
- transitive Abhängigkeiten hinter erlaubten Einstiegen wie `@sva/plugin-sdk`

## Auflösungsmodell

Die Bewertung erfolgt nicht nur anhand des Import-Strings, sondern anhand des aufgeloesten Ziels.

Das ist notwendig, damit Umgehungen über:

- relative Pfade
- Subpath-Re-Exports
- interne Dateisprünge

nicht an der Regel vorbeigehen.

Fuer die Allowlist wird das Ziel auf Package-/Subpath-Ebene normiert, zum Beispiel:

- `@sva/core`
- `@sva/core/waste-management`
- `@sva/auth-runtime`
- `apps/sva-studio-react`

Die Normierung soll robust gegen interne Datei-Refactorings bleiben. Eine Änderung von `src/...`-Dateien innerhalb eines Packages darf keine unnötige Allowlist-Churn erzeugen, solange die fachliche Kopplung dieselbe bleibt.

## Ausnahmemodell

Bekannte Altlasten werden über eine detaillierte JSON-Allowlist dokumentiert, nicht über eine anonyme Baseline.

Empfohlener Pfad:

- `config/plugin-architecture-allowlist.json`

Jeder Eintrag beschreibt genau eine Importkante.

### Empfohlene Feldstruktur

```json
{
  "plugin": "waste-management",
  "sourceFile": "packages/plugin-waste-management/src/example.ts",
  "importSpecifier": "@sva/core/waste-management",
  "resolvedTarget": "@sva/core/waste-management",
  "kind": "type",
  "reason": "Historische Übergangskopplung bis SDK-Vertrag extrahiert ist",
  "ticket": "QUAL-123"
}
```

### Semantik

- `plugin`: Plugin-ID oder eindeutig lesbarer Plugin-Schluessel
- `sourceFile`: repository-relativer Dateipfad
- `importSpecifier`: genau der im Quelltext verwendete Import
- `resolvedTarget`: normiertes Ziel auf Package-/Subpath-Ebene
- `kind`: `runtime`, `type` oder `reexport`
- `reason`: verpflichtende Begründung
- `ticket`: optionales Abbau-Tracking

Mehrere Importe gegen dasselbe Ziel werden bewusst nicht gebündelt. Ein Eintrag steht für genau eine Importkante, damit Refactorings sauber und differenziert nachverfolgbar bleiben.

## Laufzeit- und Review-Verhalten

Der Guard meldet Verstöße nur. Er macht keine Vorschläge und schreibt keine Dateien um.

Die Ausgabe soll mindestens enthalten:

- Plugin
- Quellpfad
- Import-Specifier
- normiertes Ziel
- Art des Verstoßes (`runtime`, `type`, `reexport`)
- Hinweis, ob eine passende Allowlist-Ausnahme existiert

Ziel ist ein klarer Diagnosepfad für Reviews und spätere Nachschärfung, nicht eine autonome Refactoring-Engine.

## Rollout-Plan

### Phase 1: Warn-only

- der Guard läuft lokal und in CI sichtbar mit
- Verstöße werden gemeldet
- keine Blockierung

### Phase 2: No-new-violations

- neue nicht allowlistete Kanten blockieren
- bestehende dokumentierte Altlasten bleiben vorerst toleriert

### Phase 3: Gezielte Nachschaerfung

- später können besonders kritische Ziele früher hart geblockt werden, zum Beispiel `@sva/core` oder `apps/**`
- diese Phase ist bewusst nicht Teil des ersten Rollouts

## Risiken und Trade-offs

- Ein zu breiter `@sva/plugin-sdk` kann interne Verträge zwar sauber kapseln, aber gleichzeitig zu einer neuen Sammelfassade anschwellen.
- Ein zu weicher Warn-only-Betrieb ohne spätere Nachschärfung kann schnell ignoriert werden.
- Eine sehr feingranulare Allowlist erzeugt Pflegeaufwand, ist hier aber bewusst akzeptiert, weil sie Altlasten sichtbar und abbaubar hält.
- Package-/Subpath-Normierung reduziert Churn, opfert aber die letzte technische Praezision auf Dateiebene zugunsten besserer Wartbarkeit.

## Empfehlung

Die Architekturgrenze sollte als kuratierte Plugin-Oberfläche verstanden werden:

- `@sva/plugin-sdk` ist die einzige fachlich gewollte Host-Vertragskante
- `@sva/studio-ui-react` ist die einzige fachlich gewollte gemeinsame UI-Kante
- alles andere interne bleibt für Plugins privat, selbst wenn es technisch heute noch erreichbar ist

Der empfohlene erste Schritt ist deshalb ein nicht blockierender Guard mit detaillierter Allowlist und späterem Wechsel auf `no-new-violations`.
