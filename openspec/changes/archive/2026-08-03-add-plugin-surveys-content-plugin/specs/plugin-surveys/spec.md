## ADDED Requirements

### Requirement: Surveys werden als normales Content-Plugin bereitgestellt

Das System MUST ein neues Plugin `plugin-surveys` als normales Content-Plugin im bestehenden Plugin-Standardpfad bereitstellen.

Das Plugin MUST dieselben Boundary-Regeln wie die produktiven Referenzmodule fuer News, Events und POI einhalten.

#### Scenario: Survey-Plugin folgt dem Standardpfad

- **WENN** `plugin-surveys` im Workspace registriert wird
- **DANN** liegt es als Nx-Library unter `packages/plugin-surveys`
- **UND** traegt die Tags `scope:plugin` und `type:lib`
- **UND** importiert Host-Vertraege nur ueber `@sva/plugin-sdk` und UI-Bausteine nur ueber `@sva/studio-ui-react`

#### Scenario: Survey-Plugin fuehrt keinen Sonderpfad ein

- **WENN** das Plugin Routen, Aktionen, Berechtigungen oder Admin-Ressourcen beisteuert
- **DANN** verwendet es den bestehenden Standard-Content-Vertrag
- **UND** fuehrt keine app-internen Direktimporte, keinen generischen GraphQL-Client und keine pluginseitige Host-Bypass-Logik ein

### Requirement: Surveys definieren ein eigenes Berechtigungsmodell

Das System MUST fuer `plugin-surveys` ein fachlich passendes Berechtigungsmodell definieren, das nah am bestehenden Standard-Content-Muster bleibt und nur dort erweitert wird, wo Survey-spezifische Funktionen dies erfordern.

#### Scenario: Survey-Berechtigungen werden registriert

- **WENN** der Host die Plugin-Registry fuer `plugin-surveys` materialisiert
- **DANN** registriert das Plugin die Standard-Content-Berechtigungen fuer Erstellen, Bearbeiten, Aktualisieren und Loeschen
- **UND** die zugehoerigen Action-IDs bleiben Survey-namespaced

#### Scenario: Moderation und Export sind separat absicherbar

- **WENN** ein Benutzer Surveys bearbeiten darf, aber keine Freitext-Freigabe oder Exporte ausfuehren darf
- **DANN** kann der Host Moderations- und Exportfunktionen getrennt sperren oder ausblenden
- **UND** das Plugin setzt nicht voraus, dass allgemeines Bearbeitungsrecht automatisch Moderations- oder Exportrecht einschliesst

### Requirement: Survey-Editor orientiert sich an bestehenden Content-Modulen

Das System MUST die Survey-UI fuer Erstellen und Bearbeiten im Stil der bestehenden Content-Module aufbauen.

#### Scenario: Survey-Detailansicht nutzt tab-orientierten Editor

- **WENN** eine berechtigte Redakteurin eine Survey erstellt oder bearbeitet
- **DANN** zeigt das Plugin eine routbare Erstellungs- oder Bearbeitungsansicht mit den Tabs `Basis`, `Inhalt`, `Moderation`, `Ergebnisse` und `Historie`
- **UND** dieselbe Tab-Struktur gilt fuer Erstellen und Bearbeiten
- **UND** `Basis` bildet Identitaet, Status, Laufzeit und optionale Zielgebiete ab
- **UND** `Inhalt` bildet Beschreibungen, Datenschutz- und Transparenzhinweise, Fragen, Antwortoptionen, Anonymitaet, Ergebnisfreigabe und weitere inhaltliche Survey-Einstellungen ab

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

#### Scenario: Noch nicht verfuegbare Bearbeitungsbereiche bleiben im Create-Fall sichtbar

- **WENN** eine neue Survey noch nicht gespeichert wurde
- **DANN** bleiben die Tabs `Moderation`, `Ergebnisse` und `Historie` dennoch sichtbar
- **UND** zeigen einen klaren Hinweis, dass ihre Inhalte erst nach dem ersten Speichern oder mit vorhandenen Survey-Daten verfuegbar sind

### Requirement: Survey-Tabpanels folgen einem card-basierten Panel-Schnitt

Das System MUST fuer `plugin-surveys` einen festen card-basierten Panel-Schnitt je Haupt-Tab verwenden, der an die Referenzmodule anschliesst und auf bestehende Atome aus `@sva/studio-ui-react` und shadcn/ui aufbaut.

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

