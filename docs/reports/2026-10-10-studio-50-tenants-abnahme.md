# Abnahmestand der 50 Studio-Tenants am 10.10.2026

> Historischer Zwischenstand vom 10.10.2026 vor dem Rollout von PR #1828.
> Die folgenden Ergebnisse und offenen Schritte beschreiben diesen Prüfzeitpunkt;
> spätere Änderungen und der heutige Betriebsstatus sind nicht Gegenstand dieses Berichts.

## Ergebnis

49 Tenants sind bereits aktiv; Osnabrück ist nicht aktiviert. Die vollständige Abnahme aller 50 ist noch offen. Die vorhandenen Registry-Einträge wurden zugeordnet, nicht neu erstellt. Die CSV wurde ausschließlich über die nicht geheime Slug-Spalte ausgewertet.

Der Fix aus PR #1827 ist mit Build/Dev [38039779143](https://github.com/smart-village-solutions/sva-studio/actions/runs/38039779143), Staging [38041176525](https://github.com/smart-village-solutions/sva-studio/actions/runs/38041176525) und Production [38041399212](https://github.com/smart-village-solutions/sva-studio/actions/runs/38041399212) ausgerollt. Staging und Production verwenden denselben Digest `sha256:f769d3fb20087ac2deb2f6a5b74ca0f48f7dfc478889c039e83de45f757b9930`, Quelle `91837755ede886d4863d89551abb8957647e1ca9`. Backups, Bootstrap, Swarm-Konvergenz, Runtime-Smoke und Digest-Prüfungen bestanden. Keine Migration erforderlich.

Die anschließenden Live-Pläne zeigen für alle 50 einen noch notwendigen Abgleich des Admin-Servicekontos: Die implizite Realm-Defaultrolle ist weiterhin zugewiesen. 49 Pläne sind ausführbar; Osnabrück bleibt wegen fehlender Registry-Credentials blockiert. Bestehende effektive Rollen sind bei 49 auf das erlaubte Set beschränkt; Osnabrück erbt zusätzlich `view-identity-providers`. Realm-Defaultrollen anderer Anwendungen werden nicht geändert.

## Gemeinsame geprüfte Konfiguration

Alle 50 Einträge haben passende bestehende Realm-Zuordnung, Host, Login-Client `sva-studio-login`, Admin-Client `sva-studio-realm-admin`, Admin-Bootstrap-E-Mail `admin@smart-village.app` und Vor-/Nachname `SVS` / `Admin`, sowie exakt `news, events, poi, media, categories`. Diese Aussage betrifft Registry-Konfiguration und aktuelle Provisioner-Pläne; sie ersetzt keine abschließende authentifizierte Prüfung von Login, Rückkehr-Host und Berechtigungen.

Für alle 50 bestand der HTTPS-Zertifikatsabruf und `/health/live` antwortete 200. Bei 49 aktiven Tenants antwortete `/auth/login` mit 302 zum richtigen Realm und Login-Client, mit zum Tenant passendem Callback-Host und PKCE S256. Osnabrück antwortete aufgrund des inaktiven Zustands mit 503. Dies prüft den Login-Einstieg, keinen vollständigen Login mit anschließender Berechtigungsprüfung.

## Pro Tenant

„Credentials ja“ bedeutet: Registry meldet beide Credentials als konfiguriert. Kein Geheimwert wurde ausgegeben. „Login 302“ bezeichnet ausschließlich den geprüften Einstieg. Admin-Profil und fünf Module sind bei allen korrekt konfiguriert. Der gemeinsame noch offene Schritt ist Servicekonto-Abgleich und abschließende IAM-/Readiness-Abnahme.

