# Change: SSF-Sprachauswahl aus dem unterstützten Sprachkatalog

## Why

Die V2-Inhaltsverwaltung erlaubt derzeit freie Spracheingaben, obwohl SSF die technisch unterstützten Sprachen zentral bereitstellt. Das führt zu Einträgen, die SSF nicht verwenden kann.

## What Changes

- Studio lädt den öffentlichen SSF-Sprachkatalog serverseitig und stellt ihn in den bestehenden V2-Admin-Antworten bereit.
- Systemvorlage und Mandantenansicht verwenden den Katalog für die Mitarbeitendensprache und neue Gastsprachen.
- Bei nicht verfügbarem Katalog bleiben Texte bearbeitbar; Sprachänderungen und das Hinzufügen von Sprachen werden deaktiviert.
- Bereits gespeicherte Sprachen bleiben unverändert erhalten.

## Impact

- Affected specs: `ssf-content-v2`
- Affected code: `packages/plugin-ssf`
- Affected arc42 sections: 03 Kontext und Scope, 06 Laufzeitsicht, 08 Querschnittliche Konzepte
