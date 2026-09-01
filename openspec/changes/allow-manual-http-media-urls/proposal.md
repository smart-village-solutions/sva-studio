# Change: Manuelle HTTP-Medien-URLs mit Warnung zulassen

## Why

Einige redaktionell benötigte externe Bildquellen stellen keine funktionierende HTTPS-Variante bereit. Der gemeinsame Bildblock lehnt solche manuellen URLs derzeit vollständig ab, obwohl der angebundene Mainserver-Vertrag sie speichern kann. Gleichzeitig darf diese Ausnahme den strengeren HTTPS-Vertrag der Medienbibliothek und ihrer Asset-Auslieferung nicht aufweichen.

## What Changes

- Manuell eingegebene Bild-URLs werden nach abgeschlossener Eingabe zentral normalisiert.
- Für fehlende Protokolle und explizite HTTP-Eingaben wird zuerst eine HTTPS-Variante über den vorhandenen Browser-Bildpfad geprüft.
- Eine erfolgreiche HTTPS-Variante ersetzt die Eingabe; andernfalls bleibt nur eine ausdrücklich eingegebene HTTP-URL speicherbar und erhält eine dauerhaft sichtbare, zugängliche Warnung.
- Unsichere manuelle URLs mit Zugangsdaten sowie signierte oder kurzlebige URLs bleiben unzulässig.
- Asset-basierte Medien und Auslieferungs-URLs der Medienbibliothek bleiben weiterhin auf dauerhaft persistierbare HTTPS-URLs beschränkt.

## Impact

- Affected specs: `content-management`
- Affected code: gemeinsamer Medienblock in `packages/studio-ui-react` sowie die Content-Medienadapter und Validierungen der bildfähigen Plugins
- Affected docs: `docs/development/plugin-development.md`
- Affected arc42 sections: keine; die bestehende Host-/Plugin-Grenze und der Medienreferenzvertrag bleiben unverändert
- Referenz: GitHub Issue #1084
