## Context

Der SVA Mainserver unterscheidet bei der Provisionierung nicht zwischen persönlichen und organisatorischen Zugängen. Sein bestehender Benutzer-Provisioning-Endpunkt erwartet eine reale Keycloak-ID, erzeugt beziehungsweise verknüpft Benutzer, Membership, DataProvider und OAuth-Application und synchronisiert die erzeugten Credentials nach Keycloak. Schlägt diese Keycloak-Synchronisation fehl, rollt der Mainserver seine Provisioning-Transaktion zurück. Eine synthetische Keycloak-ID kann deshalb nicht verwendet werden.

Studioaccounts werden heute zuerst in Keycloak und anschließend im lokalen IAM-Modell angelegt. Das nachgelagerte Mainserver-Provisioning ist für die Accounterstellung nicht transaktional verpflichtend. Organisationen werden dagegen bislang ausschließlich lokal angelegt; ihre Mainserver-Credentials können später manuell im geschützten Organisationsspeicher gepflegt werden.

Die Benutzerliste wird ohne Rollenfilter primär aus Keycloak gelesen und dort paginiert. Technische Accounts erst nach dem Laden einer UI-Seite auszublenden, würde deshalb Seitengröße und Gesamtzahl verfälschen.

Parallel definiert `use-mainserver-data-provider-as-content-author` die automatische, instanzgebundene Zuordnung einer Mainserver-DataProvider-ID zu einem Account oder einer Organisation. Dieser Change verwendet den Vertrag und führt keine konkurrierende Mapping-Quelle ein.

## Goals / Non-Goals

- Goals:
  - Organisationen über den unveränderten Mainserver-Benutzer-Endpunkt provisionieren.
  - Lokale Organisationserstellung unabhängig von Keycloak- und Mainserver-Verfügbarkeit erfolgreich abschließen.
  - Fehlende Organisationszugänge später idempotent nachprovisionieren.
  - Technische Accounts explizit kennzeichnen, bearbeiten, filtern und vom konfigurierten Inaktivitäts-Lifecycle ausnehmen.
  - Organisations-Credentials und DataProvider-Zuordnung korrekt und secret-minimiert persistieren.
  - Provisioning-Zustand, Konkurrenz, Recovery und Reconciliation dauerhaft und nachvollziehbar modellieren.
  - Bestehende Account-, Credential-, Audit- und Principal-Binding-Verträge wiederverwenden.
- Non-Goals:
  - Änderungen am SVA Mainserver oder ein neuer Mainserver-Endpunkt.
  - Automatische Deaktivierung, Aktivierung, Rollen- oder Gruppenänderung beim Bearbeiten des technischen Flags.
  - Ein technisches Verbot, einen menschlich genutzten Account als technisch zu markieren; die korrekte Klassifikation wird organisatorisch verantwortet.
  - Ausnahme technischer Accounts vom privilegierten Admin-Hard-Delete oder von expliziten normalen Deaktivierungsaktionen.
  - Automatische Mainserver-Provisionierung allein durch manuelles Aktivieren des technischen Flags.
  - Migration bereits manuell gepflegter Organisations-Credentials auf neue Credentials ohne explizite Provisioning-Aktion.

## Decisions

### Das technische Flag ist eine unabhängige administrative Klassifikation

`iam.accounts` erhält `is_technical_account BOOLEAN NOT NULL DEFAULT false`. API- und UI-Verträge exponieren den Wert als `isTechnicalAccount`.

Das Flag ist über den bestehenden berechtigten Account-Update-Pfad beim Erstellen und Bearbeiten eines Accounts änderbar. Es wird keine zusätzliche Berechtigung eingeführt: Die bestehende Autorisierung für Account-Erstellung beziehungsweise Account-Bearbeitung bleibt maßgeblich. Jede Änderung wird mit altem und neuem booleschem Wert auditiert.

Das Setzen oder Entfernen des Flags verändert nicht automatisch:

- den Keycloak-Status oder die Anmeldefähigkeit,
- Kennwörter, Required Actions oder Einladungen,
- Rollen, Gruppen oder Memberships,
- vorhandene Mainserver-Credentials,
- eine vorhandene Zuordnung zwischen Organisation und Provisioning-Account,
- den bereits erreichten Lösch-Lifecycle-Zustand.

