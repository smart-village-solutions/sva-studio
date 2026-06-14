# Change: E-Mail-Erinnerungsdienst mit Double-Opt-In im öffentlichen Abfallkalender

## Why
Der öffentliche Abfallkalender bietet bislang keinen E-Mail-Erinnerungsdienst für anstehende Entsorgungstermine. Gleichzeitig existiert bereits eine fraktionsbezogene Reminder-Konfiguration, die kanal- und slotbezogene Regeln vorgibt. Für Bürgerinnen und Bürger wird nun ein datenschutzkonformer E-Mail-Dienst benötigt, der vollständig in der öffentlichen Web-App startet, per Double-Opt-In aktiviert wird und jederzeit über einen Link in jeder Erinnerungs-E-Mail wieder deaktiviert werden kann. Der eigentliche Versand soll dabei nicht als Waste-Sonderlogik an SMTP oder einen Provider gekoppelt werden, sondern über eine zentrale, in `interfaces` konfigurierbare Mail-Transport-Schnittstelle laufen.

## What Changes
- `public-waste-calendar` erhält einen vollständigen E-Mail-Erinnerungsfluss mit Einstieg aus dem öffentlichen Kalender, Formular, Pending-Zustand, Double-Opt-In-Bestätigung und Abmeldeseite.
- Der Formularvertrag bietet nur Abfallarten mit aktivem E-Mail-Kanal an und erlaubt die Zeitslot-Auswahl pro gewählter Abfallart anhand der fraktionsspezifischen Reminder-Slots.
- Das System speichert E-Mail-Abos, Slot-Auswahlen, Token-Hashes, Zustimmungsnachweise und Versandzustände in einer eigenen Waste-Persistenz für Pending-, Active- und Revoked-Zustände.
- Jede Erinnerungs-E-Mail enthält einen Abmeldelink zurück auf eine Unterseite derselben Public-Waste-Web-App.
- `waste-management` erhält im Tab `output` eine eigene Card zur globalen Aktivierung des Dienstes, zu öffentlichen Rücksprung-URLs, Absenderdaten, Rechtslinks, DOI-Texten, Reminder-Textbausteinen und technischen Leitplanken.
- Alle Studio-seitigen Konfigurations- und Pflegeverträge des E-Mail-Erinnerungsdienstes bleiben ausschließlich dem Modul `waste-management` zugeordnet und werden nicht als modulübergreifende globale Studio-Settings modelliert.
- Der technische Mail-Transport wird über eine zentrale Mail-Transport-Schnittstelle aus `interfaces` konfiguriert; Waste übergibt nur normalisierte Versandaufträge und pflegt keine SMTP-Credentials.
- Der Versand wird ressourcenschonend über inkrementelle Materialisierung und eine Waste-seitige Outbox organisiert, statt regelmäßig alle Abos vollständig neu zu berechnen.

## Impact
- Affected specs: `public-waste-calendar`, `waste-management`, `external-interface-registry`
- Affected code: `apps/public-waste-calendar-web`, `packages/core`, `packages/auth-runtime`, `packages/data-repositories`, `packages/data/migrations`, `packages/plugin-waste-management`, `apps/sva-studio-react`, `apps/sva-studio-react/src/routes/interfaces/*`, zugehörige Interface-Serververträge
- Affected arc42 sections: `03-context-and-scope`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`
