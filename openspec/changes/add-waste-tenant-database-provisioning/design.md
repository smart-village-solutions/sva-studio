## Context

Waste-Management verwendet eine fachlich eigene PostgreSQL-Struktur. Die gewünschte Mandantengrenze ist eine separate Datenbank pro Studio-Instanz, nicht eine gemeinsam genutzte Datenbank mit `instance_id` oder tenantbezogenen Schemas. Die vorhandene Modulzuweisung persistiert Freigabe und IAM-Basis synchron; Datenbankanlage, Rollenverwaltung, Migration und Verbindungsprüfung sind dagegen langlaufende und teilweise externe Operationen.

Die technische Datenquelle soll als External Interface registriert bleiben, weil Resolver, Verschlüsselung, Statusprojektion und Diagnose davon profitieren. Da Tenant-Benutzer das Interface weder sinnvoll erstellen noch sicher verändern können, ist es kein Bestandteil der allgemeinen Interface-Verwaltung.

## Goals / Non-Goals

### Goals

- Genau eine eigene Waste-Datenbank pro Studio-Instanz mit aktiviertem Waste-Modul
- Automatische, idempotente und wiederholbare Provisionierung nach Modulzuweisung
- Eindeutige Status- und Fehlerzustände ohne teilweise freigeschaltete Fachruntime
- Pluginverwaltetes, verborgenes und serverseitig verschlüsseltes Interface
- Getrennte Least-Privilege-Rollen und Secrets pro Tenant
- Einmalige, tenantgenaue Übernahme des Supabase-Bestands nach `bb-prignitz`
- Backup-, Restore-, Audit- und Diagnosefähigkeit für dynamisch angelegte Datenbanken

### Non-Goals

- Kein Wartungsmodus für die einmalige Umstellung
- Keine gemeinsame Waste-Datenbank und kein `instance_id` als primäre Mandantengrenze in Fachtabellen
- Keine Datenbank- oder Interface-Selbstverwaltung durch Tenant-Benutzer
- Keine automatische Datenlöschung beim Entzug des Moduls
- Kein allgemeiner Database-as-a-Service-Vertrag für beliebige Plugins in diesem Change
- Kein neuer dauerhaft laufender Service, Worker, Container, Port oder separater Swarm-Stack
- Kein alternativer Studio-Rolloutpfad neben dem verbindlichen GitHub-Actions-Prozess

## Decisions

### Decision: Die Provisionierung läuft in vorhandenen Studio-Services

Modulzuweisung, Statuspersistenz, Interface-Auflösung und UI verbleiben in ihren vorhandenen Studio-Komponenten. Der Provisionierungsjob wird durch die bestehende Plugin-Operations-/Worker-Infrastruktur ausgeführt. Der fachlich getrennte Provisionierer ist eine privilegiengetrennte Ausführungsrolle innerhalb dieses bestehenden Jobpfads und kein zusätzlicher dauerhaft laufender Deployment-Service.

Das vorhandene Deployment wird einmalig um ein serverseitiges Provisionierer-Secret und die zugehörige vorab administrativ eingerichtete PostgreSQL-Rolle ergänzt. Außerdem werden die zentralen Studio-Migrationen und die Backup-Discovery erweitert. Nach diesem Rollout erfordert die Aktivierung eines weiteren Waste-Tenants weder einen neuen Stack noch eine manuelle Deployment- oder Secret-Änderung.

### Decision: Die Modulzuweisung erzeugt einen asynchronen Sollzustand

Nach erfolgreicher fachlicher Modulzuweisung und IAM-Synchronisierung wird ein eindeutig korrelierter Provisionierungsjob eingestellt. Die Zuweisungsmutation wartet nicht auf Datenbank- oder Netzwerkoperationen. Der Waste-Zustand durchläuft mindestens `provisioning`, `ready`, `failed` und `disabled`; bis `ready` lehnt die Fachruntime Datenzugriffe fail-closed ab.

Wiederholte Zuweisungen, Events oder Retries dürfen für dieselbe Instanz keinen konkurrierenden zweiten Sollzustand erzeugen. Ein aktiver oder bereits erfolgreicher Lauf wird deterministisch wiederverwendet; ein fehlgeschlagener Lauf kann berechtigt wiederholt werden.

