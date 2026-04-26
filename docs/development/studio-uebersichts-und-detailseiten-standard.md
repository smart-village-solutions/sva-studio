# Studio-Standard für Übersichts- und Detailseiten

## Status

Entwurf für die einheitliche Gestaltung von fachlichen Übersichtsseiten und Detailseiten im Studio. Das Dokument ergänzt den bestehenden [Studio-Standard für Listen- und Tabellen-Seiten](./studio-list-page-standard.md) und soll nach Review als Referenz für neue oder migrierte Verwaltungsoberflächen dienen.

## Ziel

Übersichtsseiten und Detailseiten sollen im Studio konsistent aufgebaut sein, damit Nutzerinnen und Nutzer wiederkehrende Verwaltungsaufgaben ohne neue Orientierungskosten erledigen können. Die Gestaltung soll fachliche Unterschiede zulassen, aber Navigation, Seitengerüst, Aktionen, Zustände und Bearbeitungsflüsse vereinheitlichen.

## Geltungsbereich

Der Standard gilt für Studio-Seiten mit fachlichen Ressourcen wie Benutzer, Rollen, Gruppen, Organisationen, Instanzen, Inhalte und Rechtstexte.

Nicht im Geltungsbereich:

- öffentliche Website- oder Marketing-Seiten
- reine technische Debug- oder Betriebsansichten
- Dialoge ohne eigene Route
- Sonderseiten mit begründeter Architekturentscheidung

## Begriffe

- **Übersichtsseite**: Einstieg in eine fachliche Ressource mit kompakter Zusammenfassung, Filtern, Suche, Liste oder Tabellenbereich und optionalen Kennzahlen.
- **Detailseite**: Routbare Seite für eine einzelne Ressource mit Identität, Status, Metadaten, fachlichen Sektionen, Aktionen und Bearbeitungsmöglichkeiten.
- **Primäraktion**: Wichtigste Handlung der Seite, zum Beispiel `Neu erstellen`, `Speichern` oder `Einladen`.
- **Sekundäraktion**: Unterstützende Handlung, zum Beispiel `Exportieren`, `Synchronisieren`, `Deaktivieren` oder `Verlauf anzeigen`.

## Gestaltungsprinzipien

- Seiten folgen einer stabilen Informationshierarchie: Kontext, Identität, Zustand, Handlung, Inhalt.
- Listen- und Detailnavigation nutzt eigene Routen statt modalbasierter CRUD-Hauptflüsse.
- Fachliche Hooks, Mutationen und Berechtigungslogik bleiben in Route oder Feature-Modul; Layout- und Seitenstruktur liegen in Shared-Komponenten.
- Neue UI nutzt das Design-System und shadcn/ui; parallele Basis-Komponenten brauchen eine dokumentierte Architekturentscheidung.
- Fehlende Spezialelemente werden als Studio-Komponenten auf Basis von shadcn/ui-Primitives, Design-Tokens und Accessibility-Patterns umgesetzt.
- Host und Plugins nutzen dieselbe öffentliche UI-Basis. Plugin-Custom-Views dürfen keine App-internen Komponenten oder eigene Basis-Control-Systeme verwenden.
- Alle sichtbaren Texte kommen aus i18n-Keys und dürfen nicht hardcoded in Komponenten stehen.
- Aktionen werden nur angezeigt, wenn die Nutzerin oder der Nutzer sie im aktuellen Kontext ausführen darf.
- Lade-, Leer-, Fehler- und Berechtigungszustände sind Bestandteil des Seitenvertrags, nicht nachträgliche Sonderfälle.

## UI-Vertragsmodell für Host und Plugins

Das Studio erhält ein gemeinsames UI-Package `@sva/studio-ui-react` als öffentliche React/UI-Basis für Host-Seiten und Plugin-Custom-Views. Der Name macht die React/shadcn-Bindung bewusst sichtbar und hält einen neutralen Namen wie `@sva/studio-ui` für spätere framework-unabhängige UI-Verträge frei. Das Package ist der einzige erlaubte Importpfad für wiederverwendbare Studio-UI-Komponenten außerhalb der App.

### Ziel

