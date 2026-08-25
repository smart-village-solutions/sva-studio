## Context

Produktive Studio-Seiten entstehen heute aus drei Quellen:

1. statische UI-Routen in der zentralen Route-Registry,
2. hostseitig aus registrierten Admin-Ressourcen abgeleitete Listen-, Anlegen-, Detail- und Verlaufsrouten,
3. freie, vom Host validierte Plugin-Routen.

Die gemeinsame Root-/App-Shell bleibt während der Navigation stabil gemountet. Sie ist damit der geeignete Owner für einen konsistenten Hilfehinweis und ein seitenübergreifendes Overlay. Das vorhandene app-lokale Markdown-Rendering für Changelog-Texte deckt nur einen begrenzten Markdown-Ausschnitt ab und ist kein geeigneter Parser für eine vollständige Anwenderdokumentation.

Die Inhalte sollen in einem separaten Repository liegen, dort auch als eigenständige statische Website funktionieren und nach einem GitHub-Pages-Deployment ohne Studio-Build sichtbar werden. Im produktiven Betrieb wird nur die neueste Studio-Version verwendet; eine Dokumentationsversionierung ist daher nicht erforderlich.

Der aktive Change `refactor-cross-cutting-runtime-guardrails` beschreibt bereits die Weiterentwicklung zu einem deklarativen, typisierten Plugin-Route-Vertrag. Die hier entworfenen Dokumentationsmetadaten sind eine additive Eigenschaft dieses Vertrags. Implementierung und Reihenfolge müssen vor Änderungen an `PluginRouteDefinition` gegen dessen aktuellen Stand abgeglichen werden; eine zweite Route-API ist ausgeschlossen.

## Goals / Non-Goals

### Goals

- Alle regulären, anwenderseitig sichtbaren Studio-Seiten besitzen einen expliziten Dokumentationsvertrag.
- Die initial benötigten Hilfeseiten werden aus den kanonischen Routenquellen ermittelt statt manuell aus UI-Dateien abgeschrieben.
- Neue Routen können den Dokumentationsvertrag nicht stillschweigend umgehen.
- Das Hilfe-Repository kann fehlende Markdown-Dateien additiv aus dem Studio-Seitenkatalog anlegen.
- Markdown-Änderungen werden nach dem unabhängigen GitHub-Pages-Deployment ohne Studio-Build sichtbar.
- Hilfe bleibt bei Netzwerk-, Inhalts- oder Konfigurationsfehlern nicht-blockierend.
- Overlay und gerenderter Inhalt erfüllen die geltenden Anforderungen an Barrierefreiheit, sichere Links und Internationalisierung.

### Non-Goals

- Release- oder Semver-basierte Dokumentationsstände.
- Automatisches Entfernen verwaister Inhalte.
- Eigene Hilfeeinträge für nicht-routbare UI-Zustände.
- Ein allgemeines Remote-Content-System oder eine konfigurierbare Remote-URL pro Route.
- Persistenter Cache, Datenbank oder redaktionelle Bearbeitung innerhalb des Studios.
- Übernahme der externen Markdown- oder Static-Site-Implementierung in das Studio-Monorepo.

## Decisions

### Decision 1: Der Dokumentationsvertrag gehört zur kanonischen Route

Jede produktive Seitenroute erhält eine diskriminierte Dokumentationsangabe:

```ts
type RouteDocumentation =
  | Readonly<{ kind: 'page'; id: DocumentationPageId }>
  | Readonly<{
      kind: 'excluded';
      reason: 'help-page' | 'technical' | 'redirect' | 'error-page';
    }>;
```

`DocumentationPageId` ist eine stabile, pfadunabhängige ID wie `admin.users.list`, `admin.users.create` oder `admin.users.detail`. Dynamische Datensatzparameter erzeugen keine eigenen IDs. Search-Parameter und Tabs verwenden die ID der zugehörigen Route.

Der framework-agnostische Metadatentyp lebt im bestehenden generischen Route-Vertrag von `@sva/plugin-sdk`, weil `@sva/routing` das SDK bereits konsumiert und freie Plugins keine gegenläufige Abhängigkeit auf das Routing-Package erhalten dürfen. `@sva/routing` darf den Typ für Host-Consumer kontrolliert re-exportieren und besitzt die Materialisierungs-, Katalog- und Match-Auflösungslogik. Es entsteht weder ein neues Package noch ein zweiter Metadatentyp.

