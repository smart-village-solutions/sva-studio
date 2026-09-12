# ADR-062: Kasseler Mandanten-Provisionierung mit Traefik File Provider

## Status

Vorgeschlagen am 12. September 2026.

## Kontext

Die Kasseler Standalone-Installation betreibt Studio, Keycloak und SSF hinter
einem gemeinsamen Traefik. Neue Instanzen waren nach Registry- und
Keycloak-Anlage nicht automatisch öffentlich geroutet. Dadurch konnte eine
Instanz fachlich vorhanden oder sogar aktiv sein, obwohl Host, Zertifikat,
Login oder ein erforderliches Plugin noch nicht betriebsbereit waren.

Die regulären Studio-Umgebungen besitzen einen anderen Ingress- und
Rollout-Vertrag. Eine globale Verallgemeinerung würde diese Systemgrenze ohne
gesicherten Bedarf verändern.

## Entscheidung

- Der vorhandene Instanz-Provisioning-Lauf wird zum führenden,
  wiederaufnehmbaren Elternlauf erweitert. Er speichert einen versionierten
  Soll-Snapshot, Kindlauf-ID, Lease, Deadline, Retry-Zeitpunkt und kumulative
  Evidenz.
- Nur Läufe der Version `2.0` und der Parent-Domain `dialog.kassel.de` werden
  vom Kassel-Adapter beansprucht. Bestandsläufe bleiben `legacy` und werden
  nicht automatisch umgedeutet.
- Die Stufen lauten Registry, Keycloak-Kindlauf, Plugin-Lifecycle, expliziter
  Router, öffentliches TLS, Modul-Readiness, Login-Redirect und Aktivierung.
  `active` wird erst als letzter Schritt gespeichert. Bis dahin bleibt die
  Instanz `provisioning` und erscheint nicht im SSF-Login-Verzeichnis.
- Für den Login-Smoke darf ausschließlich `/auth/login` im expliziten
  Kassel-Modus bereits eine `provisioning`-Instanz auflösen. Callback und
  übriger Tenant-Verkehr behalten das bestehende Active-Gate.
- Der Provisioner schreibt atomar genau eine validierte File-Provider-Datei je
  Tenant. Traefik liest das Verzeichnis read-only und routet auf den live
  verifizierten Docker-Service `sva-studio-ssf@docker`. Studio erhält weder
  Docker-Socket noch ACME- oder DNS-Zugangsdaten.
- Fehler löschen keine Registry-, Keycloak-, Secret- oder Router-Artefakte.
  Ein Retry setzt denselben versionierten Lauf unter neuer Lease fort.
- Der reguläre Studio-Rollout bleibt unverändert; die SSF-File-Provider-
  Ergänzung wird im zuständigen Repository separat geliefert.

## Folgen

Browsernavigation und Worker-Prozess sind entkoppelt. Nach einem Prozessabbruch
wird eine abgelaufene Lease erneut beansprucht; nach der Deadline endet der
Lauf terminal in `failed`. Router- und Readiness-Evidenz bleibt für Diagnose
und Retry erhalten.

Die Kasseler Installation benötigt einen koordinierten Rollout zweier
Repositorys. Der Studio-Modus darf erst aktiviert werden, nachdem der leere
File Provider ausgerollt und die Bestandsrouter überprüft wurden.

## Verworfene Alternativen

- Ein offener Create-Erfolg mit manuellen Folgearbeiten lässt erneut einen
  falschen Bereitschaftszustand entstehen.
- `HostRegexp` und Wildcard-Zertifikate erweitern Routing- und Credential-
  Umfang unnötig.
- Docker-Socket-Zugriff für den Studio-Worker vergrößert die Trust Boundary.
- Eine globale Änderung des regulären Studio-Ingress ist ohne gemeinsamen
  Infrastrukturvertrag nicht gerechtfertigt.

## Bezüge

- [ADR-030: Registry-basierte Instance-Freigabe und Provisioning](./ADR-030-registry-basierte-instance-freigabe-und-provisioning.md)
- [ADR-058: Generischer Plugin-Tenant-Lifecycle und Readiness-Gate](./ADR-058-generischer-plugin-tenant-lifecycle-und-readiness-gate.md)
- [ADR-061: Instanzgebundene Keycloak-Provisioning-Ownership und -Serialisierung](./ADR-061-instanzgebundene-keycloak-provisioning-ownership-und-serialisierung.md)
- [Kasseler Standalone-Hosts](../operations/ssf-standalone-hosts.md)
- OpenSpec-Change `automate-kassel-tenant-ingress`
