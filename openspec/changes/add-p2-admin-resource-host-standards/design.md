## Context

Der aktuelle Admin-Backbone hat bereits mehrere Bausteine, die in Richtung eines hostgeführten Resource-Standards zeigen:

- `packages/plugin-sdk/src/admin-resources.ts` definiert `AdminResourceDefinition` mit `resourceId`, `basePath`, `titleKey`, `guard` und `views`.
- `packages/routing/src/admin-resource-routes.ts` erzeugt daraus Admin-Routen für Liste, Create, Detail und optional History.
- `apps/sva-studio-react/src/components/StudioDataTable.tsx` bietet Tabellenlayout, Sortierung, Auswahl und Bulk-Action-Slots.
- Die IAM-Zielpackages enthalten Activity-Logs, Content-History und IAM-Bulk-Mutationspfade.

Die fehlende Schicht ist ein deklarativer Vertrag, der beschreibt, welche Host-Standards eine Admin-Ressource nutzt und wie diese Standards mit Routing, UI, Datenabfrage und Audit verbunden werden.

## Goals

- Admin-Ressourcen deklarieren wiederverwendbare Listenfähigkeiten: Suche, Filter, Sortierung, Pagination und Bulk-Actions.
- Admin-Ressourcen deklarieren wiederverwendbare Detailfähigkeiten: History-Anzeige, Revisionen und Revision-Restore.
- Der Host normalisiert Search-Params zentral und stellt eine stabile, teilbare URL für Listenstatus bereit.
- Der Host validiert Capability-Deklarationen früh im Registry-/Build-Time-Pfad.
- Bestehende Ressourcen bleiben ohne Capability-Deklaration lauffähig.

## Proposed Contract Shape

Der Vertrag soll `AdminResourceDefinition` rückwärtskompatibel erweitern. Die genaue Typform wird in der Implementierung finalisiert, soll aber diese Struktur abbilden:

```ts
type AdminResourceDefinition = {
  readonly resourceId: string;
  readonly basePath: string;
  readonly titleKey: string;
  readonly guard: AdminResourceGuard;
  readonly views: AdminResourceViews;
  readonly capabilities?: {
    readonly list?: {
      readonly search?: AdminResourceSearchDefinition;
      readonly filters?: readonly AdminResourceFilterDefinition[];
      readonly sorting?: AdminResourceSortingDefinition;
      readonly pagination?: AdminResourcePaginationDefinition;
      readonly bulkActions?: readonly AdminResourceBulkActionDefinition[];
    };
    readonly detail?: {
      readonly history?: AdminResourceHistoryDefinition;
      readonly revisions?: AdminResourceRevisionDefinition;
    };
  };
};
```

Definitionsfelder müssen serialisierbar oder über bestehende Binding-Keys referenzierbar bleiben. Plugins sollen keine beliebigen React-Komponenten in Capability-Deklarationen einschleusen; Rendering und Interaktionsmuster bleiben Host-Verantwortung.

## Minimum Capability Contract

Die erste Implementierungsstufe soll bewusst klein bleiben und nur Felder aufnehmen, die der Host deterministisch normalisieren, rendern, testen und auditieren kann.

- `search`: `param`, `placeholderKey`, `fields`, optional `minLength`, optional `debounceMs`. Der Host normalisiert leere oder zu kurze Suchwerte auf `undefined`.
- `filters`: stabile `id`, `param`, `labelKey`, `type`, `defaultValue` und erlaubte Werte oder Referenz auf einen Host-Binding-Key. Erlaubte Basistypen sind `singleSelect`, `multiSelect`, `boolean`, `dateRange` und `text`.
- `sorting`: erlaubte `fields`, `default`, optionale `directions`. Sortierfelder sind stabile Feld-IDs und keine frei formulierten Query-Fragmente.
- `pagination`: `paramPrefix`, `defaultPageSize`, `allowedPageSizes` und `maxPageSize`. Page-Werte kleiner 1 und Page-Size-Werte außerhalb der erlaubten Liste werden normalisiert.
- `bulkActions`: stabile fully-qualified `actionId`, `labelKey`, optionale `descriptionKey`, erforderlicher `confirmation`-Modus, `selectionScope` und Referenz auf Mutation-/Action-Binding.
- `history`: Binding-Key für History-Daten, `titleKey` und erlaubte Detail-Affordances.
- `revisions`: Binding-Key für Revision-Daten, Restore-Action-ID und Restore-Confirmation.

Alle IDs, Params und Binding-Keys müssen innerhalb einer Resource eindeutig sein. User-sichtbare Texte werden ausschließlich als i18n-Keys deklariert.

## Canonical Search Params

Der Host erzeugt je Resource einen kanonischen Search-Param-Vertrag. Die erste Stufe verwendet stabile, vorhersehbare Parameter:

- `q` für Suche, sofern die Resource keinen abweichenden Search-Param deklariert.
- `sort` und `dir` für Sortierung.
- `page` und `pageSize` für Pagination.
- Filter verwenden ihren deklarierten `param`; Multi-Select-Werte werden als wiederholbare oder kanonisch sortierte Werte normalisiert.

