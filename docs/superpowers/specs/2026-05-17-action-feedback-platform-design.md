# Action-Feedback-Plattform fuer Studio und Plugins

## Kontext

Im Studio existieren nach mutierenden Aktionen wie Speichern, Loeschen, Starten oder Abbrechen bislang keine ausreichend konsistenten Rueckmeldemuster. Besonders kritisch sind fluechtige, schlecht verankerte oder rein toast-basierte Meldungen, weil sie fachlich zu wenig Kontext tragen, fuer Screenreader schwer einzuordnen sind und von Plugins uneinheitlich umgesetzt werden koennen.

Das Studio benoetigt deshalb eine hostgefuehrte, global einheitliche Action-Feedback-Plattform. Diese Plattform soll fuer Core-UI und Plugins denselben Vertrag bereitstellen, Accessibility zentral absichern und dennoch fachliche Erweiterungen durch Plugins erlauben.

## Ziele

- Einheitliches, systemweites Rueckmeldemodell fuer Aktionen im Core und in Plugins
- Hostgefuehrte Accessibility fuer Rendering, Fokusverhalten und Live-Region-Semantik
- Konsistente UX-Regeln fuer Speichern, Loeschen, Validierungsfehler, Langlaeufer und Warnungen
- Erweiterbarkeit durch registrierte plugin-eigene Feedback-Klassen
- Deterministische Testbarkeit, Analytics- und Governance-Faehigkeit

## Nicht-Ziele

- Kein freies, pluginseitiges Rendering globaler Feedback-Oberflaechen
- Kein zweites paralleles Toast-, Banner- oder Notification-System pro Plugin
- Kein vollstaendiger Ausbau einer allgemeinen Workflow- oder Inbox-Plattform
- Keine Umsetzung des detaillierten UI-Visual-Designs in dieser Spezifikation

## Problemzuschnitt

Die Plattform muss zwei Spannungen aufloesen:

1. Das Studio braucht starke globale Regeln, damit UX und Accessibility nicht pro Screen oder Plugin auseinanderlaufen.
2. Plugins muessen fachliche Sonderfaelle ausdruecken koennen, ohne fuer jeden Fall eine Core-Aenderung zu erzwingen.

Die empfohlene Loesung ist deshalb weder ein rein festes Host-Vokabular noch ein freies Event-System, sondern ein zweistufiger Vertrag aus kanonischem Kern und validierten Erweiterungen.

## Bewertete Ansaetze

### Ansatz A: Nur hostdefinierte Feedback-Klassen

Der Host definiert alle Klassen und Plugins koennen nur Instanzen dieser Klassen ausloesen.

Vorteile:

- maximale Konsistenz
- einfachste Accessibility-Governance
- niedrigste Render- und Testkomplexitaet

Nachteile:

- zu starr fuer fachliche Spezialfaelle
- hoher Aenderungsdruck auf Core bei Plugin-Fachlogik
- schlechte Zukunftsfaehigkeit fuer reichere Plugin-Domaenen

### Ansatz B: Freie plugin-eigene Feedback-Klassen zur Laufzeit

Plugins duerfen beliebige Feedback-Klassen ad hoc emittieren, solange Mindestmetadaten mitgeliefert werden.

Vorteile:

- maximale Freiheit fuer Plugin-Teams
- geringe Vorabmodellierung

Nachteile:

- hoher Wildwuchs-Risiko
- inkonsistente Tonalitaet, Priorisierung und Persistenz
- Accessibility ist nur schwach zentral pruefbar
- schlechtere Fallbacks, Tests und Analytics

### Ansatz C: Kanonischer Host-Kern plus registrierte Plugin-Erweiterungen

Der Host definiert einen kleinen Satz kanonischer Klassen und Grundtypen. Plugins duerfen eigene Klassen deklarieren, muessen diese aber namespaced registrieren und an einen Host-Grundtyp anbinden.

Vorteile:

- gute Balance aus Konsistenz und Erweiterbarkeit
- klare Accessibility- und UX-Governance
- stabile Fallbacks fuer inkompatible oder unvollstaendige Klassen
- deterministische Review-, Test- und Analytics-Basis

