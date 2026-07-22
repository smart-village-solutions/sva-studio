# Change: Fachplugin für FAQ auf Basis von GenericItem ergänzen

## Warum

FAQ-Inhalte benötigen im Studio eine bewusst reduzierte, fachlich verständliche Redaktionserfahrung. Das vorhandene offene Generic-Items-Plugin bleibt für freie und historische GenericItem-Typen erhalten, ist für FAQs jedoch zu umfangreich und erlaubt zu viele fachfremde Felder.

## Was sich ändert

- Ein neues `@sva/plugin-faq` folgt dem etablierten Standard-Content-Plugin-Muster von News und Events: Die FAQ sind über die gemeinsame Inhaltsübersicht auffindbar, während Fachliste sowie Erstellen- und Bearbeiten-Flächen über die registrierte FAQ-Admin-Ressource und ihre spezialisierten Bindings bereitgestellt werden.
- FAQ-Datensätze werden im Mainserver als `GenericItem` mit dem unveränderlichen Diskriminator `genericType: "FAQ"` persistiert.
- Das Fachmodell enthält ausschließlich Frage, Nur-Text-Antwort, Sprachcode, Sortiergewichtung, Sichtbarkeit und Veröffentlichungszeitpunkt. Jede Sprachfassung ist ein eigener FAQ-Datensatz; gleiche Fragen dürfen in mehreren Sprachen vorkommen.
- Die Antwort wird kanonisch als alleiniger Block in `contentBlocks: [{ body: string }]` gespeichert. Der vom FAQ-Plugin kontrollierte Payload-Vertrag ist `{ languageCode: string, sortWeight: number }`. `languageCode` ist ein normalisierter BCP-47-Tag; fehlt der historische Wert, gilt `und`. Für `sortWeight` gilt bei fehlendem Wert `0`.
- Die Fachliste kann nach Sprachcode gefiltert werden und sortiert vollständig deterministisch nach Sprachcode, aufsteigender Sortiergewichtung, Frage in der Sprache des Datensatzes und schließlich ID.
- Der Host liest für die FAQ-Liste alle Upstream-Seiten, filtert nach `genericType: "FAQ"`, sortiert die FAQ-Teilmenge und wendet erst danach die angeforderte Seiteneinteilung an. Dadurch bleiben Einträge, Gesamtzahl und Seiten korrekt, auch wenn der Mainserver keinen Typfilter anbietet.
- Der Host unterscheidet FAQ-Datensätze in der Inhaltsprojektion als `faq.faq`, damit sie nicht zusätzlich als `generic-items.generic-item` erscheinen. Das offene Generic-Items-Plugin behält alle übrigen GenericItem-Typen.
- Das Plugin erhält die autorisierbaren Actions `faq.read`, `faq.create`, `faq.update` und `faq.delete`.

## Auswirkungen

- Betroffene Spezifikationen: `content-management`, `plugin-platform`, `sva-mainserver-integration`.
- Betroffener Code: neues Workspace-Package, Plugin-Registry, Modul-IAM-Vertrag, Host-Fassade und die Mainserver-zu-Content-Projektion für GenericItems.
- Qualitätsabnahme: Der Change unterliegt den bestehenden Coverage- und Komplexitäts-Gates. Vor dem PR sind die betroffenen schnellen Gates auszuführen; `pnpm test:pr` ist das verbindliche breite PR-Gate und umfasst affected Coverage, Coverage-Gate, Complexity-Gate, Integrationstests und Frontend-Build.
- Betroffene arc42-Abschnitte: [05 Bausteinsicht](../../../docs/architecture/05-building-block-view.md), [06 Laufzeitsicht](../../../docs/architecture/06-runtime-view.md), [08 Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md) und [09 Architekturentscheidungen](../../../docs/architecture/09-architecture-decisions.md). Abschnitt 09 wird nur ergänzt, falls die Umsetzung eine neue ADR erfordert; die bestehende GenericItem-Fachplugin-Entscheidung ist der erwartete Referenzrahmen.

## Nicht im Scope

- Entfernen oder Einschränken des offenen `@sva/plugin-generic-items` außerhalb der Abgrenzung von FAQ-Datensätzen.
- Rich-Text, HTML, Medien, Kategorien, Orte, Kontakte oder weitere GenericItem-Felder im FAQ-Editor.
- Eine öffentliche FAQ-Ausspielungs-API oder Änderungen an Web-/App-Clients.
