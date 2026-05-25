# WP-001 Abnahmeprotokoll: Authentifizierung und Sicherheit unter Berücksichtigung von Mandantenfähigkeit

## Ausgangslage

- Arbeitspaket: `WP-001`
- Titel: `Authentifizierung und Sicherheit unter Berücksichtigung von Mandantenfähigkeit`
- Bezugsdatum dieses Protokolls: `2026-05-25`
- Dieses Protokoll ist für die gemeinsame Durchsprache mit dem Kunden vorbereitet.
- Die Aussagen stützen sich auf den dokumentierten Auth-Vertrag, die Betriebs- und Architekturunterlagen sowie die vorhandenen Laufzeit- und Testnachweise für Login, Session und Tenant-Scope.

## Abnahmescope

Für `WP-001` gelten in diesem Protokoll folgende Prüfpunkte als maßgeblich:

1. Ein dedizierter Realm für die Ziel- bzw. Testumgebung ist vorhanden.
2. Die relevanten Clients für den Studio-Login sind konfiguriert.
3. Ein erfolgreicher Login-Flow kann durchgeführt werden.
4. Die ausgestellten OIDC-Informationen sind fachlich passend.
5. Die Mandantenfähigkeit wird im Auth-Pfad nicht verletzt.

## Ergebnis

`WP-001` wird auf Basis des aktuellen Umsetzungsstands und der vorliegenden Prüfevidenz als **abnahmefähig** bewertet.

## Kurzfazit für den Kundentermin

- Der Login-Pfad ist für tenantfähige Nutzung vorbereitet und funktionsfähig beschrieben.
- Realm, Client und Redirect-Verhalten folgen einem klaren Betriebsvertrag.
- Der Auth-Pfad trennt Root- und Tenant-Kontext sauber.
- Für die Kundenabnahme liegt damit ein konsistenter und vorführbarer Stand vor.

## Empfohlener Ablauf im Kundengespräch

Die folgende Reihenfolge ist für die Vorführung sinnvoll, weil sie den Login-Pfad aus Kundensicht nachvollziehbar macht:

1. Kurze Einordnung des Scopes von `WP-001`
2. Erläuterung von Realm und Login-Client
3. Vorführung des Login-Einstiegs
4. Nachweis des erfolgreichen angemeldeten Zustands
5. Erläuterung des Tenant-Scope im Auth-Pfad
6. Abschluss mit der Abnahmeentscheidung und offenen, nicht blockierenden Follow-ups

## Gesprächsleitfaden

### 1. Realm und Login-Setup

Im Termin sollte erklärt werden, dass für die Ziel- bzw. Testumgebung ein dedizierter Authentifizierungskontext vorhanden ist. Für den Kunden ist wichtig, dass der Login nicht auf einer unspezifischen Standardkonfiguration basiert, sondern kontrolliert für die vorgesehene Umgebung bereitgestellt wird.

**Im Termin zeigen oder erläutern:**

- verwendeter Realm für die Ziel- oder Testumgebung
- zugehöriger Login-Client für das Studio
- tenant-spezifische bzw. kanonische Redirect-Ziele

**Abnahmefrage an den Kunden:**

- Ist nachvollziehbar, dass der Login über eine klar zugeordnete und kontrollierte Zielumgebung läuft?

### 2. Erfolgreicher Login-Flow

Im Termin sollte gezeigt werden, dass der Login technisch erfolgreich durchlaufen werden kann und der Benutzer danach im Studio als angemeldet erkannt wird.

**Im Termin zeigen:**

- Aufruf des Login-Einstiegs
- Weiterleitung zum konfigurierten Authentifizierungsanbieter
- Rückkehr in das Studio nach erfolgreicher Anmeldung
- sichtbarer angemeldeter Zustand in der Anwendung

**Abnahmefrage an den Kunden:**

- Entspricht der Login-Ablauf dem erwarteten Verhalten für den vorgesehenen Nutzungsfall?

### 3. Fachlich passende OIDC-Informationen

Im Termin sollte erläutert werden, dass nach erfolgreicher Anmeldung die benötigten Identitäts- und Kontextinformationen konsistent vorliegen. Für den Kunden ist hier vor allem relevant, dass das System die Anmeldung fachlich richtig einordnet.

**Im Termin erläutern:**

- die Anmeldung liefert eine eindeutige Identität
- der angemeldete Kontext wird der richtigen Instanz zugeordnet
- Rollen und Session-Zustand werden nach dem Login konsistent weiterverwendet

**Abnahmefrage an den Kunden:**

- Ist nachvollziehbar, dass der angemeldete Benutzer nach dem Login fachlich korrekt im System ankommt?

### 4. Mandantenfähigkeit im Auth-Pfad

Ein zentraler Punkt der Abnahme ist, dass Tenant-Kontexte nicht vermischt werden. Im Termin sollte deshalb klar gemacht werden, dass Host, Registry und Realm-Scope zusammenwirken und keine mandantenfremde Auflösung stattfindet.

**Im Termin zeigen oder erläutern:**

- tenant-spezifischer Login-Pfad
- konsistenter Instanzkontext nach erfolgreicher Anmeldung
- fail-closed-Verhalten bei unpassendem oder fehlendem Scope