- **WENN** der Survey-Editor spezifiziert oder umgesetzt wird
- **DANN** enthaelt `Basis` die Haupt-Cards `Identitaet`, `Laufzeit`, `Zielgebiet` und `Metadaten`
- **UND** enthaelt `Inhalt` die Haupt-Cards `Beschreibung`, `Teilnahme und Sichtbarkeit`, `Hinweise` und `Fragen`
- **UND** enthaelt `Moderation` pro Frage jeweils eine Haupt-Card mit Freitext-Tabelle
- **UND** enthaelt `Ergebnisse` die Haupt-Cards `Uebersicht`, `Frageergebnisse` und `Export`
- **UND** enthaelt `Historie` die Haupt-Card `Aenderungsverlauf`

#### Scenario: Fragen und Optionen werden in flachen Abschnitten innerhalb einer Haupt-Card bearbeitet

- **WENN** Redakteure Fragen oder Antwortoptionen im Tab `Inhalt` bearbeiten
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

### Requirement: Survey-Inhalt bildet das vereinfachte Fachmodell ab

Das System MUST im Survey-Modul ein vereinfachtes Fachmodell mit den Statuswerten `DRAFT`, `ACTIVE` und `ARCHIVED` verwenden.

Zeitliche Wirkung wird ueber `startAt` und `endAt` modelliert und nicht ueber zusaetzliche persistierte Statuswerte wie `SCHEDULED` oder `ENDED`.

#### Scenario: Survey-Status wird vereinfacht gefuehrt

- **WENN** eine Survey im Studio erstellt, bearbeitet oder angezeigt wird
- **DANN** verwendet das Modul ausschliesslich die Statuswerte `DRAFT`, `ACTIVE` und `ARCHIVED`
- **UND** verwendet es keine separaten persistierten Statuswerte `SCHEDULED` oder `ENDED`

#### Scenario: Beendete aktive Survey wird nicht automatisch archiviert

- **WENN** eine Survey den Status `ACTIVE` hat und ihr `endAt` in der Vergangenheit liegt
- **DANN** bleibt sie fachlich weiterhin `ACTIVE`, bis ein Benutzer sie explizit archiviert
- **UND** eine abgelaufene Laufzeit fuehrt nicht automatisch zum Status `ARCHIVED`

#### Scenario: Survey kann ohne Zielgebiet und ohne Enddatum existieren

- **WENN** eine Survey erstellt oder bearbeitet wird
- **DANN** bleiben `targetAreaIds`, `startAt` und `endAt` optionale Felder
- **UND** sind auch unbefristete Surveys ohne Zielgebiet gueltig

#### Scenario: Mehrfachteilnahme pro Geraet ist keine redaktionelle Option

- **WENN** das Survey-Modul sein Fachmodell und seine Studio-Oberflaeche bereitstellt
- **DANN** exponiert es keine redaktionell bearbeitbare Option `allowsMultipleSubmissionsPerDevice`
- **UND** behandelt die geraeteseitige Teilnahme-Sperre nicht als durch Redakteure konfigurierbaren Survey-Schalter

### Requirement: Fragen und Antwortoptionen bleiben voll bearbeitbar und explizit sortierbar

Das System MUST Fragen und Antwortoptionen in `plugin-surveys` explizit sortierbar und auch nach Aktivierung normal bearbeitbar halten.

#### Scenario: Fragen sind ueber Position sortierbar

- **WENN** Redakteure Fragen in der Survey bearbeiten
- **DANN** koennen sie deren Reihenfolge explizit steuern
- **UND** wird diese Reihenfolge ueber das Fachfeld `position` modelliert

#### Scenario: Antwortoptionen sind ueber Position sortierbar

- **WENN** Redakteure Antwortoptionen einer Frage bearbeiten
- **DANN** koennen sie auch deren Reihenfolge explizit steuern
- **UND** wird diese Reihenfolge ueber das Fachfeld `position` modelliert

#### Scenario: Aktivierung sperrt die Fragestruktur nicht

- **WENN** eine Survey bereits den Status `ACTIVE` hat
- **DANN** bleiben Fragen und Antwortoptionen im ersten Zielbild weiterhin normal bearbeitbar
- **UND** das Modul fuehrt dafuer keine automatische Struktur-Sperre ein

#### Scenario: Alle vorgesehenen Fragetypen sind verfuegbar

- **WENN** eine Survey in der Studio-Oberflaeche bearbeitet wird
- **DANN** unterstuetzt das Modul die Fragetypen `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FREE_TEXT`, `SINGLE_CHOICE_WITH_TEXT` und `MULTIPLE_CHOICE_WITH_TEXT`
- **UND** muessen diese Fragetypen nicht auf einen kleineren MVP-Umfang reduziert werden

