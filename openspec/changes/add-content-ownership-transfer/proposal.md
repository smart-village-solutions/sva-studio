# Change: Inhalte kontrolliert an andere Inhaber übergeben

## Why

Inhalte sind im Studio bereits einem Account oder einer Organisation zugeordnet, können aber insbesondere bei Mainserver-basierten Datensätzen nicht über einen eigenen, verständlichen und revisionssicheren Ablauf an einen anderen Inhaber übergeben werden. Ein normales Bearbeitungsrecht ist dafür zu weit gefasst, während eine freie DataProvider-ID aus dem Browser die Instanz-, Binding- und Credential-Grenzen umgehen würde.

Der Mainserver stellt für News, Events, POI, Touren und Generic Items inzwischen einen geschützten Vertrag zur expliziten DataProvider-Auswahl bereit. Das Studio muss diesen Vertrag über eine eigene Permission, serverseitig aufgelöste Ziel-Principals, einen fehlertoleranten Transferablauf und eine bestätigungspflichtige Oberfläche nutzbar machen.

Referenz: GitHub Issue `#1102` (`feat: Inhalte an einen anderen Inhaber übertragen`).

## What Changes

- Das Studio führt die separate fully-qualified Action `content.transferOwnership` ein. Normale Update-Permissions autorisieren keine Inhaberübertragung mehr.
- Berechtigte Benutzer können einen Inhalt gezielt an einen anderen aktiven Account oder eine andere aktive Organisation derselben Instanz übergeben.
- Der Browser übermittelt ausschließlich Typ und ID des Ziel-Principals. Der Server löst daraus eine eindeutige, konfliktfreie und aktuelle DataProvider-Bindung auf; eine freie DataProvider-ID wird nicht akzeptiert.
- Lokale Inhalte wechseln ihre technische IAM-Ownership, ohne ihre redaktionelle Autorenanzeige automatisch umzuschreiben.
- Mainserver-Inhalte wechseln über den typisierten Upstream-Vertrag ihren DataProvider. Dadurch wechseln der fachliche Inhaber und die sichtbare Autorenidentität gemeinsam.
- Die Bearbeitungsansicht zeigt den aktuellen Inhaber einheitlich im ersten Tab des jeweiligen Inhaltstyps. Bei Mainserver-Inhalten stammt diese Anzeige ausschließlich aus dem aktuellen DataProvider des frisch gelesenen Datensatzes, nicht aus Actor, Credential-Kontext oder Audit-Historie.
- Normales Speichern weist darauf hin, dass der Inhaber unverändert bleibt. Wer übertragen darf, erhält dort zusätzlich den Verweis auf die getrennte Transferaktion; wer nur bearbeiten darf, sieht ausdrücklich, dass ihm das Übertragungsrecht fehlt.
- Die Zielauswahl unterscheidet verständlich zwischen „Persönlicher Account“ und „Organisation“, obwohl beide Ziele serverseitig über ihre jeweilige DataProvider-Bindung umgesetzt werden.
- V1 unterstützt News, Events, POI, Touren und Root-GenericItems einschließlich der vom Mainserver atomar mitgeführten abhängigen Datensätze. Surveys, Batch-Importe und andere nicht bestätigte Typen bleiben capability-gated und erhalten keine Transferaktion.
- Der Ablauf verwendet Fresh Pre-Read, bestehende Mutation-Journale, DataProvider-Locks, Audit und Reconciliation. Ein unklarer Upstream-Ausgang wird durch Source-/Target-Re-Reads geklärt oder als `reconciliation_required` markiert.
- Die Content-Oberflächen erhalten eine gemeinsame Inhaberanzeige sowie eine zugängliche, bestätigungspflichtige Aktion „Inhalt übertragen“ mit validierter Zielauswahl und verständlichem Ergebnisfeedback. Nicht unterstützte Inhaltstypen zeigen weiterhin den aktuellen Inhaber, aber keine aktive Transferaktion.
- Das Audit dokumentiert Studio-beobachtete Transfers, ist aber ausdrücklich keine vollständige Inhaberhistorie: Änderungen außerhalb des Studios können fehlen. Maßgeblich bleibt immer der aktuelle Zustand des Datensatzes.
- **BREAKING**: Ein bisher ausreichendes `content.updateMetadata`-Recht erlaubt keine Änderung von `ownerUserId` oder `ownerOrganizationId` mehr; dafür ist `content.transferOwnership` erforderlich.

## Non-Goals

- Keine freie Auswahl oder Eingabe einer Mainserver-DataProvider-ID.
- Keine instanz- oder municipality-übergreifende Übergabe.
- Keine automatische Übergabe bei Organisationswechsel, Membership-Änderung, Account-Sperre oder Account-Löschung.
- Kein Account-Merge, keine Identitätskonflikt-Reconciliation und keine Credential-Übertragung.
- Keine Bulk-Übergabe in V1.
- Keine Unterstützung für Surveys, Batch-Importe oder Mainserver-Typen ohne bestätigten Transfervertrag.
- Keine direkte Datenbankänderung im Mainserver und keine lokale Umschreibung, die einen fehlgeschlagenen Provider-Transfer verdeckt.

## Dependencies

- Der Ziel-Mainserver muss den optionalen `dataProviderId`-Vertrag für die fünf V1-Mutationen ausliefern und die abhängigen Datensätze sowie `ExternalReference` atomar mitführen. Die derzeitige Source-Baseline ist Mainserver-Commit `ee619d0e`.
- Der ausführende persönliche oder organisatorische Mainserver-Principal benötigt die Rolle `studio` oder eine gleichwertige Management-Rolle. Bestehende Credentials ohne diese Rolle müssen vor der Abnahme kontrolliert reprovisioniert werden.
- Der eingecheckte Mainserver-Schema-Snapshot im Studio muss gegen ein verifiziertes Ziel-Schema aktualisiert werden, bevor die typisierten Transfermutationen aktiviert werden.

## Impact

- Affected specs: `content-management`, `iam-access-control`, `iam-auditing`, `sva-mainserver-integration`
- Affected code: `packages/core`, `packages/auth-runtime`, `packages/iam-core`, `packages/sva-mainserver`, `packages/plugin-sdk`, `packages/studio-ui-react`, `apps/sva-studio-react` und die produktiven Content-Plugins
- Affected docs: Content-/IAM-Bedienung, Mainserver-Runbook, Permission-Referenz und Transfer-Abnahmematrix
- Affected arc42 sections: 03 Kontext und Scope, 04 Lösungsstrategie, 05 Bausteinsicht, 06 Laufzeitsicht, 08 Querschnittliche Konzepte und 09 Architekturentscheidungen
- New ADR: Kontrollierter Content-Inhabertransfer über IAM-Principal und Mainserver-DataProvider
