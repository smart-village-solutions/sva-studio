## Context

Die vorhandene Server-Konfiguration zeigt ein Docker-Swarm-basiertes Deployment mit:

- externem `public`-Netzwerk
- Traefik-Labels am ingressnahen Service
- `deploy.placement.constraints`
- externen `configs`
- vorgebauten Images aus einer Registry

Der aktuelle `sva-studio`-Stack folgt diesem Modell noch nicht. Er nutzt aktuell:

- `build:` in der Compose-Datei
- Port-Mappings statt Traefik-Ingress
- Bind-Mounts für Postgres-Init/Migrationslogik
- einen einzelnen kanonischen `SVA_PUBLIC_BASE_URL`

Für das künftige Hostmodell gilt zusätzlich:

- nur Hosts unter einer festen Parent-Domain sind zulässig, z. B. `*.studio.smart-village.app`
- die linke Subdomain repräsentiert direkt die `instanceId`
- es gibt keine separate UUID-basierte Instanz-ID mehr, die aus der URL aufgelöst werden müsste
- nicht jede syntaktisch gültige Subdomain ist automatisch erlaubt; eine Runtime-Allowlist ist die aktuell autoritative Quelle gültiger `instanceId`s
- mehrere Instanz-Hosts dürfen auf denselben Stack zeigen, Auth-Flows bleiben bis zur Folgeänderung aber an einen kanonischen Host gebunden

## Goals / Non-Goals

- Goals:
  - Swarm-kompatibles Deployment für Portainer herstellen
  - Traefik-/Ingress-Muster des Zielservers übernehmen
  - Registry-basiertes App-Deployment etablieren
  - das Swarm-/Traefik-/Portainer-Modell als Referenz-Betriebsprofil dokumentieren, ohne andere Zielumgebungen generell auszuschließen
  - das Modell `subdomain == instanceId` unter fester Parent-Domain explizit festhalten
  - eine Env-gesteuerte Allowlist gültiger `instanceId`s als aktuell autoritative Source of Truth festhalten
  - deterministische Reject-Regeln für unbekannte, nicht kanonische und Root-Domain-Hosts festhalten
  - die Machbarkeit dynamischer Multi-Host-OIDC-Redirects explizit bewerten
- Non-Goals:
  - Vollständige Multi-Tenant-Domain-Architektur einführen
  - dynamische OIDC-Redirect-URIs pro Host in diesem Change umsetzen
  - produktive DB-Migrationsorchestrierung für alle Upgrade-Fälle vollständig lösen
  - Portainer, Swarm oder eine konkrete Registry als einzige künftig zulässige Produktplattform festschreiben

## Decisions

### Decision: Swarm-Stack statt lokales Compose-Muster

Der Deployment-Stack wird an Docker Swarm angepasst:

- `deploy`-Abschnitt mit `replicas` und optionalen `placement.constraints`
- externes Ingress-Netzwerk statt `ports:`
- Traefik-Labels für Host-Routing

Begründung:

- passt zum bestehenden Server-Betriebsmodell
- ist mit Portainer-Stacks im Swarm-Modus konsistent
- vermeidet Einzelhost-Annahmen

Einordnung:

- dieses Change definiert damit ein Referenz-Betriebsprofil für die aktuelle Zielumgebung
- andere Deployment-Profile werden dadurch nicht grundsätzlich ausgeschlossen, müssen aber außerhalb dieses Changes separat beschrieben werden

### Decision: Image aus Registry statt `build:` im Stack

Swarm-Stacks sollen ein bereits gebautes Image deployen.

Image-Referenzierung:

- die Stack-Datei verwendet ein parametrisierbares Image-Referenzmuster: `image: ${SVA_REGISTRY:-ghcr.io/smart-village-solutions}/sva-studio:${SVA_IMAGE_TAG:-latest}`
- für Produktionsdeployments wird Digest-Pinning (`image@sha256:...`) oder Immutable-Semver-Tags empfohlen; mutable Tags (`:latest`, `:main`) sind nur für Entwicklung akzeptabel
- Image-Retention-Policy und CI-Push-Verfahren müssen im jeweiligen Runbook dokumentiert werden

Begründung:

- passt zum vorhandenen Serverbeispiel
- reduziert Abhängigkeit von Build-Tooling im Zielsystem
- ist stabiler für Rollbacks und Replica-Neustarts
- parametrisierbare Image-Referenz ermöglicht Registry-Wechsel ohne Stack-Änderung

