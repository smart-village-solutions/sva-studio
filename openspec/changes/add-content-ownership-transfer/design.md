## Context

Studio unterscheidet zwischen dem tatsächlich handelnden Account, dem persönlichen oder organisatorischen Mutationsprincipal, der Credential-Quelle, technischer IAM-Ownership und dem Mainserver-DataProvider. Bei lokalen Inhalten sind `ownerUserId` und `ownerOrganizationId` die technische Zuständigkeit; die sichtbare Autorenanzeige ist davon getrennt. Bei Mainserver-Inhalten ist der DataProvider dagegen fachlicher Inhaber und sichtbare Autorenidentität, während die lokalen Owner-Felder nur eine rekonstruierbare Projektion einer verifizierten Principal-Bindung sind.

Der aktuelle Studio-Vertrag behandelt den Mainserver-DataProvider als unveränderlich und lässt lokale Ownership-Änderungen über normale Update-Rechte zu. Issue #1102 verlangt dagegen eine separate Permission für die bewusste Übergabe an Accounts oder Organisationen. Der Mainserver-Commit `ee619d0e` ergänzt dafür `dataProviderId` auf den fünf primären Resource-Mutationen, begrenzt die Auswahl auf Management-Rollen und dieselbe Municipality und führt abhängige Datensätze sowie `ExternalReference` transaktional mit.

## Goals

- Eine bewusste, einzeln bestätigte Übergabe an einen aktiven Account oder eine aktive Organisation derselben Instanz ermöglichen.
- Inhabertransfer strikt von normaler Inhaltsbearbeitung, Principal-Auswahl und Identitäts-Reconciliation trennen.
- Ziel-Principal, DataProvider-Bindung und Credentials ausschließlich serverseitig und fail-closed auflösen.
- Den bestätigten Mainserver-Zustand als fachliche Wahrheit behandeln und lokale Projektion, Journal und Audit zuverlässig nachziehen.
- Einen unklaren Transportausgang ohne doppelten oder erfundenen Transfer klären können.
- Einen gemeinsamen UI-Vertrag für alle in V1 unterstützten Content-Typen bereitstellen.

## Non-Goals

- Kein Bulk-Transfer, kein Tenant-Transfer und keine Übergabe zwischen Mainserver-Instanzen oder Municipalities.
- Kein Transfer von Credentials, Memberships, Rollen oder Account-Identitäten.
- Keine automatische Übergabe als Nebeneffekt anderer Lifecycle- oder IAM-Ereignisse.
- Kein generischer Transfer für Typen ohne bestätigten Mainserver-Vertrag.
- Kein Ersatz für `add-mainserver-user-conflict-reconciliation`.

## Decisions

### Eine eigene Action autorisiert ausschließlich den aktuellen Inhalt

`content.transferOwnership` ist eine tenantweite, scope-fähige und vollständig qualifizierte Action. Ihr Scope wird gegen den aktuellen Inhaber des Quellinhalts ausgewertet. `own`, `organization` und `all` behalten ihre bestehende Bedeutung; der Zielbereich ist ein Validierungsziel und keine zusätzliche Leseberechtigung, die der Actor bereits besitzen muss.

Normale Actions wie `content.updateMetadata` oder pluginspezifische Update-Actions reichen für eine Übergabe nicht aus. Der Server prüft die Transfer-Action unmittelbar vor jedem Seiteneffekt erneut. `system_admin` erhält sie über den kanonischen Permission-Katalog mit Scope `all`; weitere Rollen erhalten sie nur durch explizite Konfiguration.

### Der Browser wählt einen Principal und niemals einen DataProvider

Der Client sendet genau einen `targetPrincipal` mit `type = account | organization` und einer UUID. Der Server validiert Instanz, Aktivstatus und zulässigen Principal-Typ. Für Mainserver-Inhalte löst er zusätzlich unter der Zielinstanz eine aktuelle, konfliktfreie Eins-zu-eins-Bindung vom Principal zum DataProvider sowie verwendbare persönliche oder organisatorische Credentials auf.

