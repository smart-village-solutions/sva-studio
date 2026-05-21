# Design: Studio-Daten-, Formular- und Test-Foundations schärfen

## Kontext

Der bestehende Change `add-studio-data-form-and-test-foundations` setzt die richtige Richtung, ist in mehreren Punkten aber noch zu weich formuliert. Wenn das Ziel maximale Konsistenz über Host und Plugins ist, darf der Change nicht als vorsichtige Tool-Einführung beschrieben werden, sondern als verbindlicher Architekturstandard mit klaren Default-Pfaden, engen Ausnahmen und belastbarer Migrationssteuerung.

Die bestehende Formularlandschaft ist bereits breit und heterogen. Neben Host-Flows in `admin/users`, `admin/groups`, `admin/organizations`, `admin/instances`, `admin/legal-texts`, `admin/roles`, `interfaces` und `content` existieren mehrere pluginseitige Formulare, insbesondere in `packages/plugin-waste-management` und `packages/plugin-poi`. Ohne explizite Inventur, verbindliche Governance und gemeinsame Adapter droht trotz neuer Bibliotheken erneut inkonsistente Nutzung.

## Zielbild

Der Change definiert einen repo-weiten Foundation-Standard für:

- formularzentrierte UI-Workflows mit `react-hook-form` und `@hookform/resolvers`
- HTTP-nahe Frontend-Tests mit `msw`
- gezielte Property-based Tests mit `fast-check` für kritische framework-agnostische Kernlogik

Dieser Standard gilt für alle neuen oder grundlegend überarbeiteten formular- oder HTTP-testnahen Flows in Host und Plugins. Pilotbereiche begrenzen die Geltung nicht, sondern validieren den verbindlichen Standardpfad anhand realer Referenzimplementierungen.

## Verbindliche Standards

### Formulare

- Neue oder grundlegend überarbeitete Formular-Flows verwenden `react-hook-form` für Form-State und Submit-Orchestrierung.
- `zod`-basierte Validierung wird über `@hookform/resolvers` an dieselbe Formularinstanz angebunden.
- Eine zweite formularweite Eigenorchestrierung für dieselben Aufgaben ist unzulässig.
- Feldfehler, Summary-Fehler, Fokusführung und Accessibility-Metadaten müssen konsistent über gemeinsame Studio-Primitiven abgebildet werden.

### HTTP-nahe Frontend-Tests

- Neue oder grundlegend überarbeitete Frontend-Tests, die Request-, Fehler-, Lade-, Retry- oder Response-Verhalten auf HTTP-Ebene prüfen, verwenden `msw`.
- Direkte `fetch`-, Client- oder Wrapper-Stubs sind für HTTP-Verhalten unzulässig, wenn sie das beobachtbare Netzwerkverhalten nur implizit simulieren.
- `msw` ersetzt keine echten E2E- oder Infra-Läufe.

### Property-based Testing

- Für kritische framework-agnostische Kernlogik muss im Review geprüft werden, ob eine `fast-check`-Property erforderlich ist.
- Hohe Priorität haben Parser, Guards, Normalizer, Routing-/Query-Invarianten und ähnliche Module mit großem Eingaberaum oder klaren Invarianten.
- Reine Präsentations-UI ohne relevante Eingabeinvarianten fällt nicht unter diese Pflicht.

## Erlaubte Ausnahmen

Abweichungen vom Standard sind nur in eng definierten Fällen zulässig:

- rein lokale Fachlogik ohne HTTP-Bezug
- unveränderte Legacy-Flows ohne strukturelle Überarbeitung
- technisch begründete Spezialfälle mit dokumentierter Architekturbegründung

Ausnahmen sind nicht implizit zu akzeptieren. Jede Abweichung muss im Code-Review nachvollziehbar begründet werden. Für wiederkehrende Spezialfälle ist eine formale Architekturentscheidung oder zumindest eine dokumentierte Architekturbegründung erforderlich.

## Gemeinsame Integrationsbausteine

Der Change darf nicht bei der Bibliothekswahl stehenbleiben. Er muss einen verbindlichen Nutzungsweg definieren.

### Studio-Formularintegration

`packages/studio-ui-react` benötigt einen kleinen verbindlichen Integrationspfad für:

- Feldanbindung für `Input`, `Textarea`, `Select` und `Checkbox`
- konsistentes Fehlermapping auf `StudioField` und `StudioFormSummary`
- Fokusführung auf Summary und erstes fehlerhaftes Feld
- klare Regeln für `register` versus `Controller`

Ziel ist, dass Views den Standard verwenden, nicht neu erfinden.

### Gemeinsames MSW-Setup