Die Route-Materialisierung überträgt die Angabe in die TanStack-Routenmetadaten. Die Shell wertet den tiefsten aktiven Route-Match aus und zeigt nur für `kind: 'page'` einen Hilfehinweis.

Alternativen:

- Ableitung allein aus dem URL-Pfad wurde verworfen, weil dynamische Parameter, Aliasse und spätere Pfadänderungen den Dokumentationsvertrag unnötig instabil machen.
- Eine app-lokale Mapping-Tabelle wurde verworfen, weil sie eine zweite Route-Registry erzeugen und von Admin-Ressourcen sowie Plugins driften würde.

### Decision 2: Admin-Ressourcen leiten Dokumentations-IDs deterministisch ab

Für aus `AdminResourceDefinition` erzeugte Routen bildet der Host die Dokumentations-ID aus der stabilen Ressourcen-ID und dem tatsächlichen `routeKind` `list|create|detail|history`. Namespacete Plugin-Ressourcen behalten ihren Namespace. Nicht materialisierte Routen erscheinen nicht im Katalog.

Freie Plugin-Routen deklarieren ihren Dokumentationsvertrag explizit über den generischen Plugin-SDK-Vertrag. Standard-Content-Plugins benötigen dafür keine duplizierte freie Routendeklaration.

Falls der typisierte Plugin-Route-Vertrag aus `refactor-cross-cutting-runtime-guardrails` vor diesem Change umgesetzt wird, wird dessen bestehender Metadaten-Shape erweitert. Falls er noch nicht umgesetzt ist, bleibt die Dokumentationsänderung auf dem aktuellen `PluginRouteDefinition`-Vertrag begrenzt und präjudiziert keine eigene Lösung für Path-Params, Search-Params oder Component-Bindings.

### Decision 3: Ein generierter Katalog ist die Übergabe an das Hilfe-Repository

Ein Repository-Skript sammelt die tatsächlich materialisierbaren statischen, Admin-Ressourcen- und Plugin-Seiten und erzeugt deterministisch einen eingecheckten JSON-Katalog. Jeder Eintrag enthält mindestens:

- stabile Seiten-ID,
- kanonisches Route-Pattern,
- Seitentyp,
- Owner `host|plugin` und gegebenenfalls Plugin-ID,
- Lokalisierungsschlüssel für den Seitentitel, sofern verfügbar.

CI prüft, dass der Katalog aus den aktuellen Quellen reproduzierbar ist, keine doppelten IDs oder Pfade enthält und jede produktive Seitenroute entweder katalogisiert oder explizit ausgeschlossen ist.

Der Sync im separaten Hilfe-Repository liest diesen Katalog und erzeugt nur fehlende Markdown-Dateien beziehungsweise fehlende Katalogeinträge. Bestehende Dateien werden nicht überschrieben und verwaiste Dateien werden nicht gelöscht.

### Decision 4: Das Hilfe-Repository veröffentlicht Website, Manifest und Markdown gemeinsam

Das separate Repository ist fachlicher Owner der Anwendertexte. Es enthält mindestens einen Bereich für seitengebundene Inhalte sowie frei strukturierbare Anleitungen, Konzepte und FAQ.

Sein GitHub-Pages-Workflow veröffentlicht atomar:

- die eigenständige statische Dokumentationswebsite,
- ein validiertes `manifest.json`, das `DocumentationPageId` auf Markdown- und Website-Ziel abbildet,
- die vom Studio abrufbaren Markdown-Ressourcen und statischen Medien.

Es gibt ausschließlich einen aktuellen Stand. Ein `latest`-Alias, Release-Verzeichnisse oder eine Studio-Versionsauflösung werden nicht eingeführt.

### Decision 5: Das Studio lädt Hilfe über eine same-origin Server-Fassade

Der Browser ruft keine beliebigen externen URLs auf. Eine app-seitige Server-Fassade akzeptiert ausschließlich eine bekannte `DocumentationPageId`, lädt Manifest und Markdown von genau der serverseitig konfigurierten HTTPS-Basis-URL und liefert einen begrenzten, validierten Response an den Browser.

Der Vertrag umfasst:

