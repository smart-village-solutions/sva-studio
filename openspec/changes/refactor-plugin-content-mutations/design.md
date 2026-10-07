# Design: Plugin-eigene Content-Mutationen

## Bestehenden Beitragspfad erweitern

Die Änderung erweitert den vorhandenen Content-Beitrag und seinen validierten Registry-Snapshot um optionale Laufzeitfähigkeiten für Löschen und Statuswechsel. Sie führt weder eine zweite Registry noch einen separaten Admin- oder Mutation-Provider ein. Ausführbare Handler gehören zur Browser-Runtime des Plugins; sie werden nicht als serialisierbare Manifest-Metadaten oder Server-Descriptor behandelt.

Der Host löst für einen Listeneintrag den Beitrag über dessen `contentType` auf. Er stellt nur Fähigkeiten bereit, die im validierten Snapshot vorhanden sind und deren deklarierte Action zum Plugin-Namespace und Content-Typ passt. Der Host bleibt für Berechtigungsanzeige, Bulk-Selektion, Einzelergebnis, Refresh und Fehlerzustände zuständig.

## Mutationsverträge

- Löschen erhält die bestehende Action- und Principal-Übergabe und liefert pro Eintrag denselben Erfolg-/Fehlervertrag wie bisher.
- Statuswechsel meldet die erlaubten Zielstatus aus dem Plugin-Beitrag und delegiert die Mutation an diesen Beitrag.
- Der Plugin-Handler liest den aktuellen fachlichen Datensatz und erhält beim Read-Merge-Write alle Felder, die der Statuswechsel nicht ändert.
- Bei Event- und POI-Statuswechseln nutzt der Handler die vorhandenen Detailclients `getEventDetail` beziehungsweise `getPoiDetail` und wertet deren `deviations` vor dem Schreiben aus. Betrifft eine Abweichung ein nicht vom Statuswechsel betroffenes Feld, das der Update-Payload zurückschreiben würde, wird vor `update*` kontrolliert abgebrochen; ein erfolgreicher HTTP-Read allein belegt keine vollständige Datenerhaltung.
- Fehlender Beitrag, unbekannte Fähigkeit oder nicht deklarierter Zielstatus beendet die Mutation kontrolliert, ohne einen anderen Client als Fallback aufzurufen.
- Die Plugin-Clients bleiben hinter den bestehenden API-/Servergrenzen; diese Änderung verschiebt keine serverseitige Autorisierungsentscheidung in den Browser. Validierung und Auditierung bleiben im bestehenden Host-/API-Pfad erhalten; bestehende Guardrail-Diagnostikcodes und der Ablehnungsvertrag für dynamische Registrierung bleiben unverändert.

## Konkreter Browser-Vertrag

`ContentTypeDefinition` in `packages/plugin-sdk/src/content-types.ts` erhält eine optionale Eigenschaft `mutations` mit höchstens einem `delete`- und einem `status`-Beitrag. Die folgenden Formen sind der Umsetzungsvertrag; die Typen liegen beim bestehenden SDK-Content-Beitrag und verwenden die vorhandenen `IamContentStatus`- und `MainserverActingPrincipalType`-Typen. Kein Import aus dem React-UI-Paket in das SDK ist erforderlich.

```ts
mutations?: {
  readonly delete?: {
    readonly requiredAction: string;
    readonly requiresMainserverMutationAction?: true;
    readonly execute: (
      contentId: string,
      actingPrincipalType: MainserverActingPrincipalType
    ) => Promise<void>;
  };
  readonly status?: {
    readonly requiredAction: string;
    readonly requiresMainserverMutationAction?: true;
    readonly supportedStatuses: readonly IamContentStatus[];
    readonly execute: (
      contentId: string,
      status: IamContentStatus,
      actingPrincipalType: MainserverActingPrincipalType
    ) => Promise<void>;
  };
};
```

Die Handler schließen ihren vorhandenen Plugin-API-Client ein. Sie erhalten weder die ganze Listenzeile noch einen Host-Servicecontainer. Erfolgreiche Auflösung der Promise bedeutet Erfolg für genau einen Eintrag; API-Fehler werden als Rejection an den bestehenden Host-Fehlerpfad weitergereicht. Fehlender Beitrag oder nicht unterstützter Zielstatus muss vor einem Client-Aufruf kontrolliert fehlschlagen und darf nicht als erfolgreicher No-op enden. Dafür genügt der vorhandene Fehlerpfad mit technischem Fehlercode; keine neue Result-Hierarchie oder Fehler-Registry einführen.