Für `msw` wird ein gemeinsames Test-Setup benötigt mit:

- wiederverwendbaren Handler-Factories
- klaren Reset-Regeln
- dokumentierter Trennung zwischen Node- und browsernahen Testläufen
- dokumentierter Abgrenzung zu Modul-Mocks

### Definierte `fast-check`-Hotspots

`fast-check` wird über eine explizite Hotspot-Liste eingeführt, nicht als diffuse allgemeine Empfehlung. Der Change muss eine kleine Startmenge benennen, damit Review und Umsetzung nicht an Unklarheit scheitern.

## Governance und Review-Regeln

Der Standard muss im Alltag überprüfbar sein.

- Für neue oder grundlegend überarbeitete Formular-Flows ist konkurrierende formularweite Eigenorchestrierung unzulässig.
- Für neue oder grundlegend überarbeitete HTTP-nahe Frontend-Tests sind direkte Implementierungsdetail-Stubs für HTTP-Verhalten unzulässig.
- Für kritische Kernlogik braucht die Entscheidung pro oder contra `fast-check` eine kurze fachliche Begründung.
- Pilotbereiche sind Referenzimplementierungen, keine Sonderzonen.

Die Exit-Kriterien müssen nicht nur technische Lauffähigkeit prüfen, sondern auch Governance-Fragen beantworten:

- Kann ein Reviewer schnell erkennen, ob der Standard korrekt genutzt wurde?
- Gibt es dokumentierte Beispiele für erlaubte und nicht erlaubte Abweichungen?
- Sind Legacy-Ausnahmen und Migrationsentscheidungen nachvollziehbar dokumentiert?

## Vollständige Migrationsinventur

Der Change sollte eine vollständige Inventur aller vorhandenen Host- und Plugin-Formulare verlangen. Diese Inventur ist ein Pflichtartefakt und dient als Entscheidungsgrundlage für Reihenfolge, Adapterbedarf, Review-Governance und Ausnahmen.

### Mindestfelder pro Formular

Jeder Eintrag sollte mindestens enthalten:

- technischer Pfad
- fachlicher Zweck
- Host oder Plugin
- aktuelles Formularmuster
- aktuelle Validierungslogik
- aktuelle Submit- oder Mutation-Anbindung
- verwendete Studio-Primitiven
- aktueller Teststand
- erwarteter RHF-Adapterbedarf
- erwarteter `msw`-Migrationsbedarf
- Eignung für `fast-check` im zugehörigen Kernmodul
- Priorität
- Migrationsrisiko
- Legacy-Ausnahme ja oder nein mit Begründung
- Zielzustand und erwarteter Migrationsblock

### Bereits erkennbare Inventur-Bereiche

Mindestens folgende Bereiche müssen in der Inventur explizit auftauchen:

- Host: `admin/users`, `admin/groups`, `admin/organizations`, `admin/instances`, `admin/legal-texts`, `admin/roles`, `interfaces`, `content`
- Plugins: insbesondere `plugin-waste-management` mit mehreren Create-, Edit- und Dialog-Flows sowie `plugin-poi`

Die Inventur muss vollständig sein und darf sich nicht auf offensichtliche Pilotkandidaten beschränken.

## Erwartete Anpassungen am OpenSpec-Change

Der bestehende OpenSpec-Draft sollte in folgenden Punkten verschärft werden:

- von „stufenweise einführen“ zu „repo-weitem Default-Standard mit validierenden Referenzpiloten“
- klare Kennzeichnung von `verpflichtend`, `optional` und `verboten`
- explizite Ausnahmeregeln in Proposal, Design und Delta-Specs
- konkrete Startmenge für `fast-check`-Hotspots
- explizite Abgrenzung, dass Modul-Mocks für rein lokale Logik erlaubt bleiben, aber nicht für HTTP-Verhalten
- verbindliche Benennung der RHF-Integrationsprimitiven in `packages/studio-ui-react`
- Ergänzung einer vollständigen Formular-Migrationsinventur als Pflichtartefakt
- Governance- und Review-Kriterien als Teil der Exit-Kriterien

## Offene Folgearbeit

Aus diesem Design ergeben sich als nächste Schritte:

1. Den OpenSpec-Change `add-studio-data-form-and-test-foundations` in Proposal, Design, Tasks und Delta-Specs entlang dieses Zielbilds überarbeiten.
2. Die vollständige Formular-Migrationsinventur für Host und Plugins anlegen.
3. Die benötigten RHF-, `msw`- und `fast-check`-Referenzbausteine und Start-Hotspots konkret benennen.
4. Erst danach eine belastbare Implementierungsplanung für die Einführung und Migration aufsetzen.
