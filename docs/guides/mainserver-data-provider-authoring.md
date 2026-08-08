# Mainserver-DataProvider-Autorenschaft

## Ziel und Grenzen

Bei Mainserver-Inhalten ist der vom Mainserver gesetzte `dataProvider` der unveränderliche ursprüngliche Inhaber. Der handelnde Studio-Account bleibt Actor; `actingPrincipalType` bestimmt ausschließlich, ob persönliche oder organisatorische Credentials für die konkrete Mutation verwendet werden. Freie `author`-Texte und lokale Projektionswerte begründen weder Ownership noch eine Principal-Bindung.

`/data_provider.json` liefert derzeit noch keine stabile ID. Deshalb entstehen Principal-zu-DataProvider-Bindungen ausschließlich automatisch aus einem bestätigten Create und dem DataProvider der Response oder eines Same-Credential-Re-Reads. Listen, Details, Updates, Deletes, Namen und administrative Eingaben sind keine Bindungsevidenz. Bis eine aktuelle konfliktfreie Bindung vorliegt, dürfen alle Inhalte bearbeitet werden, die mit dem ausgewählten Credential-Kontext unmittelbar gelesen werden können und für die die jeweilige fully-qualified Action erlaubt ist.

## Mutationsvertrag

- Der aktuelle Browser-Client sendet `X-SVA-Mainserver-Contract-Version: 2`, `X-SVA-Acting-Principal-Type: organization|user`, eine Operations-ID und bei geladenen Details die nicht autorisierende Kontextbindung.
- Der Server validiert Actor, aktive Organisation, `contentAuthorPolicy`, Membership, Credentials, Action und Scope erneut.
- Pre-Read, Read-Merge-Write, Provider-Write, Status-/Visibility-Zweitschritt, Post-Read, Projection, Audit und Reconciliation verwenden denselben unveränderlichen Credential-Fingerprint.
- Jede bestehende Mutation benötigt einen frischen Same-Credential-Pre-Read. Projection und Cache autorisieren nie eine Mutation.
- Gelöschte, pseudonymisierte oder blockierte Accounts und gelöschte beziehungsweise inaktive Organisationen zählen nicht als aktuelle Binding-Readiness. Ihre automatisch beobachtete Bindung bleibt als historische Referenz erhalten und wird keinem anderen Principal übertragen.
- Ein erfolgreicher Provider-Write bleibt fachlich erfolgreich. Fehler in Binding, Journal, Projection oder History erzeugen `reconciliation_required`, aber keinen fingierten Providerfehler.
- Hard Delete persistiert DataProvider und Preimage vor dem Write und verlangt keinen Post-Delete-Read.

## Rollout-Schalter

`SVA_MAINSERVER_SCOPE_RESOLVER_MODE` besitzt drei Werte:

- `shadow` ist der Standard. Studio berechnet die automatische exakte Entscheidung, erzwingt aber weiterhin `credential_visible_compatibility`. Kandidaten, Ergebnisunterschiede und Resolvermodus werden im Mutation-Journal, Audit und in der Admin-Diagnose erfasst.
- `automatic` aktiviert exakte `own`- beziehungsweise `organization`-Entscheidungen, sobald die benötigten aktuellen Bindungen konfliktfrei vorliegen. Fehlende Bindungen bleiben automatisch im Kompatibilitätsmodus.
- `compatibility` ist der Rollback. Scope-gebundene Mutationen verwenden wieder ausschließlich den credential-sichtbaren Kompatibilitätsvertrag; Action, Instanz, Principal-Policy, Pre-Read und Mainserver-Autorisierung bleiben verbindlich.

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
4. Erst bei erklärten beziehungsweise behobenen Shadow-Abweichungen `automatic` aktivieren. Dev, Staging und Production folgen dem regulären Build- und Same-Digest-Rolloutprozess.
5. Nach Ablauf offener Browser-Sessions den Principal-Vertrag auf `required` stellen.

Bei unerwarteten Scope-Ablehnungen wird ausschließlich `SVA_MAINSERVER_SCOPE_RESOLVER_MODE=compatibility` zurückgeschaltet. Datenbankmigration, automatische Bindungen, Journal und Diagnose bleiben dabei erhalten und werden nicht zurückgerollt.

## Stabile Identity-ID

Sobald `/data_provider.json` eine stabile ID liefert, vergleicht Studio sie automatisch mit der aktuellen credential-versionierten Bindung. Gleichheit bestätigt die Bindung; Abweichung erzeugt einen Konflikt und überschreibt keine bestehende Evidenz. Der Kompatibilitätspfad darf erst entfernt werden, wenn alle aktiven Credentials automatisch verifiziert werden können und produktive Metriken keine Kompatibilitätsnutzung mehr zeigen.
