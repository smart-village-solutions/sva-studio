## Context
Die Instanz-Detailseite dient gleichzeitig als Cockpit, Konfigurationsformular, Diagnosefläche und Historienansicht. Durch die jüngste Tenant-IAM- und Provisioning-Integration ist die Seite fachlich dichter geworden, behandelt aber zwei unterschiedliche Betriebsfälle weiterhin mit demselben visuellen und semantischen Modell:

- `realmMode = new`: Aufbau eines noch nicht existierenden Tenant-Realm
- `realmMode = existing`: Prüfung und Abgleich eines bereits existierenden Tenant-Realm

Im `new`-Pfad sind fehlende Realm-, Client- und Secret-Artefakte vor dem ersten Provisioning erwartbar. Im `existing`-Pfad sind dieselben Zustände echte Befunde oder Drift. Die aktuelle Seite zeigt beide Fälle mit denselben Blocker- und Anomalie-Mechanismen, wodurch Operatoren nicht sicher erkennen können, welcher Schritt als Nächstes fachlich richtig ist.

## Goals / Non-Goals
- Goals:
  - Realm-Modus als führende Betriebsdimension der Detailseite etablieren
  - Für `new` einen linearen Aufbaupfad mit eindeutiger nächster Aktion und nachvollziehbarem Erfolgsstatus schaffen
  - Für `existing` einen Diagnose- und Reconcile-Pfad mit klarer Drift-Einordnung schaffen
  - Aktuelle Evidenz im Erstblick priorisieren und Historie nachordnen
  - Konfigurationssicht von operativer Schrittführung entkoppeln
  - Die UI-Zerlegung so anlegen, dass bestehende Coverage- und Complexity-Gates bei der Umsetzung eingehalten werden können
- Non-Goals:
  - Keine Änderung des Backend-Provisioning-Vertrags in diesem Change
  - Keine neue Persistenzschicht für zusätzliche UI-Statussnapshots
  - Keine neue Route; die Trennung erfolgt innerhalb derselben Detail-Shell
  - Kein vollständiger Tenant-IAM-Bootstrap mit Gruppen, Organisationen, Persona-Seeding oder Account-Zuordnungen als Teil des `new realm`-Kernflows
  - Keine automatische Vermischung von Realm-Grundaufbau mit nachgelagerter Modulzuordnung oder Modul-IAM-Synchronisation

## Decisions
- Decision: Gemeinsame Detail-Shell, modusspezifische Workflow-Views
  - Die Route `/admin/instances/:instanceId` bleibt erhalten.
  - Kopf, Identität, Status, Tabs und Historie bleiben gemeinsame Shell.
  - Der operative Hauptbereich wird abhängig von `instance.realmMode` getrennt gerendert:
    - `NewRealmOperationsView`
    - `ExistingRealmOperationsView`

- Decision: Realm-Modus steuert semantische Bewertung der Befunde
  - `new`: Nicht erzeugte Keycloak-Artefakte vor dem ersten Provisioning sind `geplant`, `noch nicht ausgeführt` oder `nachgelagert`, nicht `blocked`.
  - `existing`: Fehlende oder abweichende Artefakte bleiben echte Blocker oder Drift-Befunde.

- Decision: Zwei unterschiedliche Workflow-Modelle
  - `new`-Pfad:
    1. Registry-Vertrag gespeichert
    2. Technische Vorbedingungen prüfen
    3. Soll-Ist-Plan für den Worker erzeugen
    4. Realm anlegen
    5. Login-Client anlegen oder abgleichen
    6. Tenant-Admin-Client anlegen oder abgleichen
    7. `instanceId`-Mapper sicherstellen
    8. Realm-Rollen sicherstellen
    9. Tenant-Admin anlegen oder auf Minimalprofil korrigieren
    10. Erzeugte Client-Secrets in die Registry zurückschreiben
    11. Abschlusszustand validieren
    12. Realm-Grundaufbau erfolgreich
  - `existing`-Pfad:
    1. Vorbedingungen prüfen
    2. Live-Status laden
    3. Drift analysieren
    4. Fehlende Vertragsdaten/Secrets ergänzen
    5. Reconcile ausführen
    6. Ergebnis validieren
    7. Ggf. Instanz aktivieren