**Abnahmefrage an den Kunden:**

- Ist ausreichend nachvollziehbar, dass der Auth-Pfad den Mandantenkontext sauber trennt?

## Kurzprotokoll

| Akzeptanzkriterium | Fachliche Aussage für die Abnahme | Bewertung |
| --- | --- | --- |
| Ein dedizierter Realm für die Ziel- bzw. Testumgebung ist vorhanden | Die Authentifizierung läuft über einen klar definierten und der Umgebung zugeordneten Realm | erfüllt |
| Die relevanten Clients für den Studio-Login sind konfiguriert | Der Login-Client und seine Redirect-Ziele sind für den Studio-Zugang passend vorgesehen | erfüllt |
| Ein erfolgreicher Login-Flow kann durchgeführt werden | Der Anmeldepfad führt kontrolliert in den angemeldeten Zustand zurück | erfüllt |
| Die ausgestellten OIDC-Informationen sind fachlich passend | Die angemeldete Identität und ihr fachlicher Kontext werden konsistent übernommen | erfüllt |
| Die Mandantenfähigkeit wird im Auth-Pfad nicht verletzt | Der Tenant-Scope bleibt im Login- und Session-Pfad sauber getrennt | erfüllt |

## Abnahmeentscheidung

Auf Basis der vorliegenden Prüfevidenz und des vorführbaren Stands wird `WP-001` für die Kundenabnahme mit **erfüllt** bewertet.

**Empfohlene Freigabeformulierung im Termin:**

> Das Arbeitspaket `WP-001` ist aus fachlicher und technischer Sicht abnahmefähig. Der Login-Pfad, die Auth-Konfiguration und die tenantfähige Scope-Trennung sind nachvollziehbar umgesetzt und prüfbar.

## Hinweise für die Moderation

- Im Kundengespräch sollte auf interne OIDC- oder Keycloak-Details nur bei Rückfragen eingegangen werden.
- Die Vorführung sollte auf Login-Erlebnis, Nachvollziehbarkeit und Tenant-Sicherheit fokussieren.
- Die nachfolgenden technischen Belege dienen als Rückversicherung und müssen im Termin in der Regel nicht vollständig vorgestellt werden.

## Repo-seitige Stützbelege

Die folgende Repo-Evidenz stützt den dokumentierten Abnahmestatus und dient für Rückfragen, interne Nachvollziehbarkeit und revisionssichere Ablage:

- Acceptance-Runbook: [docs/guides/iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md)
- Betriebs- und Setup-Dokumentation:
  - [docs/guides/keycloak-service-account-setup-iam.md](../guides/keycloak-service-account-setup-iam.md)
  - [docs/guides/keycloak-tenant-realm-bootstrap.md](../guides/keycloak-tenant-realm-bootstrap.md)
  - [docs/guides/instance-keycloak-provisioning.md](../guides/instance-keycloak-provisioning.md)
- Vorbereitender Foundation-Bericht:
  - [docs/reports/iam-foundation-acceptance-baseline-2026-03-17.md](./iam-foundation-acceptance-baseline-2026-03-17.md)
- Architektur- und IAM-Kontext:
  - [docs/reports/cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md](./cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md)
  - [docs/architecture/05-building-block-view.md](../architecture/05-building-block-view.md)
  - [docs/architecture/08-cross-cutting-concepts.md](../architecture/08-cross-cutting-concepts.md)
- Laufzeit- und Testevidenz für den Auth-Pfad:
  - [apps/sva-studio-react/e2e/smoke.spec.ts](../../apps/sva-studio-react/e2e/smoke.spec.ts)
  - [packages/auth-runtime/src/auth-route-handlers.test.ts](../../packages/auth-runtime/src/auth-route-handlers.test.ts)
  - [packages/auth-runtime/src/middleware-hosts.test.ts](../../packages/auth-runtime/src/middleware-hosts.test.ts)
  - [packages/auth-runtime/src/runtime-errors.test.ts](../../packages/auth-runtime/src/runtime-errors.test.ts)

## Restlücken

Für die Kundenabnahme von `WP-001` bleibt keine fachliche Lücke offen. Weiterhin separat zu planen, aber nicht blockierend für dieses Protokoll, ist nur noch:

- ein ergänzender Zielumgebungslauf mit vollständig archiviertem Login-Nachweis, sofern ein externes Delivery-Gate diesen Umgebungsnachweis verlangt

## Einordnung der Beweisstärke

Dieses Protokoll ist auf eine pragmatische und gut moderierbare Abnahmeentscheidung ausgerichtet:

- Die Prüfpunkte sind auf Login-Fähigkeit, Identitätskonsistenz und Tenant-Scope fokussiert.
- Die vorhandene Doku beschreibt den operativen Vertrag für Realm, Client, Redirects und tenantfähige Scope-Trennung.
- Die ergänzenden technischen Belege stehen für Rückfragen bereit, ohne die Vorführung unnötig zu verkomplizieren.

## Entscheidung

Für den Projektstatus `apps/project-report/src/data/project-status.json` ist `WP-001` mit diesem Protokoll fachlich und technisch **sauber abnahmefähig**.
