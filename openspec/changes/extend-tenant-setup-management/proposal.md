# Change: Studio-Tenants über den MCP einrichten und verwalten

> **Arbeitsstand:** Der Change ist für die Umsetzung freigegeben. Dieser erste
> Lieferabschnitt richtet die persönlichen Keycloak-Clients deaktiviert in
> bestehenden Tenant-Realms ein und ergänzt das New-Realm-Provisioning. Die
> Studio-API- und MCP-Anbindung sowie die Client-Aktivierung folgen getrennt.

## Why

Wir betreiben als Service Provider eine oder mehrere Studio-Instanzen und
stellen Kunden fertig eingerichtete Tenant-Umgebungen bereit. Wir verwalten
sowohl die Studio-Instanzen als auch die Tenants. Nach der Einrichtung erhalten
Kunden eigene Accounts mit vollen Tenant-Adminrechten; unsere Mitarbeitenden
behalten dauerhaften Zugriff über persönliche Provider-Accounts.

Der heutige Studio-MCP unterstützt die technische Instanzanlage, Keycloak- und
IAM-Bereitstellung, Diagnose und Aktivierung. Weitere für die Einrichtung und
laufende Verwaltung benötigte Studio-Funktionen sind darüber nicht erreichbar:
Schnittstellen, Accounts und Einladungen, Rollen, Gruppen sowie Organisationen
und Mitgliedschaften. Eine technisch aktive Instanz ist deshalb noch keine
fertig eingerichtete Kundenumgebung.

## What Changes

- Als erster Anwendungsfall wird der Einrichtungsauftrag im Gespräch
  schrittweise erhoben. Er bestimmt Tenant, Module, benötigte Schnittstellen,
  Kundenorganisation und die ersten Kunden-Admins. Jeder Tenant erhält eine
  Kundenorganisation; Mainserver und davon abhängige Plugins sind optional.
- Der bestehende Instanzprozess bleibt für Anlage, technische Bereitstellung
  und ausdrücklich bestätigte Aktivierung maßgeblich.
- Der MCP erhält einen allgemeinen Zugang zu vorhandenen **Studio-
  Verwaltungs-APIs** im ausdrücklich gewählten Studio- oder Tenant-Kontext.
  Er unterstützt Einzelaktionen zum Lesen, Anlegen, Ändern, Deaktivieren und
  Löschen auch unabhängig von einer Tenant-Neuanlage. Redaktionelle Inhalte
  und Plugin-Facheinstellungen gehören nicht zu diesem Change; Massenaktionen
  bleiben zunächst außerhalb des Umfangs.
- Für den neuen allgemeinen API-Zugang werden Plattform und jeder Tenant
  über getrennte Realms und eigene interaktive Anmeldungen mit persönlichen
  Provider-Accounts angesprochen. Der aktive Kontext wird ausdrücklich
  gewechselt. Eine Browser-Sitzung wird nicht als MCP-Anmeldung übernommen;
  bestehende servicegebundene Instanztools müssen dafür nicht umgestellt werden.
- Der lokale MCP wird für Provider-Operatoren eingerichtet. Seine Nutzung
  bleibt auf persönliche Provider-Accounts beschränkt, denen Keycloak im
  jeweiligen Realm den Zugang zum MCP-Client gewährt. Studio führt keine
  eigene Provider-Freigabe; es prüft Client-/Realm-Bindung des Tokens und
  danach die bestehenden fachlichen Rechte. Volle Tenant-Adminrechte eines
  Kunden reichen für einen MCP-Token nicht aus.
- Die vorhandenen Studio-Fachverträge bleiben führend für Autorisierung,
  Tenant-Bindung, Validierung, Idempotenz, Löschschutz und Audit. Fehlende
  HTTP-API-Funktionen werden als konkrete Lücken ausgewiesen und später bei
  Bedarf ergänzt; der MCP simuliert sie nicht über Browser oder direkte
  Datenbank- beziehungsweise Providerzugriffe.
- Wir richten die beauftragten Ressourcen ein, lesen die Ergebnisse zurück
  und legen den ersten Kunden-Admin ohne Einladungsversand an. Die Einladung
  senden wir erst nach abgeschlossener Einrichtung und Prüfung. Danach können
  wir Tenant-Ressourcen weiterhin per MCP verwalten. Die Kunden-Admins
  verwalten ihren Tenant ebenfalls mit
  ihren vollen Rechten in Studio.

## Grenzen

- Keine zweite Instanz-Registry, Provisionierung, IAM-Fachlogik oder
  allgemeine Workflow-Engine.
- Keine automatische Kundenfreigabe allein aufgrund von `active`.
- Keine Pflicht zur Mainserver-Anbindung oder zu weiteren Organisationen,
  Rollen, Gruppen oder Schnittstellen über den konkreten Auftrag hinaus.
- Keine redaktionelle Inhaltsverwaltung, Plugin-Fachkonfiguration oder
  Massenmutation über diesen MCP-Ausbau.
- Keine Änderung des kanonischen Studio-Rolloutpfads.

## Abhängigkeiten und Auswirkungen

- `refactor-tenant-creation-readiness` bleibt für technische Anlage,
  Readiness und manuelle Aktivierung zuständig. Dieser Change ergänzt den
  Zugriff auf die weitere Tenant-Verwaltung und die Übergabe an den Kunden.
- Die heutigen Tenant-Verwaltungs-APIs verlangen eine Studio-Cookie-Sitzung.
  Für die getrennten persönlichen MCP-Anmeldungen benötigen dieselben
  Fachaktionen zusätzlich einen sicheren API-Authentisierungspfad. Die
  Browser-Anmeldung bleibt erhalten.
- Die Schnittstellenverwaltung hat heute teilweise nur Studio-Server-
  Funktionen statt entsprechender HTTP-APIs. Solche Lücken werden vor der
  Implementierungsplanung einzeln erhoben.
- Betroffene Specs: eine eigene MCP-Verwaltungsfähigkeit sowie die
  bestehenden Verträge für `iam-core`, `iam-access-control` und
  `external-interface-registry`. Instanz-Provisioning und Organisationen
  bleiben fachlich führende, wiederverwendete Verträge.
- Sicherheitsrelevante Grenzen und Nachweise sind in den arc42-Abschnitten
  03, 04, 05, 06, 08 und 10 zu prüfen.
