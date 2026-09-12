# Betriebsnachweis zu Issue #1333

Stand: 12. September 2026

## Befund

Der produktive Keycloak 26.2.4 lief hinter Traefik mit `KC_HTTP_ENABLED=true`, festem externen
Hostname und der veralteten Option `KC_PROXY=edge`. Loki enthielt für den Zeitraum vom 5. bis 12. September 2026 insgesamt 223.506 Warnungen zum unsicheren Kontext. Kontrollierte externe
Authorization-Anfragen bestätigten vor der Korrektur fehlende
`Secure`-Attribute an den Auth-Cookies. Der öffentliche TLS-Endpunkt selbst war gültig und setzte
HSTS. Die Ursache lag damit zwischen TLS-Terminierung und Keycloak-Proxy-Auswertung.

Die historischen Keycloak-Warnzeilen enthalten weder Request-Pfad noch Realm oder Quelltyp. Eine
nachträgliche feinere Pfadklassifikation ist aus diesen Zeilen deshalb nicht belastbar möglich.
Kontrollierte Probes grenzen den betroffenen Pfad auf browserbasierte OIDC-Authorization-Anfragen
ein. Interne Studio-Admin-, Provisioning- und Token-Aufrufe verwenden die öffentliche HTTPS-Basis-URL
und benötigen keine Browser-Cookies.

## Incident-Recovery

Der produktive Stack wurde kontrolliert aktualisiert:

- `KC_PROXY=edge` wurde durch `KC_PROXY_HEADERS=xforwarded` ersetzt.
- Das zuvor effektiv laufende Image wurde auf seinen unveränderlichen Digest fixiert.
- Datenbank, Secrets, Hostname, Netze, Routing und sonstige Stack-Umgebung blieben unverändert.
- Der Keycloak-Service erreichte anschließend wieder `1/1`.

Diese Mutation war Incident-Recovery und definiert keinen zweiten regulären Rollout-Pfad.

## Abnahme

Nach dem Reconcile wurden folgende Nachweise ohne Cookie-Werte, Tokens oder vollständige
Authorization-URLs erhoben:

| Probe                     | Ergebnis                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Root-Studio `/auth/login` | `302` zu Realm `sva-studio`, Callback auf Root-Host, Code-Flow mit PKCE `S256`, `state` und `nonce` |
| Aktiver Tenant `bb-guben` | `302` zu Realm `bb-guben`, gültiger Callback; Keycloak-Antwort `200`                                |
| Keycloak-Auth-Cookies     | `AUTH_SESSION_ID`, `KC_AUTH_SESSION_HASH` und `KC_RESTART` jeweils `Secure; SameSite=None`          |
| Forwarded-Spoofing        | Eingespeistes `X-Forwarded-Proto: http` oder `https` ändert die sicheren Cookie-Attribute nicht     |
| Technische Token-Probes   | Root- und Tenant-Token-Endpunkte erzeugen keine Warnung; es wurden keine Zugangsdaten verwendet     |
| Loki ab neuem Task        | Keine Warnung `Non-secure context detected; cookies are not secured`                                |

Eine authentifizierte Browser-Abnahme von Callback und Logout war ohne freigegebenen Testzugang und
ohne verfügbare Browser-Sitzung nicht möglich. Sie bleibt ein offener manueller Nachweis; die
öffentlichen Redirect-, PKCE-, TLS- und Cookie-Verträge sind dagegen live verifiziert.

Bei `de-studio-sandbox` und `de-musterhausen` lehnt Keycloak unabhängig von der Proxy-Korrektur die
aktuelle `redirect_uri` ab. Dieser getrennte Tenant-Client-Befund ist nicht Teil der Ursache von
Issue #1333 und darf nicht als dessen Regression klassifiziert werden.

## Wiederholungsschutz

Der Runtime-Doctor enthält nun einen Loki-basierten Log-Qualitäts-Gate für das rollierende
15-Minuten-Fenster. Ein erneutes Auftreten der Warnung macht die bestehende
`observability-readiness`-Prüfung rot, ohne die betroffene Logzeile in den Bericht zu übernehmen.
