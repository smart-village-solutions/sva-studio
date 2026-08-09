## Context

Die vorhandene Plugin-Operations-Plattform ist bereits die führende Wahrheit für Jobstatus, Progress, Event-History und Terminalergebnis. Der Feedback-Change ergänzt keinen zweiten Jobzustand, sondern standardisiert, wie diese Wahrheit im auslösenden Fachbereich und im dauerhaften Monitoring-Kontext dargestellt wird.

## Goals / Non-Goals

- Goals:
  - Jobstart unmittelbar und mit stabilem Detailbezug bestätigen
  - laufende und terminale Zustände aus dem Host-Jobvertrag darstellen
  - fachlichen Startkontext und dauerhaftes Monitoring sinnvoll verbinden
  - Fehler, Retry und Cancel persistent und capability-gesteuert behandeln
  - Host-/Plugin-Darstellung und Accessibility vereinheitlichen
- Non-Goals:
  - keine neue Jobpersistenz, Queue oder Worker-Runtime
  - kein pluginlokaler zweiter Statusautomat
  - keine Toast-Ketten für langlebige Jobs
  - keine allgemeine Feedback-Klassen-Registry

## Decisions

### Decision: Der zentrale Jobdatensatz bleibt die einzige Statuswahrheit

UI-Zustände werden aus Job-ID, Status, Progress und Event-History der Plugin-Operations-Plattform abgeleitet. Pluginlokaler React-State darf eine Abfrage steuern, aber keinen konkurrierenden fachlichen Jobstatus erzeugen.

### Decision: Startfeedback bleibt im auslösenden Fachbereich

Nach erfolgreicher Jobannahme zeigt der auslösende Bereich mindestens die stabile Job-ID, den initialen Status und eine Aktion zum Jobdetail oder zur Monitoring-Liste. Ein Start-Toast ist dafür kein Ersatz.

### Decision: Langlebiger Fortschritt besitzt einen dauerhaften Kontext

Aktive Kurzsichten dürfen im Fachbereich pollend aktualisiert werden. Vollständige Progress-, Runtime- und Event-History liegt im hostverantworteten Jobdetail. Navigation oder Reload darf die Nachvollziehbarkeit nicht verlieren.

### Decision: Terminalzustände sind keine flüchtigen Meldungen

Erfolg, Fehler und Abbruch bleiben im Jobdetail und in der Monitoring-Historie sichtbar. Wenn der Fachbereich den zuletzt gestarteten Job darstellt, aktualisiert auch er auf den Terminalzustand. Eine spätere proaktive Benachrichtigung außerhalb dieser Kontexte wäre ein eigener Change.

### Decision: Folgeaktionen sind Capability-gesteuert

Retry, Cancel, Ergebnis öffnen oder Download erscheinen nur, wenn Hostvertrag, Berechtigung und aktueller Jobzustand die konkrete Aktion erlauben. Retry erzeugt eine nachvollziehbare neue Ausführung oder verwendet einen explizit definierten Hostvertrag; die UI setzt einen fehlgeschlagenen Job nicht lokal auf `running` zurück.

### Decision: Bestehende Jobtypen liefern Fachsemantik

Plugins verwenden die bestehenden namespaced Jobtypen und Progress-Metadaten für Labels, Phasen und fachliche Kurzdetails. Der Host verantwortet generische Statusdarstellung, Fokus, Live-Region und Fehlerpersistenz.

Die zuvor erwogene allgemeine Action-Outcome- und Feedback-Klassen-Registry wird nicht benötigt. Der bestehende Jobvertrag liefert bereits die notwendige dauerhafte Semantik.

## Risks / Trade-offs

- Polling kann unnötige Last erzeugen. → Nur aktive Jobs, adaptive Intervalle und Stopp bei Terminalstatus.
- Fachbereich und Monitoring können unterschiedliche Snapshots zeigen. → Beide lesen denselben Hostvertrag und invalidieren bei Terminalübergängen.
- Retry-Semantik kann je Jobtyp variieren. → Kein generischer Retry ohne explizite Host-Capability.
- Zu viele Live-Updates können Assistenztechnologien überlasten. → Progress-Ankündigungen drosseln und nur bedeutende Phasenwechsel ansagen.

## Migration Plan

1. Referenzjob und vorhandene Start-/Detailpfade auswählen.
2. Retry-/Cancel-/Ergebnis-Capabilities des Hostvertrags bestätigen.
3. Gemeinsame Jobstatus- und Folgeaktionsprimitives implementieren.
4. Fachlichen Startbereich und Monitoring-Detail als Referenz migrieren.
5. Weitere Plugin-Jobs schrittweise anbinden.

## Open Questions

- Welcher bestehende Waste- oder Importjob bildet den ersten Referenzfluss?
- Welche Retry- und Cancel-Verträge sind für Phase 1 tatsächlich produktiv belegt?
- Welche bedeutenden Progress-Übergänge werden per Live-Region angekündigt?
