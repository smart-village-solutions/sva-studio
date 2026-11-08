# Change: Baustellen im Studio erstellen und bearbeiten

## Why

Das alte CMS besitzt eine eigene Baustellenoberfläche; im Studio fehlt ein entsprechendes Fachplugin. Redakteure benötigen eine verständliche Erstellung und Bearbeitung, die bestehende Mainserver-Baustellen ohne Datenmigration übernimmt und deren weitere Inhalte erhält.

Der fachliche Zuschnitt wurde am 01.11.2026 im Gespräch bestätigt: bisheriger Funktionsumfang mit verbesserter Bedienung, keine zusätzlichen Fachfunktionen. Anschließend hat der Nutzer den Plan zur Umsetzung freigegeben. Die erste Vertragsprüfung hat den Erhalt unsichtbarer Kategoriezuordnungen hinterfragt. Anschließend hat der Nutzer ausdrücklich akzeptiert, dass Zuordnungen zu deaktivierten Kategorien beim Speichern entfallen dürfen. Mit dieser eng begrenzten Ausnahme wird die Umsetzung fortgesetzt; Mainserver-Änderungen bleiben ausgeschlossen. Die übrigen Schutzanforderungen gelten unverändert.

## What Changes

- Ergänzt das optional aktivierbare Plugin `construction-sites`, Package `@sva/plugin-construction-sites`, Content-Type `construction-sites.construction-site` und die exakte Mainserver-Zuständigkeit `genericType: "ConstructionSite"`.
- Ergänzt eine fachliche Liste mit Suche, Kategorien-/Zeitraumfilter und abgeleiteter zeitlicher Einordnung sowie Erstellung als Onepager und Bearbeitung im bestehenden Studio-Detailmuster mit echter Host-Historie.
- Übernimmt Titel, weitere Informationen, Richtung, Grund, mehrere Einschränkungen, Kategorien, Dateien, Standort und Beginn/Ende aus dem alten CMS. Titel sowie Beginn und Ende sind Pflichtfelder; alle übrigen Angaben bleiben optional.
- Nutzt vorhandene Host-/SDK-Verträge für Authentifizierung, Instanz, Organisation, Mutationsidentität, Berechtigungen, Routing, Historie, Medien und Mainserver-Zugriff. Die fachlichen Rechte sind `construction-sites.read`, `construction-sites.create` und `construction-sites.update`.
- Verwendet den bestehenden GenericItem-Schreibpfad im Studio-Mainserver-Adapter. Unbekannte Payload-Felder, nicht bearbeitete Relationen und deren Reihenfolge bleiben erhalten; unvollständig lesbare Datensätze dürfen nicht stillschweigend reduziert zurückgeschrieben werden.
- Verlangt frischen Detail-Read, Konfliktprüfung und unabhängigen Readback. Erfolgreicher Provider-Write, lokale Nachverarbeitung und unklarer Write-Ausgang werden getrennt behandelt.

## Nicht-Ziele und Scope-Grenze

- Keine Änderungen am externen Mainserver, alten CMS oder an der mobilen App; keine Bestandsmigration und keine eigene fachliche Baustellentabelle.
- Keine Strecken-/Flächengeometrie, strukturierten Sperrungsarten, Umleitungen, Importe, Benachrichtigungen oder neue Veröffentlichungsplanung.
- Keine Löschfunktion, Massenbearbeitung, neuen Hintergrundjobs, Integrationsdienste oder generische Formular-/Adapterplattform.
- Keine Änderung des technischen Zugriffsvertrags von „Generische Inhalte“ oder der bestehenden Host-Autorisierung.
- Kein automatisches Löschen, Archivieren oder Verbergen durch Ablauf des Baustellenzeitraums.

Maximal betroffene Implementierungsbereiche sind das neue Fachplugin, dessen Einbindung in bestehende Plugin-/Distributions-/Seitenkataloge, der zuständige Studio-Mainserver-Adapter, notwendiges Host-Wiring und die unmittelbar zugehörigen Tests, Übersetzungen und Dokumentation. Ein weitergehender Plattformumbau gehört nicht in diesen Lieferabschnitt.

## Impact

- Affected specs: `content-management`, `plugin-platform`, `sva-mainserver-integration`.
- Affected code: `packages/plugin-construction-sites/`, bestehende öffentliche Verträge in `packages/plugin-sdk/` und `packages/studio-ui-react/`, zuständige Adapterpfade in `packages/sva-mainserver/`, bestehendes Registry-/Routing-Wiring in `apps/sva-studio-react/` und vorhandene Distributionskataloge. Die Nennung eines gemeinsamen Packages ist keine Freigabe für dessen Umbau.
- Affected arc42 sections: 04 (Anwendung bestehender Strategie und Autorisierung), 05 (Baustein/Ownership), 06 (Read-/Write-Fluss), 08 (IAM, Medien, Konflikte, i18n, Accessibility) und 10 (Akzeptanznachweise). Die betroffenen Ist-Abschnitte wurden mit der lokalen Implementierung fortgeschrieben.
- Abhängigkeiten: vorhandene GenericItem-Zuständigkeit und Content-Projektion; vorhandene Create-Onepager-/Medien-/Mutationsverträge. `add-content-create-onepagers` wird wiederverwendet, nicht umgestaltet. `add-vouchers-plugin` bleibt fachlich und technisch unabhängig.
- Keine geplante Schemaänderung. Falls ein bestehender Host-Vertrag die geforderten Invarianten nicht tragen kann, vor einer Scope-Erweiterung stoppen und den Lieferumfang neu bewerten.

## Unterlagen und Status

- [Design, Grenzen und Nachweise](./design.md)
- [Umsetzungsschritte](./tasks.md)
- [Fachliche Anforderungen](./specs/content-management/spec.md)
- [Plugin-/IAM-Vertrag](./specs/plugin-platform/spec.md)
- [Mainserver-Vertrag](./specs/sva-mainserver-integration/spec.md)

Die Freigabe des Plans ist dokumentiert; sie hebt die vereinbarten Stop-Bedingungen und Nicht-Ziele nicht auf. Die Produktimplementierung und die in der Aufgabenliste dokumentierten Prüfungen sind lokal erfolgt. CI-, Live- und App-Abnahme stehen aus. Externe Schreibtests benötigen ein konkret freigegebenes Zielsystem, Konto und Testdatenset; die lokale Konzeptfreigabe autorisiert keinen solchen Schreibzugriff.
