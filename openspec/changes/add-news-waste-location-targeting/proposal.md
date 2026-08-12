# Change: Ortsbezogene Push-Zielgruppen für Nachrichten

## Why

Kommunale Störungen bei der Abfallabholung betreffen häufig nur einzelne Abholorte. Nachrichten können Push-Benachrichtigungen bislang nur global auslösen, obwohl die Endgeräte ortsbezogene Abonnements bereits auswerten können.

## What Changes

- Der Push-Bereich unter „Einstellungen“ erhält eine Auswahl aktiver Abholorte.
- Die Auswahl wird als dedupliziertes `payload.wasteLocationKeys` an den Mainserver übergeben.
- Bestehende unbekannte Payload-Felder und nicht mehr auflösbare Zielschlüssel bleiben verlustfrei erhalten.
- Ein Push ohne Ortsauswahl bleibt global und erfordert vor dem auslösenden Speichern eine Bestätigung.

## Impact

- Affected specs: `content-management`, `waste-management`, `sva-mainserver-integration`
- Affected code: News-Editor und News-Mainserver-Adapter; lesende Waste-Stammdatenintegration; optionale Postleitzahl im mandantenspezifischen Waste-Städteschema
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
