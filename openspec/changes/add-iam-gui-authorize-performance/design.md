## Context

Das System besitzt bereits:

- ein Monitoring-Modul unter `/monitoring`
- einen serverseitigen `POST /iam/authorize`-Pfad
- Snapshot-Invalidierung und Recompute-Logik
- einen CLI-basierten Benchmark-Pfad fuer Report-Artefakte

Es fehlt jedoch ein operativer Einstieg in derselben Produktoberflaeche, ueber den ein berechtigter Administrator mit seiner aktuellen Session den echten Pfad messen kann.

## Decision

Der Benchmark wird **serverseitig** ausgefuehrt und **UI-seitig** nur gestartet und ausgewertet.

Die aktuelle Session des aufrufenden Administrators ist die fachliche Identitaet des Laufs. Fuer `recompute` wird gezielt nur der Snapshot dieses Benutzers invalidiert. Die UI zeigt das Ergebnis tabellarisch und lesbar an, ohne die Messung selbst im Browser zu durchlaufen. Der Einstieg wird im bestehenden Monitoring-Modul und nicht im IAM-Cockpit verankert, weil die Funktion eine betriebliche Aussage ueber Cache-Wiederverwendung, Recompute und Systemgesundheit liefert.

## Components

### 1. Monitoring-UI

- neuer IAM-bezogener Monitoring-Einstieg unter `/monitoring`
- darin ein Card-/Panel-Bereich `Authorize Performance`
- Formular fuer Benchmark-Parameter
- Start-Button
- Status-/Ergebnisdarstellung

### 2. Benchmark-Endpoint

- validiert Session und Berechtigung
- uebernimmt Instanz- und Benutzerkontext aus der Session
- fuehrt Benchmark-Szenarien im Serverprozess aus
- liefert strukturiertes Ergebnis zurueck

### 3. Benchmark-Engine

- wiederverwendet vorhandene Payload-/Summary-Helfer
- misst requestnah im Serverkontext
- schreibt optionale Reports fuer Nachweiszwecke

## Data Flow

1. UI sendet Startrequest.
2. Server liest Sessionkontext.
3. Benchmark-Engine fuehrt Szenarien aus.
4. Server speichert oder rendert Ergebnis.
5. UI zeigt das Ergebnis.

## Risks

- Browser-UI koennte als scheinbare Messquelle missverstanden werden.
  - Gegenmassnahme: Ergebnis klar als serverseitig gemessen markieren.
- `recompute` koennte versehentlich globalere Invalidierung ausloesen.
  - Gegenmassnahme: nur user-scoped Invalidation fuer den Session-Benutzer.
- Lange Laufzeiten koennten die UI blockieren.
  - Gegenmassnahme: erste Ausbaustufe klein halten; bei Bedarf spaeter Job-Modell.
