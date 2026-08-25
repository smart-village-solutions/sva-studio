# Seitenkatalog der Anwenderdokumentation

`page-catalog.json` ist der maschinenlesbare Übergabevertrag vom SVA Studio zum
eigenständigen Repository der Anwenderdokumentation. Der Katalog wird aus den
kanonischen statischen Routen, Admin-Ressourcen und aktivierten Plugin-Routen erzeugt.

## Katalog aktualisieren

Nach dem Ergänzen oder Ändern einer produktiven Route wird der Katalog erzeugt mit:

```bash
pnpm nx run sva-studio-react:documentation-catalog
```

Der CI-Driftcheck verwendet:

```bash
pnpm nx run sva-studio-react:check:documentation-catalog
```

Das Hilfe-Repository liest diesen Katalog additiv ein: Es legt ausschließlich fehlende
Markdown-Dateien an. Bestehende Inhalte werden weder überschrieben noch gelöscht.

## Automatisierung nach dem Merge

Ändert ein Push beziehungsweise Merge nach `main` den Katalog, startet
`.github/workflows/sync-user-documentation.yml` unmittelbar den Workflow
`Studio-Seitenkatalog synchronisieren` im Repository
`smart-village-solutions/sva-studio-user-documentation`. Der Dispatch übergibt den exakten
Studio-Commit-SHA; das Hilfe-Repository lädt den Katalog unveränderlich von diesem Stand.

Der Hilfe-Workflow erzeugt für neue IDs deutschsprachige, mit `status: draft` und `TODO`
gekennzeichnete Markdown-Seiten. Er aktualisiert den stabilen Branch
`automation/sync-studio-page-catalog` und eröffnet beziehungsweise aktualisiert genau einen Pull
Request. Vorhandene Seiten werden nicht überschrieben, verwaiste Seiten nicht gelöscht. Erst der
redaktionell geprüfte Merge dieses Pull Requests veröffentlicht die neue Seite über GitHub Pages.

Der Studio-Workflow benötigt das Repository-Secret
`DOCUMENTATION_REPOSITORY_DISPATCH_TOKEN`. Es enthält ein Fine-grained Personal Access Token mit
folgenden Grenzen:

- Repository-Zugriff ausschließlich auf `smart-village-solutions/sva-studio-user-documentation`
- Repository-Permission `Contents: Read and write`, die GitHub für `repository_dispatch` verlangt
- kein Zugriff auf andere Organisationen oder Studio-Secrets

Das Token wird nicht für Checkout, Push oder PR-Erstellung verwendet. Diese Schritte führt der
Doku-Workflow mit seinem repository-lokalen `GITHUB_TOKEN` und den expliziten Permissions
`contents: write` sowie `pull-requests: write` aus. Im Doku-Repository muss die Einstellung
„Allow GitHub Actions to create and approve pull requests“ aktiviert sein.

## Neue Studio-Seite ergänzen

1. Für eine reguläre Seite eine stabile, pfadunabhängige ID wie `admin.users.detail` wählen. IDs
   enthalten keine sichtbaren Titel, Datensatz-IDs, Tabs oder Search-Parameter.
2. Statische und freie Plugin-Routen deklarieren `kind: 'page'`; Admin-Ressourcen leiten die ID
   automatisch aus Ressourcen-ID und `list|create|detail|history` ab.
3. Nur technische, Redirect-, Fehler- oder Hilferouten mit `kind: 'excluded'` und einem passenden
   Grund ausschließen.
4. Den Katalog erzeugen und den Driftcheck ausführen.
5. Nach dem Merge den automatisch erzeugten beziehungsweise aktualisierten Pull Request im
   Hilfe-Repository prüfen. Für einen lokalen Vorabtest kann der additive Sync weiterhin manuell
   gestartet werden:

   ```bash
   npm run catalog:sync -- /pfad/zum/sva-studio/docs/user-documentation/page-catalog.json
   ```

6. Die neue TODO-Markdown-Seite redaktionell vervollständigen und dort `npm run build` ausführen.
7. Im Delivery-Nachweis sowohl den Studio-Katalog als auch den zugehörigen Hilfe-Repository-Stand
   und die veröffentlichte Manifest-/Markdown-URL festhalten.
