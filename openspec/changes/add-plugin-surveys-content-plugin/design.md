## Context

SVA Studio besitzt bereits produktive Mainserver-basierte Content-Plugins fuer News, Events und POI. Das neue Modul `plugin-surveys` soll bewusst denselben Standardpfad nutzen: eigenes Plugin-Package im Scope `scope:plugin`, host-owned Mainserver-Anbindung, UI auf Basis von `@sva/studio-ui-react`, Registrierung ueber den bestehenden Plugin- und Content-Vertrag.

Die fachliche Zieldefinition fuer Surveys folgt dem aktuelleren Dokument `docs/staging/2026-07/umfragen-wunsch-graphql-schema.md`. Das aeltere Issue dient nur als Hintergrund, nicht als fuehrende Quelle.

## Goals / Non-Goals

- Goals:
  - Umfragen als normales Content-Plugin integrieren
  - Mainserver-Zugriff ueber neue Survey-GraphQL-Operationen modellieren
  - Surveys in der bestehenden Inhaltsverwaltung sichtbar und anlegbar machen
  - Freitext-Freigabe, Ergebnisansicht und Export als Teil des Bearbeitungsflusses abbilden
  - das Survey-Modell gegenueber dem bisherigen Wunsch-Schema fachlich vereinfachen, wo dies gewuenscht ist
- Non-Goals:
  - kein neuer Plugin-Sonderpfad ausserhalb des Standard-Content-Modells
  - keine allgemeine Erweiterung des Plugin-SDK ohne nachgewiesenen Bedarf
  - keine Spezifikation der finalen Detail-Tab-Reihenfolge auf Pixel-Ebene in diesem ersten Change
  - keine allgemeine Moderationsoberflaeche fuer alle Umfrageinhalte jenseits der Freitext-Freigabe

## Decisions

- Decision: `plugin-surveys` wird als Standard-Content-Plugin modelliert.
  - Alternatives considered:
    - eigenstaendiger Admin-Bereich ausserhalb des Content-Workflows: verworfen, weil Surveys in Inhaltsliste und `Neuer Inhalt` erscheinen sollen
    - plugin-spezifischer Sonderpfad mit direkten Host-Imports: verworfen, weil bestehende Boundaries erhalten bleiben sollen

- Decision: Die Mainserver-Anbindung bleibt host-owned und typed.
  - Alternatives considered:
    - generischer GraphQL-Client im Plugin: verworfen, weil dies den bestehenden Mainserver- und Security-Boundaries widerspricht
    - REST-Fassade nur fuer Surveys: verworfen, weil Surveys fachlich an dieselbe GraphQL-Quelle wie News, Events und POI anschliessen sollen

- Decision: Ergebnisansicht, Freitext-Freigabe und Export gehoeren zur Survey-Detail-/Bearbeitungsoberflaeche.
  - Alternatives considered:
    - separates Backoffice-Modul fuer Moderation/Auswertung: vorerst verworfen, weil das Modul als normales Content-Plugin starten soll

- Decision: Create- und Edit-Ansicht verwenden denselben stabilen Editor-Rahmen mit den Tabs `Basis`, `Inhalt`, `Moderation`, `Ergebnisse` und `Historie`.
  - Alternatives considered:
    - unterschiedlich aufgebaute Create- und Edit-Views: verworfen, weil dies die Editor-Navigation instabil machen wuerde
    - feinere Aufteilung in mehr Haupt-Tabs: verworfen, um die Redaktionsoberflaeche kompakt zu halten

- Decision: Jeder Survey-Haupt-Tab nutzt thematische Section-Cards ohne Card-Verschachtelung.
  - Alternatives considered:
    - verschachtelte Unter-Cards innerhalb grosser Arbeits-Cards: verworfen, weil dies die Informationshierarchie unruhig macht
    - Tabs innerhalb einzelner Cards: verworfen, weil die Survey-Oberflaeche nur eine Tab-Ebene haben soll
    - wiederholende Elemente als viele einzelne Mini-Cards: verworfen, weil Listen von Fragen, Optionen oder Moderationseintraegen innerhalb einer gemeinsamen Card als Abschnitte besser scanbar bleiben

- Decision: Das Survey-Statusmodell wird auf `DRAFT`, `ACTIVE` und `ARCHIVED` reduziert.
  - Alternatives considered:
    - Beibehaltung von `SCHEDULED` und `ENDED`: verworfen, weil zeitliche Wirkung ueber `startAt` und `endAt` modelliert werden soll

