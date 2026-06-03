# Redesign der Medienverwaltung

## Ziel

Die Medienverwaltung soll von einer technisch funktionalen, aber schwer
scanbaren Admin-Oberfläche zu einer klar bibliotheksgeführten
Arbeitsoberfläche werden.

Nutzer sollen innerhalb weniger Sekunden verstehen:

- welche Medien besondere Aufmerksamkeit brauchen
- welche Assets vorhanden sind
- wo ein Asset verwendet wird
- welche nächste Aktion für ein Asset sinnvoll ist

Die Oberfläche bleibt bewusst eine Medienbibliothek und wird nicht zu einem
separaten Operations-Dashboard umgebaut.

## Problem

Die aktuelle Medienverwaltung leidet in drei Bereichen:

- Die Listenansicht wirkt tabellarisch und trocken, obwohl Medien primär
  visuell bewertet werden.
- Der Upload-Einstieg nimmt viel Raum ein, ohne proportional viel
  Informationswert zu liefern.
- Die Detailseite mischt Metadatenpflege, Delivery, Nutzung und Aktionen in
  einer langen Formularfläche ohne starke Hierarchie.

Dadurch ist die Seite zwar funktional, aber nicht schnell lesbar. Gerade die
wichtigen Fragen "Ist dieses Asset problematisch?", "Wird es benutzt?" und
"Kann ich es gefahrlos ändern oder löschen?" werden zu spät sichtbar.

## Entscheidung

Die Medienverwaltung wird auf ein bibliotheksgeführtes Modell mit kompakter
Prioritätszone umgestellt.

Die Zielrichtung ist:

1. Bibliothek zuerst
2. kompakte Prioritäts-Signale darüber
3. Asset-Workspace statt langer Detailform

Das Verhältnis bleibt klar:

- die Bibliothek ist die Hauptfläche
- operative Signale helfen beim Einstieg
- Detail- und Upload-Pfade sprechen dieselbe visuelle Sprache

## Gestaltungsprinzipien

### Bibliothek vor Formular

Die Startseite `/admin/media` wird primär über Asset-Karten und visuelle
Vorschauen organisiert, nicht über eine reine Datentabelle.

### Aufmerksamkeit ohne Dashboard-Übergewicht

Status wie `blockiert`, `neu/unvollständig` und `ungenutzt` werden sichtbar,
aber als kompakte Signale. Die Medienbibliothek bleibt der visuelle
Schwerpunkt.

### Nutzung und Löschbarkeit früh zeigen

Nutzungszahl, Referenzlage und kritische Delivery-/Processing-Signale werden
bereits in Bibliothek und Detailseite deutlich eingebunden.

### Nicht-Bild-Medien gleichwertig behandeln

Dokumente und Videos dürfen im Grid nicht wie Lückenfüller wirken. Sie
erhalten eigene, aber gleichwertige Kartenmuster.

## Routenmodell

### `/admin/media`

Diese Route wird zur führenden Bibliotheksseite.

Sie enthält:

- eine kompakte Intake-Leiste für Upload-Einstieg
- einen kleinen Prioritäts-Shelf
- eine filterbare Asset-Bibliothek im Grid
- optional ein leichtes Auswahl- oder Kontextverhalten pro Asset

### `/admin/media/new`

Die Route bleibt erhalten, wird aber als vorbereitender Upload-Workspace
gedacht, nicht als nacktes Rohformular.

Sie enthält:

- vorbereitende Upload-Eingaben
- Sichtbarkeitswahl
- klaren nächsten Schritt nach Initialisierung
- Ergebnisfläche für Asset-ID, Upload-Session und Upload-URL

### `/admin/media/$mediaId`

Die Detailroute wird zum Asset-Workspace.

Sie zeigt:

- Preview und Kernstatus
- Nutzung und Referenzen
- Delivery- und Verarbeitungszustand
- Metadatenpflege
- bildspezifische Fokuspunkte und Crop-Angaben
- gefährliche Aktionen klar separiert

### `/admin/media/$mediaId/usage`

Die bisherige Usage-Route wird nicht als eigener primärer Arbeitsmodus
fortgeführt.

