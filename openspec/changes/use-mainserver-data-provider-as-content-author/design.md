## Context

Persönliche und organisatorische Mainserver-Credentials erzeugen jeweils einen OAuth-Token. Der authentifizierte Identity-Endpunkt `/data_provider.json` liefert inzwischen eine stabile DataProvider-ID. Zusätzlich garantiert der Mainserver-Benutzer-Provisioning-Vertrag für neu erzeugte Organisations-Credentials eine `data_provider_id`, die mit der späteren Identity-Antwort derselben Credentials identisch ist. Beim Content-Create setzt der Mainserver denselben an das Credential gebundenen DataProvider am neuen Content.

Studio muss während dieser Übergangszeit arbeitsfähig bleiben. Die bewusste Produktentscheidung lautet: Solange die für einen Scope erforderlichen Bindungen noch nicht automatisch und konfliktfrei entstanden sind, dürfen alle Inhalte bearbeitet und gelöscht werden, die mit den für die konkrete Aktion verwendeten Credentials unmittelbar verfügbar sind. Dies ist keine instanzweite Freigabe und ersetzt weder die Studio-Action-Permission noch die Mainserver-Autorisierung.

Das Studio führt folgende getrennte Identitäten:

| Begriff               | Bedeutung                                                                   | Autoritative Quelle                       |
| --------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| `actorAccountId`      | tatsächlich handelnde Person                                                | authentifizierte Studio-Session und Audit |
| `actingPrincipalType` | Account oder aktive Organisation, in deren Namen die Mutation läuft         | serverseitig validierter Transportvertrag |
| `credentialSource`    | tatsächlich verwendeter persönlicher oder organisatorischer Credential-Satz | serverseitige Credential-Auflösung        |
| `dataProvider`        | unveränderlicher ursprünglicher Inhaber und sichtbarer Autor des Contents   | typisierter Mainserver-Content-Vertrag    |
| IAM-Owner-Projektion  | rekonstruierbare Abbildung eines konfliktfrei gebundenen DataProviders      | automatisches Principal-Mapping           |

## Goals / Non-Goals

- Goals:
  - Mainserver-`dataProvider` als unveränderliche ursprüngliche Inhaber- und Autorenidentität verwenden.
  - Principal-Bindungen ohne manuelle Zuordnung aus stabiler Identity-ID oder der eng begrenzten garantierten Organisations-Provisioning-Evidenz erzeugen und durch spätere Beobachtungen bestätigen.
  - Fehlende oder konfliktbehaftete aktuelle Bindungen im automatischen Resolver fail-closed behandeln.
  - Credential-sichtbare Kompatibilität ausschließlich als beobachtenden Rollout- und Rollbackpfad erhalten.
  - `own`, `organization` und `all` nach automatischem Mapping deterministisch auswerten.
  - Persönlichen oder organisatorischen Mutationsprincipal explizit und ohne stillen Credential-Fallback bestimmen.
  - Actor, Mutationsprincipal, Credential-Quelle und Content-Inhaber auditierbar auseinanderhalten.
  - Hard Delete mit Preimage-Nachweis und Tombstone nachvollziehbar machen.
- Non-Goals:
  - Namensbasierte oder manuelle Principal-zu-DataProvider-Zuordnungen.
  - Instanzweite Sichtbarkeit von Content, den das verwendete Mainserver-Credential nicht lesen kann.
  - Nachträgliche Rekonstruktion direkter Mainserver-Änderungen in der Studio-History.
  - Änderung des DataProviders oder Inhabertransfer durch normale Content-Updates.
  - Freie Auswahl beliebiger Personen, Organisationen oder DataProvider durch den Client.
  - Gleichsetzung des freien GraphQL-Felds `author` mit dem Mainserver-Inhaber.

## Decisions

### Mainserver-Vertrag wird vor Enforcement typenweise bestätigt

Die Annahmen zu Create-Zuordnung, Cross-Principal-Write, DataProvider-Immutabilität, Credential-Sichtbarkeit und Mutation-Responses sind externe Voraussetzungen. Eine verbindliche Matrix pro Content-Typ und fachlicher Aktion macht die vorhandene Evidenz und bewusst akzeptierte Abweichungen sichtbar. Development, Staging und `surveys.create` bleiben aufgrund der ausdrücklichen Produktentscheidung aktiv, obwohl einzelne reale Nachweise nachgeholt werden.

Die Matrix hält mindestens fest:

- fully-qualified Studio-Action;
- eingesetzte Mainserver-Query oder -Mutation;
- erforderlicher Pre-Read;
- DataProvider in Read- und Mutation-Response;
- atomare, mehrstufige, Soft- oder Hard-Delete-Semantik;
- Cross-Principal-Lese- und Schreibverhalten;
- Idempotenz, Retry und mögliche Duplikate;
- mögliche Postcondition und Reconciliation.

News, Events, POI, Generic Items, FAQ, Cockpit Cards, Projects und Surveys werden nur für bestätigte Aktionen aktiviert. Insbesondere darf eine typenbezogene Abweichung nicht hinter der pauschalen Aufzählung Create, Update, Publish, Archive, Restore und Delete verschwinden.

### Vertraglich bestätigte Evidenz erzeugt die automatische Principal-Bindung

Vor jeder normalen Content-Mutation benötigt die aktuelle Credential-Version eine verifizierte Identity-Bindung:

1. Studio validiert Actor, aktive Organisation, Action-Permission, Principal-Policy und Credential-Verfügbarkeit.
2. Studio bindet einen `MutationPrincipalContext` einschließlich Credential-Fingerprint.
3. Studio verwendet denselben Bearer Token für `/data_provider.json` und verlangt eine nicht leere String- oder Ganzzahl-ID.
4. Die Identity-Beobachtung erzeugt oder bestätigt die instanzgebundene Principal-Bindung.
5. Eine abweichende Provider-ID oder ein konkurrierender Principal-Claim erzeugt `conflict` und überschreibt keine bestehende Bindung.
6. Erst danach darf der Provider-Write beginnen.
7. Create-Response oder Same-Credential-Re-Read müssen denselben DataProvider bestätigen. Ein abweichender bestätigter Upstream-Erfolg bleibt Erfolg, markiert lokale Folgearbeit aber als `reconciliation_required`.

Eine eng begrenzte Ausnahme gilt für die erstmalige Erzeugung von Organisations-Credentials durch den Mainserver-Benutzer-Provisioning-Endpunkt: Dessen API-Vertrag garantiert, dass die zurückgegebene `data_provider_id` mit `/data_provider.json` unter genau diesen neuen Credentials identisch ist. Studio darf diese Provisioning-Antwort deshalb als `create_response`-Evidenz für die credential-versionierte Organisations-Erstbindung verwenden. Normale Content-Create-Antworten erhalten dadurch keine zusätzliche Autorität.

Listen, Details, Updates, Statusänderungen, Deletes, Namen, Client-Werte und administrative Eingaben dürfen kein neues Mapping begründen. Ein Update-Resultat beschreibt den Inhaber des bestehenden Contents und ist daher kein Nachweis für den handelnden Principal.

Eine Bindung ist mindestens nach Instanz, Principal-Typ, Principal-ID, DataProvider-ID und Credential-Fingerprint versioniert. Credential-Rotation macht die historische Bindung für die neue Credential-Version unbrauchbar, bis der Identity-Endpunkt diese Version bestätigt. Historische Bindungen bleiben für Audit und bestehende Inhalte erhalten.

### Identity-Endpunkt ist der reguläre Credential- und Rotationsnachweis

Der Identity-Aufruf verwendet denselben Bearer Token wie GraphQL. Studio verarbeitet den tatsächlichen HTTP-Status und ausschließlich den JSON-Body.

Der bestätigte Body enthält sinngemäß:

```json
{
  "data_provider": {
    "id": 832,
    "name": "Anzeigename",
    "description": "",
    "notice": "",
    "logo": {},
    "address": {},
    "contact": {}
  }
}
```

Eine erfolgreiche Antwort ohne nicht leere ID ist eine ungültige Vertragsantwort. Kontakt, Adresse, Beschreibung, Notice, Logo und Rohantwort werden nicht persistiert oder protokolliert.

Studio normalisiert `data_provider.id` aus einer nicht leeren String- oder Ganzzahl-ID. Eine gleiche ID bestätigt auch eine aus der garantierten Organisations-Provisioning-Antwort entstandene Erstbindung. Eine abweichende ID erzeugt `conflict` und `reconciliation_required`. Der Identity-Endpunkt überschreibt weder historische Bindungen noch schaltet er einen konfliktbehafteten Scope stillschweigend um.

Eine bereits verifizierte Bindung darf nur für exakt denselben aktuellen Credential-Fingerprint weiterverwendet werden. Fehlt sie und liegt keine zulässige garantierte Organisations-Provisioning-Evidenz vor, blockieren technische oder strukturelle Identity-Fehler die Mutation vor dem Provider-Write. Credential-Rotation benötigt immer einen neuen Identity-Nachweis. Ein normaler Same-Credential-Content-Read ersetzt den Identitätsnachweis nicht.