- festen Upstream-Origin aus Runtime-Konfiguration,
- URL-Auflösung ausschließlich relativ zu diesem Origin,
- Request-Timeout und maximale Antwortgröße,
- Schema- und Content-Type-Prüfung für Manifest und Markdown,
- keine Weitergabe von Cookies, Authorization-Headern, Tenant-, Benutzer- oder Datensatzdaten,
- strukturierte, PII-freie Server-Logs über den Server-Runtime-Logger,
- Nutzung normaler HTTP-Cache-Header und bedingter Requests ohne eigene persistente Cache-Schicht.

Die Fassade liefert mindestens Seiten-ID, Markdown-Inhalt und kanonische Website-URL. Unbekannte IDs, fehlende Manifest-Einträge, ungültige Upstream-Ziele, Timeouts und zu große Antworten werden als begrenzte Fehlercodes abgebildet.

Eine direkte Browser-Abfrage wurde verworfen, weil sie CORS, externe Origins und Sicherheitsvalidierung in jeden Client verlagern würde.

### Decision 6: Markdown wird mit einem etablierten Renderer ohne Raw HTML dargestellt

Die Implementierung verwendet einen etablierten React-Markdown-Renderer nach Dependency-, Lizenz- und SBOM-Prüfung statt den vorhandenen Changelog-Miniparser zu einer eigenen Markdown-Engine auszubauen.

Raw HTML und Skriptausführung bleiben deaktiviert. Links und Medien werden auf erlaubte Protokolle und den Dokumentations-Origin begrenzt beziehungsweise sicher als externe Ziele geöffnet. Relative Ressourcen werden nur gegen die validierte Dokumentationsbasis aufgelöst.

### Decision 7: Die Shell besitzt Hinweis und Overlay

Die app-lokale Shell rendert für die aktive dokumentierbare Route ein konsistentes Hinweisfeld „Hilfe zu dieser Seite“. Das UI ist keine allgemeine Plugin-Komponente und benötigt keine neue Registry in `@sva/studio-ui-react`; es verwendet vorhandene shadcn-/Studio-Primitives.

Das Overlay verhält sich als breites, scrollbareres Sheet beziehungsweise auf kleinen Viewports als nahezu vollflächige Ebene. Es besitzt:

- sichtbaren Titel und Schließen-Aktion,
- Fokusfalle, Escape-Unterstützung und Fokusrückgabe,
- Lade-, Fehler-, Leer- und Retry-Zustand,
- Link zur vollständigen statischen Dokumentationsseite,
- semantische Überschriften, Listen, Links, Tabellen und Codeblöcke.

Ein Hilfefehler darf Navigation, Routeninhalt oder fachliche Mutationen nicht blockieren. Der Inhalt wird erst beim Öffnen geladen.

### Decision 8: Ein Studio-Merge erzeugt unmittelbar einen additiven Dokumentations-PR

Ein Studio-Workflow reagiert auf Pushes nach `main`, bei denen sich der eingecheckte Seitenkatalog geändert hat. Er sendet ein authentifiziertes `repository_dispatch` mit dem exakten Studio-Commit-SHA an `smart-village-solutions/sva-studio-user-documentation`. Das normale `GITHUB_TOKEN` des Studio-Repositories kann keine Workflows in einem anderen Repository auslösen; deshalb wird ein eigenes, auf das Ziel-Repository und den Dispatch begrenztes Fine-grained Token als Studio-Secret `DOCUMENTATION_REPOSITORY_DISPATCH_TOKEN` verwendet. Bestehende breit berechtigte Tokens werden dafür nicht wiederverwendet.

Der Workflow im Hilfe-Repository:

1. lädt den Seitenkatalog unveränderlich vom übergebenen Studio-Commit,
2. validiert den Katalog und führt den additiven Sync aus,
3. erzeugt für jede unbekannte Seiten-ID eine deutschsprachige TODO-Seite mit stabiler ID, Seitentyp und Bearbeitungshinweisen,
4. überschreibt keine vorhandene Markdown-Datei und löscht keine verwaiste Datei,
5. validiert den vollständigen Dokumentationsstand,
6. aktualisiert genau einen Automationsbranch und eröffnet oder aktualisiert genau einen Dokumentations-PR.

Der Automations-PR wird nicht automatisch gemergt. Unfertige Platzhalter erscheinen deshalb weder im Pages-Manifest noch im Studio-Overlay. Weitere Studio-Merges aktualisieren denselben PR aus dem jeweils neuesten `main`-Katalog. Enthält der Sync keine Änderung, wird weder Commit noch PR erzeugt.

