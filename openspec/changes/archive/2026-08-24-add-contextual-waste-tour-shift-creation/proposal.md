# Change: Kontextuelle Erstellung und eindeutige Priorisierung tourbezogener Ausweichtermine

## Why

Nutzer erkennen notwendige Terminverschiebungen häufig direkt an einer Tour, ihrem Jahreskalender oder beim Bearbeiten ihrer Terminlogik. Derzeit müssen sie anschließend manuell in den Tab `Ausweichtermine` wechseln und Tour sowie Originaldatum erneut auswählen.

Die vorhandene Terminlogik lässt außerdem mehrere tourbezogene Regeln für denselben Ursprung zu und besitzt keine ausdrückliche Priorität zwischen einer jährlich geltenden Grundregel und einer jahresbezogenen Ausnahme. Dadurch kann die wirksame Verschiebung von Lade- oder Sortierreihenfolgen abhängen. Für die betroffenen Ausweichtermin-Daten wurde bestätigt, dass kein produktiv zu erhaltender Bestand vorliegt; ein harter, typisierter Schemaschnitt ist deshalb möglich.

## What Changes

- Die Tourenliste bietet in der Spalte `Verschiebungen` sowohl ohne vorhandene Verschiebungen als auch im Detaildialog einen Einstieg zum Anlegen eines tourbezogenen Ausweichtermins in einem neuen Browser-Tab.
- Der Jahreskalender bietet für reguläre, noch nicht verschobene Termine eine kompakte und zugängliche Aktion, die Tour und Originaldatum in der bestehenden Erstellungsansicht eines neuen Browser-Tabs vorausfüllt.
- Die Terminlogik einer gespeicherten wiederkehrenden Tour bietet einen Einstieg mit vorausgewählter Tour. Bei ungespeicherten Änderungen an Turnus, Abstandspreset oder Gültigkeitszeitraum bleibt die Aktion sichtbar, ist aber bis zum Speichern deaktiviert.
- Eigene typsichere Search-Parameter transportieren Tour- und Datumskontext. Die kontextuelle Erstellungsansicht zeigt statt der Typauswahl einen kompakten Kontextblock und überschreibt spätere Benutzereingaben nicht.
- Jahresbezogene Regeln sind pro Tour und vollständigem Originaldatum eindeutig; jahresunabhängige Regeln sind pro Tour und Monat/Tag eindeutig.
- Eine jahresbezogene Regel überschreibt für ihr konkretes Jahr eine gleichzeitig vorhandene jahresunabhängige Grundregel. Doppelte Regeln derselben Spezifität werden mit einem fachlichen Konflikt abgelehnt.
- `original_date` und `actual_date` werden in der Waste-Tenant-Datenbank als PostgreSQL `DATE` gespeichert. Außerhalb der Datenbank bleiben Kalenderdaten normalisierte ISO-Strings ohne Uhrzeit oder Zeitzone.
- Studio-Kalender, Mainserver-Materialisierung und Public-Waste-Projektion verwenden dieselbe framework-agnostische Auswahlregel für wirksame Tourverschiebungen.
- Die neuen Aktionen werden nur Benutzern mit `waste-management.scheduling.manage` angeboten.

## Impact

- Affected specs: `waste-management`, `public-waste-calendar`
- Affected code: Waste-Tourenliste, Verschiebungsdetaildialog, Tour-Jahreskalender, Tourformular, Search-Parameter, Scheduling-Erstellungsansicht, UI-Zugriffsmodell, Core-Terminlogik, Auth-Runtime, Waste-Repositories, Tenant-Schema und -Migration, Mainserver-Materialisierung, Public-Waste-Terminprojektion, Übersetzungen und Tests
- Affected database docs: `docs/development/studio-db-schema-final.sql`, `docs/development/studio-db-schema.md`, kanonisches Runtime-Schema der externen Waste-Tenant-Datenbank
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/08-cross-cutting-concepts.md`