### Credential-visible Compatibility ist der definierte Übergangsvertrag

`credential_visible_compatibility` wird nur im expliziten Resolvermodus `shadow` oder `compatibility` erzwungen. Im Modus `automatic` führt eine fehlende oder konfliktbehaftete erforderliche Bindung zu einer exakten Ablehnung. Ist die Bindungsauflösung wegen eines Datenbank- oder Identity-Provider-Ausfalls nicht entscheidbar, bleibt der zugrunde liegende Fehler als wiederholbarer `503` erhalten; er wird nicht in eine fachliche `403`-Ablehnung umgedeutet.

In diesem Modus:

- `own` und `organization` werden für Mainserver-Inhalte nicht gegen lokale, synthetische oder vermutete Owner-Felder eingeschränkt;
- jede bestehende Content-Mutation benötigt einen frischen erfolgreichen Pre-Read mit exakt demselben `MutationPrincipalContext` wie der Write;
- nur vom Mainserver mit diesem Credential tatsächlich lesbare und mutierbare Inhalte sind verfügbar;
- ein Projection- oder Cache-Treffer allein autorisiert keine Mutation;
- `404`, `401` oder `403` beim Pre-Read beziehungsweise Write bleiben fail-closed;
- die passende fully-qualified Action-Permission bleibt für Update, Publish, Archive, Restore und Hard Delete jeweils separat erforderlich;
- aktive Organisation, Membership, Principal-Policy, Instanzgrenze und Credential-Verfügbarkeit bleiben unverändert wirksam;
- Mainserver-Autorisierung bleibt die nachgelagerte Obergrenze.

Für Listen und Details ist der verwendete Credential-Kontext sichtbar isoliert. Bei Bestandsmutationen legt die Ownership-Bindung den Principal fest; der Same-Credential-Pre-Read bestätigt dessen aktuelle Verfügbarkeit. Sichtbarkeit unter Organisations-Credentials beweist keine Verfügbarkeit unter persönlichen Credentials und umgekehrt.

Der Modus wird strukturiert auditiert und metrisch gezählt. Er ist ein bewusster fachlicher Kompatibilitätsvertrag, kein technischer Fehlerzustand. Normale Editoren benötigen deshalb keine Warnung; Administration und Diagnose zeigen Bindungs-, Konflikt- und Moduszustände.

### Exakte Scope-Auswertung wird automatisch readiness-gesteuert

Die Readiness wird pro aktuellem Scope- und Ownership-Kontext bestimmt:

- `own` ist exakt, wenn der persönliche Principal für seine aktuelle Credential-Version konfliktfrei gebunden ist.
- Eine einzelne persönliche oder organisatorische Bestandsmutation ist exakt, wenn der zum Content-DataProvider gehörende Ownership-Principal für seine aktuelle Credential-Version konfliktfrei gebunden ist.
- Die vollständige Collection-Sicht für `organization` ist exakt, wenn die laut realer Contract-Matrix erforderlichen persönlichen und organisatorischen Credential-Sichten verfügbar und ihre Principals konfliktfrei gebunden sind.
- Ohne aktive Organisation fällt `organization` auf `own` zurück.
- `all` benötigt keine Principal-Bindung; es erlaubt alle Inhalte, die im verwendeten Mainserver-Read-Kontext verfügbar sind.
- Andere Memberships und frühere Organisationskontexte erweitern keinen Scope.

Sobald die erforderlichen Bindungen automatisch vollständig und konfliktfrei sind, ist der betreffende Scope exakt auswertbar. Der Wechsel wird auditiert. Bei Rotation, Konflikt oder Verlust der aktuellen Evidenz lehnt `automatic` fail-closed ab; nur die expliziten Rolloutmodi erzwingen weiterhin `credential_visible_compatibility`. Historische Bindungen werden nicht gelöscht.

In der exakten Auswertung gilt:

- `own` erlaubt den persönlichen DataProvider des aktuellen Accounts.
- `organization` erlaubt den persönlichen DataProvider oder den DataProvider der aktiven Organisation.
- `all` bleibt durch Mainserver-Sichtbarkeit und Instanzgrenze begrenzt.
- unbekannte externe DataProvider matchen `own` und `organization` nicht.

Lokale `ownerUserId`- und `ownerOrganizationId`-Werte dürfen aus konfliktfreien Bindungen als rekonstruierbare Projektion entstehen. Im Kompatibilitätsmodus werden keine erfundenen Owner persistiert.

### Content-Autorisierung und Mutationsprincipal sind getrennte Gates

Vor einer bestehenden Content-Mutation prüft der Server:

