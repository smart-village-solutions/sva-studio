# Change: Event-Inhaltseditor entlang fachlicher Abschnitte zerlegen

## Why

Der gemeinsame Editor-Lifecycle ist konsolidiert, aber
`EventsDetailContentTab` bleibt auf `origin/main` ein kritischer React-Hotspot:
Die Komponente umfasst 809 Funktionszeilen in einer 854-zeiligen Datei,
koordiniert 19 React-Hooks und erreicht laut Fallow eine zyklomatische
Komplexität von 41 sowie eine kognitive Komplexität von 57. Zusätzlich liegen
kritische Inline-Callbacks in den Termin- und Adresslisten.

Die fachlichen Bereiche Beschreibung, Medien, Termine, Adressen,
Veranstalter, Kontakte, Links und Preise sind bereits sichtbar getrennt, ihre
Formular- und Darstellungslogik wird jedoch von einer einzigen Komponente
besessen. Dadurch ist jede lokale Änderung schwerer zu prüfen und kann
unabhängige Editorbereiche unbeabsichtigt berühren.

Der Refactor soll diese technische Schuld tatsächlich abbauen. Er darf die
bestehende Implementierung nicht durch einen parallelen Komponentenpfad
ergänzen und den produktiven Zielscope netto nicht vergrößern.

## What Changes

- hält `EventsDetailContentTab` als einzigen Einbindungspunkt des Content-Tabs,
  reduziert ihn aber auf Formular-Kontext, gemeinsam benötigte
  Capability-Ableitungen und die explizite Komposition fachlicher Abschnitte
- zerlegt die acht bestehenden Editorbereiche in wenige pluginlokale,
  fachlich gruppierte Section-Module
- verlagert `useFieldArray`, `useWatch`, Defaults und bereichsspezifische
  Callbacks jeweils in die zuständige Section
- kapselt den einmaligen Read der bestehenden Map-/Geocoding-Capabilities in
  einem pluginlokalen Hook und reicht nur den abgeleiteten Zustand an Adress-
  und Veranstalterbereich weiter
- entfernt jeden ersetzten Inline-Block im selben Implementierungsblock; es
  entstehen keine Weiterleitungswrapper, Feature-Flags oder parallelen
  Altpfade
- behält RHF-Feldpfade, Defaultwerte, bestehende manuelle Validierung,
  Mainserver-Mapping,
  Medienvertrag, Permissions, Texte, DOM-IDs, Reihenfolge und Bedienverhalten
  unverändert
- härtet bestehende Characterization-Tests gezielt an den heute kritischen
  Termin-, Adress-, Kontakt- und Preis-Callbacks
- belegt die Reduktion mit Fallow-, LOC- und Suchnachweisen

## Debt-Reduction Contract

- Der produktive Änderungsscope besteht aus der bisherigen
  `events.detail-content-tab.tsx` und allen daraus neu entstandenen oder dafür
  geänderten produktiven Events-Modulen. Gegen `origin/main` darf seine Summe
  der TypeScript-/TSX-Zeilen nicht wachsen.
- Ein Section-Modul ist nur zulässig, wenn sein bisheriger Inline-Block im
  selben Commit vollständig verschwindet.
- `EventsDetailContentTab` muss seinen kritischen Fallow-Befund verlieren;
  keine extrahierte Funktion oder Komponente darf einen neuen kritischen
  Befund erzeugen.
- Der Change darf keine Suppression, Grenzwertänderung, neue Dependency,
  öffentliche Exportfläche oder gemeinsame Cross-Plugin-Abstraktion einführen.
- Sinkende Metriken allein genügen nicht: Die Ownership jedes Feld-Arrays und
  jedes bereichsspezifischen Callbacks muss in genau einem fachlichen Modul
  liegen.

## Out of Scope

- keine neue oder entfernte Event-Funktion
- kein visuelles Redesign und keine Änderung an Accessibility oder i18n
- keine Änderung an Event-Payload, Serialisierung, Validierung, Permissions,
  Navigation oder Save-/Reference-Retry-Lifecycle
- keine repo-weite Formularmigration und keine Vorwegnahme der
  Referenzmigrationen aus `add-studio-data-form-and-test-foundations`
- keine generische Form-Engine, Schema-Renderer-, Section-Registry- oder
  Repeater-Abstraktion
- keine Einführung von `zodResolver` in der äußeren Events-Form; diese
  potenzielle Formularmigration bleibt ein eigener, verhaltensändernder Scope
- keine Migration von Generic Items oder News; deren Eignung wird erst nach
  dem messbaren Abschluss dieses Referenzschnitts neu bewertet

## Sequencing Against Form Foundations

`add-studio-data-form-and-test-foundations` wurde vor Beginn dieses Changes
gegen den aktuellen Code reconciliert. Seine bereits vorhandenen RHF-,
Studio-Form-Bridge- und Testverträge werden verwendet; sein vollständiger
Abschluss ist aber keine Implementierungsvoraussetzung.

Dieser Change ist ein interner Strukturrefactor des bestehenden Content-Tabs.
Er ändert weder den `useForm`-Owner in `EventsDetailPage` noch den heutigen
manuellen `validateEventForm`-, Fehlerfokus-, Submit-, Persistenz- oder
HTTP-Vertrag. Deshalb wird hier keine Resolver-Migration versteckt
mitgezogen. Sobald einer dieser äußeren Verträge grundlegend überarbeitet
wird, gilt der vollständige Foundation-Standard und die Resolver-Migration ist
separat zu planen.

## Impact

- Affected specs: `complexity-quality-governance`
- Affected code:
  - `packages/plugin-events/src/events.detail-content-tab.tsx`
  - neue oder geänderte pluginlokale `events.detail-content-*`-Module
  - `packages/plugin-events/tests/events.detail-content-tab.test.tsx`
- Affected arc42 sections: `10-quality-requirements`,
  `11-risks-and-technical-debt`
- Required documentation:
  - `docs/development/studio-form-migrationsinventur.md`
  - relevante Qualitäts- und Technical-Debt-Abschnitte unter
    `docs/architecture/`

## Success Criteria

- `EventsDetailContentTab` besitzt höchstens 20 zyklomatische und höchstens 15
  kognitive Komplexität und umfasst höchstens 250 Funktionszeilen
- weder `EventsDetailContentTab` noch ein neu extrahierter Abschnitt erscheint
  als kritischer Fallow-Komplexitätsbefund
- die zwei heutigen kritischen Inline-Callbacks für Termine und Adressen sind
  entfernt oder liegen nachweislich unter den kanonischen Schwellwerten
- der produktive Änderungsscope wächst netto nicht
- jeder bisherige Inline-Editorbereich besitzt genau eine führende
  pluginlokale Implementierung; Suchnachweise finden keinen verbliebenen
  Parallelpfad
- bestehende Event-Content-Tab-, Form-, Page-, Map- und Type-Tests bleiben grün
  und belegen unveränderte Feldwerte, Reihenfolge, Fehlermeldungen, Medien- und
  Geocoding-Semantik
