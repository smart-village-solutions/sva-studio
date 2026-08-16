# Mainserver-DataProvider-Autorenschaft

## Ziel und Grenzen

Bei Mainserver-Inhalten ist der vom Mainserver gesetzte `dataProvider` der unveränderliche ursprüngliche Inhaber. Der handelnde Studio-Account bleibt Actor; `actingPrincipalType` bestimmt ausschließlich, ob persönliche oder organisatorische Credentials für die konkrete Mutation verwendet werden. Freie `author`-Texte und lokale Projektionswerte begründen weder Ownership noch eine Principal-Bindung.

`/data_provider.json` liefert inzwischen eine stabile ID im Objektformat `{ "data_provider": { "id": ... } }`. Principal-zu-DataProvider-Bindungen entstehen deshalb vor dem Provider-Write automatisch aus diesem authentifizierten Nachweis. Create-Response oder Same-Credential-Re-Read bestätigen anschließend denselben Content-Inhaber. Listen, Details, Updates, Deletes, Namen und administrative Eingaben sind keine Bindungsevidenz.

## Mutationsvertrag

- Der aktuelle Browser-Client sendet `X-SVA-Mainserver-Contract-Version: 2`, `X-SVA-Acting-Principal-Type: organization|user`, eine Operations-ID und bei Änderungen beziehungsweise Deletes zwingend die nicht autorisierende Kontextbindung. Fehlt sie lokal, lädt der Client das Detail vor der Mutation erneut; liefert auch dieser Read keine Bindung, bricht er fail-closed ab.
- Der Server validiert Actor, aktive Organisation, `contentAuthorPolicy`, Membership, Credentials, Action und Scope erneut.
- Bei globaler Update-Berechtigung darf der Bestandseditor die Credential-Quelle aus einer Projektion ableiten, die exakt zum aktuellen Actor und aktiven Organisationskontext gehört. Für `own` und `organization` bleibt eine exakte Ownership-Bindung erforderlich; auch im globalen Fall autorisiert die Projektion selbst keine Mutation.
- Vor dem ersten Write mit einer neuen oder rotierten Credential-Version muss `/data_provider.json` eine nicht leere String- oder Ganzzahl-ID liefern. Fehlt eine aktuelle Bindung und scheitert dieser Nachweis, endet die Mutation fail-closed.
- Eine verifizierte Bindung darf bei einer vorübergehenden Identity-Störung nur für exakt denselben Credential-Fingerprint weiterverwendet werden.
- Pre-Read, Read-Merge-Write, Provider-Write, Status-/Visibility-Zweitschritt, Post-Read, Projection, Audit und Reconciliation verwenden denselben unveränderlichen Credential-Fingerprint.
- Jede bestehende Mutation benötigt einen frischen Same-Credential-Pre-Read. Projection und Cache autorisieren nie eine Mutation.
- Gelöschte, pseudonymisierte oder blockierte Accounts und gelöschte beziehungsweise inaktive Organisationen zählen nicht als aktuelle Binding-Readiness. Ihre automatisch beobachtete Bindung bleibt als historische Referenz erhalten und wird keinem anderen Principal übertragen.
- Ein erfolgreicher Provider-Write bleibt fachlich erfolgreich. Fehler in Binding, Journal, Projection oder History erzeugen `reconciliation_required`, aber keinen fingierten Providerfehler.
- Liefert ein Create den DataProvider erst im Same-Credential-Re-Read, wird diese beobachtete ID in Bindung, Mutation-Journal und Audit derselben Operation weitergereicht.
- Hard Delete persistiert DataProvider und Preimage vor dem Write und verlangt keinen Post-Delete-Read.

Implizite Reads und Hintergrundabgleiche verwenden bei `org_or_personal` persönliche Credentials. Nur `org_only` wählt ohne expliziten Principal organisatorische Credentials. Principal-gebundene Mutation-Refreshes werden in getrennten `user`-/`organization`-Projektionsscopes gespeichert; ein automatischer Full-Refresh darf Zeilen des jeweils anderen Principal-Scopes nicht entfernen.

## Rollout-Schalter

`SVA_MAINSERVER_SCOPE_RESOLVER_MODE` besitzt drei Werte:

- `shadow` ist der Standard. Studio berechnet die automatische exakte Entscheidung, erzwingt aber weiterhin `credential_visible_compatibility`. Kandidaten, Ergebnisunterschiede und Resolvermodus werden im Mutation-Journal, Audit und in der Admin-Diagnose erfasst.
- `automatic` aktiviert exakte `own`- beziehungsweise `organization`-Entscheidungen. Fehlende oder konfliktbehaftete erforderliche Bindungen werden fail-closed abgelehnt und nicht automatisch durch Credential-Sichtbarkeit verbreitert. Vorübergehende Datenbank- oder Identity-Provider-Fehler bei der Bindungsauflösung bleiben als wiederholbare `503`-Antwort erhalten und werden nicht als `403` fehlklassifiziert.
- `compatibility` ist der Rollback. Scope-gebundene Mutationen verwenden wieder ausschließlich den credential-sichtbaren Kompatibilitätsvertrag; Action, Instanz, Principal-Policy, Pre-Read und Mainserver-Autorisierung bleiben verbindlich.

Die getrackten Development-, Staging- und Production-Profile sind nach erfolgreicher Staging-Abnahme auf `automatic` gesetzt. Der Production-Wert wird erst durch den regulären Same-Digest-Rollout wirksam.

Der kanonische Remote-Promote reicht den Wert aus dem getrackten Umgebungsprofil über `compose.yaml` an den App-Service durch. Fehlt der Wert, bleibt der sichere Runtime-Standard `shadow` aktiv.

`SVA_MAINSERVER_ACTING_PRINCIPAL_CONTRACT_MODE` steuert den Transport-Cutover:

- `legacy_compatible` ist der Übergangsstandard. V2-Requests benötigen immer den expliziten Principal. Nur headerlose alte Clients dürfen den Principal deterministisch über den bestehenden policy-gesteuerten Credential-Resolver ableiten.
- `required` lehnt auch headerlose alte Mutationsrequests ohne expliziten Principal ab.

`SVA_MAINSERVER_CONFIRMED_CAPABILITIES` enthält ausschließlich durch reale Contract-Tests bestätigte zusätzliche Actions. Ein leerer Wert erweitert keine Capability.

Die effektive Liste wird angemeldeten Studio-Clients über
`GET /api/v1/mainserver/mutation-capabilities` bereitgestellt. UI-Rechte allein schalten keine
unbestätigte Mainserver-Operation frei: Survey-Update, Statuswechsel und Delete bleiben bis zum
Capability-Nachweis deaktiviert. Kann der Capability-Vertrag nicht geladen werden, gilt derselbe
fail-closed Zustand.

## Aktivierungsfolge

1. Migration, Bindings, Journal und Projection-Felder mit `SVA_MAINSERVER_SCOPE_RESOLVER_MODE=shadow` ausrollen.
2. In der Mainserver-Autorendiagnose Konflikte, Credential-Rotationen, Shadow-Auswertungen, Shadow-Abweichungen und Reconciliation je Instanz prüfen.
3. Reale Contract-Tests mit persönlichen und organisatorischen Credentials für Create, Same-Credential-Read, Cross-Principal-Update, Status/Visibility und Hard Delete ausführen.
4. Zusätzlich belegen, ob eine DataProvider-ID genau einem Studio-Principal zugeordnet ist. Geteilte IDs sind ein Stop-Gate für das bestehende Konfliktmodell.
5. Erst bei erklärten beziehungsweise behobenen Shadow-Abweichungen `automatic` aktivieren. Development, Staging und Production folgen in dieser Reihenfolge über den regulären Same-Digest-Rolloutprozess.
6. Nach Ablauf offener Browser-Sessions den Principal-Vertrag auf `required` stellen.

Bei unerwarteten Scope-Ablehnungen wird ausschließlich `SVA_MAINSERVER_SCOPE_RESOLVER_MODE=compatibility` zurückgeschaltet. Datenbankmigration, automatische Bindungen, Journal und Diagnose bleiben dabei erhalten und werden nicht zurückgerollt.

## Stabile Identity-ID

Studio vergleicht die stabile ID automatisch mit der aktuellen credential-versionierten Bindung. Gleichheit bestätigt die Bindung; Abweichung erzeugt einen Konflikt und überschreibt keine bestehende Evidenz. Für die Organisationssicht müssen die persönliche und die organisatorische Credential-Sicht jeweils konfliktfrei gebunden sein; `content_author_policy` begrenzt den Create-Principal, nicht die erforderlichen Read-Sichten. Der Kompatibilitätspfad darf erst entfernt werden, wenn alle aktiven Credentials automatisch verifiziert werden können und produktive Metriken keine unerklärten Shadow-Differenzen oder Kompatibilitätsnutzung mehr zeigen.