1. Die zum Content-DataProvider gehörende Ownership-Bindung, aktive Organisation, Membership, Ressourcen-Capability und Credential-Verfügbarkeit.
2. Einen frischen Read des adressierten Contents mit dem gebundenen Write-Credential.
3. Die fully-qualified Action.
4. Im automatischen Resolver die exakte DataProvider-Scope-Regel; im expliziten Shadow- oder Rollbackmodus die credential-sichtbare Vergleichsentscheidung.
5. Den Mainserver-Write mit demselben Credential-Kontext.

Eine andere Credential-Quelle erweitert niemals die credential-sichtbare Menge. Der Client übermittelt ausschließlich `actingPrincipalType: 'organization' | 'user'`. Account-, Organisations-, DataProvider- oder Credential-Werte aus dem Client bestimmen keine Autorisierung.

Für Create existiert noch kein Content-DataProvider. Deshalb gelten vor dem Upstream-Aufruf:

- `own` erlaubt Create ausschließlich als `user`.
- `organization` erlaubt Create als `user` oder als aktive Organisation.
- `all` erlaubt beide Principals, aber keinen beliebigen fremden Principal.
- Die Principal-Policy kann diese Menge weiter einschränken.
- Der Identity-Endpunkt muss die aktuelle Credential-Version vorab binden; der anschließend bestätigte Content-DataProvider bestätigt ausschließlich deren Konsistenz.

### MutationPrincipalContext bleibt über die gesamte Operation stabil

Der gemeinsame Kontext enthält mindestens Instanz, Actor, aktive Organisation, Principal-Typ, Credential-Quelle und Credential-Fingerprint. Er wird für Pre-Read, Read-Merge-Write, Provider-Mutation, Visibility- oder Status-Zweitschritt, Post-Read, DataProvider-Prüfung, Projection-Refresh, Audit und Reconciliation verwendet.

Credential- und Token-Caches enthalten denselben Principal-Kontext beziehungsweise eine gleichwertige Credential-Signatur. Ein Wechsel der aktiven Organisation oder Credential-Version darf keinen alten Cache-Eintrag weiter autorisieren. Jeder V2-Request zum Ändern oder Löschen trägt einen nicht autorisierenden Kontext-Bindungswert aus einem aktuellen Detail-Read; fehlt er oder stimmt er beim Save nicht mehr mit der aktuellen Session überein, wird die Mutation vor dem Provider-Write abgewiesen. Legacy-Requests ohne Vertragsversion bleiben ausschließlich während des konfigurierten Übergangs kompatibel.

- Create unter `org_only`: nur `organization` ist bei aktiver Organisation zulässig.
- Create unter `org_or_personal`: `organization` und `user` sind bei aktiver Organisation zulässig.
- Create ohne aktiven Organisationskontext: nur `user` ist zulässig.
- Bestandsmutation: Der gebundene Ownership-Principal ist maßgeblich; die Create-Policy überträgt oder sperrt den Inhalt nicht.
- fehlende Credentials erzeugen einen spezifischen Fehler; es gibt keinen stillen Fallback.

### Read-Sicht folgt dem IAM-Scope und nicht der Autorenrichtlinie

`contentAuthorPolicy` bestimmt, in wessen Eigentum ein neuer Inhalt entstehen darf. Die
Richtlinie bestimmt nicht, welche bestehenden Inhalte ein Mitglied lesen darf. Mit einer
`organization`-gescopten Read-Permission umfasst die autorisierte Sicht im aktiven
Organisationskontext deshalb die persönlichen Inhalte des aktuellen Accounts und die
Inhalte der aktiven Organisation. Das gilt für `org_only` und `org_or_personal`
gleichermaßen. Ohne aktive Organisation fällt diese Sicht auf `own` zurück.

Persönliche Inhalte anderer Organisationsmitglieder gehören nicht zu dieser Menge. Auch
eine Organisationsadministration erhält durch ihre administrative Rolle keinen
impliziten Zugriff darauf; ein solcher Zugriff benötigt eine ausdrücklich vergebene
`all`- oder Moderationsberechtigung. Andere Memberships und deren Inhalte bleiben vom
aktiven Organisationskontext ausgeschlossen.

Welche Mainserver-Credential-Sichten für diese fachliche Ergebnismenge abgefragt werden
müssen, ist durch reale Contract-Tests zu belegen. Liefert eine einzelne Credential-Sicht
die vollständige autorisierte Menge, darf Studio sie ohne künstlichen zweiten Abruf
verwenden. Sind persönliche und organisatorische Sicht getrennt, muss Studio beide
Credential-Scopes unabhängig synchronisieren und vor globaler Sortierung und Pagination
anhand der stabilen Mainserver-Identität vereinigen. Cache, Sync-State, Snapshot und
Projection bleiben dann je tatsächlichem Credential-Scope isoliert.