- Decision: `allowsMultipleSubmissionsPerDevice` wird aus dem gewuenschten Survey-Zielmodell entfernt.
  - Alternatives considered:
    - Feld im Schema behalten, aber nicht im Studio exponieren: verworfen, weil die Fachentscheidung das Verhalten bereits fest auf geraeteseitige Sperre setzt

- Decision: Das Berechtigungsmodell bleibt nah am Standard-Content-Muster und fuehrt nur gezielte Erweiterungen fuer Moderation und Export ein.
  - Alternatives considered:
    - feingranulare Einzelrechte fuer jede Bearbeitungsart: vorerst verworfen, um die erste Version nicht mit toter Komplexitaet zu belasten

## Risks / Trade-offs

- Das Survey-Wunsch-Schema ist breiter als die bisherigen Mainserver-Content-Typen; insbesondere Ergebnisse, Submission-Semantik und Freitext-Freigabe koennen zusaetzliche Host-Mapping-Logik erfordern.
- Der Standard-Content-Pfad passt gut fuer Listen-/Detail-/Create-Flows, aber Moderation und Auswertung koennen einzelne plugin-spezifische UI-Bausteine erfordern.
- Exporte koennen fachlich im Studio aus Host-Daten erzeugt werden oder auf Mainserver-Datenmodellen beruhen; der Change legt die fachlichen Exportvarianten fest, nicht aber schon die endgueltige technische Erzeugungsform.
- Die Survey-Oberflaeche braucht mehrere fachliche Editor-Bereiche; ohne klare Layout-Regeln droht dabei Card- und Navigations-Verschachtelung, die von den bestehenden Modulen wegfuehrt.

## Migration Plan

1. OpenSpec-Delta fuer Surveys, Content-Management und Mainserver-Integration verankern.
2. Plugin-Package nach Muster von News, Events und POI anlegen.
3. Typed Mainserver-Adapter fuer Survey-Queries/-Mutations im Host einfuehren.
4. Surveys in Inhaltsliste und `Neuer Inhalt` integrieren.
5. Survey-Editor mit stabilen Tabs, Ergebnisansicht, Freitext-Freigabe und Export schrittweise aufbauen.

## Panel-Spezifikation

### Allgemeine Layout-Regeln

- Jeder Haupt-Tab nutzt eine flache Abfolge thematischer Section-Cards.
- Cards werden nicht ineinander verschachtelt.
- Innerhalb einzelner Cards gibt es keine weitere Tab-Navigation.
- Wiederholende Elemente wie Fragen, Antwortoptionen, Moderationseintraege oder Ergebnisbloecke erscheinen innerhalb einer gemeinsamen Card als Abschnitte mit klarer visueller Trennung, zum Beispiel ueber Abstand oder Trennlinien.
- Fuer einfache Formularelemente werden bevorzugt bestehende Atome aus `@sva/studio-ui-react` und darunterliegenden shadcn-Primitives verwendet, insbesondere `StudioField`, `StudioFieldGroup`, `Input`, `Select`, `Checkbox`, `Textarea`, `Button`, `Alert` und bestehende Tabs-/Seiten-Templates.
- Neue Survey-Komponenten bleiben plugin-lokal und kapseln nur survey-spezifische Zusammensetzungen wie Frageneditor, Moderationsliste oder Ergebnisdarstellung.
- Textfelder verwenden standardmaessig einfache Eingabekomponenten wie `Textarea`; ein Rich-Text-Editor ist nur fuer laengere redaktionelle Hinweis- oder Beschreibungstexte vorzusehen, wenn Plaintext die fachliche Aufgabe nicht ausreichend abbildet.
- Destruktive Loeschaktionen verwenden durchgaengig eine explizite Bestaetigung, zum Beispiel ueber `AlertDialog`.

### Tab `Basis`

`Basis` bildet den administrativen Rahmen der Umfrage ab.

- Card `Identitaet`
  - `Input`: Titel
  - `Select`: Status (`DRAFT`, `ACTIVE`, `ARCHIVED`)
- Card `Laufzeit`
  - `Input type="datetime-local"`: `startAt`
  - `Input type="datetime-local"`: `endAt`
  - statischer Hinweistext fuer unbefristete Surveys
- Card `Zielgebiet`
  - bestehender Select-/Multiselect-Stil analog zu Kategorien-/Relationsfeldern der Referenzmodule
  - optional, leer zulaessig
- Card `Metadaten`
  - read-only Metadatenblock fuer `createdAt`, `updatedAt`, optional `publishedAt`, `archivedAt`
  - im Create-Fall Hinweis statt Werte

