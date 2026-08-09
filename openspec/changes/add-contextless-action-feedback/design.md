## Context

Eine globale kurzlebige Meldung ist nur dann das passendste Rückmeldemuster, wenn die Aktion keinen stabilen sichtbaren Ergebnis- oder Fehlerkontext besitzt. Ohne zentrale Zulässigkeits- und Accessibility-Regeln würde eine globale Surface schnell zum universellen Ausweichpfad werden.

## Goals / Non-Goals

- Goals:
  - kontextlose Aktionen objektiv von kontextgebundenen Zuständen unterscheiden
  - eine einzige hostverantwortete globale Surface bereitstellen
  - Queueing, Deduplizierung, Dismiss und Screenreader-Semantik vereinheitlichen
  - Host und Plugins einen kontrollierten öffentlichen Nutzungsvertrag geben
- Non-Goals:
  - keine globale Darstellung normaler Save-, Formularfehler- oder Jobzustände
  - keine Inbox oder langlebige Benachrichtigungszentrale
  - keine frei registrierbaren Feedback-Klassen

## Decisions

### Decision: Kontextlosigkeit ist eine Zulässigkeitsbedingung

Eine globale kurzlebige Rückmeldung ist nur zulässig, wenn nach der Aktion kein geeigneter stabiler Kontext vorhanden ist. Existiert ein Button-, Formular-, Detail-, Listen-, Job- oder Bereichskontext, bleibt die Rückmeldung dort.

### Decision: Die Layout-Shell besitzt genau eine globale Surface

Die Shell stellt den Mount- und Live-Region-Anker bereit; Darstellung und Interaktionsprimitives liegen in `@sva/studio-ui-react`. Host- und Plugin-Flows dürfen keinen parallelen Toast-Container erzeugen.

### Decision: Der Vertrag bleibt kleiner als eine allgemeine Outcome-Plattform

Der öffentliche Vertrag beschreibt nur die für eine kurzlebige globale Meldung nötige Semantik: stabile ID, Meldungsart, übersetzter oder übersetzbarer Inhalt, optionale sichere Aktion und Dismiss-Verhalten. Fachobjekte, beliebige Renderer oder pluginregistrierte Feedback-Klassen sind nicht Teil des Vertrags.

Die genaue Paketgrenze des Emissionsports wird vor Implementierung anhand des installierten Plugin-Vertrags entschieden. Sie darf keinen App-internen Import aus Plugins erfordern.

### Decision: Kritische Fehler sind nicht flüchtig

Fehler mit Handlungsbedarf, Datenverlust-, Security- oder Konfliktrisiko werden nicht automatisch ausgeblendet und nicht ausschließlich global dargestellt. Die globale Surface ist auf kurze Erfolge, Informationen und gegebenenfalls nichtkritische Warnungen begrenzt.

### Decision: Accessibility und Überlastschutz sind hostgeführt

Meldungen werden dedupliziert und in begrenzter Anzahl dargestellt. Automatisch ausblendbare Meldungen pausieren bei Hover und Fokus, sind manuell schließbar und verschieben den Fokus nicht. Die Live-Region kündigt Änderungen ohne wiederholte Meldungsstürme an.

Die zuvor erwogene allgemeine Feedback-Klassen-Registry bleibt verworfen. Dieser Change führt nur den durch konkrete kontextlose Aktionen belegten Minimalvertrag ein.

## Risks / Trade-offs

- Kontextlosigkeit kann subjektiv ausgelegt werden. → Pflichtinventur mit Begründung und Review-Regel.
- Meldungsstürme können visuell und für Screenreader belasten. → Queue-Limit, Deduplizierung und Priorisierung zentral testen.
- Ein öffentlicher Plugin-Emissionspfad kann zur Schatten-Eventplattform wachsen. → Minimaler Vertrag ohne freie Renderer oder Fachpayloads.

## Migration Plan

1. Bestehende Kandidaten und Fehlverwendungen inventarisieren.
2. Zwei bis drei echte kontextlose Referenzaktionen auswählen.
3. Öffentlichen Minimalvertrag und Shell-Surface separat freigeben.
4. Referenzaktionen migrieren und Accessibility-/Queue-Tests ergänzen.
5. Weitere Meldungen nur nach dokumentierter Zulässigkeitsprüfung aufnehmen.

## Open Questions

- Welche existierenden Aktionen bilden die ersten bestätigten Referenzfälle?
- Welche Meldungsarten und automatische Anzeigedauer werden für Phase 1 freigegeben?
- Liegt der öffentliche Emissionsport in `@sva/studio-ui-react`, in einer bestehenden Plugin-React-Fassade oder in einem kleinen getrennten Hostvertrag?
