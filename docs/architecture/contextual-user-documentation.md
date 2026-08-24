# Kontextbezogene Anwenderdokumentation

## Zweck und Systemgrenze

Das SVA Studio ordnet jeder regulären produktiven Seitenroute eine stabile Dokumentations-ID zu.
Hilfeseiten und technische Routen sind explizit ausgeschlossen. Die Anwendertexte selbst gehören
nicht zum Studio-Monorepo, sondern werden aus einem eigenständigen GitHub-Pages-Repository
veröffentlicht. Dadurch werden Textänderungen ohne neuen Studio-Build sichtbar.

## Bausteine

1. `@sva/plugin-sdk` definiert den framework-agnostischen Dokumentationsvertrag für freie
   Plugin-Routen.
2. `@sva/routing` materialisiert die Metadaten für statische Routen, Admin-Ressourcen und Plugins
   und erzeugt den deterministischen Seitenkatalog.
3. Die Studio-Server-Fassade `/api/studio/documentation/:pageId` lädt ausschließlich bekannte IDs
   von der mit `SVA_DOCUMENTATION_BASE_URL` fest konfigurierten HTTPS-Basis.
4. Die App-Shell löst den tiefsten aktiven Route-Match auf und lädt Markdown erst beim Öffnen des
   Overlays.
5. Das Hilfe-Repository veröffentlicht Website, `manifest.json` und Roh-Markdown atomar.
6. Ein katalogbegrenzter Studio-Workflow sendet nach einem Merge auf `main` den exakten
   Studio-SHA an das Hilfe-Repository; dort erzeugt ein additiver Workflow einen redaktionell zu
   prüfenden Dokumentations-PR.

## Sicherheitsgrenzen

- Der Browser kontaktiert nur die Same-Origin-Fassade des Studios.
- Die Fassade überträgt keine Cookies, Autorisierungsheader oder Benutzer-, Mandanten- und
  Datensatzdaten an GitHub Pages.
- Manifest und Markdown werden nach Origin, Basispfad, Content-Type, Größe und Timeout geprüft.
- Weiterleitungen werden nicht verfolgt; Remote-Ziele außerhalb der konfigurierten Basis werden
  abgelehnt.
- Raw HTML bleibt beim Markdown-Rendering deaktiviert. Bilder müssen vom Dokumentations-Origin
  stammen, Links verwenden ausschließlich sichere Protokolle.
- Der Cross-Repository-Dispatch verwendet ein separates Fine-grained Token mit Zugriff nur auf das
  öffentliche Hilfe-Repository. Push und PR-Erstellung erfolgen anschließend ausschließlich mit
  dem repository-lokalen `GITHUB_TOKEN` des Hilfe-Repositories.

## Betrieb

Ohne `SVA_DOCUMENTATION_BASE_URL` bleibt das Studio fachlich vollständig nutzbar. Das Overlay zeigt
einen begrenzten Fehlerzustand mit Retry. Nach Veröffentlichung des Hilfe-Repositories wird die
Basis-URL über den bestehenden Build-/Promote-Pfad je Umgebung gesetzt; es entsteht kein zweiter
Deploymentpfad für das Studio.

Neue Studio-Seiten werden nach dem Merge nicht sofort als unfertige Hilfe veröffentlicht. Der
automatisch aktualisierte Dokumentations-PR enthält klar markierte TODO-Seiten; erst sein geprüfter
Merge startet das unabhängige GitHub-Pages-Deployment.