Ungültige Search-Params werden nicht ungeprüft an Datenadapter weitergereicht. Der Host normalisiert sie auf Defaultwerte, entfernt unbekannte Resource-Params aus dem normalisierten State und stellt Tests für URL-Rehydration, Defaulting und Deep-Link-Verhalten bereit.

## Bulk-Action Semantics

Bulk-Actions müssen vor der Ausführung eine explizite Auswahlsemantik haben:

- `explicitIds`: nur sicht- oder explizit ausgewählte Datensätze.
- `currentPage`: alle Treffer der aktuellen Seite nach normalisiertem Query-State.
- `allMatchingQuery`: alle Treffer des aktuellen Query-State; nur zulässig, wenn der Datenadapter diese Operation serverseitig begrenzen und auditieren kann.

Der Host besitzt Auswahl-State, Confirmation-UI, Disabled-State und Übergabe des normalisierten Query-/Selection-Inputs. Packages besitzen fachliche Mutation, Autorisierung, serverseitige Limits und Validierung. Self-Protection, Privilege-Escalation-Schutz oder domänenspezifische Ausschlüsse bleiben Package-/Server-Verantwortung, müssen aber in der Action-Antwort für Host-Feedback abbildbar sein.

## Host Responsibilities

- Erzeugen und Validieren kanonischer Search-Params je Resource.
- Rendern standardisierter Search-, Filter-, Pagination- und Bulk-Controls.
- Verwalten von Auswahl-State und Bulk-Action-Confirmations, soweit fachlich generisch möglich.
- Anzeigen von History-/Revision-Affordances, wenn die Resource sie deklariert.
- Ausgeben verständlicher Diagnostics für unbekannte Capability-Felder, ungültige Filtertypen, doppelte IDs, unsupported Operations und Binding-Konflikte.
- Übergabe normalisierter Query-/Action-Inputs an die jeweiligen Datenadapter oder bestehenden Resource-Bindings.

## Package Responsibilities

- Deklaration der unterstützten Felder, Filteroptionen, Sortierfelder und Bulk-Actions.
- Bereitstellung fachlicher Datenabfragen und Mutationen.
- Autorisierung, serverseitige Input-Validation und PII-sichere Audit-Payloads.
- Fachliche Texte über i18n-Keys statt hardcoded UI-Strings.

## Routing and Search Params

Search-, Filter-, Sortier- und Pagination-State muss route-addressable sein. Für deklarierte Host-Listenfähigkeiten erzeugt `packages/routing` validierte Search-Param-Normalisierung, damit:

- Reload und Deep-Link denselben Listenstatus wiederherstellen.
- ungültige Werte auf Defaultwerte normalisiert werden.
- Tests die kanonische URL und den normalisierten State prüfen können.
- lokale Komponenten-States nicht mehr die Quelle der Wahrheit für deklarierte Host-Listenfähigkeiten sind.

## Auditing

Hostgeführte Operationen mit Sicherheits- oder Compliance-Relevanz müssen bestehende Audit-/Activity-Mechanismen nutzen:

- Bulk-Actions erfassen Resource-ID, fully-qualified Action-ID, Actor, Scope, normalisierte Query-/Selection-Metadaten und Anzahl akzeptierter, übersprungener und fehlgeschlagener Records.
- Revision-Restores verknüpfen Resource-ID, Record-ID, aktuelle Revision, wiederhergestellte Revision und Restore-Action-ID.
- History-sensitive Operationen verwenden vorhandene Activity-Log- oder Audit-Event-Pfade, statt parallele Audit-Infrastruktur einzuführen.
- Audit-Payloads dürfen keine ungefilterten Suchtexte, Freitextfilter oder PII-Felder enthalten; der Host standardisiert nur Metadaten, IDs, Counts und sichere Scope-Informationen.

## Migration Plan

1. Vertrag und Guardrails rückwärtskompatibel erweitern.
2. Routing/Search-Param-Normalisierung für deklarierte Resource-Listen einführen.
3. Host-UI-Komposition auf Basis der bestehenden `StudioDataTable` ergänzen.
4. `content` als Pilotressource migrieren.
5. Tests für Registry, Routing, UI, Datenadapter und Audit ergänzen.
6. arc42-Dokumentation aktualisieren.

## Risks and Mitigations

- Risiko: Der Vertrag wird zu generisch und bildet fachliche Sonderfälle schlecht ab.
  Mitigation: Capability-Set klein halten und unsupported Deklarationen diagnostizieren statt beliebige Escape-Hatches zu erlauben.
- Risiko: Plugin-Deklarationen werden zu React-spezifisch.
  Mitigation: Vertrag in `plugin-sdk` serialisierbar und framework-arm halten; React-Bindings bleiben im Host.
- Risiko: Migration bricht bestehende Admin-Routen.
  Mitigation: Legacy-Ressourcen ohne `capabilities` unverändert behandeln und mit `content` als Pilot starten.
- Risiko: Audit-Payloads enthalten PII.
  Mitigation: Audit-Inputs serverseitig validieren und nur Resource-/Action-/Count-/Scope-Metadaten standardisieren.