Nachteile:

- zusaetzlicher Plattformaufwand fuer Registry, Validierung und Doku

## Entscheidung

Es wird Ansatz C umgesetzt: eine hostgefuehrte Action-Feedback-Plattform mit kanonischem Kern und registrierten, validierten Plugin-Erweiterungen.

Die zentrale Produktregel lautet:

> Aktionen liefern strukturierte Feedback-Outcomes. Darstellung, Priorisierung und Accessibility werden hostgefuehrt aus registrierten Feedback-Klassen abgeleitet.

## Architekturueberblick

Die Plattform besteht aus drei Ebenen:

1. **Outcome-Vertrag**
   Aktionen liefern ein strukturiertes Ergebnisobjekt statt nur impliziter `success/error`-Signale.

2. **Feedback-Class-Registry**
   Der Host verwaltet kanonische und plugin-eigene Feedback-Klassen samt Validierung, Mapping und Fallback-Strategien.

3. **Host Renderer**
   Nur der Host entscheidet ueber konkrete Darstellung, Position, Lebensdauer, Fokusverhalten und Screenreader-Ankuendigung.

Core-UI und Plugins konsumieren dieselbe Plattform. Plugins duerfen Semantik liefern, aber nicht das globale Feedback-System durch eigene Toast- oder Live-Region-Mechaniken ersetzen.

## Outcome-Vertrag

Jede relevante Aktion im Studio soll ein strukturiertes Action-Feedback-Outcome erzeugen oder in ein solches abgebildet werden.

Empfohlene Kernfelder:

- `outcome`: `success | warning | error | progress | confirmation_required | cancelled`
- `feedbackClassId`
- `scope`: `inline | region | global | modal`
- `message`
- `details`
- `subjectRef`
- `actions`
- `correlationId`
- `timestamp`

### Semantik der Felder

- `feedbackClassId` verweist auf die kanonische oder registrierte Klasse.
- `subjectRef` verankert die Rueckmeldung an einem Formular, Datensatz, Job oder UI-Bereich.
- `actions` beschreibt moegliche Folgehandlungen wie `undo`, `retry`, `openDetails`, `openJob`.
- `scope` ist deklarativ und wird hostseitig gegen Klassenregeln validiert, nicht frei von Plugins erzwungen.

## Kanonische Host-Grundtypen

Der Host soll einen kleinen, stabilen Satz von Grundtypen definieren:

- `inline-success`
- `undoable-delete`
- `persistent-error`
- `form-validation-error`
- `background-job-progress`
- `background-job-result`
- `blocking-confirmation`
- `non-blocking-warning`

Diese Grundtypen repraesentieren keine starren Einzelkomponenten, sondern normierte UX- und A11y-Verhaltensmuster.

## Plugin-Erweiterungen

Plugins duerfen eigene Feedback-Klassen definieren, muessen diese jedoch:

- namespaced registrieren
- an genau einen Host-Grundtyp anbinden
- Pflichtmetadaten fuer Verhalten und Accessibility liefern
- die Host-Validierung bestehen

Beispielhafte Fachklassen:

- `news.publish-with-warnings`
- `waste-management.import-partial-success`
- `poi.bulk-delete-summary`

Die Erweiterung beschreibt Fachsemantik und optionale Render-Hinweise, aber kein vollstaendig eigenes globales Rendering.

## Registry- und Validierungsvertrag

Die Feedback-Class-Registry wird als hostgefuehrte Plattform-Registry modelliert, analog zur bestehenden Plugin-Governance.

Pflichtfelder einer registrierten Klasse:

- `classId`
- `baseClass`
- `severity`
- `defaultScope`
- `persistence`
- `interactionModel`
- `screenReaderPolicy`

Validierungsregeln:

- `classId` muss namespaced sein und zum owning Plugin passen
- `baseClass` muss ein erlaubter Host-Grundtyp sein
- unzulaessige Kombinationen aus `scope`, `persistence` und `screenReaderPolicy` werden abgewiesen
- pluginfremde oder reservierte Core-Namespaces werden abgewiesen
- fehlende Pflichtfelder fuehren zu einem deterministischen Validierungsfehler

