## 1. Gemeinsamen Tabellenvertrag absichern

- [x] 1.1 `StudioDataTable` um die expliziten Sortiermodi `disabled`, `client` und `external` ergänzen.
- [x] 1.2 Im Modus `external` genau einen kontrollierten Sortierzustand mit dem Zweierzyklus `asc`/`desc` rendern, aber kein clientseitiges Sorted-Row-Model auf die empfangene Seite anwenden.
- [x] 1.3 Sortierbare Spalten um ein explizites zugängliches Textlabel ergänzen und in der mobilen Kartenansicht Feldauswahl sowie Richtungsschalter an denselben Zustand anbinden.
- [x] 1.4 Ungültige Kombinationen aus Modus, sortierbaren Spalten, State und Change-Handler über eine diskriminierte Prop-Union und ergänzende Laufzeitinvarianten abweisen.
- [x] 1.5 Alle bestehenden `StudioDataTable`-Aufrufer nach vollständigem Datenbestand, externer Seite oder deaktivierter Sortierung klassifizieren.
- [x] 1.6 Komponenten-, Accessibility- und Type-Tests für alle drei Modi, Desktop und Mobil sowie den externen Zweierzyklus ergänzen.
- [x] 1.7 Den kleinsten relevanten `studio-ui-react`-Unit-/Type-Gate unmittelbar nach dem Block ausführen.

## 2. Inhaltsliste vollständig serverseitig sortieren

- [x] 2.1 Den gemeinsamen Inhalts-Sortiertyp um `createdAt` und `publishedAt` ergänzen und durch UI-Parser, Runtime-Parser, Client und beide serverseitigen Listenpfade führen.
- [x] 2.2 Native SQL- und Projektionssortierung mit festen Feldzuordnungen, Nullwerte-zuletzt-Semantik und `ID asc` implementieren; Textwerte deployment-stabil normalisieren.
- [x] 2.3 Inhaltsliste mit sichtbarem Default `updatedAt desc` auf externe Sortierung umstellen und Sortierwechsel atomar mit `page: 1` navigieren.
- [x] 2.4 Sortieraktionen für die übersetzten Spalten Inhaltstyp und Status entfernen.
- [x] 2.5 UI-Sortierwerte vor Requests normalisieren und direkte ungültige Inhalts-API-Parameter mit `400 invalid_request` abweisen.
- [x] 2.6 Repository-, Projektions-, Parser-, API- und UI-Tests für beide Richtungen, Nullwerte, Gleichstände, mehrere Seiten, entfernte Aktionen und ausbleibende lokale Umsortierung ergänzen.
- [x] 2.7 Relevante Unit-, Type- und Server-Runtime-Gates unmittelbar nach dem Block ausführen.

## 3. Organisationsliste global sortierbar machen

- [x] 3.1 `displayName`, `parentDisplayName`, `childCount`, `membershipCount` und `isActive` sowie die Richtung durch Clientvertrag, Hook und Runtime-Handler führen; unbekannte Werte mit `400 invalid_request` abweisen.
- [x] 3.2 Organisations-Read-Model mit festen SQL-Zuordnungen, deployment-stabiler Textordnung, Nullwerte-zuletzt-Semantik und `ID asc` vor `LIMIT/OFFSET` sortieren.
- [x] 3.3 Tabelleninteraktion mit Default `displayName asc` kontrolliert anbinden und bei Filter-, Sortier- oder Seitengrößenwechsel auf Seite eins wechseln.
- [x] 3.4 Sortieraktion der übersetzten Typ-Spalte und die Einrückung nach Hierarchietiefe entfernen.
- [x] 3.5 Repository-, Handler-, Hook- und UI-Tests mit über mehrere Seiten verteilten Treffern, Nullwerten, Gleichständen und ungültigen Parametern ergänzen.
- [x] 3.6 Relevante Unit-, Type- und Server-Runtime-Gates unmittelbar nach dem Block ausführen.

## 4. Waste-Fraktionen ohne lokale Seitensortierung anbinden