Scheitert bei einer erforderlichen Mehrquellen-Sicht genau ein Scope, bleibt dessen
letzter erfolgreicher Snapshot erhalten, sofern Membership, aktive Organisation und
Credential-Version weiterhin zum aktuellen Kontext passen. Unabhängig davon, ob ein alter
Snapshot existiert, muss die Liste einen sichtbaren Hinweis anzeigen und Ergebnis sowie
Gesamtzahl ausdrücklich als unvollständig kennzeichnen. Die UI darf aus einer Read-Sicht keine
Mutationsberechtigung oder einen Credential-Fallback ableiten.

Bei bestehenden eigenen oder organisatorischen Inhalten bestimmt die konfliktfreie
DataProvider-Bindung den erforderlichen Mutationsprincipal. Der Benutzer wählt ihn nicht
frei um. Die host-eigene Editor-Grenze lädt dazu die IAM-Projektion der konkreten Ressource
anhand ihrer Content-ID und reicht deren `credentialSource` als festen, nur lesbaren
Principal an alle Bestandseditoren weiter. Fehlt die Ressource, ihre Credential-Quelle,
eine eindeutige Bindung oder serverautoritativ gelieferte Ressourcen-Capability, wird die
Aktion blockiert. Eine ausdrücklich berechtigte
`all`-/Moderationsaktion bleibt ein separater Ressourcenvertrag. Auch dabei existiert kein
dritter Admin-Principal: Die Mutation verwendet entweder `organization` für die aktive
Organisation oder `user` für den persönlichen Account des Administrators. Die konkrete
Ressourcen-Capability bestimmt, welcher dieser beiden Kontexte zulässig ist; der
Same-Credential-Pre-Read validiert die konkrete Mutation erneut.

### Gelöschte Benutzer begründen keinen fortbestehenden Principal

Wird ein Account gelöscht, darf seine frühere Bindung nicht mehr als aktiver Principal oder
als Scope-Readiness verwendet werden. Die konfigurierte Content-Löschregel entscheidet, ob
zugehörige Inhalte ebenfalls gelöscht oder weitergeführt werden. Bei weitergeführten Inhalten
ist die lokale Benutzerzuordnung `NULL` oder wird in der Anzeige neutral als „Gelöschter
Benutzer“ dargestellt. Auditdaten folgen dem bestehenden Pseudonymisierungs- und
Retention-Vertrag. Es findet keine automatische Übertragung auf einen anderen Account oder
eine Organisation statt.

Diese Trennung ersetzt die Read- und Fallback-Semantik aus ADR-045 grundlegend. Vor der
Implementierung muss deshalb eine neue ADR ADR-045 supersedieren. Sie übernimmt die dort
weiterhin gültigen Entscheidungen zu Credential-Speicher, aktivem Organisationskontext,
Secret-Grenzen und Cache-Isolation, ersetzt aber die globale Policy-Auflösung durch die
hier definierte Trennung aus Create-Policy, IAM-Read-Scope und ressourcenbezogener
Bestandsmutation.

### Hard Delete verwendet Preimage und Tombstone

Hard Delete ist im Kompatibilitätsmodus zulässig, wenn der Benutzer die separate Delete-Action besitzt, der verpflichtende Same-Credential-Pre-Read erfolgreich ist und der Mainserver den Delete akzeptiert.

Vor dem Delete persistiert Studio mindestens Operationsreferenz, Actor, Principal, aktive Organisation, Credential-Fingerprint, Content-Typ, Content-ID und DataProvider-ID aus dem Preimage. Nach bestätigtem Delete wird der Nachweis als erfolgreicher Tombstone finalisiert. Ein Post-Delete-Read ist nicht erforderlich und ein erwartetes `not_found` darf nicht als Integritätsverletzung gelten.

Fehlgeschlagene oder verlorene Responses werden über ein persistentes Mutation-Journal korreliert. Ein bestätigter Provider-Erfolg darf durch lokale Projection-, History- oder Tombstone-Fehler nicht rückwirkend als fehlgeschlagen dargestellt werden.

### Editor und eigenständige Aktionen bestimmen den Principal eindeutig

Beim Create bietet die Oberfläche „Erstellen als“ beziehungsweise „Veröffentlichen als“ an. Bei `org_only` ist die aktive Organisation fest vorgegeben. Bei `org_or_personal` ist die aktive Organisation vorausgewählt; der Benutzer kann bewusst zum eigenen Account wechseln.

