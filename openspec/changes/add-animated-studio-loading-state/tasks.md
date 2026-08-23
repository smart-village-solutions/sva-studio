## 1. Motion-Rückbau

- [x] 1.1 Startseiten-Workbench, Home-Motion-Zustand und dekorative Baukastenmarkierungen entfernen.
- [x] 1.2 Motion-Komponenten, Artwork, Anime.js-Orchestrierung, Exporte und zugehörige Tests aus `@sva/studio-ui-react` entfernen.
- [x] 1.3 Anime.js mit pnpm aus Package-Manifest und Lockfile entfernen.

## 2. Inhalts-Detailseiten

- [x] 2.1 Getrennte Principal-Zustände `loading`, `ready` und `error` beibehalten.
- [x] 2.2 Für `loading` den bestehenden statischen `StudioLoadingState` verwenden.
- [x] 2.3 Tests für neutralen Ladezustand, unmittelbaren Erfolg und dauerhaften Fehler anpassen.

## 3. Dokumentation und Qualität

- [x] 3.1 Motion-Verträge aus Architektur-, Package- und Changelog-Dokumentation entfernen; den verbleibenden Ladevertrag dokumentieren.
- [x] 3.2 Verwaiste Motion- und Anime.js-Referenzen ausschließen.
- [x] 3.3 Relevante Unit-, Type-, Lint-, OpenSpec- und Build-Gates über Nx ausführen.
