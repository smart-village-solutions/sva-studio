Die Abschnitte 2 bis 4 sind mögliche PR-Grenzen, abhängig vom Inventar und
von eigenständig prüfbaren Zwischenständen. Abschnitt 1 ist Vorbereitung;
Abschnitt 5 verteilt seine Nachweise auf die liefernden PRs und schließt den
Gesamtfall ab.

## 1. Verträge und Lücken am aktuellen Stand festlegen

- [x] 1.1 Die vorhandenen Verwaltungsrouten für Instanzen, Accounts, Einladungen, Rollen, Gruppen, Organisationen und Schnittstellen samt Methoden, Berechtigungen, CSRF/Fresh-Reauth und Löschschutz inventarisieren; aktive Instanz-Changes abgleichen. Für den ersten Kunden-Admin den vorhandenen Create-Vertrag `sendPasswordSetupEmail=false`, dessen `not_requested`-Ergebnis und den gesonderten Einladungs-/Resend-Pfad nachweisen. Die belegte Routenmatrix und Change-Abgrenzung stehen in `design.md` unter „Inventar und Scope-Grenzen“.
- [x] 1.2 Vorhandene OIDC-/Credential-Mechanismen und Routen-/Auth-Guards prüfen; persönlichen PKCE-Client, admin-only-Keycloak-Attribut `svaStudioMcpAccess`, gebundenen Login-Flow und getrennte Studio-Audience am eingesetzten Stand sowie Plattform- und aktive Tenant-Realms samt Login-Clients verifizieren. Die konkrete persönliche API-Anmeldung und die Begrenzung persönlicher MCP-Aufrufe sind in den Abschnitten 2 und 3 umgesetzt. `system_admin` und eine MCP-Installation allein erteilen keine Freigabe; Studio führt keine zweite Provider-Allowlist. Secrettragende Mutationen bleiben gesperrt und werden erst in Abschnitt 4.2 nach Nachweis eines geeigneten Eingabewegs ergänzt.
- [x] 1.3 Den Einrichtungsauftrag als ersten Anwendungs- und Abnahmefall für die allgemeinen Funktionen festhalten: Tenant, Module, optionale Mainserver-Anbindung, Schnittstellen, Kundenorganisation, Provider- und Kunden-Admins, Einladungsempfänger. Bestehende Instanzfelder wiederverwenden; keinen neuen Workflow oder Fertig-Status einführen.

## 2. PR-Kandidat: Persönliche Studio-API-Anmeldung

- [x] 2.1 Den serverseitigen API-Authentisierungspfad nur für das User-Listen-/Anlegepaar `GET` und `POST /api/v1/iam/users` opt-in an den bestehenden Identitäts-, Tenant- und Autorisierungskern anbinden. Ausstellenden Client (`azp`) und Studio-Audience getrennt prüfen; Issuer und Tenant-Host ohne Browser-Client-Secret an den Request-Kontext binden; ungültige oder nicht freigegebene Bearer-Requests ohne Cookie-Fallback abweisen. Cookie-Session, Browser-CSRF, Account-Lifecycle und Fresh-Reauth-Semantik erhalten.
- [x] 2.2 Den serverseitigen Auth-Vertrag für das freigegebene `GET`-/`POST /api/v1/iam/users`-Paar automatisiert belegen: korrekte Issuer-/Client-/Audience-Bindung und Tenant-Host-Auflösung, Ablehnung falscher Claims, Ablehnung anderer Routen/Methoden sowie kein Cookie-Fallback bei ungültigem oder nicht zugelassenem Bearer. Bestehenden Principal-/Rollenpfad und unveränderte Browser-CSRF-/Fresh-Reauth-Semantik absichern; Auth- und Server-Runtime-Pflichtgates ausführen. Live-Token-Ausgabe und Aufrufe des bereitgestellten Endpunkts sind Teil der nachgelagerten MCP-Abnahme in 3.5.

## 3. PR-Kandidat: Allgemeiner MCP-Zugang zu bestehenden Verwaltungs-APIs

- [ ] 3.1 Persönliche MCP-Anmeldung für Plattform- und Tenant-Kontexte mit getrennter Kontextwahl und Token-Lifecycle liefern; die servicegebundenen Instanztools unverändert lassen.
  - [x] 3.1a PKCE-Login pro explizit konfiguriertem Realm-Kontext, lokaler Callback, In-Memory-Tokenhaltung, Refresh, Abmeldung und Fehler-/Timeout-Bereinigung im bestehenden `@sva/studio-mcp` umsetzen.
  - [x] 3.1b Den persönlichen Client, das admin-only-Profilattribut und den gebundenen Login-Flow im New-Realm-Provisioning sicherstellen; aktive Bestands-Realms gezielt mit Readback nachrüsten, Audience je Realm abgleichen und Clients erst nach erfolgreichem API-/MCP-Nachweis aktivieren.
