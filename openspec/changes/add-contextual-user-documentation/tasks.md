## 1. Route-owned Dokumentationsvertrag

- [x] 1.0 Vor der Implementierung den aktuellen Stand von `refactor-cross-cutting-runtime-guardrails` und `refactor-sva-studio-react-package-boundaries` gegen Code, Branches und OpenSpec prüfen; vorhandene typisierte Plugin-Routen- beziehungsweise App-Ownership-Verträge additiv erweitern und keine parallele Route-API einführen.
- [x] 1.1 Einen framework-agnostischen, diskriminierten Metadatenvertrag für dokumentierte und explizit ausgeschlossene Seiten im bestehenden generischen Route-Vertrag von `@sva/plugin-sdk` modellieren und für Host-Consumer kontrolliert über `@sva/routing` verfügbar machen; stabile Seiten-IDs dürfen keine sichtbaren Titel, konkreten Datensatz-IDs oder Search-Parameter enthalten und es darf keine gegenläufige Package-Abhängigkeit entstehen.
- [x] 1.2 Alle statischen produktiven UI-Routen klassifizieren und Hilfe-, Support-, Lizenz-, technische Auth-, Debug-, Redirect-, Fehler- und Not-found-Routen mit begründetem Ausschluss versehen.
- [x] 1.3 Für tatsächlich materialisierte Admin-Ressourcenrouten die Dokumentations-IDs aus stabiler Ressourcen-ID und `list|create|detail|history` ableiten, ohne nicht exponierte Listenrouten zu erfinden.
- [x] 1.4 Den generischen `PluginRouteDefinition`- und Guardrail-Vertrag um Dokumentationsmetadaten erweitern; Standard-Content-Plugins verwenden die hostseitige Admin-Ressourcen-Ableitung statt doppelter freier Metadaten.
- [x] 1.5 Dokumentationsmetadaten als TanStack-Routenmetadaten materialisieren und den tiefsten aktiven dokumentierbaren Route-Match typsicher auflösbar machen.
- [x] 1.6 Unit- und Vertragstests für Vollständigkeit, Ausschlüsse, Eindeutigkeit, Admin-Ableitung, freie Plugin-Routen und tiefste Route ergänzen.

## 2. Initialer und erweiterbarer Seitenkatalog

- [x] 2.1 Einen deterministischen Katalog-Collector für statische, Admin-Ressourcen- und freie Plugin-Routen implementieren, der nur tatsächlich produktiv materialisierte Seiten ausgibt.
- [x] 2.2 Ein Repository-Skript und einen passenden Nx-/pnpm-Targetpfad zum Erzeugen beziehungsweise Prüfen des JSON-Katalogs bereitstellen.
- [x] 2.3 Den vollständigen Baseline-Katalog aller aktuellen Studio-Seiten erzeugen und fachlich prüfen; dynamische IDs, Search-Varianten, Tabs, Aliasse und ausgeschlossene technische Routen dürfen keine zusätzlichen Hilfeseiten erzeugen.
- [x] 2.4 Einen CI-Driftcheck ergänzen, der fehlende Klassifizierungen, doppelte Seiten-IDs, doppelte kanonische Pfade und einen nicht reproduzierbaren eingecheckten Katalog blockiert.
- [x] 2.5 Den Katalogpfad und den additiven Übergabeprozess für das separate Hilfe-Repository in deutscher Entwicklerdokumentation beschreiben.

## 3. Separates Anwenderdokumentations-Repository

- [x] 3.1 Repository-Name, öffentliche GitHub-Pages-Domain und Ownership festlegen und das eigenständige Repository mit Markdown-Content-Struktur initialisieren.
- [x] 3.2 Einen additiven Sync-Befehl implementieren, der den Studio-Katalog einliest, ausschließlich fehlende Markdown-Dateien anlegt, bestehende Inhalte nicht überschreibt und keine Dateien löscht.
- [x] 3.3 Für jede Baseline-Seiten-ID mindestens eine valide deutschsprachige Markdown-Seite mit verständlichem Titel, Zweck, zentralen Arbeitsschritten und weiterführenden Links anlegen.
- [x] 3.4 Validierung für eindeutige Seiten-IDs, Pflicht-Metadaten, interne Links, erlaubte Medienziele und Katalogabdeckung ergänzen; verwaiste Markdown-Dateien bleiben zulässig.
- [x] 3.5 Eine eigenständige statische Website mit Navigation, Suche und zusätzlichen Bereichen für Anleitungen, Konzepte und FAQ bauen.
- [x] 3.6 Beim Static-Site-Build atomar ein validiertes `manifest.json`, die abrufbaren Markdown-Ressourcen und die Website-Ausgabe erzeugen.
- [x] 3.7 GitHub Pages per CI veröffentlichen und nachweisen, dass Markdown-Änderungen ohne Studio-Build im Manifest, in der Website und am Abrufpfad sichtbar werden.