Der Host löst Beitrag und Action aus dem validierten Snapshot auf und prüft sie sowohl vor der Anzeige als auch unmittelbar vor der Ausführung. Bestehende Zeilenzugriffsrechte, Action-Verfügbarkeit und Principal-Ermittlung bleiben maßgeblich. `requiresMainserverMutationAction: true` bedeutet zusätzlich, dass `requiredAction` in den bestehenden `enabledMainserverMutationActions` vorkommen muss; das deklarieren nur die bereits so geschützten Survey-Fähigkeiten. Es ersetzt keine serverseitige Autorisierung. Die sichere Ermittlung aus `credentialSource` und der bestehende persönliche Legacy-Fallback bleiben im Host; ohne ermittelbaren Principal erfolgt kein Aufruf.

## Zu überführende Fähigkeiten und bestehende Verbraucher

| Content-Typ                  | Löschen / Action                             | Schnellstatus / Action                              | Bestehender fachlicher Pfad                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `news.article`               | `deleteNews` / `news.delete`                 | `draft`, `published` / `news.update`                | `getNews`, danach `setNewsVisibility`                                                                                                                                                                 |
| `events.event-record`        | `deleteEvent` / `events.delete`              | `draft`, `published` / `events.update`              | `getEventDetail`, danach `updateEvent` mit geändertem `visible`                                                                                                                                       |
| `poi.point-of-interest`      | `deletePoi` / `poi.delete`                   | `draft`, `published` / `poi.update`                 | `getPoiDetail`, danach `updatePoi` mit geändertem `active`                                                                                                                                            |
| `surveys.survey`             | `deleteSurvey` / `surveys.delete`            | `draft`, `published`, `archived` / `surveys.update` | Vorhandene Locale-Auflösung, `DRAFT`/`ACTIVE`/`ARCHIVED`-Abbildung und `updateSurvey` inklusive aktuellem Datensatz erhalten; beide Fähigkeiten benötigen die bestehende zusätzliche Laufzeitfreigabe |
| `generic-items.generic-item` | `deleteGenericItem` / `generic-items.delete` | `draft`, `published` / `generic-items.update`       | `getGenericItem`, danach `updateGenericItem` mit geändertem `visible`                                                                                                                                 |
| `faq.faq`                    | `deleteFaq` / `faq.delete`                   | kein Beitrag                                        | Bestehenden Löschclient erhalten                                                                                                                                                                      |
| `cockpit-cards.cockpit-card` | `deleteCockpitCard` / `cockpit-cards.delete` | kein Beitrag                                        | Bestehenden Löschclient erhalten                                                                                                                                                                      |
| `projects.project`           | `deleteProject` / `projects.delete`          | kein Beitrag                                        | Bestehenden Löschclient erhalten                                                                                                                                                                      |

Ausgangspunkt sind `apps/sva-studio-react/src/routes/content/-content-list-row-actions.tsx`, `-content-list-deletion.ts`, `-content-status-dialog.tsx` und `apps/sva-studio-react/src/lib/content-status-mutation.ts`. Die bisherigen Fachtyp-Dispatches und pluginbezogenen Statushilfen werden durch die Beiträge ersetzt; die generische Principal-Ermittlung bleibt bestehen. Die Registrierungs-/Snapshot-Materialisierung muss die neuen Browser-Fähigkeiten bis zur Listen- und Dialogauflösung erhalten.

Der bestehende IAM-Bulk-Pfad über `contentsApi.deleteContents` und `archiveContents` bleibt erhalten, einschließlich expliziter ID-Auswahl, Einschränkung der auswählbaren Einträge, Teilfehlern, Retry-Auswahl und Refresh. Dieser Change führt weder Plugin-Bulk-Löschen noch Plugin-Bulk-Archivieren ein und erweitert die Bulk-Auswahl nicht auf bisher ausgeschlossene Mainserver-Einträge. Bestehende gemischte Bulk-Ergebnisse sind Regressionstests für den Host, kein neuer Handler-Vertrag.

## Grenzen der Registry-Validierung

Die bestehende Registry prüft ausschließlich die deklarierte Struktur: erlaubte Schlüssel, Besitzer-Namespace und eindeutiger Content-Typ, vorhandene und passende Action-Definition, aufrufbarer Handler sowie nicht leere und eindeutige zulässige Zielstatus. Die Capability-Action muss zum Besitzer-Namespace gehören und in den bestehenden Plugin-Actions mit dem passenden Content-Bezug deklariert sein. Eine vorhandene Capability ohne Handler wird abgelehnt; eine vollständig fehlende Capability ist erlaubt. Pro Operation existiert genau ein Beitrag; doppelte Content-Typen und widersprüchliche Deklarationen werden deterministisch abgelehnt.

Bestehende Guardrails lehnen deklarierte unerlaubte Persistenz-, Routing- oder Autorisierungsbindungen weiterhin mit ihren bisherigen Codes ab. Die Registry analysiert keine Funktionskörper und behauptet keinen Nachweis des Verhaltens beliebiger Handler. Die Verwendung bestehender Clients sowie die Einhaltung der Server-, Validierungs- und Audit-Grenzen werden durch die zuständigen Plugin-Tests, bestehende Server-Gates und Code-Review geprüft.

