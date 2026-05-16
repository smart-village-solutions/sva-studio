# Design: Stagehand für explorative lokale Admin-Tests

## Kontext

Die bestehende Testlandschaft enthält bereits zwei klar abgegrenzte Browser-Testebenen:

- `pnpm nx run sva-studio-react:test:e2e` für deterministische App-, Routing- und Transport-Smokes
- `pnpm nx run sva-studio-react:test:acceptance` für reproduzierbare IAM-Abnahmen gegen einen echten Laufzeitpfad

Für Admin-Flows rund um Rollen, Rechte und Benutzerverwaltung fehlt bisher eine explorative Testschicht, die reale lokale Systempfade gegen den echten IAM-/Backend-Stack prüft und dabei agentische Navigation mit einem externen LLM nutzt. Stagehand soll diese Lücke zunächst lokal-first schließen, ohne bestehende deterministische Gates zu destabilisieren.

## Ziele

- Eine neue explorative Testschicht für lokale Admin-Journeys im echten System etablieren
- Echte Rollen-, Rechte- und Benutzerverwaltungsflüsse mit agentischer Browser-Steuerung abdecken
- Die neue Schicht sauber von `test:e2e` und `test:acceptance` abgrenzen
- Artefakte erzeugen, die Explorationsläufe nachvollziehbar und auswertbar machen
- Eine Struktur schaffen, die später auf weitere Admin- und Nicht-Admin-Bereiche erweitert werden kann

## Nicht-Ziele

- Kein Ersatz der bestehenden Playwright-Smokes
- Kein Ersatz des IAM-Acceptance-Gates
- Kein CI-blockendes Gate im ersten Schritt
- Kein Vollausbau auf alle Benutzerflüsse im ersten Pilot
- Keine sofortige Fokussierung auf stark mutierende Admin-Operationen

## Empfohlener Ansatz

Es wird eine separate Stagehand-Testschicht für explorative Admin-Flows eingeführt. Diese Schicht läuft lokal gegen den echten IAM-/Backend-Stack, verwendet externe LLM-APIs und wird über ein eigenes Nx-Target ausgeführt.

Die Kernentscheidung ist die bewusste Trennung der Testebenen:

- `test:e2e` bleibt deterministisch und selektorbasiert
- `test:acceptance` bleibt reproduzierbar und vertragsorientiert
- `test:explore:admin` wird die explorative, agentische Schicht für reale Admin-Journeys

Damit bleibt die bestehende Testpyramide intakt, während Stagehand dort eingesetzt wird, wo Exploration, UI-Verständnis und Fluss-Erkundung einen Mehrwert bringen.

## Architektur

### Platzierung

Die neue Testschicht wird unterhalb von `apps/sva-studio-react/` angelegt, damit sie nah an der App-Konfiguration, den lokalen Env-Kontrakten und den bestehenden Browser-Testpfaden bleibt.

Vorgesehene Struktur:

```text
apps/sva-studio-react/
  stagehand/
    missions/
    runtime/
    assertions/
    reporting/
```

### Bausteine

#### `missions/`

Enthält einzelne explorative Szenarien. Jede Mission beschreibt:

- den fachlichen Zweck
- die Startbedingungen
- Guardrails
- Pflichtprüfungen
- Abschlusskriterien

Beispiele:

- `admin-users-overview`
- `admin-user-permissions-inspection`
- `admin-role-management-navigation`

#### `runtime/`

Enthält die wiederverwendbare Laufzeitlogik:

- Browser-/Stagehand-Initialisierung
- LLM-Konfiguration
- Env-Validation
- Ready-Checks
- Login-Helfer für den echten Admin-Pfad
- gemeinsame Missionsausführung

#### `assertions/`

Enthält bewusst wenige, aber harte Prüfanker. Diese Assertions sollen vermeiden, dass die Exploration vollständig frei driftet. Sie sichern etwa ab:

- korrekte Zielseite oder zulässiger URL-Raum
- kein Redirect auf Login- oder Forbidden-Seiten
- Sichtbarkeit zentraler Kerninformationen
- Erreichen eines minimal erfolgreichen Missionsabschlusses

#### `reporting/`

Erzeugt Laufartefakte für Diagnose und spätere Auswertung:

- strukturierter Ergebnisstatus pro Mission
- kurzer deutschsprachiger Bericht
- Screenshots
- agentisches Transcript oder Schrittprotokoll

## Ausführungsmodell

Die Schicht wird über ein eigenes Nx-Target ausgeführt, zum Beispiel:

```bash
pnpm nx run sva-studio-react:test:explore:admin
```

Dieses Target ist im Pilot:

- lokal-first
- nicht CI-blockend
- bewusst getrennt von `pnpm test:e2e`, `pnpm test:pr` und `pnpm nx run sva-studio-react:test:acceptance`

Die Runtime soll soweit möglich auf bestehende lokale Verträge aufsetzen, statt einen zweiten inkompatiblen Konfigurationspfad einzuführen. Besonders relevant ist die Wiederverwendung oder Ableitung aus etablierten Variablen wie:

