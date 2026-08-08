## Context

Persönliche und organisatorische Mainserver-Credentials erzeugen jeweils einen OAuth-Token. Beim Create setzt der Mainserver den an das Credential gebundenen DataProvider am neuen Content. Der Identity-Endpunkt `/data_provider.json` liefert derzeit jedoch noch keine stabile ID. Eine sichere Vorabzuordnung von Principal zu DataProvider ist deshalb nicht generell möglich.

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
  - Principal-Bindungen ohne manuelle Zuordnung automatisch aus Create-Beobachtungen und später aus einer stabilen Identity-ID erzeugen.
  - Bis zur vollständigen automatischen Bindung alle credential-sichtbaren Inhalte unter normaler Action-Autorisierung bearbeitbar halten.
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

Die Annahmen zu Create-Zuordnung, Cross-Principal-Write, DataProvider-Immutabilität, Credential-Sichtbarkeit und Mutation-Responses sind externe Voraussetzungen. Vor der Implementierung von exakten Scopes und UI-Cutover entsteht eine verbindliche Matrix pro Content-Typ und fachlicher Aktion.

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

### Create erzeugt die automatische Principal-Bindung

Vor einer stabilen ID aus `/data_provider.json` ist ein erfolgreicher Create der einzige zulässige Nachweis für eine neue Principal-Bindung:

1. Studio validiert Actor, aktive Organisation, Action-Permission, Principal-Policy und Credential-Verfügbarkeit.
2. Studio bindet einen `MutationPrincipalContext` einschließlich Credential-Fingerprint.
3. Der Create läuft ausschließlich mit diesem Credential.
4. Studio liest `dataProvider.id` aus der Create-Response oder einem unmittelbaren Re-Read mit demselben Credential.
5. Die Beobachtung erzeugt oder bestätigt die instanzgebundene Principal-Bindung.
6. Eine abweichende Provider-ID oder ein konkurrierender Principal-Claim erzeugt `conflict` und überschreibt keine bestehende Bindung.
7. Ein bestätigter Upstream-Erfolg bleibt Erfolg; Konflikte markieren lokale Folgearbeit als `reconciliation_required`.

Listen, Details, Updates, Statusänderungen, Deletes, Namen, Client-Werte und administrative Eingaben dürfen kein neues Mapping begründen. Ein Update-Resultat beschreibt den Inhaber des bestehenden Contents und ist daher kein Nachweis für den handelnden Principal.

Eine Bindung ist mindestens nach Instanz, Principal-Typ, Principal-ID, DataProvider-ID und Credential-Fingerprint versioniert. Credential-Rotation macht die aktuelle Bindung solange nicht exakt nutzbar, bis ein späterer Create oder der zukünftige Identity-Endpunkt denselben Provider für die neue Credential-Version bestätigt. Historische Bindungen bleiben für bestehende Inhalte erhalten.

### Identity-Endpunkt ergänzt später den automatischen Nachweis

Der Identity-Aufruf verwendet denselben Bearer Token wie GraphQL. Studio verarbeitet den tatsächlichen HTTP-Status und ausschließlich den JSON-Body.

Der derzeitige Body enthält sinngemäß:

```json
{
  "data_provider": {
    "name": "Anzeigename",
    "description": "",
    "notice": "",
    "logo": {},
    "address": {},
    "contact": {}
  }
}
```

Eine erfolgreiche Antwort ohne ID ist ein erwarteter Vertragszustand. Sie begründet weder ein Mapping noch eine zusätzliche Berechtigung. Kontakt, Adresse, Beschreibung, Notice, Logo und Rohantwort werden nicht persistiert oder protokolliert.

Sobald `data_provider.id` verfügbar ist, normalisiert Studio eine nicht leere String- oder Ganzzahl-ID. Eine gleiche ID bestätigt die aktuelle Credential-Bindung. Eine abweichende ID erzeugt `conflict`. Der Identity-Endpunkt überschreibt weder historische Bindungen noch schaltet er einen konfliktbehafteten Scope stillschweigend um.

