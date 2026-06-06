# Instanz-Lebenszyklus, Betriebsansicht und Doctor-Navigation

## Ziel

Die Instanzverwaltung unter `/admin/instances` soll entlang des tatsächlichen
Nutzerarbeitsablaufs neu strukturiert werden:

- `Anlage` als eigener, abgeschlossener Wizard
- `Setup abschließen` als einmaliger Inbetriebnahme-Flow
- `Betrieb` als ruhige Standardansicht für Bestandsinstanzen
- `Doctor` als dauerhaft erreichbarer Diagnose- und Reparaturmodus
- `Einstellungen` als nachgeordneter Bereich für Stammdaten und Vertragswerte

Das Ziel ist nicht nur eine optische Überarbeitung, sondern eine klare
Informationsarchitektur mit fokussierten Arbeitsmodi statt einer überladenen
All-in-one-Detailseite.

## Problem

Die bestehende Instanz-Detailseite mischt heute mehrere unterschiedliche
Nutzerintentionen auf derselben Fläche:

- einmalige Inbetriebnahme einer neu angelegten Instanz
- laufende Betriebsverwaltung
- Modul- und IAM-Arbeit
- technische Diagnose und Reconcile
- Historie technischer Läufe
- Stammdaten- und Vertragsänderungen

Dadurch entstehen mehrere Probleme:

- Die visuelle Hierarchie ist unklar, weil Status, Aktionen, Diagnose und
  Konfiguration gleichzeitig um Aufmerksamkeit konkurrieren.
- Der Erstblick ist zu technisch und zu voll.
- Der Unterschied zwischen `neu angelegt`, `in Inbetriebnahme` und `im
  laufenden Betrieb` ist nicht sauber abgebildet.
- Spätere Bestandsverwaltung fühlt sich zu stark wie fortgesetztes Setup an.

## Leitentscheidung

Die Oberfläche wird entlang von Lebensphasen und Arbeitsmodi getrennt.

Die zentrale Entscheidung lautet:

1. `Anlage` bleibt ein eigener Wizard.
2. Nach erfolgreicher Anlage folgt ein separater einmaliger Flow
   `Setup abschließen`.
3. Erst danach beginnt die normale Bestandsverwaltung.
4. Die Bestandsverwaltung besitzt drei dauerhafte Modi:
   - `Betrieb`
   - `Doctor`
   - `Einstellungen`

## Lebenszyklusmodell

### 1. Anlage

Die Anlage einer Instanz bleibt ein geführter Wizard. Diese Phase dient nur der
Erfassung und Prüfung der initialen Vertrags- und Basisdaten.

Sie ist bewusst getrennt von späterer Betriebsarbeit.

### 2. Setup abschließen

Nach der Anlage wird der Nutzer direkt in einen einmaligen Setup-Abschluss
geführt. Dieser Pfad ist kein dauerhafter Hauptarbeitsbereich und keine
Bestandsansicht.

`Setup abschließen` ist fachlich erst beendet, wenn beide Bedingungen erfüllt
sind:

- die Instanz ist aktiv
- die Tenant-Admin-Struktur ist initialisiert

Die Setup-Sprache und Setup-Aktionen sollen später im Bestandsbetrieb nicht die
Hauptoberfläche dominieren.

### 3. Bestandsverwaltung

Sobald das Setup abgeschlossen ist, beginnt die normale Verwaltung der Instanz.
Diese Phase ist nicht mehr setup-zentriert, sondern auf wiederkehrende
Verwaltungs- und Diagnoseaufgaben ausgerichtet.

## Bestandsnavigation

### Grundstruktur

Die Bestandsseite besitzt drei dauerhafte Hauptansichten:

- `Betrieb`
- `Doctor`
- `Einstellungen`

### Standardansicht

Die Standardansicht für vollständig eingerichtete Instanzen ist `Betrieb`.

Begründung:

- Der häufigste Happy Path ist die normale Betriebsverwaltung.
- Für diese Instanzen soll nicht mehr der Eindruck entstehen, ein Setup laufe
  weiterhin im Vordergrund.
