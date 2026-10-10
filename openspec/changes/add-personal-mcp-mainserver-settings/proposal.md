# Persönliche Mainserver-Konfiguration im Studio-MCP

## Anlass

Der persönliche MCP kann tenantverwaltete Schnittstellen bearbeiten, schließt Mainserver-Konfigurationen aber aus. Der vorhandene Mainserver-Speicherpfad ist nur über Browser-Serverfunktionen erreichbar; die Einrichtung der beauftragten Tenant-Zuordnungen benötigt einen authentifizierten HTTP-Vertrag.

## Freigegebener Zuschnitt

GET und POST `api/v1/interfaces/mainserver` werden im bestehenden Interface-Dispatcher und persönlichen MCP ergänzt. GET liefert die aktuelle Konfiguration oder `null`; POST akzeptiert ausschließlich `graphqlBaseUrl`, `oauthTokenUrl` und `enabled` und delegiert an den vorhandenen Mainserver-Speicherpfad. Die Instanz wird aus dem authentifizierten, hostgebundenen Actor bestimmt. Neue Services, Dependencies, Datenbankänderungen, Credentials, Löschaktionen, UI-Flows und automatische Tenant-Anmeldungen sind keine Ziele.

## Sicherheits- und Ausführungsgrenzen

- Persönlicher Bearer: bestehende Prüfung von Issuer, Audience, Client, Subject, Host, Tenant und Ablauf; ungültiger Bearer fällt nicht auf Browser-Cookies zurück.
- Beide Methoden benötigen `integration.manage`; POST erhält den vorhandenen Browser-CSRF-Schutz. Nur erfolgreich authentifizierte persönliche Bearer verwenden dessen bestehende Ausnahme.
- Fremde Instanz-IDs, Secrets, zusätzliche Felder und Query-Parameter werden abgelehnt. Die bestehende URL-/SSRF-Validierung und Upsert-Persistenz bleiben zuständig.
- GET und POST projizieren nur öffentliche Mainserver-Konfigurationsfelder; freie Provider-Fehlertexte und Credentials werden nicht ausgegeben.
- Ein erfolgreicher Save beweist keine Mainserver-Berechtigung oder Provider-Readiness. Unklare Mutationen werden vor einer Wiederholung nachgelesen.

## Nachweise

Gezielte Tests für HTTP-Dispatch, Tenant-/Permission-Grenzen, Browser-CSRF, ungültige Eingaben, fehlende Konfiguration, Methodenbegrenzung und MCP-Allowlist; bestehende URL-Validierung und persönliche Auth-Tests bleiben Pflichtnachweise. Types, Lint, Runtime und Dokumentations-Gates prüfen den exakten PR-HEAD. Die Live-Einrichtung folgt erst nach Merge und kanonischem Build-/Promote-Rollout.

## Betroffene Dokumentation

Betriebsrunbook `docs/operations/studio-instance-mcp-betrieb.md` und arc42 Abschnitt 8. Die Scope-Freigabe erfolgte im Nutzerauftrag „Minimalen MCP-PR erstellen“.

## Ergänzende Nutzeranforderung

Alle aktuell unterstützten Schnittstellenarten sollen über MCP anlegbar sein. Die bestehenden allgemeinen POST-Verträge decken S3, Supabase, PostgreSQL, Mailtransport und Karten/Geocoding bereits ab; dieser Change schließt die Mainserver-Lücke. Die Abdeckung wird für alle Arten dokumentiert und durch HTTP-Vertrags- und MCP-Transporttests mit lokaler Secret-Auflösung nachgewiesen. Bestehende Modul- und Ownership-Gates bleiben erhalten.
