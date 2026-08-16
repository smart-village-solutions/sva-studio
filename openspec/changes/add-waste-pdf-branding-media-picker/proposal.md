# Change: Medienpicker für das Waste-PDF-Logo verwenden

## Why

Die Branding-Grafik des öffentlichen Waste-PDFs wird im Studio derzeit ausschließlich über eine manuell eingetragene URL gepflegt. Der bereits etablierte gemeinsame Medienpicker soll auch hier Upload, Mediathek und Linkeingabe konsistent bereitstellen.

## What Changes

- Der Ausgabe-Tab des Waste-Management-Plugins erhält für die Branding-Grafik die gemeinsame Aktion `Medium hinzufügen`.
- Benutzer können ein öffentliches Bild hochladen, ein öffentliches Medium aus der Mediathek auswählen oder weiterhin eine HTTPS-URL manuell eingeben.
- Das gewählte Logo wird mit Vorschau und einer zugänglichen Entfernen-Aktion dargestellt.
- In `pdfBrandingAssetUrl` wird weiterhin ausschließlich die dauerhafte öffentliche URL gespeichert; das Waste-Datenbankschema und die PDF-Runtime bleiben unverändert.
- Medienauswahl, Upload und Metadatenbearbeitung folgen den bestehenden IAM-Capabilities und fallen bei fehlenden Berechtigungen auf die jeweils erlaubte Alternative zurück.

## Impact

- Affected specs: `waste-management`
- Affected code: `packages/plugin-waste-management`, bestehende Medienpicker-Verträge aus `packages/plugin-sdk` und `packages/studio-ui-react`
- Affected arc42 sections: keine; es wird ein vorhandenes UI- und Medienmuster ohne neue Systemgrenze wiederverwendet