### Decision: Eine physische Datenbank ist die Mandantengrenze

Der Provisionierer erzeugt pro Instanz eine kanonisch benannte Waste-Datenbank. Datenbank- und Rollennamen werden ausschließlich aus serverseitig validierten, normalisierten Identifikatoren und einem stabilen Kollisionsschutz abgeleitet; unvalidierte Tenant-Werte werden nie als SQL-Identifier interpoliert.

Die Datenbank erhält tenantbezogene Rollen mit getrennten Verantwortungen:

- eine nicht interaktive Owner-Rolle für Objektbesitz,
- eine Migrationsrolle für Schemaänderungen,
- eine Runtime-Rolle für die authentifizierte Studio-Fassade,
- bei Bedarf eine eng begrenzte Public-Runtime-Rolle für die öffentliche Waste-Anwendung.

Jeder Tenant erhält eigene Secrets. Der normalen Studio-App-Runtime werden keine clusterweiten Rechte wie `CREATEDB` oder `CREATEROLE` gegeben. Solche Rechte stehen ausschließlich dem betrieblich geschützten Provisionierungspfad des vorhandenen Job-Runners zur Verfügung und werden nicht an Browser, normale Request-Verarbeitung oder Plugin-Code weitergereicht.

### Decision: Das Interface ist pluginverwaltet und standardmäßig verborgen

Die zentrale Registry kennzeichnet den Datensatz mit einer systemseitigen Ownership für `waste-management`. Der genaue persistierte Vertrag verwendet die vorhandene Owner-Modellierung der Registry und wird nicht durch ein zweites Interface-System ersetzt.

Pluginverwaltete Interfaces werden aus normalen Listen, Auswahlfeldern und Detailrouten unter `/interfaces` entfernt. Allgemeine Create-, Update- und Delete-Mutationen lehnen sie fail-closed ab. Interne Resolver, der Provisionierungsjob und berechtigte Host-Operatoren dürfen Status und sichere Diagnose weiterhin verwenden. Secrets bleiben verschlüsselt und werden nie in Read Models ausgegeben.

### Decision: Die Freischaltung erfolgt erst nach vollständiger Prüfung

Der Job führt in wiederholbarer Reihenfolge aus:

1. Sollzustand und eindeutigen Job reservieren.
2. Rollen, Secrets und Datenbank idempotent anlegen oder auf Drift prüfen.
3. Das pluginverwaltete Interface zunächst deaktiviert anlegen oder aktualisieren.
4. Waste-Migrationen bis zur erwarteten Version anwenden.
5. Verbindungen und Rechte mit den vorgesehenen Runtime-Rollen prüfen.
6. Interface aktivieren und den Modulzustand atomar auf `ready` projizieren.

Scheitert ein Schritt, bleibt das Interface deaktiviert und der Zustand wird mit sicherer Diagnose auf `failed` gesetzt. Bereits angelegte Daten und Infrastruktur werden für einen Retry erhalten; Secrets erscheinen weder in Fehlern noch in Logs.

### Decision: Modulentzug bewahrt Daten

Beim Entzug von `waste-management` werden neue Fachzugriffe blockiert, das verwaltete Interface deaktiviert und ausstehende Provisionierungsläufe beendet oder wirkungslos gemacht. Datenbank, Rollen, Secrets, Jobhistorie und Sicherungen bleiben erhalten. Eine spätere erneute Zuweisung reconciled denselben Bestand. Eine endgültige Löschung ist eine separate, explizit bestätigte und auditierte Betriebsoperation außerhalb dieses Changes.

### Decision: `bb-prignitz` erhält einen kontrollierten Einmalimport

Der allgemeine Provisionierungsprozess erzeugt für neue Tenants nur Schema und technische Basisdaten. Der Supabase-Dump wird in einem separaten, auditierten Migrationslauf ausschließlich der kanonischen Instanz `bb-prignitz` zugeordnet. Vor Import werden Zielinstanz, Zieldatenbank und erwarteter Leer-/Ausgangszustand geprüft. Nach Import werden Schema, Zeilenzahlen, Constraints und fachliche Stichproben verifiziert. Ein Dump wird niemals implizit auf andere Tenants verteilt.

### Decision: Dynamische Datenbanken sind Teil des Betriebsvertrags