### Decision: Instanz wird direkt aus der Subdomain abgeleitet

Diese Entscheidung erweitert [ADR-011 (instanceId als kanonischer Mandanten-Scope)](../../docs/adr/ADR-011-instanceid-kanonischer-mandanten-scope.md) um die URL-Ableitung: Während ADR-011 den `instanceId`-Scope auf DB-/RLS-Ebene definiert, legt diese Decision fest, wie die `instanceId` aus dem eingehenden Hostnamen abgeleitet wird.

Für Hosts unter der erlaubten Parent-Domain gilt:

- `foo.studio.smart-village.app` -> `instanceId = "foo"`
- die Subdomain wird direkt als Instanzkennung verwendet
- die Parent-Domain wird über eine Env-Variable (z. B. `SVA_PARENT_DOMAIN`) konfiguriert, nicht im Code hart verdrahtet
- eine zusätzliche Auflösung auf UUIDs oder getrennte technische Schlüssel ist nicht Teil des Zielbilds
- erlaubt ist genau ein zusätzliches DNS-Label links der Parent-Domain
- eingehende Hostnamen werden vor der Prüfung in Kleinschreibung kanonisiert und ein optionaler abschließender Punkt wird verworfen
- zulässige `instanceId`s folgen dem Muster `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`
- Root-Domain, mehrstufige Subdomains und nicht ASCII-basierte Labels gelten in diesem Change als ungültig
- Internationalized Domain Names (IDN/Punycode, RFC 5891) werden ebenfalls nicht als gültige `instanceId`s akzeptiert; Labels mit dem Präfix `xn--` werden explizit abgelehnt

Begründung:

- reduziert Komplexität im Routing- und Auth-Flow
- passt zum fachlichen Modell des Betreibers
- vermeidet zusätzliche Mapping-Logik nur für die URL-Auflösung
- konfigurierbare Parent-Domain statt Hardcodierung sichert Portabilität und FIT-Konformität

### Decision: Gültige Instanzen werden über eine Env-Allowlist autoritativ freigegeben

Neben der Parent-Domain-Prüfung wird eine Runtime-Konfiguration vorgesehen, die aktuell die autoritative Quelle erlaubter `instanceId`s ist, z. B. als kommagetrennte Env-Variable.

Beispiel:

- `SVA_ALLOWED_INSTANCE_IDS=foo,bar,baz`

Formatregeln:

- kommagetrennt
- keine Leerzeichen
- nur kleingeschriebene `instanceId`s
- eingehende Host-Subdomains werden gegen diese kanonische Kleinschreibungsform geprüft
- nur Einträge aus dieser Allowlist gelten als freigegebene Instanzen
- Hosts außerhalb der Parent-Domain, Root-Domain-Anfragen und nicht kanonische Hostmuster werden vor OIDC und vor jeder instanzbezogenen Verarbeitung abgewiesen

Startup-Validierung:

- beim Applikationsstart wird jeder Allowlist-Eintrag gegen das `instanceId`-Regex (`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`) validiert
- bei ungültigen Einträgen bricht die Applikation fail-fast mit einer klaren Fehlermeldung ab, statt stille Fehlverhalten zu riskieren

Allowlist-Lookup und Error-Contract:

- die Allowlist wird intern als `Set` gehalten (O(1)-Lookup), nicht als Array, um Timing-basierte Instanz-Enumeration zu verhindern
- die HTTP-Antwort für alle Ablehnungsgründe (ungültiges Format, nicht in Allowlist, Root-Domain, mehrstufige Subdomain) ist identisch: gleicher Status-Code, gleicher Body, kein erläuternder Ablehnungsgrund nach außen
- als Status-Code wird `403` mit dem bestehenden `{ error, message }` + `X-Request-Id`-Fehlervertrag aus [08-cross-cutting-concepts.md](../../docs/architecture/08-cross-cutting-concepts.md) verwendet

Skalierungsgrenze:

- die Env-Allowlist ist für die aktuelle Development-Phase und eine überschaubare Anzahl an Instanzen (ca. ≤ 50) ausreichend
- bei Wachstum über diesen Schwellwert hinaus ist eine Migration auf eine DB-/API-gestützte Instanz-Registry als Folgearbeit geplant
- dieser Skalierungspfad wird als dokumentierte technische Schuld in [11-risks-and-technical-debt.md](../../docs/architecture/11-risks-and-technical-debt.md) aufgenommen

