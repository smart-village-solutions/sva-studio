# Change: Allgemeine Plugin-Mengen für Studio-Artefakte auswählen

## Why

Die Build-Profile `studio` und `ssf` bilden den für #1503 festgelegten Abnahmefall `news`, `categories` und `ssf` nicht ab. Eine feste Kassel-Distribution würde den Kundenfall in die Plattform einbauen, statt den vorhandenen Build-Vertrag allgemein nutzbar zu machen.

## What Changes

- Build-Eingaben dürfen eine validierte, explizite Menge installierter Workspace-Plugins beschreiben.
- Browser, Server, Worker, IAM, Routing, Runtime-Manifest und Image-Verifikation verwenden denselben buildgebundenen Plugin-Satz.
- Bestehende `studio`- und `ssf`-Artefakte behalten ihren aktuellen Inhalt und Build-Aufruf.
- Das Artefakt belegt enthaltene und ausgeschlossene Plugins; unbekannte, doppelte oder inkonsistente Auswahl stoppt den Build.

## Impact

- Affected specs: `plugin-platform`, `deployment-topology`
- Affected code: Plugin-Build-Inputs, Studio-Runtime-Katalog, Distributionsmanifest, Image-Build und Image-Verifikation
- Affected arc42: `05-building-block-view.md`, `07-deployment-view.md`, `08-cross-cutting-concepts.md`, `10-quality-requirements.md`, `11-risks-and-technical-debt.md`

## Liefergrenze

Dieser Change liefert die allgemeine Auswahl und den Artefaktnachweis. Er enthält weder eine Kassel-spezifische Distribution noch Änderungen an Kasseler Diensten, Keycloak, Mainserver-Daten oder Traefik. Die spätere Kassel-Instanz verwendet diesen Vertrag mit `news`, `categories` und `ssf`.