Ein direkter Commit auf `main` des Hilfe-Repositories wurde verworfen, weil er leere beziehungsweise redaktionell ungeprüfte Hilfeseiten sofort veröffentlichen würde. Ein Zeitplan wurde verworfen, weil die Synchronisation unmittelbar und nachvollziehbar an den Studio-Merge gekoppelt sein soll.

## Data Flow

1. Die Route-Registry materialisiert eine Route mit stabiler Dokumentations-ID.
2. TanStack Router stellt die Metadaten des tiefsten aktiven Matches bereit.
3. Die Shell zeigt den kontextbezogenen Hilfehinweis.
4. Der Benutzer öffnet das Overlay; der Browser fragt die same-origin Hilfe-Fassade mit der Seiten-ID an.
5. Die Fassade validiert die ID, lädt das aktuelle Manifest und anschließend ausschließlich dessen erlaubtes Markdown-Ziel.
6. Der Browser rendert das validierte Markdown ohne Raw HTML und bietet zusätzlich den kanonischen GitHub-Pages-Link an.
7. Nach einem neuen Pages-Deployment liefert derselbe Ablauf den aktualisierten Inhalt, ohne dass das Studio neu gebaut wird.

Separater Delivery-Ablauf für neue Seiten:

1. Ein Studio-PR ergänzt eine dokumentierbare Route und den reproduzierbaren Seitenkatalog.
2. Der Merge erzeugt einen Push des geänderten Katalogs auf `sva-studio/main`.
3. Der Studio-Workflow sendet den Ziel-Dispatch mit dem exakten Merge-SHA.
4. Das Hilfe-Repository synchronisiert den Katalog additiv und eröffnet oder aktualisiert den Automations-PR.
5. Redaktionelle Prüfung und Merge des Doku-PR lösen den vorhandenen Pages-Workflow aus.
6. Das Studio liest die neue Seite anschließend zur Laufzeit; ein Studio-Build wird durch den Doku-PR nicht ausgelöst.

## Errors and Degraded Behavior

- Fehlende Runtime-Konfiguration: Der Hilfehinweis bleibt sichtbar, das Overlay erklärt die vorübergehende Nichtverfügbarkeit und bietet Retry an.
- Unbekannte oder nicht dokumentierte ID: begrenzter Not-found-Zustand ohne Offenlegung interner Pfade.
- Upstream-Timeout oder GitHub-Pages-Ausfall: nicht-blockierender Fehlerzustand; keine Endlosschleife und kein automatischer aggressiver Retry.
- Ungültiges Manifest oder unsicheres Ziel: fail-closed, strukturiertes Warn-/Fehlerereignis und kein Rendering des Inhalts.
- Ungültiges Markdown oder Renderingfehler: kontrollierter Overlay-Fehler; die Studio-Seite bleibt bedienbar.

## Security and Privacy

- Die Remote-Basis-URL ist serverseitig konfiguriert und nicht durch Route, Search-Parameter oder Markdown steuerbar.
- Der Server folgt Weiterleitungen nur, wenn das Ziel weiterhin exakt zum erlaubten Origin gehört, oder lehnt Weiterleitungen vollständig ab.
- Markdown erhält keinen Zugriff auf Cookies, Tokens oder Studio-Kontext.
- Der Request transportiert nur die abstrakte Seiten-ID; konkrete Entitäts-IDs und Search-Parameter werden nicht übermittelt.
- Raw HTML, JavaScript-URLs, eingebettete Skripte und nicht erlaubte Protokolle werden nicht ausgeführt.
- Logs enthalten Seiten-ID, begrenzten Fehlercode, Status und Dauer, aber keine Markdown-Inhalte oder Benutzerdaten.
- Das Dispatch-Credential ist als separates Fine-grained Token ausschließlich für das Hilfe-Repository berechtigt und wird nur als maskiertes GitHub-Secret verwendet; weder Katalog noch PR enthalten Credentials.

## Accessibility and Internationalization