Die Referenz- und Nutzungsinformationen werden in die Detailseite integriert.
Eine separate Usage-Route kann höchstens als technische Zwischenstufe
bestehen, soll im Zielbild aber keine führende Nutzerroute mehr sein.

## Seitenaufbau

### Medienbibliothek

Die Bibliotheksseite besteht aus vier Ebenen.

#### 1. Kopfbereich

Oben steht ein knapper Bibliothekskopf mit:

- Titel
- kurzer Beschreibung
- primärer Upload-Aktion
- Ergebniszahl

Der Kopf dient nur der Orientierung und darf nicht durch große
Leerräume aufgebläht werden.

#### 2. Intake-Leiste

Statt eines großen Hero-Upload-Blocks wird eine kompakte Intake-Leiste
eingesetzt.

Sie enthält:

- kurzen Einstiegstext
- optional reduzierte Dropzone
- klaren Upload-CTA
- Hinweise auf unterstützte Medientypen

Die Intake-Leiste darf im ersten Viewport nicht mehr Fläche beanspruchen als
die erste Reihe der Bibliothek.

#### 3. Prioritäts-Shelf

Unter dem Intake folgt ein kompakter Shelf mit drei Signalen:

- `Blockiert`
- `Neu`
- `Ungenutzt`

Diese Signale dienen als schnelle Orientierung, nicht als eigener
Steuerungsmodus.

Jede Box zeigt:

- Anzahl
- kurze Einordnung
- optional anklickbaren Filtereinstieg

#### 4. Bibliotheksgrid

Die Hauptfläche ist ein Karten-Grid.

Jede Asset-Karte zeigt mindestens:

- Vorschau oder typgerechtes Ersatzmuster
- Titel oder sinnvollsten Fallback
- Formatbadge
- Dateigröße
- Nutzungssignal
- Primärstatus
- optionalen Problemhinweis

Typische Problemhinweise:

- keine Referenzen
- Delivery fehlgeschlagen
- Processing fehlgeschlagen
- Metadaten unvollständig

### Upload-Vorbereitung

Die Upload-Seite wird auf drei Ebenen reduziert:

1. knapper Kopf
2. vorbereitendes Eingabepanel
3. Ergebnis-/Nächste-Schritte-Panel

Die Seite erklärt nicht generisch „Upload vorbereiten“, sondern konkret:

- was jetzt konfiguriert wird
- was erst nach der Initialisierung passiert
- wie das Asset anschließend weiterbearbeitet wird

### Asset-Workspace

Die Detailseite wird in einen klaren Workspace aufgeteilt.

#### Oberer Workspace-Kopf

Oben stehen:

- Preview
- Titel
- Sichtbarkeit
- Upload-/Processing-Status
- Referenzanzahl
- primäre Aktionen

Die wichtigsten Entscheidungen müssen hier bereits möglich oder klar
vorbereitet sein.

#### Metadaten-Bereich

Metadaten werden in einer eigenen, sauber getrennten Sektion gepflegt:

- Titel
- Alt-Text
- Beschreibung
- Copyright
- Lizenz

#### Bildfokus und Zuschnitt

Fokuspunkt und Crop bleiben im Detailpfad, werden aber als eigene fachliche
Sektion dargestellt und nicht optisch gleichrangig mit allen Standardfeldern
vermischt.

#### Nutzung und Referenzen

Referenzinformationen gehören in den Detail-Workspace selbst:

- Gesamtzahl
- Zieltypen
- Ziel-IDs
- Rollen
- mögliche Sortierreihenfolge

Diese Informationen sind zentral für Löschbarkeit und Risikobewertung.

#### Delivery und technische Zustände

Delivery-URL, Ablaufzeit und technische Stati werden in eine technische
Sektion verschoben. Sie bleiben sichtbar, dominieren aber nicht den
Metadatenbereich.

## Datenfluss

### Bibliothek

Die bestehende Bibliotheksabfrage bleibt grundsätzlich erhalten.

Zusätzlich wird im UI ein View-Model aufgebaut, das aus den gelieferten
Assets ableitet:

- Bibliothekskartenstatus
- Prioritätszählungen
- visuelle Problemhinweise

Wenn für `blockiert`, `neu` oder `ungenutzt` einzelne Signale noch nicht
deterministisch aus dem vorhandenen Vertrag ableitbar sind, dürfen kleine,
gezielte Vertragsergänzungen erfolgen. Neue Spezialendpunkte ohne klare
Notwendigkeit werden vermieden.

### Detail

Die bestehende Detailabfrage mit Asset, Usage und Delivery bleibt die Basis.

Die Integration der bisherigen Usage-Route in den Detail-Workspace geschieht
über dieselben Datenquellen. Es soll kein zweiter paralleler
Nutzungs-Contract entstehen.

## Komponentenstruktur

Die bestehende Route `-media-page.tsx` wird in kleinere Bausteine geschnitten.

Zielstruktur:

- `MediaLibraryShell`
- `MediaIntakeShelf`
- `MediaPriorityShelf`
- `MediaAssetGrid`
- `MediaAssetCard`
- `MediaLibraryToolbar`
- `MediaUploadPreparationForm`
- `MediaAssetWorkspace`
- `MediaAssetMetadataSection`
- `MediaAssetImageControlsSection`
- `MediaAssetUsageSection`
- `MediaAssetTechnicalSection`

Die Komponentengrenzen folgen der Oberfläche, nicht nur der bisherigen
Route-Aufteilung.

## Zustandsmodell

Für die Bibliothek werden stabile UI-Zustände definiert:

- `bereit`
- `neu`
- `blockiert`
- `ungenutzt`

Diese Zustände sind reine UI-Klassen und müssen deterministisch aus
vorhandenen oder gezielt ergänzten Feldern ableitbar sein.

Sie werden in Karten, Shelf und Kontextdarstellungen einheitlich verwendet.

## Fehler-, Leer- und Ladefälle

### Bibliothek

- Ladezustand als bibliotheksgeeignete Skeleton- oder Platzhalterfläche
- leerer Zustand mit sinnvollem Upload-Einstieg
- Fehlerzustand mit knapper, klarer Fehlersprache

### Upload

- Eingabefehler direkt an relevanten Feldern
- API-Fehler als gut sichtbare, aber kompakte Fehlerfläche
- nach erfolgreicher Initialisierung klare nächste Schritte statt nur
  Rohdatenanzeige

### Detail

- fehlendes Asset als harter Fehlerzustand
- Delivery-/Usage-Probleme als Teilzustände innerhalb des Workspaces
- destruktive Aktionen deutlich getrennt von normalen Bearbeitungsaktionen

## Nicht-Ziele

Dieses Redesign umfasst bewusst nicht:

- eine vollständige neue Medien-Workflow-Engine
- komplexe Bulk-Operations-Logik jenseits der bestehenden Grundlagen
- einen separaten Operations-Dashboard-Modus
- neue Medienverarbeitungs-Backends

## Tests

Die Tests werden auf Scanbarkeit und Zustandslogik ausgerichtet.

Mindestens abzusichern:

- Bibliothek mit Prioritäts-Shelf
- kompakter Upload-Einstieg
- Asset-Karten für Bild, Video und Dokument
- Problemhinweise und Nutzungsindikatoren auf Karten
- leerer und fehlerhafter Bibliothekszustand
- Upload-Vorbereitungsseite mit Ergebniszustand
- Detail-Workspace mit integrierter Nutzung
- keine führende Abhängigkeit mehr auf eine separate Usage-Seite

Die vorhandenen Hook-Tests dürfen weitgehend bestehen bleiben. Die
seitennahen UI-Tests müssen jedoch explizit das neue Informationsmodell
absichern.

## Rollout

Die Umsetzung erfolgt in einem UI-getriebenen Refactor auf den bestehenden
Medienrouten.

Empfohlene Reihenfolge:

1. Bibliothek und Kartenmodell
2. Upload-Vorbereitung
3. Detail-Workspace
4. Integration oder Rückbau der separaten Usage-Route

So bleibt der Nutzwert früh sichtbar, während die größte UI-Wirkung zuerst in
der Bibliothek entsteht.
