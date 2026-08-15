## Context

Die Instanz-Registry persistiert Create- und Update-Eingaben über feste SQL-Parameterpositionen. Zwei Secret-Paare verwenden zusätzliche Keep-Flags, bei denen `undefined`, `false`, `null` zur Laufzeit und ein Ciphertext unterschiedliche bestehende Bedeutungen haben.

## Goals / Non-Goals

- Goals: Positionsverträge explizit charakterisieren, pure Wertsegmente benennen und CRAP der beiden Mapper senken.
- Non-Goals: SQL, Schema, Repository-Contract, Secret-Defaults, Hostname-Upsert oder Fehlerannotation verändern.

## Decisions

- Die öffentliche Repository-Fassade bleibt der Characterization-Einstieg; interne Mapper werden nicht exportiert.
- Die finalen Arrays werden weiterhin explizit und in derselben SQL-Reihenfolge zusammengesetzt.
- Secret-Erhalt wird durch einen kleinen puren Segment-Mapper aus Keep-Flag und Runtime-Ciphertext ausgedrückt.
- Objekt-Reflection, Querybuilder, `any` und neue Abhängigkeiten bleiben ausgeschlossen.

## Risks / Trade-offs

- Eine vertauschte Position könnte falsche oder vertrauliche Daten in eine andere Spalte schreiben. Exakte 20-/21-Werte-Assertions und beide Secret-Matrizen verhindern dies.
- Stärker benannte Segmente erhöhen geringfügig die Zahl interner Typen und Funktionen, senken aber die Verzweigungskomplexität der SQL-Mapper.

## Migration Plan

Keine Migration. Die Änderung ist ein verhaltensstabiles internes Refactoring und kann durch Rücknahme des Source-Commits zurückgerollt werden.