Technische oder strukturelle Fehler des Identity-Endpunkts erweitern keine Berechtigung. Sie blockieren aber nicht automatisch eine Content-Aktion, deren konkrete Credential-Verfügbarkeit durch OAuth und den verpflichtenden Same-Credential-Read nachgewiesen ist.

### Credential-visible Compatibility ist der definierte Übergangsvertrag

Solange die für den jeweiligen Scope erforderlichen aktuellen Bindungen fehlen oder konfliktbehaftet sind, verwendet Studio `credential_visible_compatibility`.

In diesem Modus:

- `own` und `organization` werden für Mainserver-Inhalte nicht gegen lokale, synthetische oder vermutete Owner-Felder eingeschränkt;
- jede bestehende Content-Mutation benötigt einen frischen erfolgreichen Pre-Read mit exakt demselben `MutationPrincipalContext` wie der Write;
- nur vom Mainserver mit diesem Credential tatsächlich lesbare und mutierbare Inhalte sind verfügbar;
- ein Projection- oder Cache-Treffer allein autorisiert keine Mutation;
- `404`, `401` oder `403` beim Pre-Read beziehungsweise Write bleiben fail-closed;
- die passende fully-qualified Action-Permission bleibt für Update, Publish, Archive, Restore und Hard Delete jeweils separat erforderlich;
- aktive Organisation, Membership, Principal-Policy, Instanzgrenze und Credential-Verfügbarkeit bleiben unverändert wirksam;
- Mainserver-Autorisierung bleibt die nachgelagerte Obergrenze.

Für Listen und Details ist der verwendete Credential-Kontext sichtbar isoliert. Ein Wechsel des Mutationsprincipal erzwingt einen neuen Pre-Read; Sichtbarkeit unter Organisations-Credentials beweist keine Verfügbarkeit unter persönlichen Credentials und umgekehrt.

Der Modus wird strukturiert auditiert und metrisch gezählt. Er ist ein bewusster fachlicher Kompatibilitätsvertrag, kein technischer Fehlerzustand. Normale Editoren benötigen deshalb keine Warnung; Administration und Diagnose zeigen Bindungs-, Konflikt- und Moduszustände.

### Exakte Scope-Auswertung wird automatisch readiness-gesteuert

Die Readiness wird pro aktuellem Scope-Kontext bestimmt:

- `own` ist exakt, wenn der persönliche Principal für seine aktuelle Credential-Version konfliktfrei gebunden ist.
- `organization` ist exakt, wenn sowohl der persönliche Principal als auch die aktive Organisation für ihre aktuellen Credential-Versionen konfliktfrei gebunden sind.
- Ohne aktive Organisation fällt `organization` auf `own` zurück.
- `all` benötigt keine Principal-Bindung; es erlaubt alle Inhalte, die im verwendeten Mainserver-Read-Kontext verfügbar sind.
- Andere Memberships und frühere Organisationskontexte erweitern keinen Scope.

Sobald die erforderlichen Bindungen automatisch vollständig und konfliktfrei sind, wechselt der betreffende Scope ohne manuelle Zuordnung zur exakten DataProvider-Auswertung. Der Wechsel wird auditiert. Bei Rotation, Konflikt oder Verlust der aktuellen Evidenz fällt nur der betroffene Scope zurück auf `credential_visible_compatibility`; historische Bindungen werden nicht gelöscht.

In der exakten Auswertung gilt:

- `own` erlaubt den persönlichen DataProvider des aktuellen Accounts.
- `organization` erlaubt den persönlichen DataProvider oder den DataProvider der aktiven Organisation.
- `all` bleibt durch Mainserver-Sichtbarkeit und Instanzgrenze begrenzt.
- unbekannte externe DataProvider matchen `own` und `organization` nicht.

