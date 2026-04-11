## Context
Das Studio besitzt bereits einen serverseitigen Readiness-Endpoint, der Datenbank, Redis und Keycloak prüft. Diese Informationen werden aber bisher nur operativ genutzt und nicht dauerhaft in der Shell visualisiert.

Die gewünschte Funktion ist bewusst environment-unabhängig: dieselbe Anzeige soll lokal, in Staging und in Produktion sichtbar sein. Sie muss daher sicher mit partiellen Ausfällen umgehen, keine sensiblen Interna leaken und darf die eigentliche Studio-Nutzung nicht blockieren.

## Goals
- Zentrale Sichtbarkeit des aktuellen Plattformzustands auf jeder Studioseite
- Einheitlicher, UI-tauglicher Vertrag für Dienststatus und sichere Fehlergründe
- Geringe Kopplung: Shell-Anzeige konsumiert den bestehenden Health-Endpoint statt eigene Checks zu implementieren
- Gute Diagnostik über strukturierte Logs und Request-Korrelation

## Non-Goals
- Kein vollständiges Monitoring-Dashboard
- Keine mandantenspezifische Tiefendiagnostik je Fachfunktion
- Kein environment-spezifisches Ausblenden der Anzeige

## Decisions

### 1. Bestehenden Readiness-Endpoint erweitern statt neuen Spezial-Endpoint bauen
Die Shell nutzt den bestehenden Readiness-Pfad als zentrale Quelle. Dadurch bleiben Backend-Checks an einer Stelle konsolidiert und die UI zeigt dieselbe Wahrheit wie Orchestrierung und Betrieb.

### 2. UI erhält normalisierte Dienstobjekte
Die Response soll für jede relevante Abhängigkeit ein stabiles Objekt enthalten, z. B. `database`, `redis`, `keycloak`, optional weitere Dienste wie `authorization_cache`, jeweils mit:
- `status`: `ready | degraded | not_ready | unknown`
- `label`
- optional `reason_code`
- optional sichere `message`

Die UI rendert daraus Badges oder Statuspunkte, ohne serverinterne Details interpretieren zu müssen.

### 3. Polling in der Root-Shell
Die Anzeige wird zentral in der Root-Shell angebunden und pollt in einem moderaten Intervall. Fehler beim Polling führen nicht zum Ausfall der Shell, sondern zu einem sichtbaren `unknown`-/Fehlerzustand der Anzeige.

### 4. Saubere Fehlerdarstellung
Die Shell zeigt nur sichere Diagnoseinformationen. Interne Stacktraces, Secrets, Hostnamen oder rohe Exceptiontexte bleiben serverseitig im strukturierten Logging und werden nicht ungefiltert in die UI gespiegelt.

## Risks
- Zusätzliche Health-Polls auf jeder geöffneten Studio-Instanz
- Wahrnehmbares UI-Rauschen, wenn die Anzeige zu dominant gestaltet wird
- Vertragsdrift zwischen bestehender Readiness-Nutzlast und neuem UI-Bedarf

## Mitigations
- Moderates Polling mit zentralem Hook statt mehrfacher Komponentenabfragen
- Kompakte Footer-/Shell-Endanzeige mit klarer visueller Priorität
- Tests für API-Vertrag und Rendering in Success-, Failure- und Polling-Fehlerfällen
