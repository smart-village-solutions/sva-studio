# Releasepfad für die öffentliche Abfallkalender-Webversion

## Ziel

Die öffentliche Webversion des Abfallkalenders soll einen eigenen,
einfach bedienbaren Releasepfad erhalten, der vollständig vom normalen
Studio-Deploy getrennt bleibt.

Ein Release soll über ein Git-Tag im Format `waste-web-vX.Y.Z`
automatisch ausgelöst werden, ein eigenes Image mit exakt diesem
SemVer-Tag bauen und ausschließlich den dedizierten Portainer-Stack
`public-waste-calendar` auf diese Version aktualisieren.

## Nicht-Ziele

- keine Änderung am bestehenden `studio`-Stack
- keine Änderung am bestehenden `studio`-Image
- keine Änderung am offiziellen `studio`-Releasevertrag
- kein gemeinsamer Releaseworkflow für Studio und öffentlichen
  Abfallkalender
- kein produktionsführender JSON-Konfigurationsblob für die Runtime
- kein Digest-Pinning als verpflichtender Betriebsvertrag für diesen
  speziellen Bürger-Frontend-Stack

## Ausgangslage

Die App `apps/public-waste-calendar-web` ist heute als eigenständige
öffentliche Capability angelegt, besitzt aber noch keinen sauberen,
produktiven Release- und Swarm-Betriebsvertrag.

Gleichzeitig ist wichtig:

- die App ist fachlich vom Studio getrennt
- sie benötigt keinen Studio-Login
- sie ist trotz schlanker Oberfläche keine rein statische Website,
  sondern liefert zusätzlich öffentliche Read-Endpunkte unter
  `/api/public-waste/*`

Damit reicht ein einfacher statischer Hostingpfad nicht aus. Die App
braucht eine eigene Runtime, aber ohne den normalen Studio-Releasepfad
mitzubenutzen.

## Leitentscheidung

Die öffentliche Webversion des Abfallkalenders erhält einen vollständig
isolierten Release- und Deploymentpfad.

Diese Isolation ist die zentrale Architekturentscheidung:

1. eigener Stack
2. eigenes Image
3. eigener Workflow
4. eigene Runtime-Variablen
5. keine Mitnutzung des `studio`-Releasevertrags

Die einzige zulässige Gemeinsamkeit liegt auf Infrastruktur-Ebene,
etwa derselbe Swarm-, Portainer- oder Traefik-Server. Auf App-,
Workflow- und Konfigurationsebene bleibt die Trennung hart.

## Release-Vertrag

Der Releasepfad wird ausschließlich über Git-Tags gesteuert.

### Trigger

- Ein Push auf ein Git-Tag im Format `waste-web-vX.Y.Z` startet den
  Releaseworkflow automatisch.
- Das Tagformat wird strikt validiert.
- Andere Tags oder Branch-Pushes dürfen diesen Workflow nicht auslösen.

### Release-Ablauf

1. Git-Tag wird erkannt
2. Workflow validiert das Tagformat
3. Workflow baut nur das Image des öffentlichen Abfallkalenders
4. Workflow published das Image mit exakt diesem Tag
5. Workflow aktualisiert im Portainer-Stack nur die Image-Version
6. Workflow stößt den Rollout des Stacks `public-waste-calendar` an
7. Workflow führt schlanke Smoke-Checks gegen den öffentlichen Host aus

### Versionsmodell

- Es wird echtes SemVer verwendet
- Das Git-Tag ist die führende Releasebezeichnung
- Der Portainer-Stack referenziert bewusst den Image-Tag
- Für diesen Stack ist kein verpflichtendes Digest-Pinning vorgesehen

Die Entscheidung gegen Digest-Pinning ist hier bewusst operativ
motiviert: Der öffentliche Webkalender ist ein schlankes
Darstellungsfrontend mit vergleichsweise einfacher Rollback-Strategie.

## Technische Trennung

### App- und Image-Trennung

- `apps/public-waste-calendar-web` bleibt die einzige App-Quelle für
  diese Bürgeroberfläche
- die App erhält ein eigenes Container-Image
- das Image wird nicht in das bestehende `sva-studio`-Image eingebaut
- der bisherige Studio-Dockerfile und die bisherigen Studio-Workflows
  bleiben fachlich unangetastet

### Stack-Trennung

- die App läuft in einem eigenen Portainer-Stack
  `public-waste-calendar`
- dafür wird eine eigene Compose-Datei eingeführt, zum Beispiel
  `deploy/portainer/docker-compose.public-waste.yml`
- dieser Stack darf weder aus dem `studio`-Stack abgeleitet werden noch
  dessen Variablenraum mitverwenden

### Variablen-Trennung

Die Runtime nutzt einen eigenen Konfigurationsraum mit dem Prefix
`PUBLIC_WASTE_`.

Beispielhafte führende Produktionsvariablen:

- `PUBLIC_WASTE_IMAGE_TAG`
- `PUBLIC_WASTE_PUBLIC_HOST`
- `PUBLIC_WASTE_BASE_URL`
- `PUBLIC_WASTE_INSTANCE_ID`
- `PUBLIC_WASTE_DATABASE_URL`
- `PUBLIC_WASTE_SCHEMA_NAME`
- `PUBLIC_WASTE_PDF_URL_TEMPLATE`

Der bestehende JSON-Blob `PUBLIC_WASTE_CONFIG_JSON` wird für den
Produktionsvertrag nicht als führende Quelle verwendet. Einzelne
Variablen sind in Portainer lesbarer, gezielter änderbar und
betriebspraktischer.

Ein JSON-basierter Fallback kann für lokale Entwicklung oder
Kompatibilität bestehen bleiben, darf aber nicht der operative
Sollzustand des Portainer-Stacks sein.

## Runtime-Vertrag

Die Runtime liefert:

- die öffentliche Startseite
- die bestehende Bürgeroberfläche
- die öffentlichen Read-Endpunkte unter `/api/public-waste/*`

Die App bleibt damit eine kleine serverseitige Web-Runtime und kein
reines Static-Site-Artefakt.

Wichtig ist dabei:

- kein impliziter Rückgriff auf `SVA_*`
- keine stillschweigende Mitnutzung von Studio-Konfiguration
- keine Vermischung von Waste-Web- und Studio-Releasevariablen

## Fehlerverhalten

Die Runtime arbeitet fail-closed.

Das bedeutet:

- fehlende Pflichtkonfiguration führt zu einem expliziten Fehlerzustand
- ungültige Konfiguration führt zu einem expliziten Fehlerzustand
- es gibt keinen stillen Fallback auf Studio-Konfiguration
- es gibt keinen automatischen Rückgriff auf alternative
  Produktionsquellen

Die harte Trennung von Studio und öffentlichem Abfallkalender gilt auch
im Fehlerfall.

## Smoke-Checks

Nach jedem Release werden nur schlanke, aber aussagekräftige
Smoke-Checks ausgeführt.

Mindestens erforderlich sind:

- `GET /` liefert die öffentliche Oberfläche
- `GET /health/live` oder ein äquivalenter Runtime-Health-Check ist grün
- mindestens ein öffentlicher Read-Pfad unter `/api/public-waste/*`
  antwortet erwartbar

Diese Prüfungen sollen den Releasepfad leichtgewichtig halten, aber
genug fachliche Sicherheit geben, dass nicht nur ein Container läuft,
sondern die öffentliche Runtime tatsächlich antwortet.

## Rollback

Rollback bleibt bewusst einfach.

Der operative Standardpfad ist:

1. im Portainer-Stack `PUBLIC_WASTE_IMAGE_TAG` auf die vorherige
   SemVer-Version zurücksetzen
2. Stack erneut deployen
3. Smoke-Checks erneut ausführen

Damit folgt der Rollback demselben bewusst einfachen Tag-Modell wie der
Vorwärts-Release.

## Schutz vor Studio-Beifang

Der neue Releasepfad muss explizit so gebaut sein, dass normale
Studio-Rollouts davon unberührt bleiben.

Verbindliche Leitplanken:

- eigener Workflow-Dateiname
- eigenes Trigger-Muster
- eigener Image-Name
- eigener Stack-Name
- eigener Variablen-Prefix
- keine Erweiterung des bestehenden `studio`-Workflows
- keine Erweiterung des bestehenden `studio`-Stacks
- keine Kopplung an `SVA_IMAGE_TAG`, `SVA_IMAGE_REF` oder
  `SVA_IMAGE_DIGEST`

Die normale Studio-Runtime darf durch einen Waste-Web-Release weder
fachlich noch operativ beeinflusst werden.

## Risiken und bewusste Trade-offs

### Kein Digest-Pinning

Das Tag-Modell ist operativ einfacher, aber weniger hart reproduzierbar
als ein digest-basierter Vertrag.

Dieser Nachteil wird hier bewusst akzeptiert, weil:

- die App ein schlankes öffentliches Frontend ist
- der Rollback einfach bleibt
- die Bedienbarkeit für den Betrieb höher gewichtet wird

### Zusätzlicher Deployvertrag

Ein eigener Waste-Web-Stack erhöht die Zahl der Betriebsartefakte:

- eigenes Image
- eigene Compose-Datei
- eigener Workflow
- eigener Satz Portainer-Variablen

Dieser Mehraufwand ist jedoch der Preis für die gewünschte harte
Isolation zum normalen Studio.

## Zielbild

Der gewünschte Bedienpfad lautet im Ergebnis:

1. Code für `public-waste-calendar-web` freigeben
2. Git-Tag `waste-web-v1.2.3` pushen
3. GitHub baut und publiziert das Image `:v1.2.3`
4. GitHub aktualisiert nur den Stack `public-waste-calendar`
5. Smoke-Checks bestätigen die neue Version

Der öffentliche Abfallkalender erhält damit einen eigenen,
leichtgewichtigen und betriebspraktischen Releasepfad, ohne den
bestehenden Studio-Betrieb zu verändern.