Lokale `ownerUserId`- und `ownerOrganizationId`-Werte dürfen aus konfliktfreien Bindungen als rekonstruierbare Projektion entstehen. Im Kompatibilitätsmodus werden keine erfundenen Owner persistiert.

### Content-Autorisierung und Mutationsprincipal sind getrennte Gates

Vor einer bestehenden Content-Mutation prüft der Server:

1. Principal-Policy, aktive Organisation, Membership und Credential-Verfügbarkeit.
2. Einen frischen Read des adressierten Contents mit dem gebundenen Write-Credential.
3. Die fully-qualified Action.
4. Je nach Readiness entweder die exakte DataProvider-Scope-Regel oder `credential_visible_compatibility`.
5. Den Mainserver-Write mit demselben Credential-Kontext.

Eine andere Credential-Quelle erweitert niemals die credential-sichtbare Menge. Der Client übermittelt ausschließlich `actingPrincipalType: 'organization' | 'user'`. Account-, Organisations-, DataProvider- oder Credential-Werte aus dem Client bestimmen keine Autorisierung.

Für Create existiert noch kein Content-DataProvider. Deshalb gelten vor dem Upstream-Aufruf:

- `own` erlaubt Create ausschließlich als `user`.
- `organization` erlaubt Create als `user` oder als aktive Organisation.
- `all` erlaubt beide Principals, aber keinen beliebigen fremden Principal.
- Die Principal-Policy kann diese Menge weiter einschränken.
- Der anschließend bestätigte DataProvider erzeugt oder bestätigt die automatische Bindung.

### MutationPrincipalContext bleibt über die gesamte Operation stabil

Der gemeinsame Kontext enthält mindestens Instanz, Actor, aktive Organisation, Principal-Typ, Credential-Quelle und Credential-Fingerprint. Er wird für Pre-Read, Read-Merge-Write, Provider-Mutation, Visibility- oder Status-Zweitschritt, Post-Read, DataProvider-Prüfung, Projection-Refresh, Audit und Reconciliation verwendet.

Credential- und Token-Caches enthalten denselben Principal-Kontext beziehungsweise eine gleichwertige Credential-Signatur. Ein Wechsel der aktiven Organisation oder Credential-Version darf keinen alten Cache-Eintrag weiter autorisieren. Jeder V2-Request zum Ändern oder Löschen trägt einen nicht autorisierenden Kontext-Bindungswert aus einem aktuellen Detail-Read; fehlt er oder stimmt er beim Save nicht mehr mit der aktuellen Session überein, wird die Mutation vor dem Provider-Write abgewiesen. Legacy-Requests ohne Vertragsversion bleiben ausschließlich während des konfigurierten Übergangs kompatibel.

- `org_only`: nur `organization` ist bei aktiver Organisation zulässig.
- `org_or_personal`: `organization` und `user` sind bei aktiver Organisation zulässig.
- kein aktiver Organisationskontext: nur `user` ist zulässig.
- fehlende Credentials erzeugen einen spezifischen Fehler; es gibt keinen stillen Fallback.

Implizite Reads und Hintergrund-Reconciliation verwenden bei `org_or_personal` den persönlichen Principal; nur `org_only` wählt ohne explizite Auswahl die aktive Organisation. Automatische und gezielte Projektionsaktualisierungen trennen `user` und `organization` im Scope-Schlüssel, sobald der Principal explizit feststeht. Ein Refresh in einem Scope löscht keine Zeilen eines anderen Principal-Scopes.

### Hard Delete verwendet Preimage und Tombstone

Hard Delete ist im Kompatibilitätsmodus zulässig, wenn der Benutzer die separate Delete-Action besitzt, der verpflichtende Same-Credential-Pre-Read erfolgreich ist und der Mainserver den Delete akzeptiert.