### Requirement: Survey-Bearbeitung umfasst Moderation und Auswertung

Das System MUST als Teil der Survey-Bearbeitung auch Freitext-Freigabe, Ergebnisansicht und Export abbilden.

#### Scenario: Freitextantworten koennen freigegeben werden

- **WENN** ein berechtigter Benutzer den Tab `Moderation` einer Survey oeffnet
- **DANN** kann er dort Freitextantworten fuer die oeffentliche Anzeige freigeben
- **UND** der Tab `Moderation` dient im ersten Zielbild nur dieser Freitext-Freigabe
- **UND** die Freigabe folgt dem Survey-Fachmodell statt einer losgeloesten Nebenoberflaeche

#### Scenario: Freitextantworten werden in der Moderation nach Fragen gruppiert

- **WENN** der Tab `Moderation` Freitextantworten anzeigt
- **DANN** gruppiert das Plugin die Antworten nach Fragen
- **UND** rendert pro Frage eine eigene Haupt-Card mit einer Tabelle der zugehoerigen Freitextantworten
- **UND** benoetigt die Moderationsansicht deshalb keine separate Kontextspalte fuer Frage oder Option pro Tabellenzeile

#### Scenario: Freitext-Sichtbarkeit wird ueber Schieberegler gesteuert

- **WENN** eine Freitextantwort in der Moderation angezeigt wird
- **DANN** kann ihre oeffentliche Sichtbarkeit ueber einen Schieberegler analog zu anderen Visibility-Einstellungen geaendert werden
- **UND** bleibt diese Statusaenderung auf den Tab `Moderation` begrenzt

#### Scenario: Gekuerzter Freitext oeffnet Volltext-Overlay

- **WENN** eine Freitextantwort in der Moderationstabelle fuer die Uebersicht gekuerzt dargestellt wird
- **DANN** oeffnet ein Klick auf diesen Text ein Overlay mit dem vollstaendigen Freitext

#### Scenario: Freitextantwort kann geloescht werden

- **WENN** ein berechtigter Benutzer eine Freitextantwort in der Moderation entfernt
- **DANN** bietet die Moderationsansicht dafuer eine Loeschaktion pro Antwort an
- **UND** erfolgt diese Loeschung ueber den host-owned Survey-Mutationspfad

#### Scenario: Ergebnisse und Export sind im Survey-Modul erreichbar

- **WENN** ein berechtigter Benutzer den Tab `Ergebnisse` einer Survey oeffnet
- **DANN** zeigt das Plugin dort eine kompakte aggregierte Uebersicht ueber die Survey-Ergebnisse an
- **UND** bietet von dort aus die vorgesehenen Exportpfade fuer Survey-Ergebnisse an

#### Scenario: Interne Ergebnisansicht zeigt auch nicht freigegebene Freitexte read-only

- **WENN** ein berechtigter Benutzer die interne Ergebnisansicht oeffnet
- **DANN** kann diese Ansicht auch noch nicht freigegebene Freitextantworten als Teil der Ergebnisse anzeigen
- **UND** erfolgt deren Statusaenderung nicht im Tab `Ergebnisse`
- **UND** bleiben Freitextantworten dort read-only

#### Scenario: Freitexte erscheinen in der Ergebnisansicht nur nachgeordnet

- **WENN** der Tab `Ergebnisse` aggregierte Survey-Daten darstellt
- **DANN** bleiben Kennzahlen und aggregierte Resultate der primaere Fokus
- **UND** koennen Freitextantworten dort nur nachgeordnet, zum Beispiel ueber eine aufklappbare Darstellung, eingesehen werden

#### Scenario: Ergebnis-Export ohne Freitexte ist separat ausloesbar

- **WENN** ein berechtigter Benutzer einen internen Ergebnisexport ohne Freitextantworten benoetigt
- **DANN** bietet der Tab `Ergebnisse` eine eigene Exportaktion ohne Freitexte an
- **UND** stehen dafuer die Formate `CSV`, `JSON`, `Excel` und `XML` zur Verfuegung

#### Scenario: Ergebnis-Export mit Freitexten ist separat ausloesbar

- **WENN** ein berechtigter Benutzer einen internen Ergebnisexport inklusive Freitextantworten benoetigt
- **DANN** bietet der Tab `Ergebnisse` eine getrennte Exportaktion mit Freitexten an
- **UND** stehen dafuer die Formate `CSV`, `JSON`, `Excel` und `XML` zur Verfuegung
