## MODIFIED Requirements
### Requirement: Neue Repository-Logik lebt nicht in `@sva/data`

Das System MUST `@sva/data` auf Migrationen, Seeds, DB-Skripte/-Operationen und dokumentierte Kompatibilitäts-Re-Exports bzw. Delegation begrenzen. Neue serverseitige Persistenz- oder Repository-Logik MUST in `@sva/data-repositories` liegen und darf in `@sva/data` nicht als parallele Implementierung aufgebaut werden.

#### Scenario: Neue Repository-Logik wird eingeordnet

- **WHEN** neue serverseitige Persistenz- oder Repository-Funktionalität entsteht
- **THEN** liegt die führende Implementierung in `@sva/data-repositories`
- **AND** `@sva/data` erhält höchstens einen dünnen Re-Export oder eine dokumentierte Delegation ohne eigene fachliche Ownership

#### Scenario: Bestehende Altpfade bleiben kontrolliert nutzbar

- **WHEN** bestehende Consumer weiterhin `@sva/data` oder `@sva/data/server` verwenden
- **THEN** delegiert das Package auf dokumentierte Zielpackages oder re-exportiert deren öffentliche API
- **AND** es führt keine parallele Implementierung derselben Repository-Funktionalität