Vor dem Delete persistiert Studio mindestens Operationsreferenz, Actor, Principal, aktive Organisation, Credential-Fingerprint, Content-Typ, Content-ID und DataProvider-ID aus dem Preimage. Nach bestätigtem Delete wird der Nachweis als erfolgreicher Tombstone finalisiert. Ein Post-Delete-Read ist nicht erforderlich und ein erwartetes `not_found` darf nicht als Integritätsverletzung gelten.

Fehlgeschlagene oder verlorene Responses werden über ein persistentes Mutation-Journal korreliert. Ein bestätigter Provider-Erfolg darf durch lokale Projection-, History- oder Tombstone-Fehler nicht rückwirkend als fehlgeschlagen dargestellt werden.

### Editor und eigenständige Aktionen bestimmen den Principal eindeutig

Beim Create bietet die Oberfläche „Erstellen als“ beziehungsweise „Veröffentlichen als“ an. Bei `org_only` ist die aktive Organisation fest vorgegeben. Bei `org_or_personal` ist die aktive Organisation vorausgewählt; der Benutzer kann bewusst zum eigenen Account wechseln.

Beim Bearbeiten zeigt die Oberfläche den bestehenden DataProvider read-only als ursprünglichen Inhaber. „Handeln als“ bestimmt nur den Mutationsprincipal. Wechselt die Auswahl gegenüber dem geladenen Credential-Kontext, validiert der Server die Verfügbarkeit mit einem neuen Same-Credential-Pre-Read.

Eigenständige Aktionen aus Listen oder Dialogen verwenden nur bei `org_only` automatisch
`organization`. Bei `org_or_personal`, fehlender Richtlinie oder ohne aktive Organisation
verwenden sie `user`, weil dort kein Principal-Dropdown die organisatorische Auswahl bestätigt.
Der Server validiert den Principal erneut. Fehlende Credentials oder fehlende
Mainserver-Verfügbarkeit führen nicht zu einem nachträglichen Fallback auf den anderen Principal.

### GraphQL-author und Content-Typen

Das freie GraphQL-Feld `author` bleibt bei bestehenden News und Generic Items aus Kompatibilitätsgründen serverseitig erhalten. Es wird aus der redaktionellen Oberfläche entfernt und bei neuen Mainserver-Inhalten nicht gesetzt. Es bestimmt weder Inhaber, Mapping, Credential-Quelle, Audit noch IAM-Scope.

Der Vertrag gilt nur entlang der bestätigten Typ-/Aktionsmatrix. Jeder Detail- und Mutation-Adapter muss den für Pre-Read, Create-Beobachtung und Integritätsprüfung benötigten DataProvider typisiert selektieren. Surveys und andere Typen ohne vollständigen Adapter oder bestätigte Immutabilität bleiben für die nicht belegten Aktionen capability-gated.

### History und Audit

Die Studio-History enthält ausschließlich im Studio beobachtete Mutationen und weist `coverage = studio_mutations` aus. Direkte Mainserver-Änderungen werden nicht rekonstruiert.

Audit und Mutation-Journal erfassen PII-minimiert mindestens Actor, Principal, aktive Organisation, Credential-Quelle beziehungsweise Fingerprint, Content-DataProvider, Action, Autorisierungsmodus, Ergebnis und Korrelationsreferenz. Bindungserzeugung, Bindungsbestätigung, Konflikt, automatischer Scope-Wechsel und Rückfall in den Kompatibilitätsmodus werden ebenfalls auditiert.

## Alternatives considered

- DataProvider-Namen als Mapping-Schlüssel verwenden: verworfen, weil Namen nicht stabil oder eindeutig sind.
- Manuelle administrative Zuordnung: verworfen, weil Principal-Bindungen ausschließlich automatisch entstehen sollen.
- Bis zur Identity-ID sämtliche Mainserver-Mutationen blockieren: verworfen, weil das Studio in der Übergangszeit arbeitsfähig bleiben muss.
- `own` und `organization` abstrakt instanzweit wie `all` behandeln: verworfen, weil Studio keine Inhalte freigeben kann, die das verwendete Mainserver-Credential nicht sieht.
- Mapping aus Listen, Details oder Updates ableiten: verworfen, weil diese den Content-Inhaber, nicht den Provider des handelnden Principal beweisen.
- Direkte Mainserver-Änderungen als vollständige Studio-History rekonstruieren: verworfen, weil kein vollständiger Event-Vertrag existiert.

