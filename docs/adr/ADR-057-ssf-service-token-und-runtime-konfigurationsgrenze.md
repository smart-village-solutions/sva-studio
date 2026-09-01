# ADR-057: SSF-Service-Token und Runtime-Konfigurationsgrenze

**Datum:** 1. September 2026
**Status:** ✅ Accepted
**Kontext:** SSF, IAM, Plugins, Runtime-Konfiguration

## Entscheidung

Smart Speech Flow (SSF) wird von einer gemeinsam betriebenen SVA-Studio-
Installation abhängig. Eine Studio-Instanz ist der kanonische Schlüssel genau
eines SSF-Mandanten; SSF führt keinen eigenen Mandantenbestand.

Studio Core besitzt Instanzidentität, Benutzer- und Realm-Provisionierung,
Plugin-Aktivierung sowie die Autorisierungs- und Auditgrenze. Ein installierbares
SSF-Plugin besitzt das SSF-Konfigurationsmodell in einer einzelnen
mandantenfähigen PostgreSQL-Datenbank. Alle V1-Produktdefaults werden als
versionierter Bestandteil dieses Plugins ausgeliefert. Damit kann das Plugin
Tenant-Overrides, serverweite Anpassungen und Produktdefaults vollständig
auflösen und eine inhaltsbasierte `configurationRevision` bilden.

SSF ruft die effektive Konfiguration über einen internen, lesenden V1-Endpunkt
ab. Es authentisiert sich mit einem installationsweiten Service-Token des
separaten SSF-Keycloaks. Studio prüft Signatur, Issuer, Audience, Zeitbindung und
die vollständig qualifizierte Action `ssf.runtime-configuration.read`. Die
angeforderte `studio_instance_id` stammt aus einem von SSF validierten Benutzer-
oder Sessionkontext. Für diesen idempotenten Read gibt es keine zweite Tenant-
Signatur, keine Browserfreigabe und keinen Replay-Speicher.

Benutzertokens tragen den kanonischen Mandantenclaim `studio_instance_id` sowie
`ssf_roles`, die autoritativen `ssf_permissions` und eine tenantweite
`ssf_authorization_revision`. Systemadmins bleiben im Studio-Root-Kontext;
Mandantenadmins und Benutzer gehören genau einem Tenant.
Gäste bleiben ausschließlich im SSF-Sessionmodell. `system_admin` und
`tenant_admin` sind Personas und Defaultrollen; Konfigurationszugriffe werden
ausschließlich über `ssf.configuration.server.manage`,
`ssf.configuration.tenant-policy.manage`,
`ssf.configuration.tenant.inspect`,
`ssf.configuration.tenant.provenance.inspect`,
`ssf.configuration.tenant.read` und `ssf.configuration.tenant.manage`
entschieden. Plattform- und Tenant-Actions besitzen getrennte IDs und damit
jeweils genau eine Availability. Kundenspezifische Rollen können die für ihren
Scope verfügbaren Actions ohne Rollennamen-Sonderfall erhalten.

Die SSF-Personas verändern das Studio-IAM-Modell aus ADR-046 nicht. Die
Studio-Rootrolle `instance_registry_admin` wird an der SSF-Integrationsgrenze
als `system_admin` eingeordnet, aber nie in Tenant-Tokens materialisiert. Die
tenantlokale Studio-Defaultrolle `system_admin` wird für SSF als `tenant_admin`
eingeordnet. Eine tenantlokale operative SSF-Rolle ergibt `user`; eine
validierte Gäste-Session ergibt `guest`. Kundenspezifische Rollen benötigen
keine Persona-Synthese, weil ihre effektiven `ssf.*`-Actions autoritativ sind.

Studio-IAM projiziert die effektiven `ssf.*`-Permissions aus Default- und
kundenspezifischen Rollen in den Client-Scope des separaten SSF-Keycloaks. Vor
einer relevanten IAM-Änderung wird der betroffene Tenant-Client gesperrt und die
Projektion als nicht bereit markiert. Nach Reconcile, Revisionsverifikation und
Session-Widerruf wird der Client wieder freigegeben. Fehler verbleiben
fail-closed; SSF vergleicht den Tokenclaim mit der vom Runtime-Endpunkt
gelieferten `authorizationRevision`.

