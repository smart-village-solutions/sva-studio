## Context
Die Instanz-Detailseite ist fachlich gewachsen und vereint inzwischen mehrere Operator-Aufgaben in einem einzigen Screen:

- aktuellen Betriebszustand verstehen
- Konfiguration bearbeiten
- Provisioning starten oder wiederholen
- Tenant-IAM-Befunde einordnen
- alte technische Runs nachvollziehen

Die heutigen Datenquellen sind fachlich korrekt getrennt, werden in der UI aber als gleichrangige Card-Gruppen dargestellt. Dadurch muss ein Operator selbst herausfiltern, welche Information aktuell handlungsleitend ist und welche lediglich Diagnosehistorie darstellt.

Fuer die Bedienung ist das problematisch, weil die Seite gleichzeitig Betriebs-Cockpit, Reparaturkonsole, Formular und Protokollansicht sein moechte. Dadurch fehlen Hierarchie, Blickfuehrung und eine klare Antwort auf die Operator-Frage: `Was ist jetzt der Zustand und was soll ich als Naechstes tun?`

## Goals / Non-Goals
- Goals:
  - den aktuellen Betriebszustand der Instanz in der Standardansicht eindeutig priorisieren
  - historische und tief technische Informationen nur bei Bedarf in den Vordergrund holen
  - Tenant-IAM-, Keycloak- und Provisioning-Befunde weiterhin vollständig, aber klarer gruppiert darstellen
  - eine wiederverwendbare Struktur fuer Admin-Detailarbeitsbereiche schaffen
  - die Detailseite explizit als Operations-Cockpit mit klarer Entscheidungsfuehrung modellieren
  - die Bedienung mit gezielten visuellen Freuden aufwerten, ohne die operative Nuechternheit zu verlieren
- Non-Goals:
  - keine Aenderung am inhaltlichen Backend-Vertrag von `tenantIamStatus`, `keycloakStatus`, `keycloakPreflight`, `keycloakPlan` oder Run-Persistenz
  - keine neue Reparaturlogik oder neue Diagnosequelle
  - keine inhaltliche Neubewertung bestehender Driftklassen

## Decisions
- Decision: Die Seite folgt einem `Control Tower + Workbench`-Modell.
  - Oberhalb der Arbeitsbereiche steht eine feste Kontrollzone mit Identitaet, Gesamtzustand, Frische der Evidenz und dominanter naechster Aktion.
  - Darunter folgen getrennte Arbeitsbereiche.
  - Rationale: Ein Cockpit braucht zuerst Lagebild und Entscheidung, nicht Vollstaendigkeit.

- Decision: Die Seite wird in wenige klar benannte Arbeitsbereiche gegliedert.
  - Empfohlene Struktur:
    - `Uebersicht`
    - `Konfiguration`
    - `Betrieb`
    - `Historie`
  - `Diagnose` wird als Teil von `Betrieb` und `Historie` behandelt statt als eigener gleichrangiger Hauptmodus.
  - Rationale: Das reduziert visuelle Konkurrenz zwischen aktuellen Befunden und Expertenmaterial und ordnet technische Details einer klaren Operator-Aufgabe zu.

- Decision: Die Einstiegsansicht zeigt eine kompakte operative Zusammenfassung statt aller Diagnosekarten.
  - Enthalten sein muessen mindestens:
    - Gesamtzustand der Instanz
    - Frische und Herkunft der dominanten Evidenz
    - wichtigste offene Befunde
    - genau eine primaere naechste Aktion
  - Rationale: Operatoren brauchen zuerst Orientierung, nicht Vollstaendigkeit.

- Decision: Die Standardansicht verwendet eine kleine, klar priorisierte `Anomaly Queue`.
  - Es werden hoechstens die wichtigsten offenen Befunde prominent dargestellt.
  - Ein Befund muss Quelle, Schweregrad und letzte belastbare Evidenz enthalten.
  - Rationale: Ein Cockpit muss Abweichungen verdichten, nicht alle Rohsignale gleich laut ausspielen.

- Decision: Aktionen werden in `primaer` und `sekundaer` getrennt.
  - Es gibt immer nur eine dominante Hauptaktion in der Uebersicht.
  - Spezialaktionen wie Rollen-Reconcile, Access-Probe oder Secret-Rotation werden nachgeordnet gruppiert.
  - Rationale: Zu viele gleichwertige Buttons verhindern klare Bedienentscheidungen.

- Decision: Historische Provisioning-Laeufe bleiben erhalten, werden aber standardmaessig komprimiert dargestellt.
  - Fehlgeschlagene Altlaeufe duerfen sichtbar bleiben, aber nicht denselben visuellen Rang wie der aktuelle Strukturzustand erhalten.
  - Rationale: Historie ist fuer Diagnose wichtig, fuehrt aber in der Standardansicht zu Fehlinterpretationen.

