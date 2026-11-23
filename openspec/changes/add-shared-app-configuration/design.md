# Technischer Entwurf: gemeinsamer App-Konfigurationsabgleich

## Freigegebener Zuschnitt

Der gemeinsame Ablauf liegt im bestehenden `@sva/sva-mainserver`. Fachplugins verantworten Formulare, Feldzuordnung und auch serverseitig ausführbare Fachvalidierung. Der Host bindet Session, Plugin-Aktivierung, Instanz, Kommune, Principal, Action und erlaubte Pfade. App-Routen bleiben dünne Adapter. Gemeinsame clientfähige Typen und Aufrufe werden im vorhandenen Plugin-SDK bereitgestellt.

Redakteure wählen die Versionsvariante selbst. Neue Versionen kopieren eine ausdrücklich gewählte bestehende Variante vollständig. Bearbeiten erfordert das jeweilige Plugin-Konfigurationsrecht; Anlegen und Löschen ganzer Dokumentvarianten erfordert zusätzlich ein übergreifendes Konfigurationsrecht. Inhaltsrechte reichen nicht aus. Speichern schreibt nach einer Änderungsvorschau direkt in den Mainserver. Ungespeicherte Formularänderungen bleiben lokal, werden bei Konflikten erhalten und begründen keinen dauerhaften Entwurfsbestand.

Die Studio-Anbindung verwendet den aktuell ausgerollten Mainserver-Vertrag. Für Updates prüft der Mainserver die erwartete Revision atomar. Der unabhängige Readback bestätigt den gelesenen Zustand zum Zeitpunkt der Abfrage.

## Historische Vertragsprüfung vor SVA-1787, SVA-1788, SVA-1789 und SVA-1792

Quellenprüfung vom 15. November 2026, keine Live-Prüfung: Mainserver-Worktree `.worktrees/saas`, Commit `b01aead122485848cd03ea774c12eb9fc3efdd28`. Alle folgenden Mainserver-Pfade sind relativ zu diesem Worktree.

| Fähigkeit | Belegter vorhandener Pfad | Grenze |
| --- | --- | --- |
| App-Auswahl lesen | `app/graphql/types/query_type.rb`, `publicJsonFile(name:, version:)` | Auswahl mit Versions-Fallback; kein vollständiger Variantenindex, kein Read nach ID. Fehler können als `not found` erscheinen. Strukturierte JSON-Antwort ist kein unveränderter Rohtext. |
| Schreiben über GraphQL | `app/graphql/mutations/create_or_update_static_content.rb` | Mit ID Update, ohne ID Create; `name.parameterize` auch bei Updates. `globalSettings` wird normalisiert. `name` weglassen hilft nicht: `params.fetch(:name)` wird trotzdem ausgeführt. Kein CAS oder bestätigter Idempotenzvertrag. |
| Gezielte GraphQL-Löschung | `app/graphql/mutations/destroy_record.rb`, `app/graphql/concerns/record_destruction.rb` | `StaticContent` ist zugelassen; Suche nach ID im Kommunen- und Rollenscope. Antwortstatus muss ausgewertet und Abwesenheit separat nachgewiesen werden. Die Mutation selbst liefert keinen exakten unabhängigen Lesepfad. |
| Variantenbestand und exakter Rohinhalt | `app/controllers/static_contents_controller.rb`, `app/views/static_contents/{index,show}.json.jbuilder`, `_static_content.json.jbuilder` | `/static_contents.json` ist paginiert; `/static_contents/:id.json` liefert Identität und Rohinhalt. Beide verlangen Devise-Anmeldung und `admin_role?`. Kein belegter OAuth-Bearer-Zugriff über den bisherigen Studio-Principal. |
| Name erhalten, Create und Delete | Derselbe REST-Controller, Methoden `create`, `update`, `destroy` | Direkte erlaubte Attribute ohne `parameterize`, aber Admin-Session und für Mutationen Rails-CSRF beachten. Keine atomare Vorbedingung. |
| Admin-Session | `app/controllers/users/sessions_controller.rb`, `app/models/user.rb` | Bestehender Loginpfad; `studio` wird ausdrücklich abgewiesen. Eine OAuth-Client-ID/-Secret-Kombination ist kein nachgewiesener Ersatz für diesen Login. Loginantworten enthalten sensible Daten und dürfen nicht protokolliert oder an Plugins weitergereicht werden. |