Bei einer normalen Account-Erstellung löst das Flag weder zusätzliches Organisations-Provisioning aus noch unterdrückt es das bereits bestehende persönliche Mainserver-Provisioning des normalen Accountpfads. Nur der interne Organisations-Provisioning-Pfad erzeugt einen Account mit dem technischen Zweck `organization_mainserver`.

Die Zuordnung eines Accounts als technische Mainserver-Identität einer Organisation wird deshalb separat im organisationsbezogenen Mainserver-Zustand gespeichert. Ein automatisch erzeugter Organisationsaccount startet mit `isTechnicalAccount = true`; ein späteres Bearbeiten des Flags löst die Zuordnung nicht auf. Ebenso macht das manuelle Setzen des Flags einen beliebigen Account nicht automatisch zum Mainserver-Account einer Organisation.

### Technische Accounts sind standardmäßig aus Accountlisten ausgeschlossen

Der Listenvertrag erhält `includeTechnicalAccounts?: boolean` mit dem serverseitigen Standard `false`. Die UI bietet die lokalisierte Filteroption „Auch technische Accounts anzeigen“ und setzt beim Umschalten die Seite auf 1 zurück.

Der Server klassifiziert und filtert Accounts vor der fachlichen Pagination und berechnet eine zur sichtbaren Treffermenge passende Gesamtzahl. Da Keycloak keine sichere Negation eines optionalen benutzerdefinierten Attributes für Bestandsaccounts garantiert, darf die Implementierung nicht nur eine bereits paginierte Keycloak-Seite nachträglich filtern. Der Tenant-Resolver lädt dafür einmalig nur die technischen Keycloak-Subjects aus dem lokalen IAM, zählt sichtbare Treffer über die erforderlichen Keycloak-Fenster und baut die vollständige lokale Accountprojektion erst für die angeforderte sichtbare Seite auf. So bleiben Such-, Status- und Rollenfilter zusammen mit dem technischen Filter exakt, ohne Rollen- und Aktivitätsaggregationen für die gesamte Keycloak-Treffermenge zu erzeugen. Unmapped Keycloak-Benutzer gelten bis zu einer expliziten lokalen Klassifikation als nicht technisch.

Bei eingeblendeten technischen Accounts zeigt die UI eine lokalisierte Kennzeichnung. Bestehende Accountaktionen bleiben entsprechend der Produktentscheidung verfügbar; allein das Flag erzeugt keine zusätzlichen technischen Sperren.

### Kontolöschungsregeln überspringen die aktuelle technische Klassifikation

Jeder automatische oder manuell angestoßene Lauf des konfigurierten Tenant-Inaktivitäts-Lifecycles prüft `is_technical_account` vor der Zustandsentscheidung. Accounts mit `true` werden weder deaktiviert noch pseudonymisiert noch in den finalen Deleted-Tombstone überführt.

Das Flag stellt keinen bereits eingetretenen Zustand wieder her. Wird ein bereits deaktivierter oder pseudonymisierter Account als technisch markiert, bleibt sein aktueller Zustand bestehen und nur weitere regelbasierte Übergänge werden übersprungen. Wird das Flag entfernt, nimmt der Account ab dem nächsten Lauf wieder nach den vorhandenen Referenzzeiten und Tenantregeln teil; dadurch kann er unmittelbar für den nächsten Übergang qualifizieren.

Der privilegierte Admin-Hard-Delete bleibt ein separater, permission- und Legal-Hold-geschützter Pfad und wird durch diesen Change nicht verändert. Auch explizite normale Account-Deaktivierungen bleiben möglich.

### Organisationserstellung bleibt lokal führend

Die lokale Organisation wird vollständig validiert und committed, bevor eine externe Provisionierung versucht wird. Der Create-Request darf anschließend mit einem zeitlich begrenzten Best-effort-Schritt den Organisationszugang erzeugen. Die erfolgreiche lokale Organisationserstellung wird bei folgenden Ergebnissen nicht zurückgerollt und nicht als fehlgeschlagen dargestellt:

- Mainserver-Integration ist nicht konfiguriert,
- tenantlokale Keycloak-Administration ist nicht verfügbar,
- Token- oder Mainserver-Endpunkt ist nicht erreichbar,
- Mainserver antwortet mit einem technischen oder fachlichen Provisioning-Fehler,
- Persistierung der nachgelagerten externen Daten benötigt Reconciliation.