Beim Bearbeiten zeigt die Oberfläche den bestehenden DataProvider read-only als ursprünglichen Inhaber. Für eigene und organisatorische Inhalte ist „Handeln als“ aus der konfliktfreien Ownership-Bindung festgelegt und nicht frei umschaltbar. Der Server validiert den ressourcenbezogenen Principal mit einem neuen Same-Credential-Pre-Read.

Der membership-gefilterte Session-Contract `GET /api/v1/iam/me/context` liefert für jede
zugeordnete Organisation zusätzlich deren `contentAuthorPolicy`. Dieser leichte Self-Service-
Contract bleibt von den administrativen Organisations-Read-Models getrennt. Ein Redakteur
benötigt deshalb weder `iam.org.read` noch einen Aufruf von
`GET /api/v1/iam/organizations/:organizationId`, um den zulässigen Principal zu bestimmen.
Die Antwort enthält keine Credentials, Secrets oder administrativen Zählerdaten.

Ein gemeinsamer host-owned Resolver erhält den vollständigen Organisationskontext und bestimmt
die aktive Organisation ausschließlich über `activeOrganizationId`. `isActive` beschreibt nur
den Zustand einer Organisation und darf nicht als Auswahlmerkmal für den aktiven Sessionkontext
verwendet werden. Der Resolver versorgt zentral News, Events, Points of Interest, Generic Items,
FAQ, Cockpit Cards, Projects und Surveys einschließlich ihrer Listen-, Status- und Delete-Aktionen.

Eigenständige Aktionen aus Listen oder Dialogen verwenden bei bestehenden eigenen oder
organisatorischen Inhalten den ressourcenbezogen bestätigten Ownership-Principal. Die globale
Autorenrichtlinie oder eine frühere UI-Auswahl ersetzt diese Entscheidung nicht. Ist eine
`activeOrganizationId` vorhanden, aber die Organisation fehlt, ist inaktiv oder besitzt keine
gültige Richtlinie, liefert der Resolver einen blockierenden `unavailable`-Zustand. Die UI
deaktiviert dann alle Mainserver-Schreibaktionen und zeigt einen übersetzten, konkreten
Kontextfehler; sie darf nicht stillschweigend auf `user` zurückfallen. Die Inhaltsliste bleibt
dabei mit Filtern, Pagination und ressourcenbezogenen Leseaktionen verfügbar, erhält aber weder
einen Mutationsprincipal noch freigegebene Mainserver-Mutationsaktionen.

Nach einem erfolgreichen Organisationswechsel lädt die Shell den kanonischen Kontext neu, setzt
die Principal-Auswahl auf den Default der neuen Richtlinie zurück und invalidiert
principal-gebundene Queries und Projektionen. Der Server validiert den Principal bei jeder Mutation
erneut. Fehlende Credentials, ein veralteter Kontext oder fehlende Mainserver-Verfügbarkeit führen
nicht zu einem nachträglichen Fallback auf den anderen Principal.

### GraphQL-author und Content-Typen

Das freie GraphQL-Feld `author` bleibt bei bestehenden News und Generic Items aus Kompatibilitätsgründen serverseitig erhalten. Es wird aus der redaktionellen Oberfläche entfernt und bei neuen Mainserver-Inhalten nicht gesetzt. Es bestimmt weder Inhaber, Mapping, Credential-Quelle, Audit noch IAM-Scope.

Der Vertrag gilt nur entlang der bestätigten Typ-/Aktionsmatrix. Jeder Detail- und Mutation-Adapter muss den für Pre-Read, Create-Beobachtung und Integritätsprüfung benötigten DataProvider typisiert selektieren. Surveys und andere Typen ohne vollständigen Adapter oder bestätigte Immutabilität bleiben für die nicht belegten Aktionen capability-gated.

### History und Audit

Die Studio-History enthält ausschließlich im Studio beobachtete Mutationen und weist `coverage = studio_mutations` aus. Direkte Mainserver-Änderungen werden nicht rekonstruiert.

Audit und Mutation-Journal erfassen PII-minimiert mindestens Actor, Principal, aktive Organisation, Credential-Quelle beziehungsweise Fingerprint, Content-DataProvider, Action, Autorisierungsmodus, Ergebnis und Korrelationsreferenz. Bindungserzeugung, Bindungsbestätigung, Konflikt, automatischer Scope-Wechsel und Rückfall in den Kompatibilitätsmodus werden ebenfalls auditiert.

## Alternatives considered

