# Change: Unveränderlichen Mainserver-DataProvider als Content-Inhaber und Scope-Anker verwenden

## Why

Jede Mainserver-Mutation wird über einen OAuth-Handshake mit den persönlichen oder organisatorischen Credentials des gewählten Principal ausgeführt. Beim Erstellen setzt der Mainserver den an diese Credentials gebundenen DataProvider am Content. Studio muss Actor, Mutationsprincipal, Credential-Quelle, ursprünglichen DataProvider, sichtbare Autorenanzeige und lokale IAM-Ownership konsistent auseinanderhalten.

Der Mainserver-Endpunkt `/data_provider.json` liefert inzwischen für authentifizierte Credentials eine stabile DataProvider-ID im Objektformat `{ "data_provider": { "id": ... } }`. Studio kann damit persönliche und organisatorische Credential-Versionen vor einer Mutation exakt einem DataProvider zuordnen. Die zuvor notwendige credential-sichtbare Kompatibilität bleibt nur noch ein expliziter Shadow- und Rollbackpfad bis zum ausgewerteten Production-Cutover.

## What Changes

- Der Mainserver-`dataProvider` wird für Mainserver-basierte Inhalte als unveränderlicher ursprünglicher Inhaber und sichtbarer Autor behandelt; freie `author`-Strings, lokale Owner-Projektionen und der aktuelle Mutationsprincipal dürfen ihn nicht überschreiben.
- Studio erzeugt Principal-zu-DataProvider-Bindungen ausschließlich aus automatischer, vertraglich bestätigter Evidenz. Regulär begründet die stabile authentifizierte ID von `/data_provider.json` eine Credential-Version. Als eng begrenzte Ausnahme darf die garantierte `data_provider_id` der Mainserver-Benutzer-Provisioning-Antwort die Erstbindung neu erzeugter Organisations-Credentials begründen; normale Content-Create-Responses und Same-Credential-Re-Reads bestätigen nur die Konsistenz des Content-Inhabers.
- Namen, Listenresultate, Updates, Statusänderungen, Deletes, Client-Payloads und administrative Eingaben dürfen kein Principal-Mapping begründen.
- Automatische Beobachtungen werden instanzgebunden, credential-versioniert und konfliktfähig geführt. Abweichende Provider-IDs oder konkurrierende Principal-Claims überschreiben kein bestehendes Mapping und werden im automatischen Resolver fail-closed abgewiesen.
- Während des beobachtenden Rollouts kann Studio explizit `credential_visible_compatibility` erzwingen:
  - `own` und `organization` werden nicht anhand vermuteter lokaler Ownership eingeschränkt;
  - erlaubt sind ausschließlich Inhalte, die mit den serverseitig für die konkrete Aktion ausgewählten Credentials unmittelbar gelesen und vom Mainserver mutiert werden können;
  - die fully-qualified Action-Permission, Instanzgrenze, aktive Organisation, Principal-Policy und Mainserver-Autorisierung bleiben verbindlich;
  - der Modus umfasst Update, Publish, Archive, Restore und Hard Delete, jeweils nur mit der eigenen Action-Permission.
- Ein alter Projection-Eintrag ist kein Verfügbarkeitsnachweis. Vor jeder bestehenden Content-Mutation erfolgt ein frischer Pre-Read mit exakt demselben Credential-Kontext wie der anschließende Write.
- `own` benötigt die aktuelle persönliche Bindung. Die vollständige Collection-Sicht für `organization` umfasst unabhängig von der Autorenrichtlinie den persönlichen und den aktiven organisatorischen Principal; eine Bestandsmutation benötigt die Bindung des konkreten Content-DataProviders. Fehlende oder konfliktbehaftete erforderliche Bindungen werden im automatischen Resolver nicht durch Kompatibilität verbreitert. `all` benötigt kein Principal-Mapping, bleibt aber durch Instanz und Mainserver-Sichtbarkeit begrenzt.
- Jede schreibende Studio-Aktion am Mainserver-Content übermittelt explizit `actingPrincipalType: 'organization' | 'user'`. Fehlende Credentials führen nie zu einem stillen Fallback.
- Die Read-Sicht folgt unabhängig von `contentAuthorPolicy` dem IAM-Scope: Im aktiven Organisationskontext sieht ein Mitglied die eigenen und die Inhalte der aktiven Organisation, nicht aber persönliche Inhalte anderer Mitglieder. Persönliche und organisatorische Mainserver-Credential-Sichten bleiben isoliert und werden dedupliziert vereinigt. Kann eine erforderliche Sicht nicht geladen werden, kennzeichnet Studio die Liste immer sichtbar als unvollständig.
- Persönliche und organisatorische Ownership bleibt dauerhaft erhalten. `org_only` beziehungsweise `org_or_personal` steuert den Principal beim Create; bestehende eigene und organisatorische Inhalte verwenden den durch DataProvider-Bindung und Ressourcen-Capability bestätigten Ownership-Principal.
- Administrativ erlaubte Bestandsmutationen führen keinen dritten technischen Admin-Principal ein: Sie verwenden entweder die aktive Organisation oder den persönlichen Account des Administrators und bleiben an Action, Ressourcen-Capability und Same-Credential-Pre-Read gebunden.
- Der membership-gefilterte Session-Contract `GET /api/v1/iam/me/context` liefert die `contentAuthorPolicy` der zugeordneten Organisationen. Alle Mainserver-Editoren und eigenständigen Content-Aktionen bestimmen den Principal zentral anhand von `activeOrganizationId`; sie benötigen dafür weder administrative Organisationsdetails noch `iam.org.read` und bleiben bei unvollständigem Organisationskontext fail-closed.
- Vor dem Create autorisieren Action-Permission, aktive Organisation und Principal-Policy den Zielprincipal; dessen aktuelle Credential-Version muss bereits durch den Identity-Endpunkt verifiziert sein. Ein abweichender Create-DataProvider wird als `reconciliation_required` behandelt, ohne einen bestätigten Provider-Erfolg als zurückgerollt darzustellen.
- Hard Delete verwendet den DataProvider aus dem verpflichtenden Pre-Read und persistiert Actor, Principal, Credential-Fingerprint, DataProvider und Operationsreferenz in Audit beziehungsweise Tombstone, weil ein Post-Delete-Read nicht möglich ist.
- Wird ein Account gelöscht, bleibt kein aktiver Benutzer-Principal bestehen. Abhängig von der konfigurierten Content-Löschregel werden seine Inhalte ebenfalls gelöscht oder ohne aktive Benutzerzuordnung mit `NULL` beziehungsweise einer neutralen Anzeige „Gelöschter Benutzer“ weitergeführt; eine automatische Übertragung auf einen anderen Principal findet nicht statt.
- Die Studio-History dokumentiert ausschließlich im Studio beobachtete Mutationen und weist ihre Abdeckung als `studio_mutations` aus.
- Bestehende freie GraphQL-`author`-Strings bleiben bei Updates unverändert erhalten, werden aber nicht mehr redaktionell angeboten. Neue Mainserver-Inhalte setzen dieses Feld nicht.
- Das Verhalten gilt für News, Events, Points of Interest, Generic Items, FAQ, Cockpit Cards, Projects und Surveys nur entlang einer vorab bestätigten typen- und aktionsbezogenen Mainserver-Vertragsmatrix.