Die UI bestätigt in diesen Fällen die Organisationserstellung. Fehlende Credentials bleiben als neutraler, später behebbarer Zustand sichtbar; sichere Diagnose- und Auditdaten dürfen einen Retry empfehlen, ohne einen falschen Gesamterfolg für das externe Provisioning zu behaupten.

Ein expliziter Retry über `POST /api/v1/iam/organizations/:organizationId/provision-mainserver` meldet sein eigenes Provisioning-Ergebnis normal, verändert aber bei einem Fehlschlag weder die Organisation noch bereits gültige Credentials.

`iam.org.write` autorisiert sowohl den automatischen Versuch nach Organisationserstellung als auch den expliziten Retry einschließlich der dafür intern notwendigen technischen Accounterstellung. Diese eng begrenzte Systemwirkung ist keine allgemeine Berechtigung zum Erstellen beliebiger Accounts. Requestdaten dürfen deshalb keine Rollen, Gruppen, Einladungseinstellungen oder frei wählbaren Accountattribute für den technischen Account enthalten. Normale Account-Erstellung und spätere Accountbearbeitung bleiben durch ihre bestehenden Account-Permissions geschützt.

Den OAuth-Bootstrap-Token lädt Studio ausschließlich mit den persönlichen Mainserver-Credentials des handelnden Administrators. Dabei wird der aktive Organisationskontext nicht in die effektive Credential-Auflösung einbezogen. Fehlende persönliche Credentials führen beim automatischen Versuch zu einem sicheren Skip bei weiterhin erfolgreicher Organisationserstellung und beim expliziten Retry zu einem deterministischen Fehler. Ein Fallback auf Credentials der Zielorganisation, der aktiven Organisation oder einer anderen Organisation ist ausgeschlossen.

### Der Organisationsaccount und das Provisioning sind lease-geschützt und idempotent

Vor jedem automatischen oder expliziten Provisioning reserviert Studio den organisationsbezogenen Zustand atomar unter `(instanceId, organizationId)` mit Operationsreferenz und zeitlich begrenzter Lease. Nur der Lease-Inhaber darf einen Account erzeugen, den Upstream aufrufen oder nach dessen Antwort Credentials und laufende Zustandsübergänge persistieren. Credential-Schreibzugriffe prüfen Operationsreferenz, Zustand und nicht abgelaufene Lease gemeinsam in demselben Datenbankstatement. Bis zum terminalen Zustandsübergang bleibt der persistierte Zustand `provisioning`; fachliche Zwischenstände werden über die Phase ausgedrückt. Parallele Requests beobachten den laufenden beziehungsweise bereits abgeschlossenen Zustand, statt unabhängig externe Identitäten zu erzeugen. Eine abgelaufene Lease darf übernommen werden, ohne eine bereits persistierte Account-Zuordnung oder Credentials zu ersetzen. Der frühere Lauf darf nach der Übernahme weder Credentials schreiben noch Erfolg melden.

Auch die manuelle Credential-Pflege respektiert diesen Vertrag: Während einer aktiven Lease werden tatsächliche Credential-Änderungen mit einem Konflikt abgewiesen. Wiederholt ein gewöhnliches Organisations-Update lediglich die unveränderte Application-ID und liefert kein neues Secret, bleibt die Persistenz vollständig unangetastet; insbesondere werden `ready`, Verifikationszeitpunkt und Bindung nicht auf `verification_required` zurückgesetzt. Eine zulässige tatsächliche Credential-Änderung außerhalb einer aktiven Lease verwirft dagegen die veraltete Operations- und Verifikationsevidenz und setzt den fachlich passenden Prüfzustand.

Existiert eine gültige Zuordnung, wird derselbe Keycloak-Subject wiederverwendet. Andernfalls erzeugt Studio genau einen Account und persistiert lokalen Account und Organisationszuordnung gemeinsam. Der Keycloak-Account erhält die stabilen Attribute `instanceId`, `organizationId` und `accountPurpose = organization_mainserver`. Nach einem Prozessabbruch darf ein Retry nur einen eindeutigen Account übernehmen, dessen deterministische Identität und sämtliche technischen Attribute zur Instanz und Organisation passen.

Der erzeugte Account:

- wird in Keycloak und `iam.accounts` über die bestehenden Account-Pfade angelegt,
- erhält initial `isTechnicalAccount = true`,
- erhält keine Rollen oder Gruppen allein aufgrund des Organisations-Provisionings,
- löst keine Passwort-Setup-E-Mail aus,
- übernimmt keine implizite Änderung seines Aktiv-/Inaktivstatus aus dem technischen Flag.

Kann Studio vor dem Absenden des Mainserver-Requests sicher beweisen, dass ein von derselben Operation erzeugter Account keine gültige Zuordnung gewonnen hat, darf es diesen Verlierer deaktivieren. Sobald der Mainserver-Request abgesendet wurde oder ein Lost Response möglich ist, findet keine automatische Accountkompensation mehr statt. Der Account samt Zuordnung bleibt erhalten und der Vorgang wechselt bei unklarer Folgearbeit zu `reconciliation_required`.

### Fehlende Benutzerdaten werden deterministisch abgeleitet

Für den unveränderten Mainserver-Benutzer-Endpunkt erzeugt Studio aus den zum ersten Provisioning-Zeitpunkt vorliegenden Werten:

| Feld                          | Ableitung                                                       |
| ----------------------------- | --------------------------------------------------------------- |
| `keycloak_id`                 | Subject des zugeordneten realen Keycloak-Accounts               |
| `email` und Keycloak-Username | normalisierte Form `<org-name>.<tenant-name>@smart-village.app` |
| `first_name`                  | Anzeigename der Organisation                                    |
| `last_name`                   | Anzeigename des Tenants                                         |

Die E-Mail-Normalisierung ist deterministisch, ASCII-sicher und längenbegrenzt. Bei einer Kollision wird vor `@smart-village.app` ein kurzer stabiler Anteil der Organisations-ID ergänzt. Die tatsächlich erzeugte E-Mail wird über den zugeordneten Account persistiert und nach späteren Namensänderungen nicht stillschweigend neu abgeleitet.

### Mainserver-Antwort wird vollständig für die Organisation ausgewertet

Studio verwendet denselben konfigurierten Provisioning-Endpunkt, persönlichen Bearer-Token-Flow, Timeout- und Fehlervertrag wie beim persönlichen Account. Die Antwortvalidierung wird so erweitert, dass sie neben den Keycloak-Credential-Attributen auch die zurückgegebene `data_provider_id` typisiert verarbeitet. Der SVA-Mainserver-API-Vertrag garantiert, dass diese ID mit der später über dieselben neuen Organisations-Credentials aus `/data_provider.json` gelesenen `data_provider.id` identisch ist.

Nach einem bestätigten Erfolg:

1. bleiben die vom Mainserver erzwungenen Credential-Attribute am zugeordneten Keycloak-Account bestehen;
2. speichert Studio Application-ID und Secret zusätzlich im bestehenden geschützten Organisations-Credential-Speicher, weil dieser die Laufzeitquelle für organisatorische Mainserver-Aufrufe ist;
3. wird das Secret ausschließlich verschlüsselt und nie über Read-Models ausgegeben;
4. begründet die normalisierte `data_provider_id` aus der erfolgreichen Provisioning-Antwort die credential-versionierte Erstbindung der Organisation gemäß `use-mainserver-data-provider-as-content-author`;
5. werden Credential- und Binding-Persistenz unter einer Operationsreferenz korreliert.

Spätere Verifikation und Credential-Rotation verwenden `/data_provider.json`. Weicht dessen ID entgegen dem garantierten Vertrag von der Provisioning-Antwort oder einer bestehenden Bindung ab, überschreibt Studio keine Bindung und setzt `reconciliation_required` beziehungsweise einen Binding-Konflikt. Ist der Upstream-Erfolg bestätigt, aber eine lokale Folgepersistenz schlägt fehl, wird der Mainserver-Erfolg nicht rückwirkend als Providerfehler dargestellt.

### Der Organisations-Credential-Speicher ist die kanonische Zustandsquelle

`iam.organization_mainserver_credentials` wird neben Credentials und Accountreferenz um den persistenten Provisioning-Zustand erweitert. Die normative Zustandsmenge lautet:

- `not_provisioned`: kein vollständiger Zugang vorhanden;
- `account_ready`: technischer Account ist eindeutig zugeordnet, Upstream-Provisioning steht aus;
- `provisioning`: eine Lease-geschützte Operation läuft;
- `verification_required`: Credentials sind vorhanden, ihre DataProvider-Bindung ist aber noch nicht bestätigt;
- `ready`: vollständige Credentials und konfliktfreie aktuelle DataProvider-Bindung liegen vor;
- `failed`: der Versuch ist nachweislich fehlgeschlagen und sicher wiederholbar;
- `reconciliation_required`: Upstream-Erfolg, Lost Response oder lokale Teilpersistenz erfordern gezielte Folgearbeit.

Der aktuelle Zustand speichert mindestens zugeordneten Account, Operationsreferenz, Phase, Versuchszähler, Lease-Ablauf, sicheren letzten Fehlercode sowie Zeitpunkte für Versuch, Abschluss und letzte erfolgreiche Verifikation. Geheimnisse sind kein Bestandteil des Status-Read-Models. Fehlende Integration wird aus der aktuellen Konfiguration abgeleitet und nicht als möglicherweise veraltender Dauerzustand persistiert.

Ein Retry versucht in `verification_required` und `reconciliation_required` zuerst, vorhandene Credentials, Accountzuordnung und Binding zu vervollständigen. Er provisioniert oder rotiert nicht blind neu. Bestehende manuell gepflegte vollständige Credentials starten als `verification_required` und werden ohne explizite Provisioning-Aktion nicht ersetzt. Audit dokumentiert Übergänge, ist aber nicht die Quelle des aktuellen Zustands.

Sind vorhandene Organisations-Credentials erfolgreich verifiziert und ist ein technischer Account zugeordnet oder eindeutig wiederherstellbar, synchronisiert der Retry diese Credentials vor dem Übergang zu `ready` erneut in dessen Keycloak-Attribute. So vervollständigt Reconciliation auch einen früher zwischen Organisationspersistenz und Keycloak-Persistenz abgebrochenen Lauf. Ein Fehler dieser Synchronisation bleibt `reconciliation_required` und darf keinen falschen `ready`-Zustand erzeugen.

### Hard Delete löst die technische Accountzuordnung

Die instanzsichere Accountreferenz verwendet `ON DELETE SET NULL`. Der privilegierte Admin-Hard-Delete bleibt zulässig, wird während einer aktiven Provisioning-Lease aber mit einem sicheren Konflikt abgewiesen. Vollständige Organisations-Credentials und die organisationsbezogene DataProvider-Bindung bleiben erhalten, weil sie fachlich der Organisation gehören.

Der finale Hard-Delete sperrt alle organisationsbezogenen Credential-Zeilen des technischen Accounts beim Lease-Check und hält diese Sperre in derselben Transaktion über Session-Revoke, externen Identity-Delete und lokalen Delete. Dadurch kann zwischen Vorprüfung und Löschung keine neue Lease für diesen Account erworben werden.

Eine Organisation mit vollständigen Credentials und konfliktfreier Bindung bleibt auch ohne aktuell zugeordneten Provisioning-Account `ready`. Ein späterer expliziter Provisioning- oder Rotationsversuch darf bei Bedarf einen neuen technischen Account erzeugen. Eine abweichende DataProvider-ID überschreibt die bestehende Bindung nicht. Bei unvollständigen Zuständen löst der Hard Delete die Referenz, erhält vorhandene Credentials und markiert notwendige Folgearbeit nachvollziehbar.

### Audit und Diagnose bleiben secret- und PII-minimiert

Audit und strukturierte Logs erfassen mindestens Instanz, Organisation, technische Account-ID beziehungsweise Keycloak-Subject als technische Referenz, Auslöser (`organization_create` oder expliziter Retry), Operationsreferenz, Ergebnisphase und sicheren Fehlercode. Änderungen des Flags erfassen Actor, Zielaccount sowie alten und neuen booleschen Wert.

Secrets, Tokens, abgeleitete Klartext-Credentials und rohe Mainserver-Antworten werden weder geloggt noch auditiert. Die synthetische E-Mail wird nur dort verarbeitet, wo der Identitäts- und Provisioning-Vertrag sie benötigt.

## Alternatives considered