- Decision: Der `new`-Kernworkflow endet bewusst vor Tenant-IAM- und Modul-IAM-Folgearbeiten
  - Der Erfolgspunkt des `new`-Pfads ist `Realm-Grundaufbau erfolgreich`.
  - Eine eventuelle Aktivierung der Instanz ist ein nachgelagerter Betriebsentscheid und kein zwingender Teil derselben technischen Aufbauphase.
  - Modulzuordnung, modulbezogene IAM-Synchronisation und weitergehende Tenant-IAM-Baselines werden in der UI als getrennte Folgearbeiten oder nachgelagerte Empfehlungen dargestellt.
  - Die Detailseite darf diese Folgearbeiten sichtbar machen, aber nicht in dieselbe lineare Schrittkette des Realm-Grundaufbaus einrechnen.

- Decision: Der `new`-Pfad zeigt technische Teilphasen statt nur grober Oberbegriffe
  - Die UI darf den Aufbau eines neuen Realm nicht als einen einzigen Schritt `Provisioning ausführen` zusammenziehen.
  - Die Detailseite soll die fachlich relevanten technischen Teilphasen sichtbar machen, damit Fehler einem präzisen Schritt zugeordnet werden koennen.
  - Jeder Schritt im `new`-Pfad enthaelt:
    - eine kurze fachliche Bezeichnung
    - einen technischen Kurzstatus
    - die letzte belastbare Evidenz oder Fehlermeldung
    - die daraus abgeleitete naechste sinnvolle Aktion
  - Fuer zusammengefasste Teilphasen wie `Clients anlegen oder abgleichen` muss die UI mindestens getrennt zwischen Login-Client und Tenant-Admin-Client unterscheiden.

- Decision: Die Detailseite priorisiert `naechster Schritt`, `letzte Evidenz` und `Fehlerort`
  - Pro Modus gibt es genau eine primaere empfohlene Aktion.
  - Wenn ein Schritt fehlgeschlagen ist, zeigt die Uebersicht zuerst:
    - welcher Schritt fehlgeschlagen ist
    - welche Vorbedingungen davor bereits erfolgreich waren
    - ob ein Retry, eine Konfigurationskorrektur oder eine Live-Pruefung der naechste Schritt ist
  - Erfolgs-, Warn- und Fehlertexte muessen die konkrete Artefaktklasse nennen, z. B. `Realm`, `Login-Client`, `Tenant-Admin-Client`, `Mapper`, `Tenant-Admin`, `Tenant-Secret`, `Tenant-Admin-Client-Secret`.

- Decision: Die naechste Hauptaktion folgt einer festen Prioritaetsregel
  - Fuer `realmMode = new` wird die eine primaere naechste Aktion in dieser Reihenfolge abgeleitet:
    1. fehlende oder ungueltige Registry-Pflichtdaten korrigieren
    2. Moduskonflikt `Realm existiert bereits` klaeren
    3. blockierende Preflight-Bedingungen beheben
    4. fehlgeschlagenen oder noch nicht gestarteten Worker-Lauf ausloesen bzw. wiederholen
    5. fehlgeschlagenen Secret-Sync beheben oder wiederholen
    6. fehlgeschlagene Abschlussvalidierung analysieren und erneut pruefen
    7. nachgelagerte Folgearbeiten wie Aktivierung oder Modul-IAM als separate Empfehlung anbieten
  - Diese Prioritaet wird im Code als kleine, isolierte Projektionsregel modelliert und nicht verteilt in mehreren UI-Komponenten dupliziert.

- Decision: Konfiguration bleibt editierbar, aber nicht operativ führend
  - Der Tab `Konfiguration` zeigt Vertragsdaten und mode-aware Hinweise.
  - Operative Schrittführung liegt im Tab `Überblick` bzw. dem primären Operationsbereich.
  - Konfigurationsfehler im `new`-Pfad unterscheiden zwischen:
    - echte fehlende Eingaben im Registry-Vertrag
    - erwartbar noch nicht erzeugte Laufzeit-/Keycloak-Artefakte

