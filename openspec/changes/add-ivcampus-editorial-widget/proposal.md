# ivCampus-Kachel für die Studio-Redaktion

## Anlass

Kommunale Mitarbeitende sollen aus ihrem ivCampus-Teamraum direkt eine Meldung
oder Veranstaltung im Studio anlegen können. Die bestehende Modulübersicht bietet
den Administrationszugang. Ihr fehlt die Widget-Adresse für die Einreichung.

## Umfang

- Optionales Studio-Modul mit Einstellungen über die Modulübersicht und einer kopierbaren Widget-Adresse.
- Öffentliche Widget-Route für die Staging-Sandbox mit wirksamer Modulzuweisung.
- Zwei feste Studio-Ziele. Anmeldung und Autorisierung erfolgen im geöffneten Studio-Tab.
- Eigene CSP für die Widget-Antwort mit genau einer per Laufzeit konfigurierten HTTPS-Origin.

Der Pilot enthält keine News-Vorschau, keine Synchronisation und keine
Datenübernahme zwischen Campus und Studio.

Die Einbettungsgrenze steht in [arc42 Abschnitt 08](../../../docs/architecture/08-cross-cutting-concepts.md).
Die [Modulverwaltung](../../../docs/reference/instance-module-management.md#ivcampus-pilot-in-der-studio-sandbox)
beschreibt Konfiguration, Einreichung und Prüfung im Teamraum.
