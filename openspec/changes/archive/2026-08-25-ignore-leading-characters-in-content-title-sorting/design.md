## Context

Die paginierte Inhaltsübersicht sortiert den vollständigen autorisierten und gefilterten Trefferbestand serverseitig. Für `title` verwendet das Read-Model aktuell den kleingeschriebenen Titel mit deployment-stabiler PostgreSQL-Collation `C`. Führende Anführungszeichen und vergleichbare dekorative Zeichen beeinflussen dadurch die Reihenfolge.

## Goals / Non-Goals

- Goals: Inhaltstitel trotz führender Leer-, Satz- oder Symbolzeichen nach dem ersten lesbaren Buchstaben beziehungsweise der ersten Ziffer einordnen; globale Sortierung vor Pagination und deterministische Gleichstandsauflösung erhalten.
- Non-Goals: Titel verändern, Suchsemantik ändern, Zeichen innerhalb eines Titels entfernen, andere Textspalten umstellen oder einen sprachabhängigen Wörterbuchvergleich einführen.

## Decisions

- Decision: Der feste SQL-Sortierausdruck für `title` entfernt nur für den Vergleich den zusammenhängenden Präfix vor dem ersten Buchstaben oder der ersten Ziffer. Die Zeichenklassifikation verwendet dafür die in der eingesetzten PostgreSQL-16-Laufzeit vorhandene Standard-Collation `unicode`; anschließend gelten wie bisher Kleinschreibung, `COLLATE "C"`, die angeforderte Richtung und `content.id ASC`.
- Decision: Der gespeicherte und angezeigte Titel bleibt unverändert. Die Suche verwendet weiterhin den tatsächlichen Titel.
- Decision: Enthält ein Titel ausschließlich ignorierbare führende Zeichen, ist sein normalisierter Vergleichswert leer. Mehrere solche Titel werden stabil nach `ID asc` geordnet.
- Alternatives considered: Ein persistierter und indexierter Sortierschlüssel wurde wegen Migration und zusätzlicher Synchronisations-Ownership verworfen. Clientseitige Normalisierung wurde verworfen, weil sie nur die bereits paginierte Seite sortieren könnte.

## Risks / Trade-offs

- Der reguläre Ausdruck wird bei einer Titelsortierung pro passender Zeile ausgewertet. Das bestehende Read-Model sortiert Titel bereits über einen Ausdruck ohne nutzbaren einfachen Spaltenindex; für diesen begrenzten Scope wird deshalb keine zusätzliche Schema- oder Indexstruktur eingeführt.
- Die Zeichenklassifikation muss gerade und typografische Anführungszeichen, Leerraum und weitere führende Symbole abdecken, ohne Umlaute als entfernbaren Präfix zu behandeln. Gezielte Regressionstests sichern diese Grenze ab.

## Migration Plan

Keine Datenmigration. Die Änderung kann durch Rücknahme des festen SQL-Sortierausdrucks vollständig zurückgerollt werden.

## Open Questions

Keine. Der Scope wurde auf führende Zeichen der Inhaltstitel begrenzt.