- Decision: Erfolg und Misserfolg werden schrittbezogen statt verteilt sichtbar
  - Jeder Workflow-Schritt bekommt einen normativen UI-Status:
    - `offen`
    - `bereit`
    - `läuft`
    - `erfolgreich`
    - `fehlgeschlagen`
  - Historische Runs bleiben im Historienbereich sichtbar, bestimmen aber nicht den Primärstatus, solange aktuellere Evidenz vorliegt.
  - Fuer den `new`-Pfad wird zusaetzlich zwischen folgenden Evidenzquellen unterschieden:
    - Registry-Vertrag
    - Worker-Preflight
    - Worker-Plan
    - letzter Keycloak-Provisioning-Run
    - finale Abschlussvalidierung
  - Die UI muss erkennbar machen, aus welcher Evidenzquelle ein Schrittstatus abgeleitet wurde.
  - Im Erstblick zeigt jeder Schritt hoechstens:
    - Schrittname
    - Kurzstatus
    - kurze Ursache oder letzte Evidenz
    - naechste Aktion
  - Detailinformationen wie Request-ID, Rohfehlermeldung oder technische Diagnosedetails werden nachgelagert in aufklappbaren Details oder Sekundaerbereichen gezeigt.

- Decision: Edge Cases werden als mode-aware Sonderlagen explizit modelliert
  - `new` mit teilweise erfolgreichem Provisioning bleibt ein Aufbaupfad, zeigt aber den letzten erfolgreichen Schritt, den ersten fehlgeschlagenen Folgeschritt und die daraus abgeleitete nächste Reparatur- oder Fortsetzungsaktion.
  - `new`, obwohl der Realm bereits existiert, wird als Konflikt zwischen Sollmodus und Live-Zustand dargestellt und blockiert den linearen Erstaufbaupfad mit klarer Konfliktauflösung.
  - `existing`, obwohl der Realm live nicht existiert, wird als harter Strukturdefekt dargestellt und nicht als normaler Drift bagatellisiert.
  - Secret-Sync-, Tenant-Admin-Bootstrap- und Reconcile-Fehlschläge werden dem jeweils betroffenen Workflow-Schritt zugeordnet und nicht nur als generischer Gesamtfehler angezeigt.
  - Veraltete oder fehlende Live-Evidenz wird als eigener Diagnosezustand kenntlich gemacht, damit Historie nicht mit aktuellem Zustand verwechselt wird.
  - Fehlende Operator-Berechtigungen oder technisch aktuell nicht verfügbare Aktionen muessen als nicht ausfuehrbar sichtbar werden, ohne den fachlichen Schritt selbst unsichtbar zu machen.

## Risks / Trade-offs
- Zwei Workflow-Views erhöhen den UI-Codeumfang.
  - Mitigation: Gemeinsame Shell, gemeinsame Status-Badges, gemeinsame Evidenz-/Historienbausteine beibehalten.

- Zusätzliche Workflow-Logik kann Coverage und Komplexität der Detailseite verschlechtern.
  - Mitigation: Statusprojektionen und Schrittdefinitionen in kleine Shared-Helper auslagern, Views komponentenseitig trennen und die Moduslogik gezielt mit Unit- und UI-Tests absichern.

- Teile der heutigen Konfigurations- und Tenant-IAM-Bewertung sind auf ein einheitliches Defektmodell ausgelegt.
  - Mitigation: Bewertungslogik schrittweise in mode-aware Projektionen überführen, ohne bestehende Backend-Verträge zu verändern.

- Die Grenze zwischen `new`-Statusprojektion und `existing`-Driftprojektion muss für gemischte Übergangszustände sauber definiert werden.
  - Mitigation: Realm-Modus bleibt führend; aktuelle Run-/Status-Evidenz ergänzt, aber überschreibt diese Semantik nicht.

## Migration Plan
1. Bestehende Detailseite in gemeinsame Shell und mode-aware Operationsmodell zerlegen.
2. Workflow-Definitionen für `new` und `existing` in Shared-Helpern kapseln.
3. Edge-Case-Projektionen fuer Konflikt-, Teil-Erfolgs-, Retry- und Evidenzalter-Faelle definieren.
4. Konfigurationsbewertung an Realm-Modus koppeln.
5. Historie und aktuelle Evidenz visuell klarer trennen.
6. UI- und Projektionstests fuer Happy Paths und Edge Cases beider Modi ergaenzen.

## Open Questions
- Soll der primäre Tab künftig `Überblick` heißen, um den Operationscharakter gegenüber `Konfiguration` klarer zu machen, oder bleibt die bestehende Tab-Benennung erhalten?