Plugins sollen eigene Views bauen können, ohne eine eigene visuelle Sprache, eigene Basiscontrols oder direkte App-Abhängigkeiten einzuführen. Der Host bleibt verantwortlich für Shell, Routing, Guards und Standard-Admin-Fähigkeiten; `@sva/studio-ui-react` stellt die wiederverwendbaren UI-Bausteine bereit.

### Paketgrenzen

- `@sva/core` bleibt framework-agnostisch und enthält keine React-, shadcn- oder Browser-UI-Abhängigkeiten.
- `@sva/plugin-sdk` bleibt der Vertrag für Plugin-Metadaten, Registries, Admin-Ressourcen, Content-Type-Erweiterungen und Plugin-i18n.
- `@sva/studio-ui-react` wird ein React-basiertes UI-Package für Templates, Formularbausteine, Zustände, Tabellen, Header und Studio-Spezialcontrols.
- `apps/sva-studio-react` konsumiert `@sva/studio-ui-react` und verdrahtet Shell, Routing, Server-Funktionen und Host-Bindings.
- `@sva/plugin-*`-Packages dürfen für eigene Views `@sva/studio-ui-react` und `@sva/plugin-sdk` konsumieren, aber keine App-internen Komponenten importieren.

### Standardfall und Ausnahmefall

Der Standardfall bleibt host-rendered: CRUD-artige Admin-Ressourcen deklarieren ihre Fähigkeiten über `AdminResourceDefinition`, und der Host rendert Listen, Toolbars, Detailrahmen, Aktionen, Zustände und Navigation konsistent.

Der Ausnahmefall ist eine Plugin-Custom-View. Sie ist zulässig, wenn die Fachoberfläche nicht sinnvoll über Host-Metadaten beschrieben werden kann, zum Beispiel bei komplexen Editoren, Medienverwaltung, Karten-/Geo-Auswahl oder stark fachspezifischen Workflows. Solche Views müssen `@sva/studio-ui-react` für Seitenstruktur, Controls, Aktionen und Zustände verwenden.

### Durchsetzung

- Plugins importieren keine Komponenten aus `apps/sva-studio-react/src/components`.
- Plugins definieren keine eigenen `Button`, `Input`, `Select`, `Table`, `Tabs`, `Dialog` oder vergleichbaren Basiscontrols.
- Neue wiederverwendbare UI-Muster entstehen zuerst in `@sva/studio-ui-react` oder werden dort nachgezogen.
- shadcn/ui-Primitives werden in `@sva/studio-ui-react` gekapselt oder gezielt re-exportiert, damit Plugins nicht an App-Pfade gebunden sind.
- Nx-Boundaries und ESLint-Regeln müssen verbotene App-Imports und lokale Basis-Control-Duplikate in Plugins verhindern.
- Abweichungen von `@sva/studio-ui-react` brauchen eine dokumentierte Architekturentscheidung.

### Mindestumfang von `@sva/studio-ui-react`

Das Package startet mit einem bewusst kleinen, aber verbindlichen Umfang. Der erste umgesetzte MVP enthält die UI-Boundary, Basiscontrols, Page-/Form-/State-Primitives und `plugin-news` als Referenzverbraucher.

