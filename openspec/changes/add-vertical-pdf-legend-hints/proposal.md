# Change: Strukturierte Hinweise in der vertikalen PDF-Legende anzeigen

## Why

Die waagerechte PDF-Legende bietet keinen verlässlichen Platz für vorhandene Hinweise zu Abfallfraktionen, Touren und einzelnen Terminen. Gleichzeitig wiederholt die bisherige Fußzeile bereits im Kopfbereich sichtbare Angaben und belegt den benötigten Raum.

## What Changes

- Die PDF-Legende wird unterhalb des unverändert großen Kalenderrasters vertikal mit höchstens acht einzeiligen Einträgen dargestellt.
- Fraktions-, Tour- und terminbezogene Hinweise werden mit ihrer fachlichen Herkunft in einer deterministischen Reihenfolge dargestellt.
- Texte, die den verbleibenden horizontalen Platz überschreiten, werden mit `...` gekürzt.
- Der PDF-Kopfbereich wird kompakter; die redundante Fußzeile entfällt.
- Der rote Asterisk bleibt außerhalb der Fraktionsbox und wird in einer eigenen vertikalen Legendenzeile als Ausweichtermin erklärt.

## Impact

- Betroffene Specs: `public-waste-calendar`
- Betroffener Code: öffentlicher PDF-Endpunkt sowie PDF-Dokumentmodell und Rendering
- Betroffene arc42-Abschnitte: keine; bestehende Verantwortungsgrenzen bleiben erhalten
