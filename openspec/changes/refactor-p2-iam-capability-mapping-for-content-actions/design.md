## Context

Content-Aktionen entstehen zunehmend aus Core-Funktionalität, registrierten Content-Typen und plugin-nahen Beiträgen. Die zentrale Permission Engine bleibt der maßgebliche Ort für Allow/Deny-Entscheidungen, kennt aber primitive Studio-Action-IDs und nicht zwingend jede fachliche Aktion, die eine UI oder ein Content-Typ anbietet.

Der Change führt deshalb eine deklarative Zwischenschicht ein: Eine Aktion deklariert eine fachliche Capability, der Host löst diese Capability auf eine primitive Studio-Action auf, und nur diese primitive Action wird gegen die bestehende Permission Engine geprüft.

## Goals

- Eine fachliche Aktion wird in UI, API und Audit gleich bezeichnet.
- Eine primitive Studio-Action bleibt die einzige Grundlage für echte Autorisierung.
- Mutierende Aktionen ohne unterstützte Capability werden früh abgewiesen.
- Fehlende Mappings führen zu deterministischen Denials statt zu impliziten Fallbacks.
- Plugins und Content-Typen liefern Metadaten, aber keine ausführbare Autorisierungslogik.

## Non-Goals

- Kein neues Rollen- oder Ownership-Modell.
- Keine zweite Permission Engine.
- Keine Plugin-eigenen Guard-Funktionen oder Permission-Resolver.
- Keine Migration weg von bestehenden primitiven Studio-Action-IDs.
- Keine rein UI-seitige Autorisierung.
- Keine vollständige Vereinheitlichung aller Admin-Aktionen in diesem P2-Schnitt.
- Keine Erweiterung von Audit-Exportformaten, die über konsistente Speicherung der neuen Audit-Felder hinausgeht.

## Aufwand/Nutzen-Entscheidung

Der höchste Nutzen liegt bei mutierenden Content-Aktionen, weil sie fachlich sichtbar, auditrelevant und durch Plugin-Content-Typen erweiterbar sind. Admin-Aktionen haben ein ähnliches Problem, aber meist andere Ressourcenverträge, Scope-Regeln und UI-Flows. Sie werden deshalb nicht in denselben Umsetzungsschnitt gezogen.

Die optimierte Umsetzung ist:

1. Content-Capabilities modellieren und auf bestehende primitive Studio-Action-IDs abbilden.
2. Mutierende Content-Aktionsregistrierung gegen dieses Mapping validieren.
3. Serverseitige Content-Action-Handler immer über die aufgelöste primitive Action autorisieren.
4. Audit-Events additiv um Capability und primitive Action ergänzen.

Das vermeidet eine breite Admin-/Export-Migration und liefert trotzdem den wichtigsten Sicherheits- und Wartbarkeitsgewinn.

## Model

Der Mapping-Vertrag besteht aus mindestens:

- `domainCapability`: fachliche, stabile Capability-ID, z. B. eine Publish-, Archive- oder Bulk-Edit-Capability.
- `primitiveAction`: bestehende autorisierbare Studio-Action-ID im fully-qualified Format.
- `resourceType`: Zielressource, für diesen Change primär `content`.
- `scopeKind`: erwarteter Scope, z. B. Instanz-, Organisations- oder Ressourcen-Scope.
- `auditClassification`: Klassifikation für Audit-Pfade.
- `diagnosticCode`: stabiler Code für Missing-Mapping-, Invalid-Mapping- oder Denial-Fälle.

Die Domain-Capability beschreibt die fachliche Absicht. Die primitive Action beschreibt das technische Recht, das in Rollen, Permission-Snapshots und `POST /iam/authorize` ausgewertet wird.

## Runtime Flow

1. Der Content-Typ registriert eine mutierende Aktion mit deklarierter `domainCapability`.
2. Der Host validiert beim Aufbau des Registry-Snapshots, ob die Capability bekannt und auf eine primitive Action abbildbar ist.
3. Die UI nutzt den validierten Mapping-Vertrag, um Aktionsverfügbarkeit und Diagnosehinweise darzustellen.
4. Beim Ausführen der Aktion löst der serverseitige Handler die Capability erneut auf.
5. Der Handler ruft die zentrale Permission Engine mit der primitiven Action, Resource-Type und Scope auf.
6. Persistence oder Statuswechsel laufen nur nach erfolgreicher Autorisierung.
7. Der Host erzeugt Audit-Events mit fachlicher Capability, primitiver Action, Actor, Scope, Ergebnis und Denial-Grund.

## Failure Modes

- `capability_mapping_missing`: Eine Aktion referenziert eine Capability ohne registriertes Mapping.
- `capability_mapping_invalid`: Ein Mapping verweist auf eine nicht autorisierbare oder nicht fully-qualified primitive Action.
- `capability_scope_mismatch`: Die Aktion liefert keinen zum Mapping passenden Scope.
- `capability_authorization_denied`: Die Capability wurde aufgelöst, aber die Permission Engine verweigert die primitive Action.

Alle Fehler müssen serverseitig sicher deny-by-default behandelt werden. Die UI darf diese Diagnosen anzeigen, aber nicht in Allow-Entscheidungen umdeuten.

## Package Boundaries

Der Mapping-Vertrag gehört in framework-agnostische Kern- oder IAM-nahe Pakete. React-Bindings und SDK-Hilfen dürfen daraus lesen, aber keine eigene Mapping- oder Autorisierungslogik duplizieren.

`@sva/auth-runtime` ist für diesen Change der maßgebliche Runtime-Pfad: App, Routing und Mainserver konsumieren stabile `@sva/auth-runtime`-Fassaden. Das ältere `@sva/auth`-Package bleibt in diesem P2-Schnitt unberührt und wird nicht synchron mitimplementiert; eine spätere Legacy-Bereinigung muss separat entscheiden, ob Code dort entfernt, archiviert oder gezielt nachgezogen wird.

Serverseitig von Node geladene Workspace-Packages müssen ESM-strikte Runtime-Imports mit `.js`-Endungen verwenden. Runtime-Imports auf andere Workspace-Packages müssen im jeweiligen `package.json` unter `dependencies` stehen.
