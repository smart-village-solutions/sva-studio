## MODIFIED Requirements

### Requirement: Survey-Editor orientiert sich an bestehenden Content-Modulen

Das System MUST die Survey-UI fuer Erstellen und Bearbeiten im Stil der bestehenden Content-Module aufbauen.

#### Scenario: Survey wird auf einem Onepager erstellt

- **WENN** eine berechtigte Redakteurin eine neue Survey erstellt
- **DANN** zeigt das Plugin einen routbaren Onepager ohne Editor-Tabs
- **UND** ordnet Titel, Kurzbeschreibung, Beschreibung, Fragen/Optionen, Zielgebiet, Laufzeit, Anonymität, Datenschutzhinweis, Transparenzhinweis, Ergebnisdarstellung und Status in dieser Reihenfolge an
- **UND** verwendet es vorhandene Feldkomponenten, Formularzustand und Mutationspfade

#### Scenario: Gespeicherte Survey nutzt weiterhin tab-orientierten Editor

- **WENN** eine berechtigte Redakteurin eine gespeicherte Survey bearbeitet
- **DANN** zeigt das Plugin weiterhin die Tabs `Basis`, `Inhalt`, `Moderation`, `Ergebnisse` und `Historie`
- **UND** bildet `Basis` Identität, Status, Laufzeit und optionale Zielgebiete ab
- **UND** bildet `Inhalt` Beschreibungen, Hinweise, Fragen, Antwortoptionen, Anonymität und Ergebnisfreigabe ab

#### Scenario: Survey-Editor bleibt Teil derselben Admin-Oberflaeche

- **WENN** der Survey-Editor gerendert wird
- **DANN** verwendet er bestehende Studio-Patterns fuer Seitenkopf, Formulare, Tabs, Status, Dialoge und Fehlerzustaende
- **UND** fuehrt keine visuell oder strukturell parallele Admin-Oberflaeche ein

#### Scenario: Tabpanels nutzen thematische Cards ohne Verschachtelung

- **WENN** ein Survey-Tabpanel fachliche Eingaben oder Auswertungen darstellt
- **DANN** gliedert das Plugin den Tab-Inhalt ueber thematische Section-Cards
- **UND** verschachtelt keine Cards ineinander
- **UND** fuehrt innerhalb einzelner Cards keine weitere Tab-Navigation ein

#### Scenario: Wiederholende Elemente bleiben Abschnitte innerhalb einer Card

- **WENN** ein Tab wiederholende Survey-Elemente wie Fragen, Antwortoptionen, Moderationseintraege oder Ergebnisbloecke zeigt
- **DANN** erscheinen diese innerhalb einer gemeinsamen fachlichen Card als klar getrennte Abschnitte, Zeilen oder durch Trennlinien strukturierte Eintraege
- **UND** werden dafuer nicht standardmaessig viele untergeordnete Einzel-Cards erzeugt

#### Scenario: Erst nach Anlage verfügbare Bereiche fehlen im Create-Modus

- **WENN** eine neue Survey noch nicht gespeichert wurde
- **DANN** zeigt der Onepager keine Moderations-, Ergebnis- oder Historienbereiche und keine ersatzweisen Hinweistabs
- **UND** sind diese Bereiche nach Anlage im bestehenden Edit-Workspace gemäß Berechtigung erreichbar

### Requirement: Survey-Tabpanels folgen einem card-basierten Panel-Schnitt

Das System MUST fuer gespeicherte Surveys in `plugin-surveys` einen festen card-basierten Panel-Schnitt je Haupt-Tab verwenden, der an die Referenzmodule anschliesst und auf bestehende Atome aus `@sva/studio-ui-react` und shadcn/ui aufbaut.

Neue Survey-Komponenten duerfen als plugin-lokale Kompositionen entstehen, wenn bestehende Atome fuer Fragen, Moderation und Ergebnisse allein nicht ausreichen.

#### Scenario: Basis-Tab gruppiert Verwaltungsrahmen in wenige Haupt-Cards

- **WENN** der Tab `Basis` gerendert wird
- **DANN** gruppiert er seine Inhalte in thematische Haupt-Cards fuer `Identitaet`, `Laufzeit`, `Zielgebiet` und `Metadaten`
- **UND** verwendet darin bevorzugt bestehende UI-Atome wie `Input`, `Select`, `StudioField`, `StudioFieldGroup` und einfache Read-only-Metadatenbloecke

#### Scenario: Inhalt-Tab gruppiert Redaktion und Fragen in wenige Haupt-Cards

- **WENN** der Tab `Inhalt` gerendert wird
- **DANN** gruppiert er seine Inhalte in thematische Haupt-Cards fuer `Beschreibung`, `Teilnahme und Sichtbarkeit`, `Hinweise` und `Fragen`
- **UND** verwendet fuer einfache Felder bevorzugt bestehende UI-Atome aus `@sva/studio-ui-react`
- **UND** kapselt Fragen- und Optionsbearbeitung in plugin-lokalen Survey-Kompositionen statt in neuen shared UI-Abstraktionen