## Entscheidung über Detailabweichungen

Event-/POI-Handler lesen mit demselben ermittelten Principal, der auch an das Update geht. Grundlage ist die Antwort `{ data, deviations }` des vorhandenen Detailclients. Maßgeblich ist `fieldGroup` der Deviation, nicht allein ein erfolgreicher Read oder ein Vergleich einzelner `handling`-Werte.

Vor `updateEvent` beziehungsweise `updatePoi` wird geprüft, ob eine Deviation eine unverändert zurückzuschreibende schreibbare Feldgruppe betrifft. Dabei sind die vorhandenen `EventFormInput`-/`PoiFormInput`-Felder und die bestehenden API-/Server-Mappings maßgeblich; auch durch Normalisierung erzeugte Ersatzwerte, gefilterte Arrays und beim Update als Leerung behandelte fehlende Felder zählen als Schreibwirkung. Event ändert ausschließlich `visible`, POI ausschließlich `active`; Deviation-Gruppen dieser gezielt ersetzten Statusfelder sind für sich kein Abbruchgrund. Abweichungen reiner Read-only-Metadaten ohne Schreibwirkung blockieren ebenfalls nicht. Keine neue zentrale Feldmatrix und keine Importe von Server-Internals in Browserhandler anlegen.

Konkrete Entscheidungsfälle für die lokalen Plugin-Tests:

- Event: `dates[]` mit `fieldGroup: 'dates'` wurde beim erfolgreichen Read gefiltert → kein `updateEvent`; ebenso normalisierte `title` oder `tags`, wenn sie zurückgeschrieben würden.
- POI: gefilterte `categories[]` mit `fieldGroup: 'categories'` → kein `updatePoi`.
- Vollständiger Read ohne relevante Deviation → Update mit unveränderten übrigen Feldern und korrektem Principal.
- Ausschließlich Deviation des gezielt ersetzten Statusfelds oder nachweislich nicht geschriebener Read-only-Metadaten → Statuswechsel bleibt möglich.

Unbekannte Deviation-Gruppen dürfen nur ignoriert werden, wenn anhand des bestehenden Mappings ihre fehlende Schreibwirkung belegt ist; sonst kontrolliert abbrechen. Die Prüfung bleibt lokal im jeweiligen Handler. Keine neue Upstream-API, automatische Datenreparatur oder zusätzliche Concurrency-Garantie ist Teil dieser Änderung.

## Laufzeit- und Paketgrenze

Nur die Studio-Browser-Runtime konsumiert die Funktionshandler. Deskriptoren, Manifeste und serverseitige Snapshots behalten ausschließlich ihre bisherigen serialisierbaren Metadaten. Das erhält die in #1511/#1512 etablierte Trennung zwischen Browser-Modulen und Server-/Job-Einstiegspunkten.

## Verifikation

Neben den bestehenden Listen-, Status- und Typprüfungen werden Registry-Tests für falsche Namespace-Zuordnung, doppelte oder ungültige Fähigkeiten und fehlende Handler benötigt. Die Negativmatrix muss nachweisen, dass nicht installierte oder entfernte Beiträge keinen ausführbaren Handler im Host hinterlassen.

Ein Plugin-Negativtest bildet die bereits in `packages/sva-mainserver/src/server/service-internals/resilient-detail-mappers.test.ts` belegte erfolgreiche Event-Antwort mit gefilterten `dates` und zugehöriger Deviation ab und erwartet keinen Update-Aufruf. Für POI wird die entsprechende Deviation eines zurückzuschreibenden Feldes geprüft; unveränderte vollständige Datensätze bleiben als Positivfälle erhalten.

## Konkretisierte Browser-Bindung

Die bestehenden Content-Deskriptoren in `src/plugin.tsx` bleiben unverändert und handlerfrei. Der Browser-Einstieg `src/index.ts` exportiert denselben Plugin-Beitrag mit den zusätzlichen `ContentTypeDefinition.mutations`. Der bestehende Katalogloader vergleicht alle übrigen Metadaten mit dem Descriptor, übernimmt die Browser-Contenttypen und validiert sie vor Veröffentlichung des Snapshots. Es gibt weder eine zweite Mutationsregistry noch neue Manifest-Felder.

Für die beiden konkreten Operationen referenziert `requiredAction` die vorhandene eigene `<namespace>.delete`- beziehungsweise `<namespace>.update`-Action einschließlich passender Permission-Deklaration. Das erhält die bestehenden Operations- und Action-Verträge ohne neue Zuordnungsschicht.