| Tenant / Realm | Registry-Status | Beide Credentials | TLS / Health | Login-Einstieg | Provisionierung / verbleibender Blocker |
|---|---|---|---|---|---|
| bb-ahrensfelde | active | ja | geprüft / 200 | 302, Callback geprüft | Pilot fehlgeschlagen: `UNKNOWN_EXECUTION_FAILED`, Run `f8471b55-5432-41fe-b02a-8c475f68477d` |
| mv-crivitz | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-amt-schlieben | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-angermuende | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| st-arneburg-goldbeck | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| by-augsburg | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-bernau | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-birkenwerder | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-briesen | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-dahme-spreewald | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| nrw-detmold | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-eberswalde | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-eisenhuettenstadt | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-falkenberg-elster | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-gransee | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-gruenheide | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| mv-hagenow | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| ni-harsum | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-herzberg-elster | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-hohen-neuendorf | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| he-kassel | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| sh-kiel | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-kloster-lehnin | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-kyritz | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-koenigs-wusterhausen | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-havelland | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-uckermark | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| nrw-legden | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| ni-lehrte | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| rp-linz-am-rhein | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| st-magdeburg | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-michendorf | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-neuzelle | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| sh-nordapp | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-nuthetal | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-oberspreewald-lausitz | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| ni-osnabrueck | requested | nein | geprüft / 200 | 503, inaktiv | Recovery abgewiesen: `keycloak_plan_blocked`; keine neue Run-ID |
| bb-panketal | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-petershagen-eggersdorf | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-prenzlau | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-ruedersdorf | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| sl-sankt-wendel | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-schoenefeld | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-seelow | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-spremberg | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-storkow | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| bb-wandlitz | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| st-wittenberg | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| ni-wittingen | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |
| st-zeitz | active | ja | geprüft / 200 | 302, Callback geprüft | Servicekonto-Abgleich noch ausstehend; kein neuer Lauf gestartet |

## Konkrete Fehler und Lösung

- Osnabrück: Recovery-Anfrage `600f5b64-48c9-4d46-9646-c61f630f6ee4` wurde vor Enqueue/Keycloak-Mutation mit `keycloak_plan_blocked` abgewiesen. Es entstand keine neue Run-ID. Letzter historischer Worker-Lauf: `b22b4707-2ccd-46f6-873a-534a52ac86d7`, `tenant_admin_service_access_readback_failed`.
- Ahrensfelde: Pilot-Worker `f8471b55-5432-41fe-b02a-8c475f68477d`, Request `94706175-f523-463a-ba19-fb0856f1578f`, terminal `UNKNOWN_EXECUTION_FAILED`. Registry bleibt aktiv, beide Credentials und Module bestehen unverändert. Live-Plan nach Fehler unverändert. Worker-Logs zeigen nur die generische Fehlerklassifikation; der Quellcode und die reproduzierte Regression belegen den fehlerhaften Wiederholungsweg für bereits übernommene eigene Admin-Konten.
- [PR #1828](https://github.com/smart-village-solutions/sva-studio/pull/1828) repariert den bestehenden privaten Recovery-Proxy, die Autorisierung anhand aktueller Worker-Preflight-Evidenz und die wiederholbare, eindeutige E-Mail-Übernahme eigener Konten. Die letzte E-Mail-/ID-Prüfung muss auch bei bereits bestehender Ownership vor jeder Benutzermutation erfolgreich sein. Die Änderung ist noch nicht in Production.

## Nächster autorisierter Ablauf

Nach Merge und kanonischem Rollout von PR #1828: Für Osnabrück einen neuen Live-Plan und eine neue Recovery-Challenge lesen, neue Idempotenz-ID verwenden, Credential-Recovery ausführen und den tatsächlichen Worker-Abschluss prüfen. Anschließend IAM-Rollen, Admin, Module und Berechtigungen prüfen und erst bei vollständiger Readiness aktivieren. Für die 49 anderen Tenants ebenfalls jeweils frische Pläne und neue Idempotenz-IDs für den Servicekonto-Abgleich verwenden und tatsächliche Worker-Ergebnisse verfolgen.

Keine alten Fingerprints oder Challenges wiederverwenden, keine Ownership- oder Readiness-Prüfung umgehen. Eine angenommene Anfrage ist kein erfolgreicher Worker-Abschluss. Die abschließende Abnahme mit authentifiziertem Login und Berechtigungsprüfung bleibt für alle 50 offen.

