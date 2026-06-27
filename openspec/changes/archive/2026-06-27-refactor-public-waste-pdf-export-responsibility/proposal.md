# Change: Verlagerung der Waste-PDF-Erzeugung in die öffentliche Web-App

## Why
Die bisherige PDF-Erzeugung hängt fachlich am Studio, obwohl das Ergebnis für Bürgerinnen und Bürger in der öffentlichen Abfallkalender-App gebraucht wird. Gleichzeitig sollen künftig Fraktionsauswahl, Jahreswahl und die wirksame Standortvererbung direkt im öffentlichen Export berücksichtigt werden.

## What Changes
- Studio `waste-management` stellt im Tab `Ausgabe` nur noch PDF-bezogene Stamminhalte bereit und erzeugt keine PDFs mehr.
- `public-waste-calendar` erzeugt PDFs serverseitig ad hoc aus dem final aufgelösten Standort, dem gewählten Jahr und den ausgewählten Fraktionen.
- Die bisherige Ableitung statischer PDF-Links aus einem URL-Schema entfällt zugunsten eines echten Export-Endpunkts.
- Waste-Fraktionen erhalten ein optionales Kürzel für die PDF-Legende; dafür wird eine DB-Migration ergänzt.

## Impact
- Affected specs: `waste-management`, `public-waste-calendar`
- Affected code: `packages/core`, `packages/auth-runtime`, `packages/plugin-waste-management`, `apps/public-waste-calendar-web`, `packages/data/migrations`
- Affected arc42 sections: `03-context-and-scope`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