- Diagnose und Stammdatenpflege bleiben erreichbar, dominieren aber nicht den
  Erstblick.

### Verantwortung der Ansichten

#### Betrieb

`Betrieb` ist die ruhige Standardansicht für laufende Instanzverwaltung.

Primäre Aufgaben:

- Module zuweisen und entziehen
- IAM-Basis-bezogene Standardaktionen
- alltägliche Verwaltungsarbeit an der aktiven Instanz

Der Happy Path der Modulverwaltung soll diese Ansicht visuell dominieren.

#### Doctor

`Doctor` ist ein eigener Diagnose- und Reparaturmodus für Bestandsinstanzen.

Er ist kein Ersatz für das Setup und kein versteckter Fehlerdialog, sondern ein
dauerhaft sichtbarer Einstiegspunkt für:

- Diagnose offener Befunde
- Rechte- oder Reconcile-Probleme
- Drift zwischen Registry, Tenant-IAM und Keycloak
- geführte Reparatur- und Validierungsschritte
- technische Historie im Kontext von Diagnose und Reparatur

#### Einstellungen

`Einstellungen` bündelt seltenere Änderungen an Stammdaten und
Vertragskonfiguration.

Dazu gehören insbesondere:

- Anzeigename
- Parent-Domain
- Realm-/Client-Zuordnung
- Issuer- und Secret-bezogene Vertragswerte
- Tenant-Admin- und Client-Basisdaten

Diese Inhalte sollen bewusst nicht mehr in der Hauptarbeitsfläche des
Bestandsbetriebs dominieren.

## Kopf der Bestandsseite

Die Bestandsseite benötigt einen kompakten, klar priorisierten Kopf.

### Inhalte des Kopfs

Der Kopf enthält:

- Instanzidentität
- `Setup-Status`
- `Betriebsstatus`
- feste Aktionszone für `Doctor öffnen`

### Prinzip

Der Kopf dient nur der Orientierung und dem schnellen Wechsel in den passenden
Arbeitsmodus. Er soll nicht die vollständige Arbeitslogik der Seite erneut
abbilden.

## Doctor-Einstieg

`Doctor öffnen` bleibt immer an derselben Stelle sichtbar.

Es werden zwei Szenarien unterschieden:

### 1. System erkennt ein Problem

Wenn das System selbst einen problematischen Zustand erkennt, darf im Kopf ein
Warnkontext erscheinen. Dieser Warnkontext ergänzt denselben Einstiegspunkt und
zieht ihn stärker nach oben.

Wichtig:

- Der Einstiegspunkt bleibt an derselben Position.
- Die Warnung ersetzt den Einstieg nicht.
- Der Nutzer muss kein neues Interaktionsmuster lernen.

### 2. System erkennt kein Problem

Auch wenn das System keinen Befund erkennt, muss der Nutzer `Doctor öffnen`
jederzeit finden und bewusst starten können.

Begründung:

- Nicht alle Probleme sind automatisch detektierbar.
- Nutzer sollen Diagnose aktiv und selbstbestimmt anstoßen können.

## Doctor als geführter Ablauf

Der Doctor ist kein reines Dashboard, sondern ein standardisierter,
wiedererkennbarer Ablauf.

### Ziel

Der Nutzer soll nicht direkt in tiefe technische Reparaturaktionen geworfen
werden, sondern zuerst Orientierung erhalten.

### Ablauf

Der Doctor folgt immer demselben Grundmuster:

1. `Überblick`
2. `Empfohlene Maßnahme`
3. `Reparatur ausführen`
4. `Validieren`

### 1. Überblick

Der erste Schritt ist eine kompakte Checkliste mit grünen, gelben und roten
Befunden.

Diese Übersicht zeigt bewusst auch grüne Vorbedingungen, damit der Nutzer
versteht:

- was bereits erfolgreich geprüft wurde
- welche Ursachen bereits ausgeschlossen sind
- worauf sich die empfohlene Maßnahme stützt

Der Doctor darf also auch bei bereits erkanntem Systembefund nicht unmittelbar
mit einer tiefen Reparaturaktion starten.

### 2. Empfohlene Maßnahme

