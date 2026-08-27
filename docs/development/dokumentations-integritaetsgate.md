# Dokumentations-Integritätsgate

`pnpm check:docs` schützt die aktuelle lokale Projekt-Wissensbasis vor struktureller Drift. Der Check läuft lokal, innerhalb von `test:ci` und als blockierender Job **Documentation Integrity** im Workflow **Repository Hygiene**.

## Gültigkeitsbereich

Geprüft werden ausschließlich die durch `config/documentation/wiki-publication-paths.txt` ausgewählten aktuellen Dateien. Historische und evidenzbezogene Bestände unter `docs/changelog/`, `docs/reports/`, `docs/pr/`, `docs/staging/`, `docs/superpowers/` und `docs/architecture/decisions/` werden nicht nachträglich auf vollständige Linkintegrität verpflichtet. `docs/user-documentation/` bleibt der getrennte Integrationsbereich der externen Anwenderdokumentation.

Der Check validiert:

- relative Datei- und Verzeichnisziele in aktueller Markdown-Dokumentation
- Erreichbarkeit jeder aktuellen Markdown-Seite ab `docs/README.md` über den zuständigen Bereichs- oder Unterindex; ein Index unter `docs/<bereich>/` darf nur Ziele desselben Bereichs klassifizieren
- Parität zwischen ADR-Dateien unter `docs/adr/` und `docs/adr/README.md`
- Ausschluss historischer, evidenzbezogener und externer Pfade aus dem Wiki-Manifest
- Wiki-Links gegen die aktuelle Publikationsmenge und den Ausschluss der Legacy-ADRs

Links auf vorhandene Scripts, Workflows oder andere technische Repository-Dateien sind zulässig. Sie machen diese Ziele nicht zu publizierter Dokumentation. Ausgeschlossene Nachweise werden bei Bedarf über absolute Repository-Links referenziert.

Jede Zeile des Publikationsmanifests ist genau ein Git-Pathspec. Leerzeilen, Kommentare und Rand-Whitespace sind verboten und werden sowohl vom Integritätsgate als auch vor der Wiki-Publikation abgewiesen.

## Lokal ausführen

```bash
pnpm check:docs
```

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

## Pflegevertrag

Neue aktuelle Seiten werden im selben PR dem zuständigen Bereichsindex zugeordnet. Neue oder umbenannte ADRs aktualisieren zusätzlich den kanonischen ADR-Index. Änderungen an Publikationsgrenzen werden gemeinsam in Manifest, Wiki-Vertragstests und diesem Gate fortgeschrieben.

Der Markdown-Baum wird mit `unified` 11, `remark-parse` 11 und `unist-util-visit` 5 verarbeitet. Die Pakete sind als MIT-lizenzierte Root-Dev-Dependencies explizit versioniert; ein eigener Markdown-Linkparser wird nicht gepflegt.
