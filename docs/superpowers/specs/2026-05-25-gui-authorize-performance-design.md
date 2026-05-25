# GUI-gestützter IAM-Authorize-Performance-Lauf

> Status: Entwurf nach Design-Abstimmung, noch vor Implementierung

## Ziel

Im bestehenden Monitoring-Bereich unter `/monitoring` soll ein berechtigter Administrator einen echten Performance-Lauf für `POST /iam/authorize` direkt aus der GUI starten können. Der Lauf nutzt die **aktuelle eigene Session** des angemeldeten Benutzers und deckt `cache-hit`, `cache-miss` und `recompute` ab.

## Nicht-Ziele

- Keine neue allgemeine Benchmark-Plattform
- Kein Login mit technischen Test-Accounts in der UI
- Keine Browser-seitige Messung als primäre Wahrheitsquelle
- Kein Ersatz für bestehende CLI-/Acceptance-Läufe, sondern ein ergänzender operativer Einstieg

## Empfohlener Ansatz

Die UI startet keinen Benchmark direkt im Browser, sondern einen **serverseitigen Lauf**, der vom Host kontrolliert wird. Dadurch bleiben Session-Nutzung, Invalidation und Messung deterministisch, während die UI nur Start, Fortschritt und Ergebnis darstellt.

## Architektur

### UI

Im bestehenden Monitoring-Modul unter `/monitoring` wird ein eigener IAM-bezogener Einstieg `Authorize Performance` ergänzt. Dieser Bereich enthält:

- Eingabefelder für `action`, `resourceType`, optionale `resourceId` und optionale `organizationId`
- technische Laufparameter mit konservativen Defaults
- Start-Aktion
- Statusdarstellung für laufenden, erfolgreichen oder fehlgeschlagenen Lauf
- Ergebnisübersicht pro Szenario mit `Samples`, `p50`, `p95`, `p99`, Bewertung und Report-Verweisen

Die UI nutzt bestehende `shadcn/ui`-Bausteine, vorhandene Monitoring-/Admin-i18n-Namensräume und den vorhandenen Auth-/Admin-Kontext.

### Server

Der Server stellt einen geschützten Start-Endpoint und einen Lese-Endpoint für das letzte Ergebnis bereit. Der Start-Endpoint:

- prüft die aktuelle Session des aufrufenden Administrators
- leitet `instanceId` und `keycloakSubject` aus dieser Session ab
- führt die Benchmark-Szenarien im Serverkontext aus
- stößt für `recompute` gezielt eine Benutzerinvalidierung für den aktuellen Benutzer an
- erzeugt einen Report als JSON und Markdown unter `docs/reports/` bzw. in einem dafür vorgesehenen Laufartefaktpfad

### Messstrategie

- `cache-hit`: gleicher Autorisierungskontext, wiederholte Requests
- `cache-miss`: variierter Geo-/Kontextschlüssel pro Request, damit kein Shared Snapshot wiederverwendet wird
- `recompute`: gezielte Invalidation vor dem Messrequest

Die Metrikquelle für die Abnahme ist die serverseitig gemessene Request-Dauer des echten `/iam/authorize`-Pfads, nicht Browser-Timing.

## Datenfluss

1. Administrator meldet sich regulär an.
2. UI lädt `/monitoring` und zeigt den neuen Benchmark-Einstieg.
3. Nutzer startet den Lauf.
4. Server validiert Berechtigung und Session.
5. Server misst die drei Szenarien.
6. Server persistiert Ergebnis und schreibt Report-Artefakte.
7. UI lädt das Ergebnis nach und stellt es lesbar dar.

## Fehlerbehandlung

- Fehlende Session oder unzureichende Berechtigung: fail-closed, kein Start
- Redis-/DB-/Invalidation-Fehler während des Laufs: Laufstatus `failed` mit sicherer Diagnose
- Teilweise Ergebnisse werden nicht als erfolgreich dargestellt
- UI zeigt keine Roh-Stacktraces und keine sensitiven Sessiondaten

## Sicherheits- und Betriebsaspekte

- Der Lauf nutzt ausschließlich die aktuelle Session des Administrators
- Es werden keine Passwörter oder technischen Test-Credentials in die UI verlagert
- `recompute` darf nur den aktuellen Benutzerkontext invalidieren, nicht global beliebige Nutzer
- Start und Ergebnisabruf werden serverseitig autorisiert und geloggt

## Tests

- Unit-Tests für Payload- und Ergebnis-Mapping
- Server-Tests für Start-Endpoint, Sessionableitung und Benutzerinvalidierung
- UI-Tests für Start, Progress, Ergebnis und Fehlerzustände
- optional E2E-Smoke für `/admin/iam` mit gestartetem Benchmark im Mock-/Controlled-Modus

## Betroffene Bereiche

- `apps/sva-studio-react/src/routes/monitoring/`
- `apps/sva-studio-react/src/lib/iam-api.ts`
- `packages/auth-runtime` für geschützten Benchmark-Endpoint und Ergebnisvertrag
- Reports-/Artefaktpfad für versionierte Performance-Nachweise

## Offene Implementierungsentscheidung

Für die erste Ausbaustufe reicht ein **synchroner serverseitiger Lauf** mit blockierendem UI-Waiting, solange die Laufzeit kurz und die UX klar bleibt. Wenn der Lauf spürbar länger wird oder parallelisierte Mehrfachstarts relevant werden, sollte daraus ein expliziter Job-Flow werden.
