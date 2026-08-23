## Context

Mainserver-basierte Inhalts-Edit-Routen lösen vor dem Rendern des Editors den Ressourcenprincipal des bestehenden Inhalts auf. Die getrennten Zustände `loading`, `ready` und `error` verhindern den früheren roten Fehlerblitz korrekt. Die darüber hinaus eingeführte Motion-Sprache für Detailseite und Startseite soll dagegen vollständig entfallen.

## Goals / Non-Goals

- Goals:
  - Erwartetes Laden semantisch und visuell von einem echten Fehler unterscheiden.
  - Den Editor unmittelbar nach erfolgreicher Principal-Auflösung anzeigen.
  - Anime.js und sämtliche Studio-Motion-Eigenlogik vollständig entfernen.
  - Die Startseite wieder statisch und ohne präsentationsbezogenen Sitzungszustand rendern.
- Non-Goals:
  - Keine Änderung an der Ressourcenprincipal- oder Berechtigungslogik.
  - Kein neuer Loader, kein Artwork und keine neue Animation.
  - Keine globale Umstellung anderer Ladezustände.

## Decisions

### Bestehendes Status-Primitiv wiederverwenden

Der `loading`-Zweig verwendet den bereits vorhandenen `StudioLoadingState` aus `@sva/studio-ui-react`. Er rendert den übersetzten Ladetext als regulären `role="status"` und benötigt weder neue Komponente noch zusätzliche Abhängigkeit.

### Fachlicher Zustand steuert die Darstellung

Die Principal-Auflösung bleibt eine explizite Zustandsmaschine mit `loading`, `ready` und `error`. Nur `ready` rendert den Editor. `loading` zeigt den neutralen Status, `error` die dauerhafte destruktive Meldung. Es gibt keine Timer, Mindestdauer oder Übergangslogik.

### Motion vollständig entfernen

Content-Assembly, Workbench-Artwork, Anime.js-Orchestrierung, dynamische Imports, Reduced-Motion-Sonderlogik und Session-Marker werden gelöscht. Die Startseite verwendet wieder ihre statische Struktur. Damit verbleibt kein ungenutztes Motion-API im Design-System.

## Alternatives considered

- Statisches Baukastenmotiv ohne Anime.js: verworfen, weil außer dem Detailseiten-Ladeverhalten keine Teile der Motion-Umsetzung erhalten bleiben sollen.
- Neuer seitenfüllender Loader ohne Animation: verworfen, weil `StudioLoadingState` den benötigten zugänglichen Status bereits abdeckt.
- Vollständiger Revert der Principal-Zustände: verworfen, weil dadurch der ursprüngliche irreführende Fehlerblitz zurückkehren würde.

## Risks / Trade-offs

- Der kompakte Ladehinweis ist visuell zurückhaltender als das entfernte Artwork; das ist beabsichtigt und reduziert Ablenkung sowie Ownership.
- Beim Rückbau könnten Startseiten- oder Motion-Referenzen verbleiben; gezielte Suche, Type-Tests und Build prüfen die vollständige Entfernung.
- Die Lockfile-Änderung kann einen breiten affected-Scope erzeugen; lokale Tests bleiben fokussiert, die vollständige PR-CI bildet das Workspace-Gate.

## Migration Plan

1. Startseiten- und Design-System-Motion entfernen.
2. Anime.js mit dem Workspace-Paketmanager aus Manifest und Lockfile entfernen.
3. Detailseiten-Boundary auf `StudioLoadingState` umstellen und Regressionstests anpassen.
4. OpenSpec-, Architektur-, Package- und Changelog-Dokumentation bereinigen.
5. Gezielte Unit-, Type-, Lint- und Build-Gates ausführen.

## Open Questions

Keine. Der Rückbau und der verbleibende Detailseiten-Vertrag sind abgestimmt.