- `IAM_ACCEPTANCE_BASE_URL`
- dedizierte Admin-Credentials
- Ready-/Health-Endpunkte des lokalen Systems

## Pilot-Missionen

### 1. `admin-users-overview`

Ziel:
Ein dedizierter Admin meldet sich an, erreicht `/admin/users`, versteht die sichtbaren Listen- und Kontextinformationen und identifiziert mindestens einen bearbeitbaren Nutzer.

Pflichtkriterien:

- Login über den echten lokalen Auth-Pfad erfolgreich
- `/admin/users` ohne Forbidden- oder Login-Redirect erreichbar
- Benutzerliste oder leerer, fachlich gültiger Zustand sichtbar
- mindestens ein zentrales UI-Element der Benutzerverwaltung eindeutig erkannt

### 2. `admin-user-permissions-inspection`

Ziel:
Ein Admin öffnet einen Nutzerdatensatz und prüft Rollen, direkte Rechte, Herkunft der Berechtigungen und die sichtbare Darstellung des effektiven Rechtebilds.

Pflichtkriterien:

- Nutzerdetailseite erreichbar
- Rollen- oder Berechtigungssektionen sichtbar
- Missionsbericht dokumentiert, welche Rechteinformationen gefunden wurden
- keine unerwartete Navigationssperre oder instabile Fehlerseite

### 3. `admin-role-management-navigation`

Ziel:
Ein Admin navigiert zwischen Benutzer- und Rollenverwaltung, öffnet Rollendetails und bestätigt, dass Rechtebündel und zentrale Verwaltungsaktionen sichtbar und verständlich sind.

Pflichtkriterien:

- `/admin/roles` erreichbar
- mindestens eine Rolle oder ein fachlich gültiger Leerzustand sichtbar
- Rollendetail oder Rollenanlage-Kontext erreichbar
- zentrale Verwaltungsaktionen sind auffindbar oder ihr Fehlen wird explizit protokolliert

## Qualitätsgrenzen und Guardrails

Die Pilotphase soll explorativ, aber kontrolliert sein. Deshalb gelten folgende Guardrails:

- feste Start-URL pro Mission
- feste dedizierte Testidentität
- Abbruch bei fehlender Readiness des Zielsystems
- Pflichtartefakte pro Lauf
- begrenzter zulässiger Navigationsraum
- harte Minimal-Asserts zusätzlich zur freien Exploration

Für den ersten Ausbauzustand ist ein read-mostly-Ansatz vorgesehen:

- Fokus auf Navigation, Verstehen, Sichtbarkeits- und Konsistenzprüfungen
- keine aggressive Vollmutation produktionsnaher IAM-Daten
- spätere Erweiterung auf kontrollierte, reversible Schreiboperationen möglich

## Risiken und Gegenmaßnahmen

### LLM- und Browser-Varianz

Risiko:
Explorative Läufe sind weniger deterministisch als klassische Playwright-Specs.

Gegenmaßnahmen:

- keine CI-blockende Nutzung im Pilot
- feste Missionen statt völlig freier Agentenläufe
- harte Minimal-Asserts
- Pflichtartefakte zur Diagnose

### Echte Datenmutation im lokalen IAM-Stack

Risiko:
Admin-Flows können lokale Testdaten in einen schwer reproduzierbaren Zustand bringen.

Gegenmaßnahmen:

- Start mit read-mostly-Missionen
- dedizierte Testidentitäten
- später nur kontrollierte und reversible Schreibpfade

### Schwer interpretierbare Fehlerbilder

Risiko:
Ohne strukturierte Berichte bleibt unklar, ob ein Lauf an Auth, UI, Backend oder Exploration gescheitert ist.

Gegenmaßnahmen:

- strukturierter Status pro Mission
- Screenshot- und Transcript-Pflicht
- klarer Missionsname und definierter Startzustand

## Ausbaupfad

Nach dem Pilot kann die Schicht in drei Richtungen erweitert werden:

1. Weitere Admin-Missionen
   Beispiele: Rollenänderung, Benutzeranlage, Zuordnung direkter Rechte, Konflikt- und Fehlerszenarien

2. Kontrollierte Mutationsflüsse
   Zunächst nur mit reversiblen oder vorbereiteten Testdaten

3. Weitere Domänen außerhalb des IAM-Admins
   Zum Beispiel redaktionelle oder plugin-bezogene Explorations-Journeys

Die Missionsstruktur soll deshalb von Anfang an katalogisierbar und modular aufgebaut werden, sodass neue Bereiche ohne Architekturbruch ergänzt werden können.

## Offene Umsetzungsentscheidungen für die Planungsphase

- welches konkrete Stagehand-SDK-Setup lokal verwendet wird
- wie Env-Secrets für externe LLM-APIs lokal eingebunden und dokumentiert werden
- welches Artefaktformat zusätzlich zum Textbericht für spätere Auswertung sinnvoll ist
- ob Missionen einzeln oder gesammelt über Parameter am Nx-Target gestartet werden
- wie stark die Stagehand-Schicht an bestehende Acceptance-Login-Helfer andockt
