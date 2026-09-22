## Kontext

SSF benötigt für seine öffentliche Login-Auswahl ein installationsweites
Verzeichnis aktiver Studio-Mandanten. SSF führt den Login selbst aus und
benötigt deshalb Mandanten-ID, öffentliche Bezeichnung, Keycloak-Realm und die
öffentliche URL des jeweiligen Studio-Tenant-Bereichs.
Der Abruf erfolgt serverseitig mit der bestehenden vertraulichen
`ssf-runtime`-Identität.

## Ziele und Nicht-Ziele

Ziele:

- stabiler, tenantungebundener Lesevertrag für aktive Registry-Einträge,
- kanonische Tenant-Studio-URL ohne redundante Konfiguration oder Persistenz,
- eigene, minimal berechtigte Action `ssf.admin-login-directory.read`,
- vollständige SSF-Login-Bereitschaft vor Veröffentlichung,
- unveränderte private Ingress-Grenze für interne Plugin-Endpunkte.

Nicht-Ziele:

- kein Login-Handler und keine OIDC-Transaktionswerte in Studio,
- keine zusätzliche manuelle Freigabeliste,
- keine Schemaänderung und keine neue Service-Identität,
- keine Änderung am SSF-Consumer oder SSF-Frontend.

## Entscheidungen

Der Host verarbeitet den exakten Directory-Pfad im Server-Entry nach dem
privaten Ingress-Guard. Die Service-Authentifizierung bleibt vor Registry- und
Readiness-Lesen. Für autorisierte Reads konfiguriert der Host den Plugin-Snapshot
und prüft denselben schreibfreien Readiness-Pfad wie der Runtime-Zugriff.
Alle übrigen Plugin-Routen behalten ihren bestehenden Dispatcher.

Die Auth-Runtime validiert Issuer, Audience, Client-ID und die eigene
Directory-Action. Ablehnungen mit `401` oder `403` erzeugen ein
action-spezifisches Plattform-Audit. Erst danach liest der Handler die lokale
Instanz-Registry. Er übernimmt ausschließlich aktive Einträge mit bereitem
Lifecycle, Tenant-Grunddatensatz, korrekten Client-Verträgen und bestätigter
IAM-Revision. Die Erstprovisionierung stellt diese Voraussetzungen vor `ready`
her; der Directory-Endpoint führt selbst keine Reparatur aus.

Die Antwort enthält nur `id`, `displayName`, `realm` und `studioUrl`.
`studioUrl` entsteht als `https://${primaryHostname}/` aus dem bereits
kanonischen Registry-Feld. Sie wird weder aus `SVA_PUBLIC_BASE_URL` noch aus
Mandanten-ID oder Parent-Domain abgeleitet. Die sortierte öffentliche Nutzlast
bestimmt einschließlich `studioUrl` die SHA-256-Revision. Eine leere Liste bleibt
eine gültige `200`-Antwort; Authentifizierungs-, Berechtigungs- und temporäre
Verfügbarkeitsfehler bleiben als `401`, `403` und `503` stabil.

Die additive Felderweiterung behält `contractVersion: "1.0"`, weil der aktuelle
SSF-V1-Consumer unbekannte Tenant-Felder ignoriert, aber andere Versionswerte
ablehnt. So kann Studio unabhängig ausgerollt werden, ohne den bestehenden
Loginpfad zu unterbrechen. Eine spätere SSF-Nutzung des Felds ist ein eigener
Lieferabschnitt.

## Alternativen und Abwägungen

Eine Studio-Login-URL wurde verworfen, weil SSF den OIDC-Flow startet und die
transaktionsgebundenen Werte selbst erzeugt. Ein Aufruf über den
tenantgebundenen Plugin-Dispatcher bleibt ungeeignet für den installationsweiten
Read. Die gemeinsame Readiness-Prüfung wird deshalb pro Registry-Eintrag an
der hostseitigen Composition Root eingebunden.

Eine separat persistierte URL wurde verworfen, weil `primaryHostname` bereits
die kanonische Tenant-Adresse ist und eine zweite Quelle driften könnte. Eine
Ableitung im SSF-Consumer wurde verworfen, weil SSF weder Studio-Hosttopologie
noch Registry-Zustand rekonstruieren soll. Ein neuer V2-Endpoint wäre für das
additive Feld unverhältnismäßig und würde einen parallelen Vertrag schaffen.

Die vorhandene `ssf-runtime`-Identität wird weiterverwendet. Die getrennte
Action hält die Berechtigung eng, ohne eine zweite Client-Credentials-Identität
und deren Secret-Lifecycle einzuführen.

## Migration und Betrieb

Es gibt keine Datenmigration. Vor der Nutzung wird die neue Client-Rolle im
jeweiligen Studio-Root-Realm angelegt und dem Service-Account sowie dessen
Client-Scope zugeordnet. Studio und SSF behalten ihre vorhandenen Issuer-,
Audience- und Client-ID-Werte. Der Rollout verwendet den regulären
Build-, Staging- und Production-Pfad mit demselben unveränderlichen Image.

Ein Rollback auf das vorherige Studio-Image entfernt den Endpoint wieder. Die
zusätzliche, dann ungenutzte Keycloak-Rolle erweitert keine andere Action und
kann anschließend separat entfernt werden.