- DataProvider-Namen als Mapping-Schlüssel verwenden: verworfen, weil Namen nicht stabil oder eindeutig sind.
- Manuelle administrative Zuordnung: verworfen, weil Principal-Bindungen ausschließlich automatisch entstehen sollen.
- Identity-Abfrage bei jeder Mutation trotz unverändertem Fingerprint: verworfen, weil die verifizierte credential-versionierte Bindung als PII-minimierter Cache und Auditnachweis dient.
- `own` und `organization` abstrakt instanzweit wie `all` behandeln: verworfen, weil Studio keine Inhalte freigeben kann, die das verwendete Mainserver-Credential nicht sieht.
- Mapping aus Listen, Details oder Updates ableiten: verworfen, weil diese den Content-Inhaber, nicht den Provider des handelnden Principal beweisen.
- Direkte Mainserver-Änderungen als vollständige Studio-History rekonstruieren: verworfen, weil kein vollständiger Event-Vertrag existiert.
- `iam.org.read` an alle Organisationsredakteure vergeben: verworfen, weil das administrative Leserecht mehr Organisationsdaten freigibt als der Content-Flow benötigt und die bestehende Self-Service-Grenze umgeht.
- Einen separaten Endpoint nur für erlaubte Mutationsprincipals einführen: verworfen, weil der kanonische Organisationskontext bereits membership-gefiltert geladen wird und die zusätzliche Policy ohne zweiten Lade-, Cache- oder Fehlerpfad transportieren kann.

## Risks / Trade-offs

- Während `shadow` oder eines bewussten Rollbacks können Benutzer mit `own` oder `organization` fremde DataProvider-Inhalte bearbeiten und löschen, sofern ihre konkret verwendeten Mainserver-Credentials diese Inhalte lesen und mutieren dürfen. Dieser Übergang ist zeitlich begrenzt und wird metrisch ausgewertet.
- Die effektive Breite des Rollbackpfads hängt von Mainserver-Rollen ab. Der automatische Zielzustand verbreitert fehlende Bindungen nicht.
- Ein Create kann einen automatischen Wechsel zu exakten Scopes auslösen; Inhalte anderer Provider können dadurch unmittelbar verschwinden. Der Wechsel wird auditiert und die UI lädt ihren Scope neu.
- Geteilte oder rotierte Credentials können Konflikte erzeugen und im automatischen Resolver Mutationen blockieren; Diagnose und Reconciliation müssen den Konflikt sichtbar machen.
- Typen ohne idempotenten Create können bei Lost Responses Duplikate erzeugen. Die Typ-/Aktionsmatrix und das Mutation-Journal müssen dieses Risiko offen ausweisen.
- Bestehende Clients ohne `actingPrincipalType` benötigen einen versionierten Übergang.
- Direkte Mainserver-Änderungen fehlen bewusst in der Studio-History.
- Die additive Erweiterung des Organisationskontexts vergrößert dessen Payload geringfügig. Dafür entfallen administrative N+1-Detailaufrufe aus allen Content-Seiten.

## Migration Plan

1. Überlappende Changes und Base-Specs zu Credential-Auflösung, Projektion, Autorenschaft und History komponieren.
2. Den Objektvertrag und die stabile Identity-ID mit persönlichen und organisatorischen Credentials bestätigen; noch fehlende reale Nachweise für die zulässige Principal-zu-DataProvider-Kardinalität nachholen und vor einer Production-Aktivierung bewerten.
3. Automatisches, credential-versioniertes Binding-Modell mit Konfliktzuständen, Mutation-Journal, Tombstone und Admin-Diagnose additiv einführen.
4. Alle Projektionen im Shadow-Modus um DataProvider und Credential-Kontext ergänzen; keine Berechtigungsänderung.
5. Gemeinsamen `MutationPrincipalContext` und versionierten `actingPrincipalType`-Transport typenweise einführen.
6. Same-Credential-Pre-Read für Update, Statusaktionen und Hard Delete erzwingen.
7. Identity-Beobachtungen vor dem Provider-Write automatisch binden und Readiness policy-gesteuert für `own` und `organization` berechnen.
8. Im Shadow-Modus die exakte Scope-Auswertung gegen `credential_visible_compatibility` vergleichen; im automatischen Modus fehlende Bindungen fail-closed behandeln.
9. Editor, History und Diagnose anbinden; Legacy-`author` serverseitig erhalten.
10. Nach ausgewertetem Dev-, Staging- und Production-Cutover den Shadow- und Kompatibilitätscode in einem separaten Cleanup entfernen, historische Auditdaten aber erhalten.

## Exit-Kriterien für den Kompatibilitätsmodus

