# Change: Detailseiten-Ladezustand von Fehler unterscheiden

## Why

Die Auflösung des Ressourcenprincipals vor dem Öffnen einer Inhalts-Detailseite ist ein erwarteter Ladezustand. Wird dieser Zustand bereits als destruktiver Fehler dargestellt, entsteht kurzzeitig eine irreführende Fehlermeldung, obwohl der Inhalt anschließend regulär geladen wird.

Die inzwischen ergänzte Motion-Sprache für Ladezustand und Startseite überzeugt gestalterisch nicht und erhöht durch Anime.js, Artwork, Sitzungszustand und Animationslogik die langfristige UI-Ownership. Sie wird vollständig zurückgebaut. Erhalten bleibt ausschließlich die fachlich richtige Trennung zwischen Laden und einem dauerhaften Fehler.

## What Changes

- Die Ressourcenprincipal-Auflösung vor Inhalts-Detailseiten behält getrennte Zustände für `loading`, `ready` und `error`.
- `loading` verwendet den bestehenden, statischen `StudioLoadingState` als höflich angekündigten Status und zeigt keinen destruktiven Alert.
- `ready` rendert den Editor unmittelbar, ohne Mindestanzeigedauer oder künstliche Verzögerung.
- `error` behält die dauerhafte destruktive Fehlermeldung und den Fail-closed-Vertrag bei.
- Anime.js, Content-Assembly-Artwork, Workbench-Szene, Startseiten-Timelines und deren Sitzungszustand werden vollständig entfernt.
- Die Startseite kehrt zu ihrer bisherigen statischen Struktur und Darstellung zurück.
- Tests sichern die drei Principal-Zustände und den unmittelbaren Übergang zum Editor ab.

## Impact

- Betroffene Specs: `content-management`
- Betroffener Code: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`, Rückbau der Motion-Erweiterungen in `apps/sva-studio-react` und `packages/studio-ui-react`
- Entfernte Dependency: `animejs` aus `@sva/studio-ui-react`
- Betroffene arc42-Abschnitte: `docs/architecture/08-cross-cutting-concepts.md`
- Keine Änderung an Principal-Auflösung, Autorisierung oder Fail-closed-Sicherheitslogik