Begründung:

- Betreiber können freigeschaltete Instanzen ohne Codeänderung steuern
- unbekannte oder noch nicht freigegebene Subdomains werden fail-closed behandelt
- die Freigabequelle bleibt operativ einfach und explizit nachvollziehbar
- das passt gut zu Swarm-/Portainer-Betrieb mit zentral gepflegten Stack-Variablen
- identische Fehlerantworten verhindern Mandanten-Enumeration durch Timing-Seitenkanäle

### Decision: Mehrere App-Hosts sind zulässig, Auth bleibt bis zur Folgeänderung kanonisch

Hostnamen wie `instanceid.studio.smart-village.app` sind auf Ingress-Ebene zulässig. Die aktuelle Anwendung ist aber nicht vollständig hostdynamisch:

- `SVA_PUBLIC_BASE_URL` ist heute eine einzelne Env-Variable und definiert den kanonischen Auth-Host
- OIDC `redirectUri` und `postLogoutRedirectUri` sind statisch konfiguriert
- Login-/Logout-Flow berechnet Redirect-Ziele nicht aus dem eingehenden Host

Folge:

- mehrere App-Hosts können auf denselben Stack zeigen
- interaktive Login-/Logout-Flows sind bis zur Folgeänderung ausschließlich über den kanonischen Auth-Host zulässig
- Anfragen auf Instanz-Hosts, die einen OIDC-Login, Logout oder einen hostgebundenen Redirect erfordern würden, werden deterministisch fail-closed abgewiesen statt auf einen falschen Host weitergeleitet
- eine separate Folgeveränderung bleibt für vollständig hostdynamische Redirects und Logout-Ziele erforderlich
OIDC-Discovery und Cookie-Scoping:

- `redirectUri` und `postLogoutRedirectUri` verwenden ausschließlich den kanonischen Auth-Host; Instanz-Hosts dürfen NICHT als Redirect-Ziele beim IdP registriert werden
- Redirect-Ziele werden ausschließlich aus serverseitiger Konfiguration abgeleitet, nie aus Request-Parametern (Open-Redirect-Schutz gemäß CWE-601)
- Instanz-Hosts bedienen keine OIDC-Discovery-Metadaten (`.well-known/openid-configuration`)
- Cookie-Domain-Scoping: Ob ein Parent-Domain-Cookie (`.studio.smart-village.app`) oder ein strikt hostgebundener Cookie verwendet wird, muss bei Implementierung festgelegt und dokumentiert werden
- für die Folgeänderung (dynamische Multi-Host-Redirects) gilt als Sicherheitsanforderung: dynamische Redirect-Targets müssen gegen eine Allowlist validierter Hostnames geprüft werden
### Decision: Secrets, Configs und Stateful-Betrieb werden minimal verbindlich eingegrenzt

Für das Referenz-Betriebsprofil gilt:

- sensible Runtime-Werte wie OIDC-Client-Secrets, Session-/Cookie-Schlüssel und andere vertrauliche Schlüssel werden nicht in Stack-Dateien oder allgemeinen Env-Variablen abgelegt
- solche Werte werden als Swarm-Secrets oder durch einen gleichwertigen externen Secret-Manager bereitgestellt und im Runbook mit Namenskonvention, Rotation und Zuständigkeit beschrieben
- nicht sensitive Runtime-Werte werden als Swarm-Configs oder bewusst dokumentierte Stack-Variablen geführt
- Postgres und Redis bleiben stateful Services mit persistenten Volumes
- destruktive oder nicht rückwärtskompatible Schemaänderungen sind nicht Teil dieses Changes

Klassifizierungstabelle (verbindlich für das Referenzprofil):

| Env-Variable | Klassifizierung | Swarm-Typ | Rotation |
|---|---|---|---|
| `SVA_AUTH_CLIENT_SECRET` | Vertraulich | Secret | bei Kompromittierung |
| `SVA_AUTH_STATE_SECRET` | Vertraulich | Secret | bei Kompromittierung |
| `ENCRYPTION_KEY` | Vertraulich | Secret | halbjährlich |
| `IAM_PII_KEYRING_JSON` | Vertraulich | Secret | halbjährlich (Keyring) |
| `APP_DB_PASSWORD` | Vertraulich | Secret | bei Kompromittierung |
| `POSTGRES_PASSWORD` | Vertraulich | Secret | bei Kompromittierung |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Vertraulich | Secret | bei Kompromittierung |
| `SVA_PUBLIC_BASE_URL` | Intern | Config | – |
| `SVA_AUTH_ISSUER` | Intern | Config | – |
| `SVA_ALLOWED_INSTANCE_IDS` | Intern | Config | bei Instanzänderung |
| `SVA_PARENT_DOMAIN` | Intern | Config | – |

