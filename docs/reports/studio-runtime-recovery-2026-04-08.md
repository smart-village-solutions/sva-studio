# Studio Runtime Recovery 2026-04-08

## Zusammenfassung

Am 8. April 2026 war `studio.smart-village.app` extern nicht erreichbar und lieferte durchgehend `502`, obwohl der Swarm-Status fuer `studio_app` weiterhin `replicated 1/1` meldete. Ursache war kein Datenbank- oder Goose-Fehler mehr, sondern eine inkonsistente Live-Service-Spec: `studio_app` war nur noch am internen Overlay-Netz angeschlossen und hatte die Anbindung an das externe `public`-Netz verloren. Dadurch konnte Traefik keinen funktionierenden Upstream mehr erreichen.

Die Wiederherstellung erfolgte ohne neuen Image-Pull und ohne Stack-Reconcile direkt ueber die Portainer-API: Die bestehende Service-Spec von `studio_app` wurde minimal korrigiert, indem das `public`-Netz wieder an `TaskTemplate.Networks` angehaengt wurde. Danach startete Swarm den App-Task neu, und die Plattform war wieder gesund.

## Symptome

- `https://studio.smart-village.app/health/live` lieferte `502`
- `https://bb-guben.studio.smart-village.app/auth/login` lieferte ebenfalls `502`
- `quantum-cli ps --endpoint sva --stack studio` zeigte trotzdem:
  - `app` `replicated 1/1`
  - `postgres` `replicated 1/1`
  - `redis` `replicated 1/1`
- `pnpm env:deploy:studio` war fuer Recovery ungeeignet, weil der Precheck korrekt am roten Tenant-Auth-Proof scheiterte

## Technischer Befund

Die Live-Spec von `studio_app` zeigte vor der Reparatur:

- Traefik-Labels waren weiterhin vorhanden
- `EndpointSpec.Mode` war weiterhin `vip`
- `TaskTemplate.Networks` enthielt aber nur noch das interne Netz
- das externe Overlay-Netz `public` fehlte

Dadurch entstand genau das Fehlerbild:

- Swarm sieht einen laufenden Container
- Health im Container kann theoretisch gruen sein
- Traefik hat aber keinen erreichbaren Netzwerkpfad zum Service
- extern entsteht `502 Bad Gateway`

## Wiederherstellung

Direkt ueber die Portainer-API wurde die bestehende Service-Spec von `studio_app` geladen, minimal angepasst und wieder zurueckgeschrieben:

- beibehalten:
  - Image
  - Env
  - Healthcheck
  - Labels
  - Update-/Rollback-Config
- geaendert:
  - `TaskTemplate.Networks`
  - hinzugefuegt: `public`

Anschliessend ersetzte Swarm den laufenden Task.

## Verifikation nach Recovery

Nach der Reparatur waren folgende Checks wieder gruen:

- `https://studio.smart-village.app/health/live` -> `200`
- `https://studio.smart-village.app/` -> `200`
- `GET https://bb-guben.studio.smart-village.app/auth/login` -> `302` auf Realm `bb-guben`
- `pnpm env:smoke:studio` -> erfolgreich
- `pnpm env:precheck:studio` -> erfolgreich

## Learnings

1. `app 1/1` im Swarm ist kein ausreichender Beleg fuer extern gesunden Betrieb.
2. Fuer `studio` muss zwischen internem Task-Status und externer Ingress-Erreichbarkeit klar unterschieden werden.
3. Recovery darf nicht zwingend einen frischen Image-Pull voraussetzen, wenn das Problem in der Live-Spec und nicht im Artefakt liegt.
4. Der Precheck braucht einen expliziten Konsistenzhinweis fuer den Fall `Task laeuft, externer Live-Endpoint ist trotzdem rot`.

## Umgesetzte Schutzmassnahme

Im Ops-Skript wurde ein zusaetzlicher Check `acceptance-ingress-consistency` aufgenommen. Er meldet kuenftig explizit einen Fehler, wenn:

- `quantum-cli ps` einen laufenden App-Task fuer den Ziel-Stack meldet
- der externe Live-Endpoint aber nicht `ok` ist

Damit wird dieses Fehlerbild frueher und klarer benannt, statt nur indirekt ueber spaetere Tenant-Redirect-Fehler aufzufallen.