### Tab `Inhalt`

`Inhalt` bildet den eigentlichen redaktionellen und fachlichen Survey-Inhalt ab.

- Card `Beschreibung`
  - Feld fuer Kurzbeschreibung
  - Feld fuer laengere Beschreibung
- Card `Teilnahme und Sichtbarkeit`
  - `Checkbox`: `isAnonymous`
  - `Checkbox`: `showResultsInApp`
  - `Select`: `resultVisibility`
- Card `Fragen`
  - plugin-lokale Komponente `SurveyQuestionListEditor`
  - Liste aller Fragen in expliziter Reihenfolge ueber `position`
  - pro Frage ein flacher Abschnitt mit:
    - Titel
    - Fragetyp
    - Pflichtfeld-Markierung
    - Aktionsbuttons fuer Bearbeiten, Verschieben, Loeschen
  - Inline-Bearbeitungsbereich direkt innerhalb desselben Fragenabschnitts
  - innerhalb des Frage-Bearbeitungsabschnitts:
    - Feld fuer Fragetitel
    - Feld fuer Fragebeschreibung
    - `Select` fuer Fragetyp
    - `Checkbox` fuer `required`
    - Abschnitt `Antwortoptionen`
      - plugin-lokale Komponente `SurveyQuestionOptionsEditor`
      - je Option ein flacher Abschnitt mit:
        - Titel
        - `Checkbox` fuer `enablesFreeText`
        - Reihenfolge ueber `position`
        - Aktionen fuer Verschieben und Loeschen
- Card `Hinweise`
  - Feld fuer Datenschutz-Hinweis
  - Feld fuer Transparenz-Hinweis


### Tab `Moderation`

`Moderation` dient im ersten Zielbild ausschliesslich der Freigabe und Loeschung von Freitextantworten.

- Pro Frage eine eigene Card
  - plugin-lokale Komponente `SurveyFreeTextModerationTable`
  - Card-Titel ist die jeweilige Frage
  - innerhalb der Card eine Tabelle auf Basis bestehender Studio-/shadcn-Atome
  - pro Tabellenzeile:
    - gekuerzte Freitextantwort
    - Zeitstempel
    - aktueller Status
    - Schieberegler fuer die oeffentliche Sichtbarkeit analog zu anderen Visibility-Einstellungen
    - Loeschaktion fuer die Freitextantwort
  - Klick auf die gekuerzte Freitextantwort oeffnet ein Overlay mit dem vollstaendigen Text
- im Create-Fall:
  - Hinweiszustand innerhalb der Moderationsflaeche, dass Moderation erst nach erstem Speichern moeglich ist

### Tab `Ergebnisse`

`Ergebnisse` bietet eine kompakte interne Auswertungsansicht und den Export.

- Card `Uebersicht`
  - plugin-lokale Komponente `SurveyResultsSummaryCard`
  - kompakte Kennzahlen wie Teilnahmen, Submissions, Fragenanzahl und ggf. Laufzeitkontext
- Card `Frageergebnisse`
  - plugin-lokale Komponente `SurveyQuestionResultsList`
  - pro Frage ein Abschnitt mit aggregierten Resultaten
  - Auswahlfragen werden mit einfachen Layoutmitteln auf Basis bestehender Atome dargestellt, zum Beispiel Balken-/Label-Kombinationen ohne neue Chart-Library
  - Freitextantworten erscheinen nur nachgeordnet ueber aufklappbare Abschnitte
  - interne Ansicht darf auch nicht freigegebene Freitexte read-only anzeigen
- Card `Export`
  - zwei getrennte Aktionen:
    - Export ohne Freitexte
    - Export mit Freitexten
  - pro Exportaktion stehen die Formate `CSV`, `JSON`, `Excel` und `XML` zur Verfuegung
- im Create-Fall:
  - Hinweiszustand innerhalb der jeweiligen Cards statt Ergebnisdaten

### Tab `Historie`

`Historie` folgt dem bekannten Muster der Referenzmodule.

- Card `Aenderungsverlauf`
  - read-only Liste oder Tabelle fuer Historieneintraege
- im Create-Fall:
  - Hinweiszustand innerhalb derselben Card statt Historienliste

## Open Questions

- Wie stark die bestehende Standard-Content-Contribution fuer Surveys ohne zusaetzliche SDK-Helfer ausreicht
- Welche Textfelder einfache `Textarea` bleiben und wo ein Rich-Text-Editor echten Mehrwert gegenueber hoeherer Komplexitaet bringt