Nach dem Überblick wird genau eine priorisierte nächste Aktion empfohlen.

Diese Maßnahme erhält:

- eine klare Bezeichnung
- eine kurze Begründung
- einen eindeutigen CTA

### 3. Reparatur ausführen

In diesem Schritt werden gezielte Reparatur- oder Reconcile-Aktionen
ausgeführt, zum Beispiel:

- Vorbedingungen erneut prüfen
- Tenant-IAM-Rechte probeweise prüfen
- Reconcile starten
- Provisioning-nahe Reparaturschritte ausführen

### 4. Validieren

Nach der Maßnahme folgt ein eigener Validierungsschritt.

Der Nutzer sieht:

- ob der Befund behoben wurde
- welche Checks nun grün sind
- ob weitere Maßnahmen nötig bleiben

Erst danach erfolgt der gedankliche Rückwechsel in den normalen Betrieb.

## Historie

Technische Laufhistorie ist kein eigenständiger Hauptmodus mehr.

Stattdessen gehört sie in den Kontext des Doctor-Modus, weil sie dort für
Diagnose und Reparatur sinnvoll interpretierbar ist.

Das bedeutet:

- Historie unterstützt den Doctor
- Historie konkurriert nicht mehr im Erstblick mit Betrieb oder Einstellungen

## Visuelle Hierarchie

Die visuelle Hierarchie soll künftig diesen Grundsatz erfüllen:

1. Normalbetrieb zuerst ruhig und fokussiert
2. Diagnose schnell erreichbar
3. Probleme im Kopf erkennbar, aber nicht chaotisch
4. seltene Vertrags- und Stammdatenpflege nachgeordnet

Konkrete Folgen:

- `Betrieb` erhält die stärkste Priorität auf vollständig eingerichteten
  Instanzen
- `Doctor` ist ständig erreichbar, aber ohne den Happy Path dauerhaft zu
  stören
- `Einstellungen` werden als bewusster Wechsel in einen anderen Arbeitsmodus
  behandelt

## Routing- und Strukturfolgen

Die bisherige Instanz-Detailroute soll nicht länger alle Arbeitsmodi auf einer
gleichrangigen Fläche bündeln.

Für die Umsetzung ist mindestens sicherzustellen:

- eigener Setup-Abschluss-Flow nach der Anlage
- dauerhafte Bestandsansichten `Betrieb`, `Doctor`, `Einstellungen`
- stabile Navigation zwischen diesen Ansichten
- klare Default-Regel:
  - vor abgeschlossenem Setup: geführter Setup-Abschluss
  - nach abgeschlossenem Setup: Default auf `Betrieb`

Ob diese Ansichten als getrennte Routen oder als klar getrennte Hauptansichten
innerhalb einer Instanzhülle umgesetzt werden, ist eine technische
Umsetzungsentscheidung. Die fachliche Trennung ist jedoch verbindlich.

## Nicht-Ziele

- kein Wiederverwenden des kompletten Setup-Flows als Standard-Bestandsansicht
- kein gleichrangiger Hauptmodus `Historie`
- keine Rückkehr zu einer Seite, auf der Setup, Betrieb, Diagnose und
  Stammdaten dauerhaft ungefiltert nebeneinander stehen
- keine Doctor-Variante, die Nutzer ohne Überblick direkt in tiefe
  Reparaturaktionen wirft

## Empfehlung für die Umsetzung

Die Umsetzung sollte in dieser Reihenfolge erfolgen:

1. Lebensphasen und Zielnavigation im UI-Modell trennen
2. Setup-Abschluss als einmaligen Flow vom Bestandsbetrieb ablösen
3. Bestandsseite auf `Betrieb`, `Doctor`, `Einstellungen` zuschneiden
4. Modulverwaltung als Happy Path im Betrieb priorisieren
5. Doctor als geführten Diagnose- und Reparaturablauf einführen
6. Historie in den Doctor-Kontext verschieben
7. Stammdaten konsequent nach `Einstellungen` verlagern

So entsteht eine Oberfläche, die sowohl visuell klarer als auch fachlich näher
am echten Arbeitsablauf der Nutzer liegt.