- [x] 4.1 Waste-Fraktionen weiterhin auf dem statusgefilterten Vollbestand sortieren und erst danach mit `createPagedItems` zuschneiden.
- [x] 4.2 Feldspezifische Comparatoren auf fehlende Werte zuletzt und `ID asc` vereinheitlichen.
- [x] 4.3 Waste-Tabelle mit Default Name aufsteigend auf externe Sortierung umstellen und Sortierwechsel atomar mit `page: 1` navigieren.
- [x] 4.4 Fach- und UI-Tests für beide Richtungen, optionale Werte, Gleichstände, mehrere Seiten und ausbleibende lokale Umsortierung ergänzen.
- [x] 4.5 Relevante Waste-Unit- und Type-Gates unmittelbar nach dem Block ausführen.

## 5. Governance- und DSR-Listen sortieren und paginieren

- [x] 5.1 `createdAt` und `updatedAt` für Governance sowie `createdAt` und `completedAt` für DSR einschließlich Richtung in die Query-Verträge aufnehmen und unbekannte Werte mit `400 invalid_request` abweisen.
- [x] 5.2 Vollständige gefilterte Governance- und DSR-Mengen mit Nullwerten zuletzt und eindeutiger Fallidentität aufsteigend vor `paginate*Items` sortieren.
- [x] 5.3 Anzeige- und Sortierfallbacks `updatedAt ?? resolvedAt` sowie `completedAt ?? createdAt` entfernen und fehlende Werte lokalisiert kennzeichnen.
- [x] 5.4 Beide UI-States um Gesamtzahl, Default `createdAt desc`, Default-Seitengröße 25, Seitennavigation und Seitengrößen 25, 50 und 100 ergänzen.
- [x] 5.5 Filter-, Sortier- und Seitengrößenwechsel atomar auf Seite eins zurücksetzen und beide Tabellen extern kontrolliert anbinden.
- [x] 5.6 Mapper-, Read-Model-, Handler-, Client- und UI-Tests für beide Richtungen, fehlende Werte, Gleichstände, mehrere Seiten, Gesamtzahl und 25/50/100 ergänzen.
- [x] 5.7 Relevante Unit-, Type- und Server-Runtime-Gates unmittelbar nach dem Block ausführen.

## 6. Irreführende Benutzersortierung entfernen

- [x] 6.1 Sortieraktionen aus den paginierten Tenant- und Plattform-Benutzerlisten entfernen und den Tabellenmodus explizit deaktivieren.
- [x] 6.2 Unpaginierte Benutzer-Teilansichten separat klassifizieren und vorhandene korrekte Vollbestands-Sortierung nicht unnötig entfernen.
- [x] 6.3 UI-Tests anpassen und belegen, dass beide paginierten Hauptlisten keinen globalen Sortierzustand vortäuschen.
- [x] 6.4 Gezielte Benutzerlisten-Unit- und Type-Tests ausführen.

## 7. Dokumentation und Abschlussvalidierung

- [x] 7.1 Die arc42-Abschnitte `05`, `06`, `08`, `10` und `11` um Tabellenownership, Laufzeitreihenfolge, mobile Bedienung, Qualitätsnachweis und Restrisiken ergänzen.
- [x] 7.2 Prüfen, dass keine paginierte sortierbare `StudioDataTable` ohne externen Vollbestandsvertrag verbleibt und alle übrigen Aufrufer ihren Modus explizit deklarieren.
- [x] 7.3 Die parallel veränderten Inhaltsprojektions- und Organisationspfade vor dem Staging auf Konflikte mit `use-mainserver-data-provider-as-content-author` und `add-organization-mainserver-provisioning` prüfen.
- [x] 7.4 Affected-Scope für Unit- und Type-Targets gegen `origin/main` messen und gemäß Repository-Regeln zielgerichtet validieren.
- [x] 7.5 `pnpm check:server-runtime`, `pnpm check:file-placement` und die kleinsten relevanten Lint-Gates ausführen.
- [x] 7.6 Vor PR-Freigabe nach Möglichkeit `pnpm test:pr` ausführen; ausgelassene breite Gates transparent dokumentieren.
- [x] 7.7 `pnpm exec openspec validate enforce-global-table-sorting --strict` erfolgreich ausführen.