- SVA Mainserver um einen Organisations-Endpunkt erweitern: verworfen, weil der Mainserver unverändert bleiben soll.
- Synthetische Keycloak-ID ohne realen Benutzer senden: verworfen, weil der Mainserver Credentials nach Keycloak synchronisiert und bei einem Fehler seine Transaktion zurückrollt.
- Technisches Flag als nicht editierbaren Accounttyp modellieren: verworfen, weil Administratoren die Klassifikation bewusst ohne technische Hürde korrigieren können sollen.
- Beim Setzen des Flags Login sperren oder Rollen entfernen: verworfen, weil das Flag gemäß Produktentscheidung keine automatischen Nebenwirkungen haben soll.
- Technische Accounts nur clientseitig ausblenden: verworfen, weil Keycloak-Pagination und Gesamtzahl dadurch falsch würden.
- Organisationserstellung mit externer Provisionierung transaktional koppeln: verworfen, weil Studio ohne SVA Mainserver betrieben werden können muss.
- Bei externem Fehler den bereits erzeugten Account löschen: verworfen wegen Lost-Response-Risiko und fehlender atomarer Transaktion über Studio, Keycloak und Mainserver.

## Risks / Trade-offs

- Ein Administrator kann einen menschlich genutzten Account als technisch markieren und damit von den Kontolöschungsregeln ausnehmen. Diese bewusste Produktentscheidung wird durch sichtbare Beschriftung, Erklärung und Audit unterstützt, aber nicht technisch verhindert.
- Das Entfernen des Flags kann beim nächsten Lifecycle-Lauf unmittelbar einen Übergang auslösen, wenn die bestehenden Referenzzeiten einen Schwellwert bereits überschreiten. Die UI weist darauf hin.
- Die exakte Filterung vor Pagination kann zusätzliche Keycloak-Fenster benötigen. Tests und Metriken müssen sicherstellen, dass die Accountliste bei größeren Tenants korrekt und betrieblich vertretbar bleibt.
- Ein Mainserver-Ausfall nach Keycloak-Erstellung hinterlässt absichtlich einen technischen Account ohne Organisations-Credentials. Der Retry- und Diagnosepfad muss diesen Zustand eindeutig wiederverwenden.
- Persönliche Mainserver-Credentials des handelnden Administrators sind eine bewusste Voraussetzung des externen Bootstrap-Schritts. Ihr Fehlen beeinträchtigt nicht den lokalen Organisationserfolg, verhindert aber den jeweiligen Provisioning-Versuch.
- Die Mainserver-Credentials liegen aufgrund des unveränderten Upstream-Vertrags sowohl als Keycloak-Attribute als auch verschlüsselt im Organisationsspeicher. Nur der Organisationsspeicher ist die Studio-Laufzeitquelle; Logs und Read-Models dürfen keine Secrets exponieren.
- Namensnormalisierung kann Kollisionen erzeugen. Der stabile Organisations-ID-Suffix verhindert eine unkontrollierte Auswahl eines fremden Accounts.
- Dieser Change und `use-mainserver-data-provider-as-content-author` berühren organisationsbezogene Bindungen. Implementierung und Migration müssen dieselbe Binding-Tabelle und Konfliktsemantik verwenden.
- Prozessabbrüche zwischen Keycloak-Erstellung und lokaler Zuordnung können externe Zwischenzustände hinterlassen. Stabile Keycloak-Attribute, Lease-Recovery und eindeutige Übernahmebedingungen begrenzen dieses Risiko.

## Migration Plan

1. `iam.accounts.is_technical_account` mit `NOT NULL DEFAULT false` ergänzen; alle Bestandsaccounts bleiben nicht technisch.
2. Den bestehenden organisationsbezogenen Mainserver-Zustand um eine nullable, instanzgebundene Account-Referenz mit `ON DELETE SET NULL`, Zustandsautomat, Operationsreferenz, Lease und sichere Diagnosefelder ergänzen, ohne vorhandene Credentials zu verändern.
3. API- und Read-Models additiv um `isTechnicalAccount` und `includeTechnicalAccounts` erweitern.
4. Lifecycle-Resolver vor dem ersten produktiven Markieren technischer Accounts um den Ausschluss erweitern.
5. Organisationserstellung und expliziten Retry mit persönlichem Bootstrap-Principal, Lease und idempotenter Account-Zuordnung aktivieren.
6. Bestehende Organisationen ohne Zugang werden nicht automatisch massenprovisioniert; Administratoren verwenden den expliziten Retry.
7. Schema-Snapshot, Schema-Dokumentation, arc42-Abschnitte 03, 05, 06 und 08 sowie eine neue IAM-ADR aktualisieren und in Abschnitt 09 verlinken.