## 4. Sichere Studio-Laufzeitfassade

- [x] 4.1 Eine serverseitige Runtime-Konfiguration für genau eine erlaubte HTTPS-Dokumentationsbasis mit fail-closed Validierung ergänzen und in den bestehenden Konfigurations-/Deploymentpfad aufnehmen.
- [x] 4.2 Eine same-origin Hilfe-Fassade implementieren, die nur bekannte Seiten-IDs akzeptiert und Manifest sowie Markdown mit Timeout, Größenlimit, Content-Type-/Schema-Prüfung und sicherer Redirect-Regel lädt.
- [x] 4.3 Sicherstellen, dass keine Studio-Cookies, Authorization-Header, Tenant-, Benutzer-, Datensatz- oder Search-Param-Daten an das Hilfe-Repository übertragen werden.
- [x] 4.4 Begrenzte Fehlercodes für fehlende Konfiguration, unbekannte ID, fehlenden Manifest-Eintrag, ungültiges Ziel, Timeout, zu große Antwort und ungültigen Inhalt definieren.
- [x] 4.5 Strukturierte PII-freie Diagnoseereignisse über den Server-Runtime-Logger ergänzen; Markdown-Inhalte und vollständige externe URLs dürfen nicht geloggt werden.
- [x] 4.6 Unit- und Server-Integrationstests für Erfolgsfall, Origin-Begrenzung, Redirects, Header-Weitergabe, Timeout, Größenlimit, Schemafehler und Upstream-Ausfall ergänzen.
- [x] 4.7 Für Änderungen an `packages/routing`, `packages/plugin-sdk` und serverseitigen App-Pfaden früh `pnpm check:server-runtime` sowie die passenden Type-Gates ausführen.

## 5. Kontextueller Hilfehinweis und Markdown-Overlay

- [x] 5.1 In der app-lokalen Shell ein einheitliches, i18n-fähiges Hinweisfeld für den tiefsten aktiven dokumentierbaren Route-Match integrieren; ausgeschlossene Routen zeigen kein Hinweisfeld.
- [x] 5.2 Ein responsives, barrierefreies Sheet-/Overlay mit Titel, Schließen, Fokusfalle, Escape-Unterstützung, Fokusrückgabe, internem Scrollbereich und Link zur vollständigen Dokumentationsseite umsetzen.
- [x] 5.3 Inhalt erst beim Öffnen laden und explizite Lade-, Leer-, Fehler- und Retry-Zustände bereitstellen, ohne Route oder Fachfunktion zu blockieren.
- [x] 5.4 Einen etablierten React-Markdown-Renderer nach Dependency-, Lizenz- und SBOM-Prüfung verwenden; Raw HTML und Skriptausführung bleiben deaktiviert, Links und Medien werden protokoll- und originbegrenzt behandelt.
- [x] 5.5 Semantische Markdown-Komponenten für Überschriften, Absätze, Listen, Tabellen, Links und Codeblöcke mit Studio-Tokens statt Inline-Styles gestalten.
- [x] 5.6 Unit-, Komponenten- und Accessibility-Tests für Route-Wechsel, Overlay-Lifecycle, Fokus, Tastatur, responsive Darstellung, sichere Links, Ladefehler und Retry ergänzen.

## 6. Architektur-, Betriebs- und Delivery-Dokumentation

- [x] 6.1 `docs/architecture/04-solution-strategy.md` um den route-owned Dokumentationsvertrag und die unabhängig veröffentlichte Anwenderdokumentation ergänzen.
- [x] 6.2 `docs/architecture/05-building-block-view.md` um Katalog-Collector, Hilfe-Fassade, Shell-Hinweis, Overlay und die Grenze zum separaten Repository ergänzen.
- [x] 6.3 `docs/architecture/06-runtime-view.md` um den Ablauf Route-Match → Seiten-ID → same-origin Fassade → Manifest → Markdown → Overlay einschließlich Fehlerpfaden ergänzen.
- [x] 6.4 `docs/architecture/07-deployment-view.md` um GitHub Pages, Runtime-Konfiguration, unabhängige Veröffentlichung und Ausfallverhalten ergänzen.
- [x] 6.5 `docs/architecture/08-cross-cutting-concepts.md` um Remote-Content-Sicherheit, Datenschutz, Accessibility, i18n und HTTP-Caching ergänzen.
- [x] 6.6 Eine deutsche Entwickleranleitung für neue Studio-Seiten erstellen: Dokumentations-ID wählen, Ausschluss begründen, Katalog aktualisieren, additive Hilfeseite erzeugen und Cross-Repository-Evidenz prüfen.
- [x] 6.7 Nach Eröffnung des Studio-PR den Changelog-Eintrag mit dessen tatsächlicher Nummer unter `docs/changelog/entries/` ergänzen.

