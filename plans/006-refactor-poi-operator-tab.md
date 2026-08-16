# Plan 006: POI-Operator-Tab entflechten

## Status

- Status: DONE
- Ausgeliefert mit: PR #990, Merge-Commit
  `3b1085ebc48a2c4e182346dcbf3037dd0bbdd99b`
- Priorität: P1
- Aufwand: L
- Risiko: MEDIUM
- Abhängigkeit: PR #986 muss gemergt sein
- Kategorie: React-Komplexität und Testbarkeit

## Ziel und Ist-Zustand

`packages/plugin-poi/src/poi.detail-operator-tab.tsx` enthält mit
`PoiDetailOperatorTab` den stärksten verbleibenden Fallow-Hotspot der Erhebung:
62 zyklomatische, 43 kognitive Komplexität, 341 Zeilen und CRAP 3906. Die
Komponente bündelt Laden, Formularzustand, Berechtigungen, Mutation,
Fehlerbehandlung und Darstellung.

## Scope und Vorgehen

- bestehende User Journeys und Berechtigungsentscheidungen zuerst durch
  Characterization-Tests absichern,
- framework-agnostische Ableitungs- und Validierungslogik aus React herauslösen,
- Serverzustand und Mutationen in einen kleinen Hook bzw. Controller bündeln,
- Ansichtsabschnitte entlang vorhandener Design-System-Komponenten trennen,
- keine neue UI, keine neuen Texte und keine geänderten API-Verträge einführen.

## Verifikation

- fokussierte POI-Operator- und Detailseiten-Tests,
- vollständige POI-Unit- und Type-Suite,
- Lint, Complexity-Gate, Fallow und OpenSpec strict,
- PR-Gate bei handhabbarem affected Scope.

## Fertig, wenn

- der kritische Fallow-Befund beseitigt ist,
- Berechtigungen, Lade-/Fehlerzustände und Mutationen unverändert getestet sind,
- keine neue Komponente selbst wieder zum kritischen Hotspot wird.

## STOP-Bedingungen

- PR #986 ist nicht gemergt oder berührt noch dieselben POI-Dateien,
- die erforderliche Zerlegung würde UX oder Berechtigungsverträge ändern.