Leere, mehrdeutige, konfliktbehaftete, instanzfremde, gelöschte oder credential-lose Ziele werden nicht angeboten und bei direktem Request serverseitig abgewiesen. Eine vom Browser gelieferte DataProvider-ID gehört nicht zum Request-Schema.

### Lokale und Mainserver-basierte Inhalte besitzen getrennte Transferadapter

Lokale Inhalte ändern `ownerUserId` beziehungsweise `ownerOrganizationId` atomar im bestehenden Repository. Beim Wechsel auf eine Organisation wird der persönliche Owner entfernt; beim Wechsel auf einen Account wird der Organisations-Owner entfernt. Die sichtbare redaktionelle Autorenanzeige bleibt unverändert.

Mainserver-Inhalte werden nicht durch eine lokale Owner-Umschreibung übertragen. Der typisierte Adapter sendet die serverseitig aufgelöste Ziel-DataProvider-ID an die bestehende Resource-Mutation. Erst der bestätigte Mainserver-Response oder ein eindeutiger Target-Re-Read begründet den neuen Inhaber. Anschließend werden Binding-basierte Owner-Projektion, Credential-Quelle, Liste und History nachgezogen.

### V1 verwendet eine explizite Typmatrix

V1 aktiviert den Transfer nur für:

- NewsItem,
- EventRecord,
- PointOfInterest,
- Tour,
- Root-GenericItem einschließlich der vom Mainserver mitgeführten abhängigen GenericItems, TourStops und POI-Voucher.

Fachplugins auf Basis eines Root-GenericItems verwenden denselben Host-Vertrag. Surveys, Legacy SurveyPolls, Batch-Importe und alle weiteren Typen bleiben deaktiviert, bis ihr vollständiger Transfer- und Abhängigkeitsvertrag separat bestätigt ist. Die UI leitet Verfügbarkeit aus derselben serverseitigen Capability-Matrix ab und führt keine eigene Typenliste.

### Source-Principal führt aus, Target-Principal übernimmt

Der aktuelle, für den Quellinhalt autorisierte persönliche oder organisatorische Principal führt Fresh Pre-Read und Transfermutation mit seinen Management-Credentials aus. Der Ziel-Principal liefert keine Browser-Credentials und wird nicht zum Actor. Nach erfolgreicher Übergabe bestimmen Zielbindung und Ziel-Credentials alle späteren Mutationen.

Der Server sperrt den Content-/DataProvider-Pfad während Reservierung und Finalisierung, prüft Transfer-Permission, Quell-Preimage, Zielbindung und Upstream-Capability erneut und reserviert eine stabile Operationsreferenz im bestehenden Mutationsjournal.

### Unklare Ergebnisse werden durch Source und Target geklärt

Bei Timeout oder Verbindungsabbruch liest Studio den Datensatz zuerst mit den Ziel-Credentials und anschließend, soweit noch zulässig, mit den Quell-Credentials:

- bestätigt der Target-Re-Read die Ziel-DataProvider-ID, wird der Transfer als erfolgreich finalisiert;
- bestätigt der Source-Re-Read weiterhin ausschließlich den Quell-DataProvider, darf dieselbe Operationsreferenz kontrolliert wiederholt werden;
- liefern die Reads widersprüchliche, fehlende oder nicht eindeutige Evidenz, bleibt der Vorgang `reconciliation_required` und eine weitere automatische Mutation ist gesperrt.

Lokale Folgefehler nach bestätigtem Provider-Erfolg ändern den fachlichen Erfolg nicht. Sie werden als Reconciliation-Bedarf nachgezogen und nicht als Mainserver-Rollback dargestellt.

### Der sichtbare Autor folgt dem jeweiligen Fachmodell