## Impact

- Affected specs: `content-management`, `iam-access-control`, `iam-auditing`, `iam-core`, `iam-data-subject-rights`, `iam-organizations`, `sva-mainserver-integration`
- Affected code: automatisches DataProvider-Mapping und Datenbankschema, Permission-Scope-Auswertung, Credential-Auflösung und Caches, Mainserver-Routen und typisierte Adapter, Content-Projektionen, Mutation-Journal/Tombstones, History/Audit, gemeinsame Editor-Bindings und Content-Plugins
- Affected external contract: SVA-Mainserver-Identity-Endpoint sowie typenbezogene Create-, Read-, Update-, Status- und Delete-Semantik
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`; eine neue ADR supersediert die globale Read-/Fallback-Semantik von ADR-045 und übernimmt deren weiterhin gültige Credential- und Isolationsentscheidungen
- Related changes: Die implementierten Changes `make-mainserver-content-authoritative`, `update-mainserver-editor-resilience`, `standardize-plugin-content-history` und `add-organization-mainserver-provisioning` sind fachliche Voraussetzungen. `centralize-scoped-ui-access` ist für den gemeinsamen fail-closed UI-Decision- und Ressourcen-Capability-Vertrag führend; dieser Change ergänzt ausschließlich die Mainserver-spezifische Principal-Auswahl.
- Breaking behavior: `org_or_personal` erlaubt beim Create eine explizite Principal-Auswahl; bestehende eigene und organisatorische Inhalte lassen keinen freien Principal-Wechsel zu; Schreibaktionen ohne `actingPrincipalType` werden nach dem kompatiblen Transport-Cutover abgewiesen; neue Mainserver-Inhalte setzen keinen freien `author`; exakte `own`-/`organization`-Scopes werden automatisch aktiv, sobald die erforderlichen konfliktfreien Bindungen vorliegen

## Rebaseline vom 12. August 2026

Der Change bleibt die fachliche Klammer für die zentrale Mainserver-Principal-Auflösung,
ist aber noch nicht abschließbar. Offen sind der Self-Service-Kontext ohne `iam.org.read`,
der strikt an `activeOrganizationId` gebundene UI-Resolver sowie die reale persönliche und
organisatorische Read-Contract-Matrix und deren minimal notwendige Auflösungsstrategie.
Development und Staging laufen durch bewusste Produktentscheidung bereits auf `automatic`;
`surveys.create` ist ebenfalls bewusst freigegeben. Production bleibt bis zur späteren
Abnahme auf `shadow`.

## Pragmatischer Abschluss vom 17. August 2026

Der Production-Cutover verlangt keinen realen Volltest jedes Content-Typs mit jeder Aktion.
Maßgeblich ist ein risikobasierter Staging-Canary mit beiden Principal-Arten, einem positiven
Create-/Bestandsmutationspfad je Credential-Art, einem Cross-Principal-Negativfall,
unverändertem ursprünglichem DataProvider und ohne neue ungeklärte Reconciliation-Fälle.
Die übrigen Adapter bleiben über gemeinsame zentrale Verträge, Integrationstests und
Capability-Gates abgesichert.
