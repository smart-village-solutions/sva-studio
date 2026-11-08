# Orte: Bedeutung von `active` und `visible`

Stand: 04.11.2026. Untersuchung der lokalen Quellstände von Mainserver,
mobiler App und Studio. Keine Produktivmutation und keine Codeänderung.

## Ergebnis

Für die geprüften normalen Ortsabfragen steuert `visible` die Auslieferung an
die mobile App. `active` ist ein persistiertes, beschreibbares und abrufbares
Feld; eine Filterwirkung auf die geprüften Ortslisten, Details oder die Suche
ist nicht implementiert. Die Studio-Zuordnung `active: false` → „Entwurf“
entspricht damit nicht der Veröffentlichungslogik des Mainservers.

## Mainserver

- `Attraction` bindet `FilterByRole` ein. Für die App-Rolle verwendet dieser
  Concern `by_data_provider.visible`; `visible` bedeutet `where(visible: true)`.
  Verwaltungsrollen können auch unsichtbare Datensätze lesen.
  Quellen: `../main-server/app/models/data_resources/attraction.rb:8`,
  `../main-server/app/models/concerns/filter_by_role.rb:36`, `:51–70`.
- Sowohl die Ortsliste als auch die Einzelabfrage verwenden diesen Rollenfilter.
  Der Listenresolver enthält keinen Filter auf das POI-Feld `active`.
  Quellen: `../main-server/app/graphql/resolvers/points_of_interest_search.rb:58`,
  `../main-server/app/graphql/types/query_type.rb:150`.
- Die Meilisearch-Indexierbarkeit hängt von `visible` und einem zugeordneten
  kommunalen Datenanbieter ab. `active` ist zwar ein Indexattribut, aber keine
  Indexierungsbedingung und kein konfiguriertes Filterattribut. Die GraphQL-Suche
  begrenzt Treffer zusätzlich auf den oben beschriebenen Rollen-Scope.
  Quelle: `../main-server/app/models/data_resources/point_of_interest.rb:48–99`,
  `../main-server/app/graphql/resolvers/points_of_interest_search.rb:95–105`.
- `createPointOfInterest` akzeptiert `active`; der GraphQL-Ausgabetyp bietet
  `active` und `visible` an. Beide Felder haben im dokumentierten Modellschema
  den Standardwert `true`.
  Quellen: `../main-server/app/graphql/mutations/create_point_of_interest.rb:13`,
  `../main-server/app/graphql/types/query_types/point_of_interest_type.rb:6–15`,
  `../main-server/app/models/data_resources/point_of_interest.rb:279–286`.
- `changeVisibility` unterstützt `PointOfInterest` und ändert ausschließlich
  `visible`, ohne den gesamten Ort erneut zu schreiben.
  Quelle: `../main-server/app/graphql/mutations/change_visibility.rb:12–35`.
- Nicht verwechseln: `Category.active` filtert tatsächlich Kategorien. Das
  `active` in `available_filters` beziehungsweise `AttributeService` beschreibt
  eine Filterkonfiguration und ist kein Nachweis eines POI-Lesefilters.
  Quellen: `../main-server/app/models/data_resources/point_of_interest.rb:20`,
  `../main-server/app/services/data_resource_filter_services/attribute_service.rb:207`.

## Mobile App

- Die normale Ortsliste fragt `visible`, aber nicht `active` ab. Die Detailabfrage
  fragt keines der beiden Felder ab; die kombinierte Orts-/Tourenabfrage setzt
  ebenfalls keinen Aktivfilter. Es gibt keinen Treffer für `includeInactive`
  im untersuchten App-Repository.
  Quellen: `../mobile-app/src/queries/pointsOfInterest.js:3–34`, `:110`,
  `../mobile-app/src/queries/pointsOfInterestAndTours.js:12`.
- Profilinhalte werden zusätzlich clientseitig mit `item.visible !== false`
  gefiltert.
  Quelle: `../mobile-app/src/helpers/profileContentHelper.ts:171–182`.
- Übersichtslisten können bei aktiviertem `hideInvisible` ebenfalls nach
  `visible !== false` filtern. Der Listenparser verarbeitet ansonsten die vom
  Server gelieferten Orte ohne Aktivfilter.
  Quellen: `../mobile-app/src/components/screens/Overviews.js:375–381`,
  `../mobile-app/src/helpers/parser/listItemParser.js:239–266`.
- Die App-Funktion zum Entfernen eines Orts verwendet
  `changeVisibility(... recordType: "PointOfInterest", visible: false)`.
  Quellen: `../mobile-app/src/queries/pointsOfInterest.js:333–340`,
  `../mobile-app/src/components/screens/PointOfInterest.tsx:166–170`.

## Abweichung in Studio

Studio projiziert `active === false` auf `draft`, sonst auf `published`.
Der Statuswechsel der Liste liest den gesamten Ort und ruft `updatePoi` mit
geändertem `active` auf. Die Aktiv-Checkbox schreibt ebenfalls `active`.
Quellen: `apps/sva-studio-react/src/lib/iam-content-list-mainserver.ts:281`,
`packages/plugin-poi/src/index.ts:21–41`,
`packages/plugin-poi/src/poi.detail-form.serialization.ts:237`.

Damit kann ein Ort mit `active: false` und `visible: true` in Studio als
„Entwurf“ erscheinen und gleichzeitig über den normalen App-Leseweg ausgeliefert
werden. Für einen Statuswechsel, der die Veröffentlichung steuern soll, ist
`visible` samt `changeVisibility` der bestehende Mechanismus. Die Statusprojektion
muss dann ebenfalls `visible` verwenden.

## Grenzen

Statische Quellcodeprüfung, keine Laufzeitprüfung der ausgelieferten Lehrte-App
und kein Abgleich der produktiven Mainserver-Version. Untersucht wurden die
lokalen Checkouts mit bereits vorhandenen uncommitteten Fremdänderungen.
Mainserver-HEAD: `4af16decd531743680e726bb412eecc9e7bc83a0`.
Mobile-App-HEAD: `608c01b5a7cac73efcc5bfd024dc66912acdfa01`.
Keine Tests ausgeführt, da ausschließlich recherchiert und dokumentiert wurde.