Bei lokalen Inhalten bleibt die Autorenanzeige trotz Ownership-Transfer stabil. Bei Mainserver-Inhalten ist der aktuelle DataProvider gleichzeitig fachlicher Inhaber und sichtbare Autorenidentität; ein bestätigter Transfer ändert daher beide gemeinsam. Die UI weist diese Wirkung vor der Bestätigung ausdrücklich aus.

### Die UI verwendet eine gemeinsame bestätigungspflichtige Aktion

Ein gemeinsamer Host-Baustein liefert Trigger, Zielsuche, Zielzusammenfassung, Bestätigung, Lade-/Fehlerzustände und Erfolgsfeedback. Plugins tragen nur Content-Typ und Transfer-Capability bei. Nicht autorisierte oder nicht unterstützte Inhalte zeigen keine aktive Transferaktion.

Der Dialog nennt aktuellen und neuen Inhaber, weist auf möglichen Verlust des anschließenden Zugriffs hin und verlangt eine eindeutige Bestätigung. Fokusführung, Tastaturbedienung, Screenreader-Beschriftung und lokalisierte Meldungen folgen den vorhandenen shadcn/ui- und Action-Feedback-Verträgen.

## Error Contract

Der Server liefert stabile, PII-arme Fehlercodes mindestens für:

- `content_transfer_permission_missing`,
- `content_transfer_target_invalid`,
- `content_transfer_target_binding_missing`,
- `content_transfer_target_binding_conflict`,
- `content_transfer_target_credentials_missing`,
- `content_transfer_type_unsupported`,
- `content_transfer_source_changed`,
- `content_transfer_provider_rejected`,
- `content_transfer_reconciliation_required`.

Antwort, Audit und Logs enthalten keine E-Mail-Adressen, Credential-Inhalte, Tokens oder vollständigen Mainserver-Responses.

## Risks and Mitigations

- Übergabe an einen falschen Principal → serverseitig gefilterte Zielauswahl, klare Typkennzeichnung, Wirkungszusammenfassung und explizite Bestätigung.
- Actor verliert nach erfolgreicher Übergabe den Zugriff → Erfolg wird aus dem bestätigten Transferzustand angezeigt; ein anschließender 403/404 widerruft den Erfolg nicht.
- Mainserver-Vertrag ist noch nicht auf dem Zielsystem verfügbar → Schema-/Capability-Preflight blockiert die Funktion vor Aktivierung.
- Upstream-Erfolg bei verlorenem Response → Target-/Source-Re-Read und bestehendes Mutationsjournal verhindern erfundene Rollbacks und unkontrollierte Wiederholungen.
- DataProvider-Bindung ändert sich parallel → DataProvider-Lock, Fresh Validation und erwartete Binding-Version blockieren stale Transfers.
- Unterschiedliche Typverträge → zentrale Capability-Matrix und gezielte Contract-Tests statt optimistischer Freischaltung.

## Migration Plan

1. Den Mainserver-Vertrag und seine Verfügbarkeit in Dev/Staging für alle fünf V1-Typen verifizieren und den Studio-Schema-Snapshot aktualisieren.
2. Permission-Katalog, System-Admin-Reconcile, lokale Transferautorisierung und Audit einführen.
3. Zielauflösung, typisierte Mainserver-Adapter, Journal-/Reconciliation-Pfad und Projektion implementieren.
4. Gemeinsame UI-Aktion und Plugin-Capabilities für die V1-Typen aktivieren.
5. Bestehende Test-Principals mit fehlender `studio`-Rolle gezielt reprovisionieren und die vollständige Transfermatrix in Dev/Staging abnehmen.
6. Studio und erforderliche Mainserver-Version über ihre jeweiligen geschützten Rolloutpfade ausrollen; Aktivierung erst nach positivem Runtime-Preflight.

## Open Questions

Keine offenen Produktentscheidungen für V1. Erweiterungen um Bulk-Transfer, Surveys oder weitere Mainserver-Typen benötigen einen eigenen bestätigten Vertrag.