#### Scenario: Moderation und Ergebnisse nutzen jeweils wenige klar fokussierte Haupt-Cards

- **WENN** die Tabs `Moderation` oder `Ergebnisse` gerendert werden
- **DANN** bestehen sie jeweils aus wenigen fachlich fokussierten Haupt-Cards statt aus verschachtelten Panel-Hierarchien
- **UND** bleiben Moderation, Ergebnisuebersicht, Ergebnisdetails und Export auch visuell klar voneinander getrennt

#### Scenario: Panel-Schnitt des Survey-Editors ist tabweise festgelegt

- **WENN** der Edit-Modus für eine gespeicherte Survey spezifiziert oder umgesetzt wird
- **DANN** enthaelt `Basis` die Haupt-Cards `Identitaet`, `Laufzeit`, `Zielgebiet` und `Metadaten`
- **UND** enthaelt `Inhalt` die Haupt-Cards `Beschreibung`, `Teilnahme und Sichtbarkeit`, `Hinweise` und `Fragen`
- **UND** enthaelt `Moderation` pro Frage jeweils eine Haupt-Card mit Freitext-Tabelle
- **UND** enthaelt `Ergebnisse` die Haupt-Cards `Uebersicht`, `Frageergebnisse` und `Export`
- **UND** enthaelt `Historie` die Haupt-Card `Aenderungsverlauf`

#### Scenario: Fragen und Optionen werden in flachen Abschnitten innerhalb einer Haupt-Card bearbeitet

- **WENN** Redakteure Fragen oder Antwortoptionen im Tab `Inhalt` oder im Create-Onepager bearbeiten
- **DANN** geschieht dies innerhalb der Haupt-Card `Fragen`
- **UND** erscheinen einzelne Fragen und Optionen dort als flache wiederholende Abschnitte mit klaren Bearbeitungsaktionen
- **UND** erfolgt die Bearbeitung einer Frage inline innerhalb ihres jeweiligen Abschnitts
- **UND** erzeugt das Plugin dafuer nicht standardmaessig eine weitere Ebene untergeordneter Cards oder innerer Tabs

#### Scenario: Moderation und Ergebnisse nutzen plugin-lokale Kompositionen auf Basis bestehender Atome

- **WENN** das Plugin UI fuer Freitext-Freigabe, Frageneditor oder Ergebnisdarstellung benoetigt
- **DANN** duerfen dafuer plugin-lokale Survey-Komponenten entstehen
- **UND** bauen diese bevorzugt auf bestehenden Atomen aus `@sva/studio-ui-react` und shadcn/ui auf
- **UND** fuehrt das Plugin dafuer keine neue shared UI-Abstraktion ohne nachgewiesenen Mehrfachbedarf ein

#### Scenario: Textfelder nutzen standardmaessig einfache Eingabekomponenten

- **WENN** das Survey-Modul Textfelder fuer redaktionelle Inhalte bereitstellt
- **DANN** verwendet es standardmaessig einfache Eingabekomponenten wie `Textarea`
- **UND** setzt einen Rich-Text-Editor nur dort ein, wo laengere redaktionelle Hinweis- oder Beschreibungstexte damit fachlich besser abgebildet werden

#### Scenario: Destruktive Loeschaktionen muessen bestaetigt werden

- **WENN** das Survey-Modul eine Frage, Antwortoption oder Freitextantwort loeschen will
- **DANN** verlangt die UI vor dem Loeschen eine explizite Bestaetigung
- **UND** verwendet dafuer ein bestehendes bestaetigendes Dialogmuster statt einer sofortigen irreversiblen Aktion


## ADDED Requirements

### Requirement: Umfrage-Neuanlage erklärt Teilnahme und Ergebnisfreigabe

Das System SHALL im Create-Onepager für ungeschulte Redakteure Fragetypen und die bestehenden Einstellungen für Teilnahmegebiet, Laufzeit, Anonymität, Hinweise und Ergebnisfreigabe durch kurze zugeordnete Hilfen verständlich machen. Status und Laufzeit SHALL gemäß ihrem bestehenden Zusammenspiel erklärt werden; die Darstellung darf keine zusätzlichen Datenschutz-, Anonymitäts- oder Publikationsgarantien behaupten.

#### Scenario: Redakteurin legt Teilnahmebedingungen fest

- **WHEN** eine Redakteurin eine Umfrage erstellt und Teilnahmebedingungen oder Ergebnisfreigabe ändert
- **THEN** erläutern die Hilfen die tatsächliche Bedeutung der bestehenden Optionen
- **AND** erklärt der Abschlussbereich die aus Status und Laufzeit gemäß bestehendem Vertrag folgende Wirkung
- **AND** werden weder neue Freigabestufen noch ein neuer Entwurfs- oder Publikationspfad eingeführt