## 7. Integrierte Abnahme

- [x] 7.1 Einen E2E-Pfad für mindestens eine statische Seite, eine Admin-Ressourcen-Detailseite und eine freie Plugin-Seite ergänzen; jeweils Hilfe öffnen, passenden Inhalt prüfen und zur Studio-Seite zurückkehren.
- [x] 7.2 E2E-/Integrationsevidenz für fehlende Dokumentationskonfiguration und nicht erreichbares GitHub Pages erbringen; die fachliche Seite muss vollständig bedienbar bleiben.
- [x] 7.3 Nachweisen, dass eine reine Markdown-Änderung im separaten Repository nach dessen Pages-Deployment ohne Studio-Build im Overlay sichtbar ist.
- [x] 7.4 Vor breiten lokalen Runs den affected Scope messen und anschließend die kleinsten relevanten Unit-, Type-, ESLint-, Server-Runtime- und E2E-Gates gemäß `AGENTS.md` ausführen.
- [ ] 7.5 Vor dem initialen Implementierungs-PR nach Möglichkeit `pnpm test:pr`, `pnpm check:file-placement`, `pnpm check:studio-changelog` und `openspec validate add-contextual-user-documentation --strict` ausführen.
- [ ] 7.6 Die Aktivierung über Dev und Staging prüfen; ein Production-Rollout erfolgt ausschließlich über `Build` → Dev → Staging → Production mit demselben unveränderlichen Image-Digest.

### Veröffentlichungsevidenz

- Repository: `https://github.com/smart-village-solutions/sva-studio-user-documentation`
- GitHub Pages: `https://smart-village-solutions.github.io/sva-studio-user-documentation/`
- Initiale Veröffentlichung: Commit `c2ada508b4077e182f0f5dc21d0fdb066d53cc25`, Pages-Lauf `32772358708`
- Reiner Markdown-Nachweis: Commit `26ca778b1ba6be86d4a0e99d98f385387808e784`, Pages-Lauf `32772480918`
- Live geprüft: Startseite, `manifest.json` mit 43 Seiten und `markdown/home.overview.md` liefern HTTP 200; die Studio-Laufzeitfassade liest die ausschließlich im Doku-Repository ergänzte Passage mit unverändertem Studio-Artefakt.

## 8. Merge-getriebene additive Synchronisation

- [x] 8.1 Das Seitentemplate im Hilfe-Repository so erweitern, dass jede neue valide Katalog-ID ohne manuelle Titel-Mapping-Änderung eine deutschsprachige TODO-Seite mit Pflichtmetadaten und Bearbeitungshinweisen erhält.
- [x] 8.2 Im Hilfe-Repository einen `repository_dispatch`-Workflow ergänzen, der den Katalog vom exakten Studio-Commit lädt, additiv synchronisiert, validiert und bei Änderungen genau einen Automationsbranch sowie einen offenen PR erzeugt beziehungsweise aktualisiert.
- [x] 8.3 Im Studio einen auf Änderungen an `docs/user-documentation/page-catalog.json` begrenzten `main`-Workflow ergänzen, der den Ziel-Dispatch mit Merge-SHA sendet und bei fehlendem beziehungsweise abgelehntem Credential sichtbar fehlschlägt.
- [x] 8.4 Den Least-Privilege-Vertrag für `DOCUMENTATION_REPOSITORY_DISPATCH_TOKEN`, die erforderlichen Workflow-Permissions und die Aktivierung von GitHub-Actions-PR-Erstellung dokumentieren und konfigurieren.
- [x] 8.5 Den additiven Sync mit unbekannter ID, unveränderten vorhandenen Dateien, wiederholtem Lauf und No-change-Fall testen; Workflow-Syntax und OpenSpec strict validieren.
- [ ] 8.6 Den Cross-Repository-Ablauf mit einem kontrollierten Dispatch prüfen und nach dem ersten echten Studio-Merge den automatisch erzeugten beziehungsweise aktualisierten Doku-PR als Live-Evidenz ergänzen.