- umgesetzt im MVP: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Badge`, `Alert`, `Dialog`, `AlertDialog`, `Tabs`
- umgesetzt im MVP: `StudioPageHeader`, `StudioOverviewPageTemplate`, `StudioDetailPageTemplate`
- umgesetzt im MVP: `StudioField`, `StudioFieldGroup`, `StudioFormSummary`
- umgesetzt im MVP: `StudioStateBlock`, `StudioLoadingState`, `StudioEmptyState`, `StudioErrorState`
- Folgeumfang: Ressourcen-Header, Detail-Tabs, Sektionen, Editierflächen und Aktionsmenüs nach konkretem Host- oder Plugin-Bedarf
- Folgeumfang: Tabellen-/Listenbausteine und Bulk-Action-Kompositionen in Abstimmung mit dem Admin-Resource-Host-Standard
- Folgeumfang: Spezialcontrol-Wrapper für Rich-Text, Upload, Medienauswahl, Farbwahl, Icon-Auswahl und Geo-Auswahl, sobald sie mehrfach oder pluginübergreifend benötigt werden

Plugin-spezifische Wrapper sind erlaubt, wenn sie diese Bausteine komponieren und keine eigenen Varianten, Focus-/ARIA-Regeln oder Design-Tokens etablieren.

## Anforderungen an Übersichtsseiten

### Seitengerüst

Übersichtsseiten verwenden dieselbe Grundstruktur:

- Breadcrumbs aus der Shell
- Seitentitel mit fachlichem Ressourcenplural
- kurze Beschreibung des Zwecks der Seite
- optionale Primäraktion auf Titelhöhe rechts
- optionaler kompakter Status- oder Kennzahlenbereich
- Toolbar mit Suche, Filtern und sekundären Aktionen
- Listen-, Tabellen- oder Kartenbereich als Hauptinhalt
- Pagination oder Page-Size-Auswahl in einem konsistenten Bereich am Tabellen- oder Listenrand

### Navigation

- Die erste sichtbare Interaktion mit einer Zeile oder Karte führt zur Detailseite.
- Zeilenaktionen bleiben sekundär und dürfen die Detailnavigation nicht verdrängen.
- `Neu erstellen` führt auf eine eigene Create-Route, wenn der Erstellungsfluss mehr als eine einfache Bestätigung benötigt.
- Tabs werden nur für gleichrangige Bereiche innerhalb derselben Übersichtsseite verwendet.

### Daten und Zustand

- Suche und Filter werden über typisierte Search-Params abgebildet, wenn sie teilbare oder wiederherstellbare Ansichten erzeugen.
- Sortierung, Pagination und aktive Filter müssen nach Reload erhalten bleiben.
- Empty States unterscheiden zwischen "keine Daten vorhanden" und "Filter liefern keine Treffer".
- Fehlerzustände zeigen eine handlungsleitende Meldung und, falls vorhanden, sichere Diagnoseinformationen wie `requestId`.
- Bulk-Aktionen bleiben deaktiviert oder verborgen, bis eine Auswahl existiert.
- Badge- und Tag-Gruppen müssen lange Werte kontrolliert darstellen, zum Beispiel über Kürzung, Umbruch oder eine `+N`-Zusammenfassung.

### Tabellen und Listen

Tabellarische Übersichtsseiten folgen dem bestehenden [Studio-Standard für Listen- und Tabellen-Seiten](./studio-list-page-standard.md). Die konkreten Spalten richten sich nach der fachlichen Ressource und sind nicht verbindlich vorgegeben.

Typische Spaltenarten sind:

- Hauptspalte mit fachlichem Namen oder Titel als Einstieg in die Detailseite
- Zuordnungs- oder Kontextspalten, zum Beispiel Rollen, Gruppen, Organisationen oder Kategorien
- Statusspalte mit konsistenten Badges
- Metadatenspalten, zum Beispiel Version, Autor, Quelle oder letzte Änderung
- Aktionsspalte für sekundäre Zeilenaktionen

Die Spaltenüberschriften konkreter Seiten, zum Beispiel `Titel`, `Zugeordnete Rollen`, `Status`, `Version`, `Autor` oder `Zuletzt bearbeitet`, sind Beispiele. Sie dürfen nur übernommen werden, wenn sie zur jeweiligen Ressource passen.

### Aktionen

- Die Hauptinteraktion einer Zeile oder Karte führt zur Detailseite.
- Zeilenaktionen bleiben sekundär und verwenden zugängliche Namen sowie Tooltips bei Icon-only-Darstellung.
- Häufige Aktionen wie ansehen oder bearbeiten dürfen direkt in der Zeile stehen.
- Destruktive Aktionen wie löschen benötigen eine Bestätigung und sollen bei mehreren Aktionen bevorzugt in einem Aktionsmenü gebündelt werden.
- Primäraktionen im Seitenkopf bleiben fachlich eindeutig benannt, zum Beispiel `Neue Bestimmung` statt nur `Neu`.

## Anforderungen an Detailseiten

Detailseiten sind routbare Arbeitsflächen für genau eine fachliche Ressource. Sie müssen die Ressource eindeutig identifizierbar machen, den aktuellen Zustand sichtbar halten und Bearbeitung, Prüfung sowie sekundäre Verwaltungshandlungen klar voneinander trennen.

### Seitengerüst

Detailseiten verwenden dieselbe Grundstruktur:

- Rücknavigation oder Breadcrumbs mit Rückbezug auf die Übersichtsseite
- Seitentitel mit Bearbeitungs- oder Ansichtskontext, zum Beispiel `Account bearbeiten`
- kurze Beschreibung des fachlichen Zwecks der Seite
- Primäraktion auf Titelhöhe rechts, wenn die Seite eine eindeutige Hauptaktion hat
- Ressourcen-Header mit Identität, Status und zentralen Metadaten
- Tab-Navigation oder Sektionsnavigation für gleichrangige Detailbereiche
- aktiver Arbeitsbereich mit fachlichen Sektionen
- optionale Historie, Aktivität oder Audit-Information

### Kopfbereich

Der Kopfbereich der Seite beschreibt die aktuelle Aufgabe, nicht nur die Ressource. Er beantwortet die Frage, was die Nutzerin oder der Nutzer hier tun kann.

- Der Seitentitel benennt den Modus, zum Beispiel `Account bearbeiten`, `Rolle ansehen` oder `Bestimmung prüfen`.
- Die Beschreibung erklärt den fachlichen Umfang in einem Satz.
- Die Primäraktion steht rechts oben und bleibt unabhängig vom Scrollstand des Formulars leicht auffindbar, sofern das Layout dies zulässt.
- Speichern, Veröffentlichen, Einladen oder Erstellen sind typische Primäraktionen.
- Abbrechen, Zurück, Exportieren, Synchronisieren oder Deaktivieren sind keine Primäraktionen, wenn gleichzeitig ein fachlicher Abschluss wie Speichern möglich ist.
- Eine explizite Rücknavigation ist sinnvoll, wenn Detailseiten aus Tabellen oder Suchergebnissen geöffnet werden.

### Ressourcen-Header

Detailseiten mit stabiler Ressourcenidentität zeigen vor dem Arbeitsbereich eine kompakte Zusammenfassung der Ressource.

Der Ressourcen-Header enthält nach Möglichkeit:

- Avatar, Icon oder Ressourcentyp-Indikator
- fachlichen Anzeigenamen oder stabile Fallback-ID
- Status-Badge
- wichtigste Klassifikation, Rolle, Typ oder Kategorie
- ein bis drei zentrale Metadaten, zum Beispiel E-Mail, Organisation, letzte Aktivität, Quelle oder Version

Der Ressourcen-Header ist kein Formularersatz. Bearbeitbare Felder werden im Arbeitsbereich gepflegt; der Header zeigt den aktuellen Zustand als Orientierung.

### Identität und Status

- Der Titel zeigt den fachlichen Anzeigenamen. Wenn kein Anzeigename existiert, wird eine stabile technische ID angezeigt.
- Statuswerte verwenden konsistente Badges und dieselben Benennungen wie Übersichtsseiten.
- Kritische Zustände wie deaktiviert, gesperrt, nicht synchronisiert oder fehlerhaft müssen im Kopfbereich sichtbar sein.
- Metadaten wie Erstellungsdatum, letzte Änderung, Quelle oder Mandant werden kompakt und scannbar dargestellt.
- Rollen-, Typ- oder Kategorie-Badges müssen visuell schwächer gewichtet sein als kritische Status-Badges.
- Lange Namen, E-Mail-Adressen, IDs und Organisationsnamen müssen umbrechen oder gekürzt werden, ohne relevante Identität zu verlieren.

### Detailnavigation

Tabs sind auf Detailseiten erlaubt, wenn sie gleichrangige fachliche Bereiche derselben Ressource trennen. Sie dürfen nicht genutzt werden, um einen langen ungeordneten Inhalt künstlich aufzuteilen.

Geeignete Tab-Bereiche sind zum Beispiel:

- Stammdaten oder persönliche Daten
- Verwaltung
- Berechtigungen oder Freigabe
- Beziehungen und Zuordnungen
- Synchronisation oder Diagnose
- Historie oder Audit

Tabs müssen typisiert über Search-Params abgebildet werden, wenn ihr Zustand teilbar, wiederherstellbar oder testrelevant ist. Der aktive Tab muss visuell eindeutig und per Tastatur erreichbar sein.

### Arbeitsbereich

Der aktive Detailbereich ist die zentrale Arbeitsfläche der Seite. Er darf visuell gegenüber Header und Navigation abgesetzt sein, soll aber ruhig und gut scannbar bleiben.

- Formularbasierte Bearbeitung kann eine getönte Arbeitsfläche nutzen, wenn sie Eingabefelder und Auswahlfelder besser hervortreten lässt.
- Die Tönung bleibt zurückhaltend und darf nicht mit Statusfarben konkurrieren.
- Eingabefelder, Labels, Hilfetexte, Pflichtkennzeichen und Fehlermeldungen müssen auf der Arbeitsfläche ausreichend Kontrast haben.
- Große Arbeitsflächen brauchen klare Abschnittsüberschriften, Abstände oder Trennungen, damit der Inhalt nicht als unstrukturierter Block wirkt.
- Rein lesende Detailbereiche können auf eine getönte Arbeitsfläche verzichten und stattdessen mit Abschnitten, Definition Lists oder Tabellen arbeiten.

### Bearbeitung

- Detailseiten trennen Lesen, Bearbeiten und gefährliche Aktionen klar.
- Inline-Bearbeitung ist nur für kurze, risikoarme Felder vorgesehen.
- Umfangreiche Bearbeitung nutzt Formularsektionen oder eigene Bearbeitungsrouten.
- Destruktive Aktionen benötigen eine Bestätigung und eine klare Beschreibung der Auswirkung.
- Nach Mutationen bleibt die Nutzerin oder der Nutzer auf der Detailseite, sofern die Ressource weiter existiert.
- Pflichtfelder werden visuell und semantisch erkennbar markiert.
- Validierungsfehler stehen am Feld und zusätzlich in einer zusammenfassenden Meldung, wenn mehrere Fehler auftreten.
- Ungespeicherte Änderungen müssen erkennbar sein, wenn Nutzerinnen oder Nutzer die Seite verlassen oder den Tab wechseln.
- Speichern darf erst erfolgreich wirken, wenn serverseitige Validierung und Persistenz abgeschlossen sind.
- Nach erfolgreichem Speichern wird der Ressourcen-Header aktualisiert, wenn sich dort angezeigte Werte geändert haben.

### Sektionen

Detailseiten ordnen Inhalte nach fachlicher Relevanz:

1. Zusammenfassung und Status
2. Stammdaten
3. Beziehungen und Zuordnungen
4. Berechtigungen oder Wirksicht
5. Synchronisation, technische Metadaten oder Diagnose
6. Historie oder Audit

Nicht jede Detailseite muss alle Sektionen anzeigen. Fehlende Sektionen werden nicht als leere Platzhalter gerendert.

### Formularraster

Formularbereiche verwenden ein konsistentes Raster:

- Auf Desktop bevorzugt zwei Spalten für kurze bis mittlere Felder.
- Felder mit langen Inhalten, Adressen, Beschreibungen oder mehrzeiligen Eingaben dürfen volle Breite nutzen.
- Zusammengehörige Felder stehen räumlich nah beieinander.
- Feldlabels stehen dauerhaft sichtbar am Feld und verschwinden nicht nur als Placeholder.
- Hilfetexte erklären fachliche Einschränkungen, nicht offensichtliche Bedienung.
- Auf Mobile wird das Raster einspaltig.

### Eingabe- und Bearbeitungselemente

Detailseiten verwenden ein konsistentes Inventar an Eingabe- und Bearbeitungselementen. Die konkrete Auswahl richtet sich nach Datentyp, Eingaberisiko und Bearbeitungshäufigkeit; Controls dürfen nicht nur aus optischen Gründen gegeneinander ausgetauscht werden.

Alle Standard-Controls werden bevorzugt aus shadcn/ui komponiert. Dazu gehören insbesondere `Input`, `Textarea`, `Select`, `Checkbox`, `Button`, `Badge`, `Tabs`, `Dialog`, `AlertDialog`, `Alert`, `Card` und `Collapsible`. Wenn weitere shadcn/ui-Primitives benötigt werden, zum Beispiel `RadioGroup`, `Slider`, `Calendar`, `Popover`, `Accordion`, `DropdownMenu`, `Tooltip`, `Command`, `Separator`, `Skeleton` oder `Progress`, werden sie gezielt ergänzt statt lokal neu erfunden.

#### Text und Zahlen

- Einzeilige Textfelder werden für kurze, klar begrenzte Inhalte verwendet.
- Mehrzeilige Textfelder werden für längere Freitexte und Beschreibungen verwendet.
- Rich-Text-Editoren werden nur eingesetzt, wenn Formatierung fachlich erforderlich ist.
- Zahlenfelder verwenden numerische Eingabetypen und validieren Min-, Max- und Schrittweiten serverseitig.
- E-Mail, Telefon, URL und Passwort nutzen spezialisierte Feldtypen mit passender Tastatur, Validierung und optionalen Feldaktionen.
- Passwortfelder brauchen eine Anzeigen-/Verbergen-Aktion mit zugänglichem Namen.

#### Auswahlfelder

- Checkboxen werden für unabhängige Ja/Nein-Entscheidungen verwendet.
- Radio-Gruppen werden für wenige gegenseitig ausschließende Optionen verwendet.
- Select- oder Combobox-Felder werden für längere Optionslisten verwendet.
- Multi-Select wird verwendet, wenn mehrere Werte aus einer größeren Menge gewählt werden können.
- Checkbox-Gruppen werden verwendet, wenn alle Optionen gleichzeitig sichtbar sein sollen.
- Pflichtauswahlen müssen einen klaren Leerzustand und eine validierbare Auswahl besitzen.

#### Datum, Zeit und Bereiche

- Datums- und Zeitfelder verwenden spezialisierte Picker oder Eingaben mit klarer Formatierung.
- Gespeicherte Datums- und Zeitwerte müssen Zeitzonen- und Locale-Anforderungen der jeweiligen Domäne berücksichtigen.
- Slider werden nur für grobe, explorative Werte verwendet, nicht für präzise Pflichtwerte.
- Bereichsslider zeigen immer aktuellen Wert, Minimalwert und Maximalwert sichtbar an.
- Für präzise Bereichswerte muss zusätzlich eine direkte numerische Eingabe möglich sein, wenn Genauigkeit fachlich relevant ist.

#### Medien und Spezialfelder

- Datei-Uploads zeigen erlaubte Formate, Größenbeschränkungen und Upload-Zustand vor der Auswahl sichtbar an.
- Drag-and-Drop darf Click-to-Upload nicht ersetzen.
- Medienauswahl und neuer Upload werden als gleichrangige, klar benannte Optionen dargestellt.
- Farbwerte zeigen sowohl eine Farbvorschau als auch den editierbaren Wert, zum Beispiel als Hex-Code.
- Icon-Auswahl zeigt ausgewähltes Icon, zugänglichen Namen und eine klare Auswahlaktion.
- Bewertungsfelder werden nur für echte Bewertungsdomänen eingesetzt und müssen Tastaturbedienung unterstützen.

Spezialelemente wie Rich-Text-Editor, Datei-Upload, Medienverwaltung, Farbauswahl, Icon-Auswahl, Bewertung und Geo-Auswahl werden als Studio-Komponenten gekapselt. Sie verwenden shadcn/ui für Buttons, Dialoge, Popover, Menüs, Alerts, Badges und Formularzustände, dürfen aber domänenspezifische Logik oder externe Fachbibliotheken enthalten.

#### Feldaufbau

Jedes Formularfeld besteht aus:

- dauerhaft sichtbarem Label
- optionalem Pflichtkennzeichen
- Eingabe- oder Auswahl-Control
- optionalem Hilfetext
- optionaler Feldaktion, zum Beispiel Anzeigen, Auswählen oder Hochladen
- Validierungs- oder Fehlermeldung am Feld

Hilfetexte stehen unter dem Feld und erklären Format, Einschränkung oder fachliche Wirkung. Info-Icons sind ergänzend erlaubt, dürfen aber keinen notwendigen Pflichtkontext verstecken.

### Struktur- und Gruppierungselemente

Formulare werden über fachliche Gruppen organisiert, nicht über technische Komponentenlisten.

- Fieldsets gruppieren eng zusammengehörige Felder.
- Akkordeons sind für selten bearbeitete oder optionale Bereiche erlaubt, aber nicht für Pflichtinformationen, die vor dem Speichern geprüft werden müssen.
- Verschachtelte Bereiche sind sparsam einzusetzen und brauchen klare Überschriften.
- Große Formulare müssen in scanbare Abschnitte mit Zwischenüberschriften, Abstand und optionaler Sektionsbeschreibung gegliedert werden.
- Zusammenklappbare Bereiche behalten ihren Fehlerzustand sichtbar, auch wenn sie geschlossen sind.

### Aktionen

Detailseiten unterscheiden drei Aktionsebenen:

- **Primäraktion**: fachlicher Abschluss der Seite, zum Beispiel `Speichern`, `Veröffentlichen` oder `Einladung senden`.
- **Sekundäraktionen**: unterstützende Handlungen, zum Beispiel `Synchronisieren`, `Exportieren`, `Verlauf anzeigen` oder `Einladung erneut senden`.
- **Destruktive Aktionen**: risikobehaftete Handlungen, zum Beispiel `Deaktivieren`, `Löschen` oder `Zugriff entziehen`.

Sekundäraktionen stehen in einer kompakten Button-Gruppe oder in einem Aktionsmenü. Destruktive Aktionen stehen nicht direkt neben der Primäraktion, außer eine fachliche Prüfung zeigt, dass sie häufig und sicher erforderlich sind. Jede destruktive Aktion benötigt eine Bestätigung mit konkreter Auswirkung.

### Zustände

Detailseiten müssen folgende Zustände abdecken:

- Laden der Ressource
- Ressource nicht gefunden
- Zugriff verweigert
- Fehler beim Laden
- Fehler beim Speichern oder Ausführen einer Aktion
- leere fachliche Sektion, zum Beispiel keine Historie oder keine Zuordnungen
- schreibgeschützter Zustand bei fehlender Berechtigung oder gesperrter Ressource

Fehlerzustände zeigen, soweit verfügbar, sichere Diagnoseinformationen wie `requestId`, aber keine PII oder internen Provider-Details.

## Gemeinsame Komponenten

Für die spätere Umsetzung werden folgende Shared-Komponenten vorgesehen:

- `StudioPageHeader` für Titel, Beschreibung, Status, Metadaten und Aktionen
- `StudioOverviewPageTemplate` für Übersichtsseiten mit Toolbar- und Inhalts-Slots
- `StudioDetailPageTemplate` für Detailseiten mit Header-, Aktions- und Sektions-Slots
- `StudioResourceHeader` für Avatar oder Icon, Anzeigename, Status, Klassifikation und zentrale Metadaten
- `StudioDetailTabs` für typisierte Tab-Navigation innerhalb einer Ressource
- `StudioSection` für benannte Detailbereiche
- `StudioEditSurface` für getönte formularbasierte Arbeitsflächen
- `StudioStateBlock` für Loading, Empty, Error und Forbidden States
- `StudioActionMenu` für sekundäre und destruktive Aktionen

Die Komponenten dürfen keine fachliche Datenbeschaffung enthalten. Sie nehmen gerenderte Inhalte, Statusinformationen und Aktionen über Props oder Slots entgegen.
Studio-Komponenten sind Wrapper auf Design-System- und shadcn/ui-Basis. Sie dürfen Styling, Layout, Accessibility-Verhalten und Zustandsdarstellung vereinheitlichen, aber keine parallelen Basis-Controls mit eigener visueller Sprache einführen.

## Responsive Verhalten

- Auf Desktop stehen Inhalt und Aktionen dicht, aber nicht überladen.
- Auf Tablet bleiben Header, Toolbar und Hauptinhalt untereinander stabil nutzbar.
- Auf Mobile werden Tabellen zu Kartenansichten oder responsiven Listen.
- Primäraktionen bleiben erreichbar, ohne den Titelbereich zu überdecken.
- Lange Namen, IDs und E-Mail-Adressen umbrechen kontrolliert und sprengen keine Container.
- Getönte Editierflächen behalten auch auf Mobile ausreichend Innenabstand und eine klare Abgrenzung zwischen Formularsektionen.

## Accessibility und Tastaturbedienung

- Überschriften folgen einer logischen Hierarchie.
- Interaktive Zeilen oder Karten haben sichtbare Fokuszustände.
- Icon-only-Aktionen erhalten zugängliche Namen und Tooltips.
- Status darf nicht ausschließlich über Farbe vermittelt werden.
- Dialoge, Menüs und Bestätigungen sind per Tastatur vollständig bedienbar.
- Fehler- und Ladezustände werden für Assistive Technologies verständlich angekündigt.

## Berechtigungen und Sicherheit

- Autorisierbare Aktionen verwenden fully-qualified Action-IDs im Format `<namespace>.<actionName>`.
- Nicht erlaubte Aktionen werden bevorzugt ausgeblendet; wenn Sichtbarkeit fachlich notwendig ist, werden sie deaktiviert und begründet.
- Fehlerdetails bleiben allowlist-basiert und dürfen keine PII oder internen Provider-Details offenlegen.
- Clientseitige Validierung verbessert die Bedienung, ersetzt aber keine serverseitige Validierung.

## Erster inhaltlicher Entwurf

### Übersichtsseite

```text
Breadcrumb