Root-Actions werden nicht in diesen Tenant-Pfad projiziert. Das SSF-Plugin
registriert `ssf.configuration.server.manage`,
`ssf.configuration.tenant-policy.manage` sowie die erforderlichen Root-Reads
als plattformgebundenen Beitrag mit Default-Grant für
`instance_registry_admin`. Tenant-Actions bleiben im normalen Tenant-Katalog.

SSF speichert die Runtime-Antwort nicht persistent. Studio und SSF verwenden
keine gemeinsame Fachdatenbank und greifen nicht direkt auf die Persistenz des
jeweils anderen Systems zu.

## Begründung

Der Vertrag nutzt vorhandene Studio-Fähigkeiten und hält SSF-Fachlogik im
Plugin. Ein vollständig aufgelöster Response gibt SSF ein festes Schema, ohne
Override- oder Persistenzwissen zu duplizieren. Der einfache Service-Token-
Vertrag ist für einen internen, lesenden Endpunkt auf demselben Serverprofil
ausreichend und vermeidet zusätzliche Signatur- und Replay-Infrastruktur.

Die ausschließliche Auslieferung der Defaults mit dem Plugin verhindert, dass
Studio und SSF bei unterschiedlichen Softwareständen verschiedene effektive
Konfigurationen oder Revisionen berechnen.

## Konsequenzen

- Änderungen im Studio werden beim nächsten Runtime-Abruf sichtbar; es gibt
  keinen Draft- oder Publish-Zustand.
- Ein geänderter Produktdefault benötigt einen Rollout des SSF-Plugins. SSF
  selbst löst keine alternative Default-Schicht auf.
- Ein Studio-, Plugin- oder interner API-Ausfall darf einen SSF-Vorgang
  fehlschlagen lassen; V1 verlangt keine Offline-Kopie.
- Service- und Benutzertoken benötigen getrennte Claims, Rollen und
  Lebenszyklen im SSF-Keycloak.
- Die Integrationsübersetzung zwischen Studio-IAM und SSF-Personas muss bei
  Provisionierung und Token-Materialisierung konsistent angewendet werden;
  ADR-046 wird nicht supersediert.
- Relevante Tenant-IAM-Änderungen sperren die SSF-Tokenausstellung bis zur
  verifizierten Projektion. Dadurch kann ein Keycloak-Ausfall die SSF-Nutzung
  des betroffenen Mandanten vorübergehend blockieren.
- Plattform-Grants und Tenant-Grants verwenden getrennte Katalog- und
  Projektionspfade, obwohl ihre Action-IDs im selben `ssf`-Namespace liegen.
- Gesprächsinhalte, Gäste-Sessions und Auswertungsdaten bleiben außerhalb des
  Runtime-Konfigurationsvertrags.

## Verworfene Alternativen

- **Defaults ausschließlich oder zusätzlich in SSF auflösen:** verworfen, weil
  Studio dann weder einen vollständig aufgelösten Response noch dessen Revision
  allein bestimmen könnte.
- **Gemeinsame Datenbank oder direkte Datenbankzugriffe:** verworfen, weil dies
  Ownership und Betriebsgrenzen koppelt.
- **Persistenter SSF-Konfigurationscache:** für V1 verworfen, weil der gemeinsam
  betriebene Server keine eigenständige Offline-Fähigkeit benötigt.
- **Zweite Tenant-Signatur und Replay-Speicher:** für den internen idempotenten
  Read unverhältnismäßig; eine spätere mutierende Schnittstelle ist neu zu
  entscheiden.

## Verweise

- [Studio–SSF-Vertrag für Runtime-Konfiguration V1](../api/ssf-studio-runtime-konfigurationsvertrag-v1.md)
- [Kontext und Scope](../architecture/03-context-and-scope.md)
- [Lösungsstrategie](../architecture/04-solution-strategy.md)
- [Bausteinsicht](../architecture/05-building-block-view.md)
- [Laufzeitsicht](../architecture/06-runtime-view.md)
- [Verteilungssicht](../architecture/07-deployment-view.md)
- [Querschnittliche Konzepte](../architecture/08-cross-cutting-concepts.md)