## Fallback-Strategie

Der Host muss fail-closed rendern.

- Unregistrierte Klassen werden nicht nativ vertraut
- unvollstaendige oder inkompatible Klassen werden auf einen sicheren Host-Grundtyp zurueckgefuehrt
- bevorzugte Fallbacks sind `persistent-error` oder `non-blocking-warning`
- Fallbacks bleiben auditier- und telemetry-faehig

Damit wird verhindert, dass Plugins zur Laufzeit unvorhersehbares Feedback-Verhalten einschleusen.

## Host-Rendering

Der Host-Renderer ist die einzige Quelle fuer globale Feedback-Darstellung.

Host-Verantwortung:

- Auswahl des Render-Surfaces
- Priorisierung gleichzeitiger Rueckmeldungen
- Lebensdauer und Dismiss-Regeln
- Fokusverhalten
- Live-Region-Ausgabe
- Undo- und Folgeaktions-Darstellung

Plugins duerfen keine eigenen globalen Toast-Stacks, Alert-Live-Regionen oder konkurrierenden Notification-Manager einfuehren.

## UX-Regeln

### Speichern

- Erfolg nach `Save` wird standardmaessig inline oder regionsnah signalisiert
- globale Rueckmeldung ist optional ergaenzend, nicht alleiniger Traeger
- reine Erfolgstoasts ohne Kontextbezug gelten nicht als bevorzugtes Muster

### Loeschen

- `Delete` wird standardmaessig als `undoable-delete` modelliert
- destruktive Bestaetigung vorab bleibt nur fuer risikoreiche oder irreversible Faelle Pflicht
- eine blosse Erfolgsmeldung ohne Undo ist nur fuer Ausnahmefaelle zulaessig

### Fehler

- Fehler sind persistent und kontextbezogen
- Meldungen beschreiben, was fehlgeschlagen ist und welche Folgehandlung moeglich ist
- komplexe oder formularbezogene Fehler duerfen nicht ausschliesslich global angezeigt werden

### Langlaeufer

- langlaufende Aktionen werden als Job- oder Progress-Zustaende behandelt
- eine Kette kurzlebiger Toasts ist dafuer kein akzeptabler Primaerpfad
- Abschlussfeedback verweist auf Detail- oder Monitoring-Sichten, wenn fachlich relevant

## Accessibility-Vertrag

Accessibility wird hostgefuehrt aus der Klasse abgeleitet.

Beispielhafte Standardregeln:

- `inline-success`: `aria-live="polite"`, kein Fokuswechsel
- `undoable-delete`: `aria-live="polite"`, Undo-Aktion per Tastatur erreichbar
- `form-validation-error`: persistente Fehlerzusammenfassung mit Verknuepfung zu Feldern
- `persistent-error`: prominente Fehlerregion, kein Auto-Dismiss
- `background-job-result`: `aria-live="polite"` mit Sprungziel auf Detailansicht

Verbindliche Querschnittsregeln:

- keine Bedeutung nur ueber Farbe
- keine automatische Fokusentfuehrung durch unkritische Erfolgsmeldungen
- keine ausschliesslich fluechtigen Fehler fuer handlungsrelevante Probleme
- Meldungen muessen auf das betroffene Objekt oder den betroffenen Bereich referenzierbar bleiben

## SDK-Zuschnitt

Die SDK soll zwei zentrale Faehigkeiten bereitstellen:

### 1. Deklarative Registrierung

Plugins registrieren eigene Feedback-Klassen ueber einen deklarativen Authoring-Vertrag.

Die Registrierung beschreibt:

- fachliche Kennung
- zugehoerigen Host-Grundtyp
- erlaubte Folgeaktionen
- optionale Render-Hinweise
- Accessibility-Metadaten im erlaubten Rahmen

### 2. Emissions-Helper fuer Outcomes

Plugins und Core-Aktionen erzeugen standardisierte Outcomes ueber typsichere Helper.

Beispiele:

- `feedback.success(...)`
- `feedback.warning(...)`
- `feedback.error(...)`
- `feedback.progress(...)`