Titel                         Primäraktion
Beschreibung

Status/Kennzahlen, falls fachlich hilfreich

Toolbar: Suche | Filter | Ansicht | Sekundäraktionen

Tabelle/Liste/Karten
  - Auswahl nur bei Bulk-Aktionen
  - Hauptspalte führt zur Detailseite
  - Status und wichtigste Metadaten sind sichtbar
  - Aktionsspalte bleibt rechts

Pagination oder Lade-mehr-Bereich
```

Beispiel für Benutzer:

- Titel: `Benutzer`
- Beschreibung: `Benutzerkonten, Rollen und Zugriffsstatus verwalten.`
- Primäraktion: `Benutzer einladen`
- Kennzahlen: `Aktiv`, `Deaktiviert`, `Einladung offen`
- Toolbar: Suche nach Name oder E-Mail, Statusfilter, Rollenfilter
- Hauptinhalt: Tabelle mit Name, E-Mail, Status, Rollen, letzte Aktivität, Aktionen

### Detailseite

```text
Zurück oder Breadcrumb

Seitentitel                   Primäraktion
Beschreibung

Ressourcen-Header
  Avatar/Icon | Anzeigename | Status | Typ/Rolle/Kategorie
  zentrale Metadaten

Tabs oder Sektionsnavigation

