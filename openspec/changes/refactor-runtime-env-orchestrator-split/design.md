## Context

`runtime-env.ts` ist der kanonische Einstieg fuer lokale Runtime-Befehle, Studio-Prechecks, Deploys und Smokes. Die Datei ist fachlich gewachsen und enthaelt inzwischen mehrere voneinander abgrenzbare Verantwortungen, die aber gemeinsam getestet und gepflegt werden muessen.

## Goals / Non-Goals

- Goals:
  - Interne Verantwortungen klar schneiden
  - Bestehende CLI- und Test-Vertraege unveraendert halten
  - Orchestrierungslogik in kleineren, separat testbaren Modulen abbilden
- Non-Goals:
  - Keine Aenderung am externen Releaseablauf
  - Keine neue generische Service-/Provider-Abstraktion
  - Keine Aenderung an Command-Namen, JSON-Formaten oder Approval-Tokens

## Decisions

- Decision: `scripts/ops/runtime-env.ts` bleibt Fassade und verdrahtet neue Module ueber explizite Dependency-Objekte.
- Alternatives considered: Vollstaendiges Verschieben aller Hilfsfunktionen in neue Module wurde verworfen, weil das den Refactor-Radius fuer Verhalten, Imports und Tests deutlich vergroessern wuerde.
- Decision: Die fachlichen Typen fuer Commands und Doctor-Reports werden in `runtime-env.shared.ts` zentralisiert, damit neue Module ohne Zyklen dieselben Vertraege nutzen.

## Risks / Trade-offs

- Der Refactor erhoeht kurzfristig den Verdrahtungsaufwand, reduziert aber die langfristige Ownership und macht Hotspots separat testbar.
- Dependency-Injection zwischen Fassade und Modulen ist ausdrucksstark, fuehrt aber zu groesseren Dependency-Objekten; diese bleiben funktionsorientiert und lokal statt globale Service-Layer einzufuehren.

## Migration Plan

1. Typen und erste Modultests einfuehren.
2. Smoke- und Remote-Verification-Helfer auslagern und Fassade stabil halten.
3. Doctor-, Deploy- und Dispatch-Orchestrierung ueber neue Module verdrahten.
4. Zielgerichtete Unit-/Type-Gates ausfuehren und verbleibende Importe bereinigen.