Die Helper validieren den Bezug zu registrierten Klassen und erzwingen stabile Typsicherheit im Strict-Mode.

## Package-Zuschnitt

Empfohlene Verantwortungen:

- `@sva/core`
  - stabile Typen fuer Outcome, Feedback-Klasse, A11y-Policy und Folgeaktionen
- `@sva/plugin-sdk`
  - deklarative Registry-Helfer und typsichere Emissions-Helper fuer Plugins
- `apps/sva-studio-react` oder ein entsprechender Host-UI-Layer
  - Feedback-Renderer, Priorisierungslogik, Live-Region-Manager und Surface-Auswahl
- optionale Dokumentation in `docs/guides/`
  - Guidelines fuer Plugin-Autoren

## Beziehung zu bestehenden Plattformfaehigkeiten

Die neue Action-Feedback-Plattform ist querschnittlich und soll mit bestehenden Host-Vertraegen zusammenspielen:

- `plugin-platform`: Plugin-Erweiterungen bleiben deklarativ und hostvalidiert
- `plugin-actions`: autorisierte Aktionen koennen strukturierte Outcomes liefern
- `plugin-operations-platform`: Jobstarts, Progress und Abschlusszustande binden an dieselbe Feedback-Plattform an
- `ui-layout-shell`: globale Render-Surfaces muessen in die bestehende Shell integrierbar bleiben

## Telemetrie, Audit und Tests

Die Plattform soll konsistente Beobachtbarkeit ermoeglichen.

Mindestens erfassbar:

- `feedbackClassId`
- `baseClass`
- `outcome`
- `scope`
- ausgeloeste Folgeaktion
- Fallback-Nutzung

Tests sollten mindestens absichern:

- Registry-Validierung
- Host-Fallback fuer ungueltige Klassen
- A11y-Mapping fuer kanonische Klassen
- Rendering-Priorisierung bei konkurrierenden Rueckmeldungen
- Plugin-SDK-Typsicherheit und Namespace-Checks

## Risiken und Trade-offs

- Ein zu grosser Satz kanonischer Klassen fuehrt wieder zu Uebermodellierung.
- Zu viel pluginseitige Freiheit untergraebt die Host-Governance.
- Zu komplexe Scope- und Persistence-Regeln machen die API schwer vermittelbar.

Die Plattform sollte deshalb mit einem kleinen kanonischen Kern starten und Erweiterungen nur fuer echte Fachsemantik erlauben.

## Empfohlene Einfuehrungsstrategie

1. Kanonische Grundtypen und Outcome-Typen in `@sva/core` definieren
2. Host-Renderer und Accessibility-Mapping fuer den Core einziehen
3. SDK-Registry fuer plugin-eigene Klassen bereitstellen
4. bestehende Save/Delete/Error-Patterns schrittweise auf die Plattform migrieren
5. Langlaeufer und Plugin-Operations auf dieselbe Plattform anbinden
6. Plugin-Authoring-Guidelines und Testmuster dokumentieren

## Offene Umsetzungsfragen fuer die naechste Phase

- Welche bestehenden Screens oder Komponenten sind die erste Migrationswelle?
- Welche kanonischen Klassen werden in Phase 1 zwingend benoetigt?
- Wie stark sollen Folgeaktionen wie `undo` oder `retry` typisiert werden?
- Ob die Plattform als eigene OpenSpec-Capability `action-feedback-platform` eingefuehrt oder initial ueber mehrere bestehende Capabilities geschnitten wird

## Empfehlung

Das Studio soll eine hostgefuehrte Action-Feedback-Plattform einfuehren, die:

- einen kleinen kanonischen Kern verbindlich vorgibt
- plugin-eigene Klassen als registrierte Erweiterungen erlaubt
- Rendering und Accessibility zentral beim Host verankert
- Save, Delete, Error und Job-Feedback ueber dasselbe strukturierte Outcome-Modell vereinheitlicht

Damit wird aus uneinheitlichen Einzelmeldungen ein belastbarer Plattformvertrag fuer UX, Accessibility und Plugin-Integration.
