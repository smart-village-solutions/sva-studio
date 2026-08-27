# Dokumentations-Integritätsgate

`pnpm check:docs` schützt die aktuelle lokale Projekt-Wissensbasis vor struktureller Drift. Der Check läuft lokal, innerhalb von `test:ci` und als blockierender Job **Documentation Integrity** im Workflow **Repository Hygiene**.

## Gültigkeitsbereich

Geprüft werden ausschließlich die durch `config/documentation/wiki-publication-paths.txt` ausgewählten aktuellen Dateien. Historische und evidenzbezogene Bestände unter `docs/changelog/`, `docs/reports/`, `docs/pr/`, `docs/staging/`, `docs/superpowers/` und `docs/architecture/decisions/` werden nicht nachträglich auf vollständige Linkintegrität verpflichtet. `docs/user-documentation/` bleibt der getrennte Integrationsbereich der externen Anwenderdokumentation.

Der Check validiert:

- relative Datei- und Verzeichnisziele in aktueller Markdown-Dokumentation
- Erreichbarkeit jeder aktuellen Markdown-Seite ab `docs/README.md` über den zuständigen Bereichs- oder Unterindex; ein Index unter `docs/<bereich>/` darf nur Ziele desselben Bereichs klassifizieren
- Parität zwischen ADR-Dateien unter `docs/adr/` und `docs/adr/README.md`
- Ausschluss historischer, evidenzbezogener und externer Pfade aus dem Wiki-Manifest
- deterministische, kollisionsfreie Slugs für jede publizierte Markdown-Seite
- Transformation relativer Markdown-Links auf gerenderte Wiki-Seiten einschließlich Ankern
- Home und Sidebar gegen die tatsächlich erzeugten Wiki-Seiten
- Ausschluss verschachtelter Wiki-Pfade, die GitHub auf Raw-Inhalte umleitet

Links auf vorhandene Scripts, Workflows oder andere technische Repository-Dateien sind zulässig. Sie machen diese Ziele nicht zu publizierter Dokumentation. Der Wiki-Publikationsprozess kennzeichnet solche Nicht-Markdown-Ziele als Quellartefakte und erzeugt absolute Repository-Links. Bilder werden über die Raw-Ansicht eingebettet, gelten aber nicht als Wiki-Seiten. Ausgeschlossene Nachweise werden bei Bedarf ebenfalls über absolute Repository-Links referenziert.

Jede Zeile des Publikationsmanifests ist genau ein Git-Pathspec. Leerzeilen, Kommentare und Rand-Whitespace sind verboten und werden sowohl vom Integritätsgate als auch vor der Wiki-Publikation abgewiesen.

## Lokal ausführen

```bash
pnpm check:docs
```

Eine vollständige lokale Wiki-Ausgabe kann in einem frischen temporären Verzeichnis erzeugt werden:

```bash
wiki_preview_root="$(mktemp -d /tmp/sva-wiki-preview.XXXXXX)"
pnpm exec tsx scripts/ci/build-wiki-publication.ts --output "$wiki_preview_root/wiki"
```

Der Builder überschreibt ausschließlich ein leeres Ziel oder einen vorhandenen Wiki-Git-Checkout. Andere nicht leere Verzeichnisse werden fail-closed abgelehnt.

Ein Befund verwendet das Format:

```text
pfad:zeile: grund
```

Typische Reparaturen:

| Befund                                              | Reparatur                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| relatives Linkziel fehlt                            | Pfad relativ zur Quelldatei korrigieren oder den veralteten Verweis entfernen              |
| nicht von `docs/README.md` erreichbar               | Seite im zuständigen Bereichsindex verlinken                                               |
| ADR-Datei fehlt im kanonischen Index                | ADR in `docs/adr/README.md` direkt verlinken                                               |
| ausgeschlossener Pfad wird publiziert               | Eintrag aus dem Wiki-Manifest entfernen und einen kanonischen aktuellen Einstieg verwenden |
| Wiki-Link liegt außerhalb des Publikationsmanifests | Ziel publizieren oder den Wiki-Einstieg auf eine bereits publizierte Seite umstellen       |
| Wiki-Slug-Kollision                                 | Dateipfade so benennen, dass der bereichspräfixierte flache Slug eindeutig bleibt          |
| Wiki-Link kann nicht transformiert werden           | relatives Ziel korrigieren oder einen expliziten absoluten Repository-Link verwenden       |
| Wiki-Workflow enthält verschachtelten Raw-Pfad      | ausschließlich den generierten flachen Publikationspfad verwenden                          |

## Pflegevertrag

Neue aktuelle Seiten werden im selben PR dem zuständigen Bereichsindex zugeordnet. Neue oder umbenannte ADRs aktualisieren zusätzlich den kanonischen ADR-Index. Änderungen an Publikationsgrenzen werden gemeinsam in Manifest, Wiki-Transformation, Vertragstests und diesem Gate fortgeschrieben. `docs/` bleibt die einzige redaktionelle Quelle; manuelle Wiki-Änderungen werden beim nächsten Sync ersetzt.

Der Markdown-Baum wird mit `unified` 11, `remark-parse` 11, `remark-gfm` 4, `remark-stringify` 11 und `unist-util-visit` 5 verarbeitet. Die Pakete sind als MIT-lizenzierte Root-Dev-Dependencies explizit versioniert; ein eigener Markdown-Linkparser oder -Serializer wird nicht gepflegt.
