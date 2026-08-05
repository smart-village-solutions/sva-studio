# Change: Mainserver-Editoren tolerant und verlustarm ausführen

## Why

Studio behandelt aktuell teilweise den gesamten Mainserver-Datensatz als nicht ladbar, wenn nur ein optionales Feld, eine zusätzliche Studio-Anreicherung oder eine lokale Vertragserwartung fehlschlägt. Dadurch können vorhandene Inhalte trotz erfolgreicher Mainserver-Detailantwort weder angezeigt noch bearbeitet werden. Die Integrationsschicht benötigt einen gemeinsamen, realistisch umsetzbaren Resilienzvertrag, der verwertbare Quelldaten anzeigt, Abweichungen sichtbar und beobachtbar macht und bereits gelesene Werte innerhalb des bestätigten GraphQL-Vertrags erhält.

## What Changes

- macht die stabile Mainserver-ID zusammen mit dem durch die typisierte Route bestimmten Inhaltstyp zur minimalen Lesegrenze; typbezogene Diskriminatoren bleiben dort hart, wo sie die fachliche Route absichern
- validiert und mappt optionale Felder sowie verschachtelte Feldgruppen isoliert, statt bei einer einzelnen Abweichung den gesamten Datensatz abzulehnen
- trennt den führenden Mainserver-Detailrequest von Medienreferenzen, Kategorien, Historie, Karten und weiteren optionalen Anreicherungen
- zeigt degradierte Felder und Zusatzdienste abschnittsbezogen an, ohne den übrigen Editor zu blockieren
- protokolliert jede erkannte Vertragsabweichung strukturiert, PII-arm und aggregierbar über den Server-Runtime-Logger
- transportiert sichere, feldgruppenbezogene Abweichungsmetadaten über einen rückwärtskompatibel erweiterten Host-/SDK-Vertrag bis zum Editor
- erhält unbekannte Payload-Schlüssel und bekannte, unmittelbar zuvor gelesene Passthrough-Felder beim Speichern, soweit der bestätigte GraphQL-Lese- und Mutationsvertrag dies erlaubt
- sperrt die konkret nicht sicher schreibbare Feldgruppe; unabhängige Felder bleiben nur dann separat speicherbar, wenn der typisierte Mutation-Vertrag diese Trennung verlustfrei erlaubt, andernfalls wird die Mutation vor dem Provider-Aufruf blockiert
- führt den Vertrag zuerst für POI und Events ein und migriert danach News, Generic Items, FAQ, Cockpit Cards und Projects
- verlangt vor jeder Typmigration eine dokumentierte Read-/Write-Feldmatrix; ein Feld darf nur erhalten werden, wenn Lese- und Mutation-Vertrag dies typisiert unterstützen
- verspricht weder schemafreie Bearbeitung nicht abgefragter GraphQL-Felder noch konfliktfreies Zusammenführen paralleler externer Änderungen

## Impact

- Affected specs: `content-management`, `sva-mainserver-integration`
- Affected code: Mainserver-Mapper und Routen in `packages/sva-mainserver`, additive Detailmetadaten in `packages/plugin-sdk`, Action-/Editor-Lade- und Speicherpfade in den Mainserver-basierten Content-Plugins, gemeinsame Warnungsdarstellung in `packages/studio-ui-react`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
- Affected architecture docs: `docs/architecture/logging-architecture.md`, `docs/architecture/request-flow-szenarien.md`, gegebenenfalls `docs/architecture/fachliche-zustaendigkeiten.md`
- Database impact: keine Schemaänderung vorgesehen; Abweichungen werden über bestehende Logs und sichere Response-Metadaten transportiert
