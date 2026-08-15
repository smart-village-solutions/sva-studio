# Change: DOI-Versandnachricht in explizite Abschnitte zerlegen

## Why

Die produktive Zusammensetzung der Double-Opt-in-Mail bündelt optionale Textabschnitte, Template-Fallbacks und die Priorität von Absender- und Antwortadressen in einer stark verzweigten Funktion. Eine verhaltensgleiche Zerlegung macht diesen datenschutzrelevanten Vertrag nachvollziehbarer und testbarer, ohne den öffentlichen Mail-, Token- oder Outbox-Vertrag zu ändern.

## What Changes

- charakterisiert die bestehende DOI-Komposition für vollständige und fehlende Abschnitte, Leerwerte, unbekannte Platzhalter und die exakte Abschnittsreihenfolge
- charakterisiert die Priorität von Payload-, Waste-Konfigurations- und Transportadressen einschließlich `to`, `cc`, `bcc`, `replyTo`, Absender und Anzeigenamen
- zerlegt ausschließlich die interne DOI-Komposition in kleine typisierte Helfer für Templatewerte, Textabschnitte und Envelope
- erhält Betreff, Text, Leerzeilen, Fallbacks und Mail-Envelope bytegenau für dieselben Eingaben

## Out of Scope

- keine Änderung an Token, Secret, Bestätigungs-URL, DOI-Lebensdauer oder Abmeldevertrag
- keine Änderung an Outbox, SQL, Retry, Idempotenz oder Reminder-Materialisierung
- keine Änderung der Reminder-Mail-Komposition oder der Dispatch-Auswahl für unbekannte Template-Keys
- keine neue Template-Engine, Dependency oder öffentliche API
- keine Änderung an PR #983 oder PR #984

## Impact

- Affected specs: `waste-management`
- Affected code:
  - `apps/sva-studio-react/src/lib/waste-management-email-reminder-dispatch.server.ts`
  - `apps/sva-studio-react/src/lib/waste-management-email-reminder-dispatch.server.test.ts`
- Affected arc42 sections: keine; es wird weder eine Paket-, Runtime-, Persistenz- noch öffentliche Vertragsgrenze verändert

## Success Criteria

- alle Characterization-Fälle laufen vor und nach dem Refactoring unverändert grün
- DOI-Betreff, Textabschnitte, Abschnittsreihenfolge, Leerzeilen und Adress-Envelope bleiben für dieselben Eingaben identisch
- Token-, URL-, Outbox-, SQL-, Retry-, Idempotenz- und Reminder-Pfade bleiben source-seitig unverändert
- der Fallow-Zielanker `buildDoiDispatchMessage` ist nicht mehr als High-CRAP-Funktion vorhanden, ohne neue moderate CRAP-Findings einzuführen
