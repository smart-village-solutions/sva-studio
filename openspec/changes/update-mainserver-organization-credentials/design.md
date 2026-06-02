## Kontext

Die bestehende Mainserver-Delegation liest Application-ID und Secret pro Benutzer aus Keycloak. Gleichzeitig existiert mit `contentAuthorPolicy` bereits eine organisationsbezogene Leitplanke, und der aktive Organisationskontext wird in der Session für nachgelagerte Entscheidungen bereitgestellt. Für Organisationen mit gemeinsamem Mainserver-Zugang fehlt bisher jedoch ein organisationsgebundener Secret-Speicher und eine deterministische Auflösungslogik.

## Ziele

- `contentAuthorPolicy` steuert zusätzlich die Auswahl der effektiven Mainserver-Credentials.
- `org_only` erzwingt Credentials der aktiven Organisation ohne Benutzer-Fallback.
- `org_or_personal` nutzt zuerst Credentials der aktiven Organisation und fällt nur bei unvollständiger Organisationskonfiguration auf Benutzer-Credentials zurück.
- Der aktive Organisationskontext aus der Session bleibt die einzige Organisationsquelle für Credential-Auflösung.
- Organisationsgebundene Secrets werden serverseitig in der Studio-Datenbank gespeichert und nie über generische Read-Models oder Logs offengelegt.

## Nicht-Ziele

- keine Migration bestehender Benutzer-Credentials auf Organisationen
- keine Suche über andere Mitgliedsorganisationen oder heuristische Best-Match-Auflösung
- keine Ablage organisationsgebundener Secrets in `iam.organizations.metadata`
- keine Browser- oder Session-Exposition von Mainserver-Credentials oder Access-Tokens

## Entscheidungen

### Decision: `contentAuthorPolicy` steuert auch die Credential-Auflösung

Die bestehende Policy bleibt die fachliche Schaltstelle für Autorenschaft und Mainserver-Zugang. Dadurch entsteht keine zweite, konkurrierende Policy im Organisationsmodell.

Alternativen:
- separate Mainserver-Policy pro Organisation: verworfen, weil sie fachliche Inkonsistenzen und zusätzliche UI-Komplexität erzeugt
- globaler Instanzschalter: verworfen, weil er organisationsbezogene Verantwortung nicht sauber abbildet

### Decision: Der aktive Session-Kontext ist die einzige Organisationsquelle

Der Resolver nutzt ausschließlich `activeOrganizationId` aus der Session. Es gibt keine implizite Suche über andere Organisationsmitgliedschaften, keinen hierarchischen Best-Match und keinen stillen Wechsel auf eine andere Organisation.

Alternativen:
- Suche über alle Mitgliedsorganisationen: verworfen, weil Mehrfachmitgliedschaften sonst nicht deterministisch bleiben
- Hierarchie-basierte Vererbung der Credentials: verworfen, weil das freigegebene Design nur den aktiven Kontext autorisiert

### Decision: Organisations-Credentials liegen in einem dedizierten DB-Speicher

Application-ID und Secret werden als organisationsgebundene Daten serverseitig in der Studio-Datenbank modelliert. Das Secret wird ausschließlich als Ciphertext gespeichert; Read-Models und API-Responses liefern nur `mainserverApplicationId` und `mainserverApplicationSecretSet`.

Alternativen:
- Speicherung in `iam.organizations.metadata`: verworfen, weil `metadata` kein Secret-Speicher ist und generische Responses unnötig verbreitert
- Speicherung in Keycloak-Organisationsattributen: verworfen, weil der freigegebene Scope organisationsgebundene Secrets in der Studio-DB verlangt

### Decision: Laufzeitauflösung bleibt fail-closed und cache-isoliert

`org_only` verlangt vollständige Credentials der aktiven Organisation und liefert bei Fehlen einen deterministischen organisationsbezogenen Fehler. `org_or_personal` prüft zuerst die aktive Organisation und fällt nur dann auf Benutzer-Credentials zurück. Credential- und Token-Caches berücksichtigen mindestens `instanceId`, `keycloakSubject`, `activeOrganizationId` und die effektive Credential-Quelle.

Alternativen:
- stiller Fallback von `org_only` auf Benutzer-Credentials: verworfen, weil dies die Policy semantisch entwertet
- Cache-Key ohne Organisationskontext: verworfen, weil Tokens sonst zwischen Organisationskontexten vermischt werden könnten

## Risiken und Trade-offs

- Fehlende Organisations-Credentials bei `org_only` erzeugen zunächst mehr sichtbare Fehler.
  Mitigation: deterministischer Fehlercode und klare Admin-Pflege in der Organisationsdetailansicht.
- Zwei Credential-Quellen erhöhen die Laufzeitkomplexität.
  Mitigation: zentraler Resolver in `@sva/auth-runtime` statt verteilter Fallback-Logik in einzelnen Mainserver-Aufrufern.
- Organisations-Credential-Pflege erweitert den Admin-Scope um Secret-Handling.
  Mitigation: write-only Secret-Feld, Redaction und read-safe Statusmodell.

## Migrationsplan

1. OpenSpec-Change für betroffene Capabilities anlegen und freigeben.
2. Organisationsgebundenen Credential-Speicher und abgesicherte API-Verträge ergänzen.
3. Resolver und Mainserver-Integration auf den aktiven Organisationskontext umstellen.
4. Organisations-UI sowie Architektur- und Betriebsdokumentation nachziehen.

Es gibt keine automatische Migration bestehender Benutzer-Credentials. Bestehende Keycloak-basierte Benutzer-Credentials bleiben für `org_or_personal` als Fallback-Pfad erhalten.

## Offene Fragen

- Keine. Die Leitplanken für Policy-Semantik, Organisationsquelle und Secret-Speicher sind durch das freigegebene Design festgelegt.