- Decision: Tenant-IAM bleibt ein eigenstaendiger Befundraum, wird in der Standardansicht aber als zusammengefasste Betriebsampel mit Deep-Link oder Sekundaerbereich dargestellt.
  - Rationale: Trennung von Struktur-Readiness und Tenant-IAM bleibt fachlich wichtig, darf aber den Erstblick nicht ueberladen.

- Decision: Der Uebersichtsbereich zeigt keine gleichrangigen Wiederholungen desselben Zustands.
  - `configurationAssessment`, Workflow, Keycloak-Statuslisten und Run-Historie duerfen denselben Sachverhalt nicht mehr parallel in unterschiedlichen Darstellungsformen wiederholen.
  - Stattdessen wird aus den vorhandenen Datenquellen ein kanonisches Cockpit-Modell fuer:
    - `Gesamtzustand`
    - `Betriebsachsen`
    - `dominanter Befund`
    - `naechste Aktion`
    abgeleitet.
  - Rationale: Mehrfachbewertungen desselben Problems erzeugen kognitive Last und Widerspruchsempfinden.

- Decision: Statusdarstellungen folgen dem Prinzip `state + freshness + provenance`.
  - Ein hervorgehobener Befund soll nach Moeglichkeit nicht nur den Status, sondern auch letzte Evidenzzeit und Herkunft wie Preflight, Access-Probe, Reconcile oder letzter Run ausweisen.
  - Rationale: In Operator-Cockpits ist nicht nur der Status entscheidend, sondern auch wie frisch und aus welcher Quelle er stammt.

- Decision: Das Cockpit darf bewusst kleine visuelle Highlights enthalten.
  - Zulaessig sind zum Beispiel:
    - subtile Statuspulse oder sanfte Aktivitaetsanimationen fuer laufende Prozesse
    - hochwertige Hover- und Fokuszustaende fuer Achsen, Queue-Eintraege und Aktionen
    - fein abgestufte Flaechen, Tiefen und Farbzonen zur Blickfuehrung
    - kompakte Mikrovisualisierungen fuer Frische, Verlauf oder Befunddichte
  - Nicht zulaessig sind:
    - dauernd blinkende oder hektische Animationen
    - dekorative Effekte, die Statusfarben uebersteuern
    - Gimmicks ohne Bezug zu Orientierung, Feedback oder Freude an der Bedienung
  - Rationale: Ein gutes Cockpit darf sich hochwertig und lebendig anfuehlen, solange die Informationsarbeit dadurch besser und nicht schlechter wird.

- Decision: Visuelle Gimmicks sind nachrangig gegenueber Betriebslesbarkeit.
  - Statuskontrast, Scanbarkeit, Tastaturfokus und ruhige Hierarchie gehen immer vor dekorativer Wirkung.
  - Motion muss reduziert, kurz und abschaltbar im Sinne bestehender Accessibility-Muster bleiben.
  - Rationale: Freude an der Bedienung ist ein Qualitaetsmerkmal, aber kein Ersatz fuer Klarheit.

## Risks / Trade-offs
- Risiko: Wichtige Diagnoseinformationen koennten zu weit versteckt werden.
  - Mitigation: Diagnose- und Historienbereiche bleiben mit einem Klick erreichbar und behalten Request-ID-, Fehlercode- und Schrittinformationen.

- Risiko: Bestehende Power-User muessen sich an eine neue Seitenlogik gewoehnen.
  - Mitigation: Die Datenquellen und Aktionen bleiben erhalten; geaendert wird primaer die Priorisierung und Gruppierung.

## Migration Plan
1. OpenSpec-Deltas fuer die neue Informationsarchitektur festziehen.
2. Cockpit-Modell fuer Uebersicht, Befundachsen und Aktionshierarchie aus bestehenden Datenquellen ableiten.
3. UI in getrennte Arbeitsbereiche umstrukturieren.
4. Tests fuer Standardansicht, Kontextaktionen und Historienabgrenzung anpassen.
5. Doku fuer Operatoren und Architektur aktualisieren.

## Open Questions
- Ob die Arbeitsbereiche als Tabs, Segmented Panels oder eine Hybridstruktur mit fixem Uebersichtsblock und Sekundaerpanels umgesetzt werden, bleibt Implementierungsentscheidung.
- Ob die Tenant-IAM-Kurzsicht in der Uebersicht nur den `overall`-Status oder zusaetzlich den dominanten Teilbefund zeigt, wird in der Umsetzung konkretisiert.
- Ob die `Anomaly Queue` maximal drei oder vier Befunde sichtbar macht, wird in der Umsetzung konkretisiert.
