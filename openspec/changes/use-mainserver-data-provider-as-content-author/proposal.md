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
- `own` benötigt die aktuelle persönliche Bindung. `organization` benötigt bei `org_only` ausschließlich die aktuelle Organisationsbindung und bei `org_or_personal` die aktuellen persönlichen und organisatorischen Bindungen. Fehlende oder konfliktbehaftete erforderliche Bindungen werden im automatischen Resolver nicht durch Kompatibilität verbreitert. `all` benötigt kein Principal-Mapping, bleibt aber durch Instanz und Mainserver-Sichtbarkeit begrenzt.
- Jede schreibende Studio-Aktion am Mainserver-Content übermittelt explizit `actingPrincipalType: 'organization' | 'user'`. Fehlende Credentials führen nie zu einem stillen Fallback.
- Vor dem Create autorisieren Action-Permission, aktive Organisation und Principal-Policy den Zielprincipal; dessen aktuelle Credential-Version muss bereits durch den Identity-Endpunkt verifiziert sein. Ein abweichender Create-DataProvider wird als `reconciliation_required` behandelt, ohne einen bestätigten Provider-Erfolg als zurückgerollt darzustellen.
- Hard Delete verwendet den DataProvider aus dem verpflichtenden Pre-Read und persistiert Actor, Principal, Credential-Fingerprint, DataProvider und Operationsreferenz in Audit beziehungsweise Tombstone, weil ein Post-Delete-Read nicht möglich ist.
- Die Studio-History dokumentiert ausschließlich im Studio beobachtete Mutationen und weist ihre Abdeckung als `studio_mutations` aus.
- Bestehende freie GraphQL-`author`-Strings bleiben bei Updates unverändert erhalten, werden aber nicht mehr redaktionell angeboten. Neue Mainserver-Inhalte setzen dieses Feld nicht.
- Das Verhalten gilt für News, Events, Points of Interest, Generic Items, FAQ, Cockpit Cards, Projects und Surveys nur entlang einer vorab bestätigten typen- und aktionsbezogenen Mainserver-Vertragsmatrix.

## Impact

- Affected specs: `content-management`, `iam-access-control`, `iam-auditing`, `iam-core`, `iam-data-subject-rights`, `iam-organizations`, `sva-mainserver-integration`
- Affected code: automatisches DataProvider-Mapping und Datenbankschema, Permission-Scope-Auswertung, Credential-Auflösung und Caches, Mainserver-Routen und typisierte Adapter, Content-Projektionen, Mutation-Journal/Tombstones, History/Audit, gemeinsame Editor-Bindings und Content-Plugins
- Affected external contract: SVA-Mainserver-Identity-Endpoint sowie typenbezogene Create-, Read-, Update-, Status- und Delete-Semantik
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`
- Related active changes: `make-mainserver-content-authoritative`, `update-mainserver-editor-resilience` und `standardize-plugin-content-history` müssen vor Archivierung mit diesem Vertrag komponiert werden
- Breaking behavior: `org_or_personal` erlaubt eine explizite Principal-Auswahl; Schreibaktionen ohne `actingPrincipalType` werden nach dem kompatiblen Transport-Cutover abgewiesen; neue Mainserver-Inhalte setzen keinen freien `author`; exakte `own`-/`organization`-Scopes werden automatisch aktiv, sobald die erforderlichen konfliktfreien Bindungen vorliegen