Die vorhandene Studio-Anbindung in `service-internals/{service-context,credentials,access-token-provider,graphql-client}.ts` nutzt die bestehende Credential-Auflösung und OAuth für GraphQL. Der aktuelle Static-Content-Writer normalisiert den Namen selbst, sucht ohne Versionsparameter nur eine ID, schreibt `version: ''` und bestätigt anhand der Mutation-ID. Er ist keine fertige Editor-Anbindung.

**Festgelegter Integrationsweg:** Der Nutzer möchte bei GraphQL bleiben. Die bestehende Admin-REST-Schnittstelle wird deshalb ausschließlich als untersuchter Bestand dokumentiert und nicht als Umsetzungspfad vorgesehen. Keine zusätzliche Admin-Session, kein anderes Konto, keine Rollenänderung und kein DB-Direktzugriff.

**Ergebnis der Vertragsprüfung:** Der volle freigegebene Umfang ist mit dem gelesenen OAuth-/GraphQL-Vertrag nicht nachgewiesen. Der eingecheckte Studio-Schema-Snapshot bestätigt `publicJsonFile(name, version)`, `publicHtmlFile(name, version)`, `publicHtmlFiles`, `createOrUpdateStaticContent(forceCreate, id, name, content, dataType, version)` und `destroyRecord(id, recordType, externalId)`. Eine JSON-Variantenliste oder ein exakter Static-Content-Read nach ID fehlt. Hinzu kommt die im Mainserver-Resolver belegte Namensnormalisierung auch beim Update. Diese beiden Fähigkeiten werden nicht durch Clientlogik erfunden. Die Mainserver-Unveränderlichkeit und der freigegebene Produktumfang bleiben bestehen; die Integrationslücke wird bis zu einer belegbaren Lösung oder einer ausdrücklich geänderten Anforderung offengehalten.

Ein unbekannter Variantenbestand wird nicht durch eine Suche über geratenen Versionsnummern oder durch einen lokalen Shadow-Katalog ersetzt. Die Anforderung, Varianten zu erstellen und zu löschen, bleibt bestehen. Nur der nicht belegte technische Zugriff ist offen; fehlendes CAS ist kein zusätzlicher pauschaler Schreibblocker.