Namenskonvention für Swarm-Secrets: `sva_studio_<service>_<secret_name>` (z. B. `sva_studio_app_auth_client_secret`).

Begründung:

- trennt Security-kritische und nicht sensitive Konfiguration sauber
- reduziert Fehlkonfigurationen im Portainer-/Swarm-Betrieb
- explizite Zuordnungstabelle verhindert versehentliche Falschklassifizierung bei der Migration

## Risks / Trade-offs

- Swarm-Configs/Secrets unterscheiden sich betriebsseitig von einfachem Compose und benötigen klare Operator-Dokumentation
- DB-Migrationen per Bind-Mount sind in Swarm unattraktiv; ein konkretes Migrationsverfahren wird als Folgearbeit für den produktiven Betrieb geplant (Development-Phase: frische Instanzen)
- Multi-Host-Betrieb ohne hostdynamische Redirect-Logik bleibt bewusst auf einen kanonischen Auth-Host begrenzt und muss diese Grenze im Runbook klar markieren
- direkte Nutzung der Subdomain als `instanceId` setzt voraus, dass erlaubte Zeichen, Normalisierung und Fehlerfälle explizit definiert werden
- eine Env-Allowlist kann bei vielen Instanzen (≥ 50) unhandlich werden; der Schwellwert und der Eskalationspfad (DB-/API-gestützte Registry) werden als technische Schuld in [11-risks-and-technical-debt.md](../../docs/architecture/11-risks-and-technical-debt.md) dokumentiert
- ohne identische Fehlerantworten für alle Ablehnungsgründe könnten Timing-Seitenkanäle eine Mandanten-Enumeration ermöglichen; daher: einheitlicher `403`-Fehlervertrag
- Cookie-Domain-Scoping über die Parent-Domain (`*.studio.smart-village.app`) birgt Sicherheitsimplikationen und muss bei Implementierung bewusst entschieden werden
- IDN-/Punycode-Labels (`xn--*`) könnten das instanceId-Regex passieren und müssen explizit ausgeschlossen werden

## Migration Plan

1. Swarm-/Traefik-Zielbild und benötigte Runtime-Werte dokumentieren
2. Portainer-Stack auf Registry-Image, externes Netzwerk und dokumentierte Secrets-/Configs-Ressourcen umbauen
3. Parent-Domain, Host-Validierung und HostRegexp-Routing für Instanz-Subdomains dokumentieren
4. Env-Allowlist als autoritative Freigabequelle für gültige `instanceId`s dokumentieren
5. Kanonischen Auth-Host und fail-closed-Grenzen für nicht unterstützte Multi-Host-OIDC-Flows dokumentieren
6. Persistenz-, Restore- und kompatibles Rollback-Fenster für stateful Services dokumentieren
7. Dynamische Redirect- und Base-URL-Logik als separaten Folgeschritt für `subdomain == instanceId` planen

## Open Questions

- Welche konkrete Registry in einem Zielsystem verwendet wird, bleibt umgebungsabhängig und muss im jeweiligen Runbook benannt werden.
- Secrets und Configs werden in diesem Change als externe Betriebsressourcen vorausgesetzt; die initiale Provisionierung ist als dokumentierter Operator-Schritt zulässig.
- Die Root-Domain `studio.smart-village.app` fungiert in diesem Change als kanonischer Auth-Host; Instanz-Hosts liegen ausschließlich eine Ebene darunter.
- Die Allowlist bleibt in diesem Change die alleinige autoritative Quelle gültiger `instanceId`s.
- Cookie-Domain-Scoping (Parent-Domain-Cookie vs. strikt hostgebundener Cookie) muss bei Implementierung festgelegt und in [08-cross-cutting-concepts.md](../../docs/architecture/08-cross-cutting-concepts.md) dokumentiert werden.
- Ob arc42-Abschnitte 02 (Randbedingungen) und 03 (Kontext/Scope) Nachträge für Traefik-Voraussetzung und Parent-Domain-Modell benötigen, wird bei Implementierung geprüft.
- Die Allowlist bleibt in diesem Change die alleinige autoritative Quelle gültiger `instanceId`s.