## Risks / Trade-offs

- Bis zur automatischen Bindung können Benutzer mit `own` oder `organization` fremde DataProvider-Inhalte bearbeiten und löschen, sofern ihre konkret verwendeten Mainserver-Credentials diese Inhalte lesen und mutieren dürfen. Dies ist der bewusst akzeptierte Kompatibilitätsvertrag.
- Die effektive Breite hängt von Mainserver-Rollen ab. Studio-IAM bleibt notwendiges Gate, kann die Upstream-Sichtbarkeit im Kompatibilitätsmodus aber nicht weiter nach DataProvider einschränken.
- Ein Create kann einen automatischen Wechsel zu exakten Scopes auslösen; Inhalte anderer Provider können dadurch unmittelbar verschwinden. Der Wechsel wird auditiert und die UI lädt ihren Scope neu.
- Geteilte oder rotierte Credentials können Konflikte erzeugen und den Kompatibilitätsmodus verlängern.
- Typen ohne idempotenten Create können bei Lost Responses Duplikate erzeugen. Die Typ-/Aktionsmatrix und das Mutation-Journal müssen dieses Risiko offen ausweisen.
- Bestehende Clients ohne `actingPrincipalType` benötigen einen versionierten Übergang.
- Direkte Mainserver-Änderungen fehlen bewusst in der Studio-History.

## Migration Plan

1. Überlappende Changes und Base-Specs zu Credential-Auflösung, Projektion, Autorenschaft und History komponieren.
2. Typ-/Aktionsmatrix durch reale Mainserver-Contract-Tests bestätigen.
3. Automatisches, credential-versioniertes Binding-Modell mit Konfliktzuständen, Mutation-Journal, Tombstone und Admin-Diagnose additiv einführen.
4. Alle Projektionen im Shadow-Modus um DataProvider und Credential-Kontext ergänzen; keine Berechtigungsänderung.
5. Gemeinsamen `MutationPrincipalContext` und versionierten `actingPrincipalType`-Transport typenweise einführen.
6. Same-Credential-Pre-Read für Update, Statusaktionen und Hard Delete erzwingen.
7. Create-Beobachtungen automatisch binden und Readiness für `own` und `organization` berechnen.
8. `credential_visible_compatibility` und exakte Scope-Auswertung pro aktuellem Scope-Kontext aktivieren; Entscheidungen und Wechsel auditieren.
9. Editor, History und Diagnose anbinden; Legacy-`author` serverseitig erhalten.
10. Sobald `/data_provider.json` stabile IDs liefert, diese als zusätzliche automatische Evidenz aktivieren und Konflikte statt stiller Überschreibung erzeugen.

## Exit-Kriterien für den Kompatibilitätsmodus

Der Kompatibilitätsmodus ist solange Bestandteil des unterstützten Vertrags, wie aktuelle persönliche oder organisatorische Credential-Bindungen fehlen oder konfliktbehaftet sind. Er endet für einen konkreten Scope automatisch, wenn:

- `own`: die aktuelle persönliche Credential-Version konfliktfrei einem DataProvider zugeordnet ist;
- `organization`: aktuelle persönliche und aktive organisatorische Credential-Version konfliktfrei zugeordnet sind;
- keine konkurrierenden Claims für die benötigten DataProvider bestehen.

Global kann der Pfad erst entfernt werden, wenn der Identity-Endpunkt stabile IDs liefert, alle aktiven Credentials automatisch verifiziert werden können und produktive Metriken keine Kompatibilitätsentscheidungen mehr zeigen.