Die fehlenden Abfragen sind Daniel Külpmann konkret zugewiesen: [SVA-1788](https://tpwd.atlassian.net/browse/SVA-1788) für den vollständigen Variantenbestand und [SVA-1789](https://tpwd.atlassian.net/browse/SVA-1789) für den exakten Rohtext-Read nach ID. Die Namensnormalisierung beim Write bleibt ein separates Thema aus [SVA-1787](https://tpwd.atlassian.net/browse/SVA-1787).

## Erster Verbraucher und belegte Feldpfade

App-Code: `smart-village-app-app/smart-village-app-app`, Commit `3e4e7711d15db1c78da3c03b1ad930bd2b35417f`. Keine App-Laufzeitabnahme.

| Pluginbereich | Pfad unter `globalSettings` | Verbraucher und Bedeutung |
| --- | --- | --- |
| Allgemein | `settings.locationService.showAlternativeLocationButton` | `src/components/settings/LocationSettings.js`: liest den Boolean mit Default `true` und zeigt die alternative Standortwahl. `settings.locationService` kann im Bestand auch Boolean sein; der Editor darf daraus nicht stillschweigend ein Objekt machen. |
| Design | `appDesignSystem.serviceTiles.numberOfLines` | `src/config/appDesignSystem/default.ts`, `src/ConfigurationsProvider.tsx`, `src/components/screens/{Service,ServiceTile}.tsx`: gemeinsame Zeilenzahl für Kacheltitel, sofern der einzelne Eintrag keinen Override besitzt. Die ConfigurationsProvider-Bedingungen und App-Caches bleiben unverändert. |

Dies sind begrenzte erste Feldgruppen, keine vollständigen Allgemein-/Designformulare und keine zugesicherte Clientwirkung. Vor UI-Implementierung werden Typen, zulässige Werte und die tatsächlichen Plugin-IDs mit den vorhandenen Feldmatrizen abgeglichen. Keine automatische Default-Anreicherung beim Laden oder Kopieren. „Nicht gesetzt“ bleibt von einem ausdrücklich gespeicherten Defaultwert unterscheidbar.

## Gemeinsamer Ablauf

### Bestehender Schreibpfad für andere statische Inhalte

Im bestehenden `service-internals/static-content-operations.ts` gilt `allowRetry: false` für die Create-/Update-Mutation. Der vorausgehende Lookup behält seine Retry-Regel. Fehler ab Beginn der Mutation einschließlich fehlender Mutation-ID werden mit dem bereits vorhandenen `cause.retry.kind: terminal` markiert; der bestehende Job-Lifecycle behandelt sie dadurch bereits vor dem letzten Versuch als permanent und führt den Handler nicht automatisch erneut aus. Acht Mutationstests prüfen Create/Update bei HTTP 503, Verbindungsabbruch, Timeout und fehlender Antwort-ID. Zwei Lookup-Fälle prüfen erhaltenen Lese-Retry und unveränderte Fehler vor Beginn einer Mutation. Es entsteht kein neuer Fehler- oder Retry-Vertrag. Payload, Namen und Versionsbehandlung bleiben unverändert. Ein Transportfehler bedeutet weiterhin einen unklaren Ausgang, keinen Nachweis eines fehlgeschlagenen Writes.

### Gemeinsamer Ablauf für App-Konfigurationsupdates

1. **Lesen:** Host autorisiert das Plugin, bindet den aktuellen Zielkontext und liest die explizit gewählte Variante. ID, gespeicherter Name, Datentyp und gespeicherte Version werden geprüft. Angefragte App-Version und aufgelöste Variante werden getrennt behandelt. Rohinhalt bleibt ausschließlich im berechtigten Serverpfad; der Browser erhält die erlaubten Feldprojektionen und benötigte Identitäts-/Vergleichsmetadaten.
2. **Bearbeiten und Vorschau:** Das Plugin führt ausdrücklich geänderte eigene Pfade mit ihrer gelesenen Ausgangsbasis. Setzen, Entfernen und `null` sind verschieden. Der Host akzeptiert keine vom Browser selbst erklärte Pfadberechtigung. Vollständige fremde Konfiguration und sensible Werte gehören nicht in Vorschau, Fehler oder Logs.
3. **Speichern:** Der Host prüft Rechte und Kontext erneut. Innerhalb der Ausführung wird die gewählte ID frisch gelesen und die zugehörige Revision als atomare Vorbedingung für das Update verwendet.
4. **Abgleichen:** Auf jedem geänderten Pfad werden gelesene Basis, aktueller Bestand und eigener Zielwert verglichen. Fremde disjunkte Änderungen bleiben erhalten. Hat sich ein eigener Pfad widersprüchlich verändert, erfolgt kein Write; der Formularentwurf bleibt erhalten und der Nutzer entscheidet feldbezogen. Identische Zielwerte sind kein widersprüchlicher Konflikt. Container- und Typwechsel werden mitgeprüft; kein Ersatz fremder Geschwister und kein Deep-Merge nach Array-Index.
5. **Write und Readback:** Änderungen werden auf den frischen vollständigen Bestand angewendet und ausschließlich an die ausgewählte Identität/Variante geschrieben. Ein separater nicht gecachter Read liest den tatsächlich geschriebenen Datensatz erneut. Inhalt und Identitätsmetadaten müssen passen. Die Mutationsantwort allein bestätigt den Erfolg nicht. Fremde Änderungen im Readback werden nicht automatisch zurückgeschrieben.

Die Revisionsprüfung erfolgt am gespeicherten Datensatz und schützt gleichermaßen vor Änderungen aus Studio und anderen Mainserver-Schreibpfaden, wenn diese die Revision geändert haben.

## Varianten und unklarer Ausgang

- **Neuanlage:** Zusätzliches Variantenrecht, vollständige gewählte Vorlage frisch lesen, Zielversion und vollständigen bekannten Bestand prüfen, ausdrücklich bestätigen und kopieren. Hat sich die bestätigte Vorlage zwischenzeitlich geändert, Vorschau erneuern. Zielvariante existiert bereits: keine Umdeutung zum Update. Quelle unverändert lassen. Ohne Vorlage keine erfundene leere Erstkonfiguration.
- **Löschung:** Zusätzliches Variantenrecht und dokumentweite Bestätigung mit klarer Version, Name und Wirkung auf andere Pluginbereiche. Der Host löscht exakt die gewählte ID. Danach Abwesenheit über den exakten Lesepfad bzw. bestätigten Variantenbestand nachweisen; eine App-Fallback-Antwort ist kein Löschbeweis. Welche Alternative einzelne App-Versionen anschließend verwenden, folgt dem bestehenden Mainserver-Fallback; kein erfundener Rollback.
- **Timeout/Netzabbruch:** Kein automatischer Mutationsretry. Bestehende Host-Idempotenz-/Reconciliation-Primitiven verwenden, soweit der konkrete Ablauf das erlaubt. Zuerst frisch abgleichen: Update über bekannte ID; Create über eindeutige Zielidentität und vollständigen Bestand; Delete über die ausgewählte ID. Passender Inhalt allein beweist nicht die Urheberschaft eines Create. Bei uneindeutiger Zuordnung bleibt der Ausgang ungeklärt und es erfolgt keine blinde Wiederholung. Kein lokaler Idempotenzdatensatz erzeugt einen upstream nicht vorhandenen Exactly-once-Vertrag.
- **Status:** bestätigt gespeichert / bestätigt gelöscht, Konflikt vor Write, Speicherung erfolgt aber Readback nicht bestätigt, Ausgang ungeklärt. Ein fehlgeschlagener Readback darf nicht als „sicher nicht gespeichert“ erscheinen. Die tatsächlich beobachtete Evidenz bestimmt den Status.

## Rechte und Grenzen

Die Fachplugins deklarieren nur ihre eigenen Pfade und Actions. Namespaces und Überschneidungen werden über bestehende Descriptor-/Registry-Prüfungen validiert. Gemeinsame Container übertragen keine Rechte auf sämtliche Nachfahren. Plugin-Aktivierung ist auch beim direkten API-Aufruf zu prüfen. Das übergreifende Variantenrecht wird durch einen zuständigen Host-Vertrag serverseitig kontrolliert; dessen konkreter Namespace/Owner und initiale Rollenzuweisung sind vor Rechteimplementierung festzulegen. Bestehende Inhaltsrollen erhalten die Rechte nicht automatisch.

Alle Lese-, Schreib- und Readback-Schritte verwenden denselben bestätigten Ziel- und Principal-Kontext. Die Löschung eines pluginübergreifenden Dokuments ist keine normale Feldmutation. Audit beschreibt Aktion, Quelle, Zielvariante, Akteur und Ergebnis ohne vollständige sensible Inhalte. Bestehende CSRF-, Request-/Trace- und Credential-Verträge bleiben führend.

## Nachweise und Umsetzungseintritt

Die folgenden Nachweise werden in bestehenden Vitest-/Integrationstestpfaden ergänzt, nicht in einem neuen Testframework oder CI-Gate:

| Invariante | Geplanter Nachweis |
| --- | --- |
| Ein gemeinsamer Writer | Beide echten Plugin-Verbraucher laufen durch denselben Host-/Adapterpfad; bestehender Waste-Writer wird nicht dupliziert. |
| Fremde Felder bleiben erhalten | Zwei Plugin-Edits derselben Variante, auch überlappend gestartete Studio-Requests; unbekannte verschachtelte Felder, Arrays und fehlend/null/false bleiben unverändert. |
| Sichtbare Konflikte | Widersprüchlicher eigener Pfad oder Containerwechsel zwischen Basis und Fresh Read: kein Write, Entwurf bleibt; externe Änderung nach dem Fresh Read führt beim Schreiben zu einem Revisionskonflikt. |
| Variantenidentität | Versioniert/unversioniert, gleiche Namen in verschiedenen Kommunen, Fallback und leere Fehlerantwort, Namensgroßschreibung, Vorlage kopieren, bestehendes Ziel und gezieltes Delete. |
| Rechte und Principal | Direkter Host-Aufruf mit deaktiviertem Plugin, nur Inhaltsrechten, falschem Feldpfad, fehlendem Variantenrecht, fremdem Tenant oder gewechseltem Kontext wird vor Write abgewiesen. |
| Wahrheitsgemäßer Ausgang | Timeout vor/nach Provider-Write, Create/Delete ohne eindeutige Zuordnung, unabhängiger Readback mit anderem Inhalt/Name/Version sowie fehlender Readback-Zugriff. |
| Bestehende Verbraucher | Gezielte Waste-Adapter-/Sync-Regression; App-/Mainserver-Code unverändert. |

Für geänderte Runtime-Bereiche gelten die bestehenden Pflicht-Gates: früh `pnpm check:server-runtime`, kleinstes echtes Unit-/Type-Gate pro Änderung, Auth-/Datenintegritätsprüfungen nach `DEVELOPMENT_RULES.md` 5.2. Nx-Dateifilter als `--testFiles=...`; breite affected-Läufe nur nach Scope-Messung. UI: bestehende Design-System-Komponenten, deutsche/englische Übersetzungen, Tastatur-/Fokusnachweis und konkrete Clientwirkungsprüfung getrennt vom Provider-Readback. Keine Aussage über Live-Erfolg aus Fixtures.


## Mainserver-Vertrag und erster Studio-Schreibpfad

SVA-1788, SVA-1789 und SVA-1792 liefern den Variantenbestand und den exakten Detailabruf mit Rohtext und Revision. SVA-1787 sichert Inhaltsupdates nach ID ohne Namens- oder Versionsänderung mit `expectedRevision` ab. Der erste Editor wird im vorhandenen App-Arbeitsbereich mit seinen Lese- und Änderungsrechten eingebunden. Die vollständige Dateiliste ist sichtbar, das erste Formular bearbeitet die beiden vereinbarten Felder aus `globalSettings`. Anlegen, Löschen und weitere Fachformulare folgen getrennt.

Studio hält die Liste und geladene Feldprojektionen im geöffneten Arbeitsbereich kontextgebunden bis zu 24 Stunden vor. Neue Änderungen werden beim Speichern direkt abgeglichen. Eine geänderte Revision zeigt Ausgangswerte, eigene Änderungen und aktuelle Werte. Überschneidungen erfordern eine Feldentscheidung. Der Server liest nach dieser Entscheidung erneut, wendet ausschließlich gewählte Änderungen am Rohtext an und bestätigt das Ergebnis separat per ID. Die Mainserver-Revisionsprüfung verhindert zwischenzeitlich veraltete Studio-Writes. Unklare Ergebnisse werden ausdrücklich angezeigt und nicht automatisch wiederholt. Die bestehende Vorschau unter „Schnittstellen“ entfällt.