- Alle sichtbaren Studio-Texte verwenden i18n-Schlüssel.
- Hinweisfeld und Overlay erfüllen WCAG-2.1-AA-Anforderungen für Tastatur, Fokus, Namen, Rollen, Kontrast und Statusankündigungen.
- Markdown-Überschriften beginnen innerhalb des Overlays unterhalb des Dialogtitels in einer semantisch konsistenten Hierarchie.
- Das Initialziel ist deutschsprachige Anwenderdokumentation. Die stabile Seiten-ID bleibt sprachneutral und verhindert eine spätere Kopplung von Routing und Dateinamen an sichtbare Texte.

## Delivery Slices

1. **Studio-Vertrag und Baseline-Katalog:** Dokumentationsmetadaten, Ableitung, vollständige initiale Liste und CI-Driftprüfung.
2. **Separates Hilfe-Repository:** additive Synchronisation, initiale Markdown-Seiten, statische Website, Manifest und GitHub Pages.
3. **Studio-Laufzeitintegration:** sichere Server-Fassade, Shell-Hinweis, Overlay und Markdown-Rendering.
4. **Abnahme und Dokumentation:** Cross-Repository-Vertrag, Accessibility, Fehlerfälle, arc42 und End-to-End-Nachweis.
5. **Merge-getriebene Erweiterung:** sicherer Cross-Repository-Dispatch, generische TODO-Vorlage und automatisch aktualisierter Dokumentations-PR.

Der erste Slice ist eigenständig lieferbar und verändert noch nicht das sichtbare Studio-Verhalten. Der zweite Slice kann unabhängig veröffentlicht werden. Der dritte Slice wird erst aktiviert, wenn das veröffentlichte Manifest und die initialen Markdown-Seiten erreichbar sind.

## Migration Plan

1. Alle aktuellen produktiven Seitenrouten klassifizieren und technische beziehungsweise Hilfe-Routen explizit ausschließen.
2. Den Baseline-Katalog generieren und auf Duplikate sowie tatsächlich materialisierte Routen prüfen.
3. Das separate Hilfe-Repository initialisieren und für jede Katalog-ID mindestens eine valide Markdown-Seite veröffentlichen.
4. Manifest und Website-URLs aus Staging beziehungsweise einer kontrollierten Preview prüfen.
5. Studio-Fassade und Overlay mit deaktiviertem beziehungsweise fehlendem Upstream sicher ausliefern.
6. Die konfigurierte Dokumentationsbasis zunächst in Dev, dann Staging und schließlich über den kanonischen Promote-Pfad in Production aktivieren.

Rollback erfolgt durch Entfernen beziehungsweise Deaktivieren der Runtime-Konfiguration oder durch Zurückrollen des Studio-Images. Die fachlichen Studio-Seiten bleiben unabhängig von der Hilfe funktionsfähig. Bereits veröffentlichte Dokumentationsseiten bleiben als eigenständige Website erreichbar.

## Risks / Trade-offs

- **Cross-Repository-Drift:** Der Studio-Katalog und der additive Sync reduzieren Drift; eine neue Studio-Seite kann dennoch vor ihrem Hilfetext veröffentlicht werden. Der Delivery-Prozess muss deshalb den zugehörigen Hilfe-Repository-PR als Abnahmeevidenz führen.
- **Cross-Repository-Credential:** Der unmittelbare Dispatch benötigt ein zusätzliches Secret. Ein eigenständiges Fine-grained Token mit minimalem Zielumfang begrenzt die Auswirkung; ein fehlendes oder abgelaufenes Token macht den Post-Merge-Workflow sichtbar rot, verändert aber weder Studio- noch Dokumentationsinhalte.
- **Externe Laufzeitabhängigkeit:** Hilfe kann bei GitHub-Pages-Ausfall fehlen. Die fachliche Anwendung bleibt bewusst unabhängig und zeigt einen begrenzten Fehlerzustand.
- **Remote-Content-Risiko:** Strikte Origin-, Größen-, Schema-, Protokoll- und Markdown-Regeln begrenzen die Angriffsfläche.
- **Katalog als generiertes Artefakt:** Der zusätzliche Drift-Check erzeugt geringe CI-Ownership, ersetzt aber eine fehleranfällige manuelle Seitenliste.
- **Nur aktueller Stand:** Die Dokumentation kann ältere, noch lokal laufende Entwicklerstände nicht korrekt beschreiben. Das ist akzeptiert, weil produktiv ausschließlich die neueste Version betrieben wird.

## Open Questions

Keine. Repository, Pages-Domain, Merge-Zeitpunkt und PR-basierter Review-Vertrag sind festgelegt.