Backup- und Restore-Werkzeuge müssen tenantbezogene Waste-Datenbanken entdecken oder über die zentrale Registry inventarisieren, ohne Credentials auszugeben. Sicherungen tragen eine eindeutige Instanz- und Datenbankzuordnung. Restore-Proben und Löschfristen gelten ebenso wie für andere fachlich relevante Persistenz. Audit und Jobdiagnose korrelieren mindestens Instanz, Modul, Job, Phase und redigierten Fehlercode.

## Alternatives Considered

- **Manuelle Interface-Konfiguration:** verworfen, weil sie technische Verantwortung und Secrets unnötig an Tenant-Benutzer delegiert und Aktivierungen uneinheitlich macht.
- **Synchrone Datenbankanlage in der Zuweisungsmutation:** verworfen, weil externe Teilerfolge, Timeouts und Retries die fachliche Transaktion unbeherrschbar koppeln.
- **Eine gemeinsame Datenbank mit `instance_id`:** verworfen, weil die vereinbarte physische Mandantengrenze und unabhängige Restore-/Lifecycle-Fähigkeit verloren gehen.
- **Ein Schema pro Tenant:** verworfen, weil Rollen-, Migrations- und Restore-Isolation schwächer und die gewünschte Datenbankgrenze nicht erfüllt wäre.
- **Automatische Löschung beim Modulentzug:** verworfen, weil eine Fehlbedienung irreversible Fachdatenverluste verursachen könnte.

## Risks / Trade-offs

- Clusterweite Provisionierungsrechte sind hochprivilegiert. → Separater Provisionierer, minimale Secret-Reichweite, validierte Identifier, Audit und keine Rechte in der normalen App-Runtime.
- Teilerfolge über zentrale Registry und Tenant-Datenbank sind nicht atomar. → Explizite Zustandsmaschine, deaktiviertes Interface bis zur Endprüfung und idempotenter Reconcile statt verteilter Transaktion.
- Viele Datenbanken erhöhen Backup- und Monitoring-Aufwand. → Zentrales Inventar, automatisierte Discovery, tenantgenaue Sicherungsmetadaten und Restore-Proben.
- Parallele Moduländerungen können doppelte Jobs starten. → Eindeutiger aktiver Job-/Sollzustand pro Instanz und transaktionales Enqueue.
- Der bestehende Migrationschange verändert dieselben Waste-Verträge. → Explizite Abhängigkeit und gemeinsame Delta-Auflösung vor Archivierung.

## Migration Plan

1. Den PostgreSQL-Migrationschange für Waste integrieren und die Zielversion des Waste-Schemas festlegen.
2. Zentralen Provisionierungsstatus, Jobtyp und pluginverwaltete Interface-Ownership einführen.
3. Provisionierer und tenantbezogene Rollen-/Secret-Erzeugung zunächst ohne automatische Aktivierung ausrollen und in einer Testinstanz prüfen.
4. Modulzuweisung und Retry-Aktion mit dem Provisionierungsjob verbinden.
5. Backup-Discovery und Restore-Probe für mindestens eine tenantbezogene Waste-Datenbank erfolgreich nachweisen.
6. Die Waste-Datenbank für `bb-prignitz` provisionieren, Supabase-Schreibzugriffe im vereinbarten Sonntagsfenster stoppen, finalen Dump importieren und verifizieren.
7. `bb-prignitz` auf das verwaltete Interface umschalten und Smoke-Tests ausführen; Supabase zunächst nur als Rückfallquelle erhalten.
8. Weitere Tenants erst nach erfolgreicher Betriebsverifikation aktivieren.

Rollback erfolgt durch Deaktivierung des verwalteten Interfaces und Rückprojektion des Modulstatus. Für `bb-prignitz` darf nur innerhalb des dokumentierten Cutover-Fensters auf die unveränderte Supabase-Quelle zurückgeschaltet werden; danach benötigen Rückwechsel eine explizite Datenabgleichsentscheidung.

## Open Questions

- Keine fachlich blockierenden Fragen. Exakte Identifier-Längen, Secret-Backend und Worker-Ausführung werden bei der Implementierung anhand der bestehenden Registry- und Deployment-Verträge konkretisiert, ohne die hier festgelegten Sicherheitsgrenzen zu verändern.
