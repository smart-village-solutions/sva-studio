# Change: Unveränderlichen Mainserver-DataProvider als Content-Inhaber und Scope-Anker verwenden

## Why

Jede Mainserver-Mutation wird über einen OAuth-Handshake mit den persönlichen oder organisatorischen Credentials des gewählten Principal ausgeführt. Beim Erstellen setzt der Mainserver den an diese Credentials gebundenen DataProvider am Content. Studio muss Actor, Mutationsprincipal, Credential-Quelle, ursprünglichen DataProvider, sichtbare Autorenanzeige und lokale IAM-Ownership konsistent auseinanderhalten.

Der Mainserver-Endpunkt `/data_provider.json` liefert derzeit noch keine stabile DataProvider-ID. Deshalb kann Studio bestehende persönliche und organisatorische Credentials nicht vorab exakt einem DataProvider zuordnen. Die aktuelle Lösung muss bis zur Erweiterung dieses Vertrags ohne Namens-Mapping und ohne manuelle Zuordnungen funktionsfähig bleiben. Inhalte, die mit den für eine konkrete Aktion verwendeten Credentials unmittelbar verfügbar sind, sollen in dieser Übergangszeit unter Beibehaltung der fully-qualified Action-Permission bearbeitet und auch gelöscht werden können.

## What Changes

- Der Mainserver-`dataProvider` wird für Mainserver-basierte Inhalte als unveränderlicher ursprünglicher Inhaber und sichtbarer Autor behandelt; freie `author`-Strings, lokale Owner-Projektionen und der aktuelle Mutationsprincipal dürfen ihn nicht überschreiben.
- Studio erzeugt Principal-zu-DataProvider-Bindungen ausschließlich automatisch:
  - durch einen erfolgreichen Create mit exakt gebundenen persönlichen oder organisatorischen Credentials und die anschließend aus Response oder Same-Credential-Re-Read gelesene DataProvider-ID;
  - zukünftig zusätzlich durch eine stabile ID aus `/data_provider.json`.
- Namen, Listenresultate, Updates, Statusänderungen, Deletes, Client-Payloads und administrative Eingaben dürfen kein Principal-Mapping begründen.
- Automatische Beobachtungen werden instanzgebunden, credential-versioniert und konfliktfähig geführt. Abweichende Provider-IDs oder konkurrierende Principal-Claims überschreiben kein bestehendes Mapping, sondern halten den betroffenen Scope im Kompatibilitätsmodus.
- Solange die für den angeforderten Scope erforderlichen konfliktfreien Bindungen fehlen, verwendet Studio `credential_visible_compatibility`:
  - `own` und `organization` werden nicht anhand vermuteter lokaler Ownership eingeschränkt;
  - erlaubt sind ausschließlich Inhalte, die mit den serverseitig für die konkrete Aktion ausgewählten Credentials unmittelbar gelesen und vom Mainserver mutiert werden können;
  - die fully-qualified Action-Permission, Instanzgrenze, aktive Organisation, Principal-Policy und Mainserver-Autorisierung bleiben verbindlich;
  - der Modus umfasst Update, Publish, Archive, Restore und Hard Delete, jeweils nur mit der eigenen Action-Permission.
- Ein alter Projection-Eintrag ist kein Verfügbarkeitsnachweis. Vor jeder bestehenden Content-Mutation erfolgt ein frischer Pre-Read mit exakt demselben Credential-Kontext wie der anschließende Write.
- `own` wechselt automatisch zur exakten DataProvider-Auswertung, sobald der persönliche Principal konfliktfrei gebunden ist. `organization` wechselt erst, wenn sowohl persönlicher als auch aktiver Organisationsprincipal konfliktfrei gebunden sind. `all` benötigt kein Principal-Mapping, bleibt aber durch die Sichtbarkeit des verwendeten Mainserver-Credentials begrenzt.
- Jede schreibende Studio-Aktion am Mainserver-Content übermittelt explizit `actingPrincipalType: 'organization' | 'user'`. Fehlende Credentials führen nie zu einem stillen Fallback.
- Beim Create autorisieren Action-Permission, aktive Organisation und Principal-Policy den Zielprincipal. Der bestätigte DataProvider erzeugt oder bestätigt anschließend dessen automatische Bindung. Ein Konflikt oder unerwarteter Provider wird als `reconciliation_required` behandelt, ohne einen bestätigten Provider-Erfolg als zurückgerollt darzustellen.
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