Der Kompatibilitätsmodus ist nur noch ein expliziter Rollout- und Rollbackvertrag. Der automatische Resolver verwendet ihn nicht bei fehlenden Bindungen. Der Rollout kann auf `automatic` wechseln, wenn:

- `own`: die aktuelle persönliche Credential-Version konfliktfrei einem DataProvider zugeordnet ist;
- `organization`: die laut realer Read-Contract-Matrix erforderlichen persönlichen und aktiven organisatorischen Credential-Versionen unabhängig von `contentAuthorPolicy` konfliktfrei zugeordnet sind;
- keine konkurrierenden Claims für die benötigten DataProvider bestehen.

Development und Staging laufen durch bewusste Produktentscheidung bereits auf `automatic`.
Die noch offene Vertragsevidenz ist dort Nacharbeit und kein Grund für einen automatischen
Rollback. Production bleibt bis zu einer späteren ausdrücklichen Abnahme auf `shadow`. Jede
Promotion folgt dem regulären Same-Digest-Rolloutprozess.

Global kann der Pfad erst entfernt werden, wenn alle aktiven Credentials automatisch verifiziert werden können, die Principal-zu-DataProvider-Kardinalität bestätigt ist und produktive Metriken keine unerklärten Shadow-Differenzen oder Kompatibilitätsentscheidungen mehr zeigen.

## Rebaseline und aktueller Delivery-Stand

Der Change wurde am 12. August 2026 erneut gegen Implementierung, Tests, getrackte
Remote-Konfiguration, Runtime-Telemetrie und parallele OpenSpec-Changes geprüft. Dabei
gilt folgender Stand:

- Der Kernvertrag für explizite Mutationsprincipals, stabile Credential-Kontexte,
  Identity-Bindungen, Journal und exakte Scope-Auswertung ist implementiert und durch
  gezielte Unit- und Integrationstests abgedeckt.
- Die aktuelle reguläre Projektion lädt bei `org_or_personal` nur den persönlichen
  Credential-Scope. Ob eine zweite organisatorische Credential-Sicht für die fachlich
  geforderte Menge `own ∪ aktive Organisation` notwendig ist, wird erst durch reale
  persönliche und organisatorische Read-Contract-Tests entschieden. Der Change schreibt
  keine Doppelabfrage ohne diesen Nachweis vor.
- ADR-045 ist für die bisherige globale Organisations-Primärquelle weiterhin formal
  accepted, widerspricht aber dem hier freigegebenen Fachvertrag. Eine neue ADR muss die
  weiterhin gültigen Teile übernehmen und ADR-045 vor Implementierungsbeginn
  supersedieren.
- Normale Content-Create-Responses und Same-Credential-Re-Reads bestätigen nur eine
  bestehende Identity-Bindung. Sie dürfen keine neue Principal-Bindung begründen.
- Development und Staging sind in den getrackten Profilen bereits auf `automatic`
  konfiguriert. Dieser Zustand ist als Produktentscheidung akzeptiert; Production bleibt
  auf `shadow`.
- Die reale persönliche und organisatorische Contract-Matrix ist weiterhin offen. Die
  bisherige Staging-Telemetrie belegt den persönlichen automatischen Pfad, aber noch
  keine Organisationsprincipal-Mutation.
- `surveys.create` ist bewusst freigegeben. Die noch fehlende reale persönliche und
  organisatorische Vertragsevidenz wird nachgeholt, blockiert die bestehende Freigabe aber
  nicht.
- Der Mainserver-Principal wird in der Oberfläche noch über administrative
  Organisationsdetails bestimmt. Diese Abhängigkeit und die fehlerhafte Auswahl anhand
  des ersten `isActive`-Eintrags werden durch den zentralen Self-Service-Kontext-Resolver
  dieses Changes ersetzt.

Die bereits abgeschlossenen Changes `make-mainserver-content-authoritative`,
`update-mainserver-editor-resilience`, `standardize-plugin-content-history` und
`add-organization-mainserver-provisioning` bleiben fachliche Voraussetzungen. Der
neuere Change `centralize-scoped-ui-access` ist für den gemeinsamen fail-closed
UI-Decision- und Ressourcen-Capability-Vertrag führend. Dieser Change definiert nur die
Mainserver-spezifische Principal-Auswahl und darf keine parallele allgemeine
UI-Autorisierungslogik einführen.

Der Change ist erst archivierbar, wenn die offenen Contract-, Capability-,
Principal-Resolver- und Rollout-Aufgaben abgeschlossen, die Umgebungsnachweise eindeutig
zuordenbar und die Delta-Specs mit den genannten parallelen Changes komponiert sind.
