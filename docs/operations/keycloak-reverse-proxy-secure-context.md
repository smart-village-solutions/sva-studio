# Keycloak-Reverse-Proxy und sicherer Cookie-Kontext

## Zweck und Geltungsbereich

Dieses Runbook beschreibt den Betriebsvertrag für den zentralen Keycloak unter
`keycloak.smart-village.app`. Es ergänzt den kanonischen Studio-Rollout, ersetzt ihn aber nicht.
Direkte Stack-Mutationen bleiben auf genehmigte Incident-Recovery beschränkt.

## Verbindlicher Proxy-Vertrag

Für Keycloak 26 hinter dem TLS-terminierenden Traefik gelten folgende effektive Einstellungen:

```yaml
environment:
  KC_HOSTNAME: https://keycloak.smart-village.app
  KC_HTTP_ENABLED: 'true'
  KC_PROXY_HEADERS: xforwarded
```

- `KC_PROXY=edge` ist eine veraltete Hostname-v1-Option und darf nicht verwendet werden.
- Der veröffentlichte Container-Digest muss unveränderlich sein; `latest` ist kein Rollout-Nachweis.
- Nur Traefik darf den HTTP-Port des Keycloak-Containers erreichen. Der Container-Port `8080` wird
  nicht direkt öffentlich veröffentlicht.
- Traefik überschreibt `X-Forwarded-*` am vertrauenswürdigen Ingress. Von Clients eingespeiste
  Forwarded-Header dürfen den von Keycloak erkannten Sicherheitskontext nicht herabstufen.

Dieser Vertrag wurde gegen den eingesetzten Keycloak-Stand 26.2.4 geprüft. Dessen
[versionsgebundene Reverse-Proxy-Dokumentation](https://github.com/keycloak/keycloak/blob/26.2.4/docs/guides/server/reverseproxy.adoc)
nennt `proxy-headers=xforwarded`, das Überschreiben der `X-Forwarded-*`-Header und
`http-enabled=true` für TLS-Terminierung ausdrücklich. Die
[aktuelle Keycloak-Dokumentation](https://www.keycloak.org/server/reverseproxy) dient ergänzend als
Referenz für spätere Upgrades, ersetzt aber nicht die Prüfung gegen die jeweils eingesetzte Version.

## Abnahme ohne sensible Daten

Nach einem Rollout oder einer Recovery werden mindestens der Root-Login und ein aktiver
Tenant-Login geprüft:

1. `/auth/login` liefert `302` zum erwarteten Realm unter `keycloak.smart-village.app`.
2. `redirect_uri` zeigt auf denselben Studio-Host und `/auth/callback`.
3. Der Authorization-Code-Flow verwendet PKCE mit `S256`, `state` und `nonce`.
4. Die Keycloak-Antwort setzt `AUTH_SESSION_ID`, `KC_AUTH_SESSION_HASH` und `KC_RESTART` mit
   `Secure; SameSite=None`; Cookie-Werte werden weder ausgegeben noch gespeichert.
5. Derselbe Header-Nachweis bleibt bei clientseitig eingespeistem `X-Forwarded-Proto: http`
   unverändert sicher.
6. Login, Callback und Logout werden zusätzlich in einer authentifizierten Browser-Sitzung geprüft,
   sobald ein freigegebener Testzugang verfügbar ist.

Interne Admin-, Provisioning- und Token-Aufrufe verwenden die konfigurierte HTTPS-Basis-URL. Ein
direkter interner HTTP-Aufruf ist nur für nicht-browserbasierte Probes zulässig und darf keine
Keycloak-Browser-Cookies erzeugen. Request-Pfade, Query-Parameter, Cookie-Werte, Tokens und
personenbezogene Daten gehören nicht in den Nachweis.

## Log-Qualitäts-Gate

`pnpm env:doctor:studio` und `pnpm env:precheck:studio` prüfen bei konfiguriertem Loki-Zugriff das
letzte 15-Minuten-Fenster. Sobald ein zentraler Keycloak-Service die Meldung
`Non-secure context detected; cookies are not secured` schreibt, wird
`observability-readiness` mit dem Fehlercode `keycloak_insecure_cookie_context` rot. Der Bericht
enthält nur eine untere Grenze der Trefferzahl, das Abfragelimit und die Fenstergröße, keine
Logzeilen.

Für den Zugriff werden wie bei den übrigen Runtime-Probes `SVA_LOKI_URL` und ein nur lesbares
`SVA_GRAFANA_TOKEN` aus dem lokalen Operator-Overlay verwendet. Unmittelbar nach einer Korrektur kann
der Gate wegen der rollierenden Historie noch höchstens 15 Minuten rot bleiben.

## Rollback

Bei einem Regression-Rollback wird ausschließlich auf den zuletzt nachweislich sicheren,
unveränderlichen Digest und dessen Proxy-Vertrag zurückgegangen. Ein Rollback auf
`KC_PROXY=edge` ist unzulässig, weil er den fehlerhaften Sicherheitskontext wiederherstellt.