- [ ] 3.2 Kontextgebundene API-Aufrufe im bestehenden MCP mit relativen Admin-Pfaden, Query und JSON-Body ergänzen; Zielhost, Routen und Redirects begrenzen.
  - [x] 3.2a Für den ersten Lieferstand ausschließlich `GET` und `POST api/v1/iam/users` mit explizitem Kontext, relativer Route, begrenzten Parametern/Body und abgewiesenen Redirects aufrufen.
  - [x] 3.2b Weitere für den Einrichtungs- und Verwaltungsfall benötigte Methoden und bestehende Admin-Routen nach Autorisierungs-/Browser-Paritätsnachweis freigeben.
- [ ] 3.3 Antwort, Fehler, Korrelation und Idempotenzangaben ohne Secrets oder unnötige PII übertragen; bei unklarem Mutationsausgang Readback verlangen statt automatisch erneut zu schreiben.
  - [x] 3.3a Für die User-Collection Fehler redigieren, Request- und Idempotency-IDs weiterreichen, Mutationen nicht automatisch wiederholen und bei unklarem POST-Ausgang Readback verlangen.
  - [x] 3.3b Den Fehler-, Audit-, Korrelation- und Idempotenzvertrag für alle weiteren freizugebenden Verwaltungsrouten nachweisen.
- [x] 3.4 Bestehende Einzelaktionen für Accounts/Einladungen/Deaktivierung/Löschung, Rollen, Gruppen, Organisationen und Mitgliedschaften über den persönlichen Kontext prüfen. Serverautorisierung, Audit, Schutzregeln und Browser-Verhalten mit Positiv- und Negativfällen belegen.
- [x] 3.5 Nach Implementierung des persönlichen MCP-Kontexts und der benötigten API-Routen die Live-Abnahme in Dev durchführen: Kunden-`system_admin` darf `svaStudioMcpAccess` nicht selbst setzen; für die Probe den persönlichen Client zeitlich begrenzt aktivieren und ausschließlich einen isolierten synthetischen Test-Provider freigeben. Den tatsächlich bereitgestellten API-Pfad mit Lesen, zulässigem Schreiben und Ablehnungen für falschen Realm/Host/Client, Tenant-Grenzen, fehlende Rechte, Tokenablauf und Entzug prüfen und mit Browser-Verhalten vergleichen. Testzugang und Testdaten danach entfernen, den Client wieder deaktivieren und per Admin-Readback bestätigen. Dauerhafte Provider-Freigaben sind erst nach bestandenem Nachweis zulässig; Staging- und Produktions-Realms bleiben unangetastet.

## 4. PR-Kandidat: Fehlende Schnittstellen-HTTP-Verträge und MCP-Nutzung

- [x] 4.1 Nur die für beauftragte Schnittstellenaktionen fehlenden HTTP-Endpunkte im zuständigen Interface-Pfad ergänzen; bestehende Services, Schemas, Verschlüsselung, Healthchecks und Berechtigungen wiederverwenden.
- [x] 4.2 Die vorhandene MCP-Credential-Auflösung für secrettragende Mutationen prüfen und nur bei belegter Lücke minimal ergänzen; Klartext aus MCP-Argumenten, Antworten, Fehlern und Logs fernhalten. Pluginverwaltete Interfaces bleiben für allgemeine Tenant-Verwaltung verborgen.
- [x] 4.3 CRUD-, Health-, Autorisierungs-, Tenant- und Secret-Negativtests ausführen; Mainserver nur bei beauftragter Anbindung und mit eigenen bestehenden Verträgen prüfen.

## 5. Einrichtungs- und Verwaltungspfad abnehmen

- [ ] 5.1 Einen vollständigen Einrichtungsauftrag über vorhandene Instanztools und neue Admin-API-Aufrufe nachvollziehen: technische Aktivierung gesondert, dann Schnittstellen, Kundenorganisation, Rollen/Gruppen, dauerhafte persönliche Provider-Accounts und Kunden-Accounts mit vollen Tenant-Adminrechten samt Readbacks.
- [ ] 5.2 Einen Tenant mit und einen ohne Mainserver prüfen; bei letzterem abhängige Plugins und Organisations-Provisionierung auslassen. Provider-Zugriff und beauftragte Funktionen vor Einladung prüfen.
- [ ] 5.3 Den ersten Kunden-Admin ohne Versand anlegen und `not_requested` prüfen. Die Einladung erst nach bestandenen Einrichtungsprüfungen über den gesonderten Vertrag auslösen, Versandstatus nachlesen und die spätere erste Kundenanmeldung als getrennten Nachweis dokumentieren. Offene Lücken dürfen nicht als abgeschlossene Einrichtung gelten.
- [ ] 5.4 Laufende Einzelverwaltung einschließlich zulässiger Deaktivierung und Löschung sowie Ablehnungen durch Schutzregeln prüfen. Relevante arc42-Abschnitte und aktuelle MCP-Betriebsdokumentation aktualisieren; passende gezielte Gates und `openspec validate ... --strict` ausführen.