Aktiver Arbeitsbereich
  Abschnitt: Zusammenfassung oder persönliche Daten
  Abschnitt: Stammdaten
  Abschnitt: Beziehungen und Zuordnungen
  Abschnitt: Berechtigungen oder Wirksicht
  Abschnitt: Synchronisation und Diagnose
  Abschnitt: Historie oder Audit
```

Beispiel für Benutzer:

- Seitentitel: `Account bearbeiten`
- Beschreibung: `Account-Daten, Berechtigungen und Sicherheitseinstellungen verwalten.`
- Ressourcen-Header: Initialen, Anzeigename, Status, Rolle, E-Mail, Organisation, letzter Login
- Primäraktion: `Speichern`, falls die Seite im Bearbeitungsmodus ist
- Sekundäraktionen: `Deaktivieren`, `Einladung erneut senden`, `Synchronisieren`
- Tabs: persönliche Daten, Verwaltung, Freigabe, Historie
- Stammdaten: Name, E-Mail, Profilfelder
- Beziehungen: Rollen, Gruppen, Organisationen
- Berechtigungen: direkte Rechte und effektive Wirksicht
- Diagnose: Sync-Status und sichere Fehlerdetails
- Historie: relevante Konto- und Rollenänderungen

## Akzeptanzkriterien

- Neue Übersichts- und Detailseiten nutzen die definierte Seitenstruktur oder dokumentieren eine begründete Abweichung.
- Primär- und Sekundäraktionen stehen konsistent im Header oder in der Toolbar.
- Search-Params, Path-Params und Tabs sind typisiert.
- Alle sichtbaren Texte verwenden i18n-Keys.
- Empty, Loading, Error und Forbidden States sind pro Seite abgedeckt.
- Seiten erfüllen WCAG 2.1 AA und sind per Tastatur bedienbar.
- Betroffene Unit-, Type-, ESLint- und E2E-Tests werden für umgesetzte Seiten ergänzt oder angepasst.

## Offene Fragen

- Soll `StudioListPageTemplate` in `StudioOverviewPageTemplate` aufgehen oder als spezialisierte Tabellenvariante bestehen bleiben?
- Welche Detailseiten brauchen eigene Edit-Routen statt Formularsektionen auf derselben Route?
- Welche Kennzahlen sind auf Übersichtsseiten standardmäßig erlaubt, ohne zusätzliche Backend-Last zu erzeugen?
- Wie stark sollen Plugin-Seiten an denselben Detailseitenstandard gebunden werden?
