## 1. Bestandszugriff im eigenen Modul

- [x] `@sva/plugin-tours` über die kanonische Registry mit `tours.read`, tenantgeschützter Liste `/plugins/tours` und Detail `/plugins/tours/$id` registrieren. Kontext-Hilfe und Dokumentationskatalog für beide Routen anbinden.
- [x] Separate typisierte `tours`- und `tour`-Abfragen im Mainserver-Pfad anbinden. Gemeinsamen Scope vor Pagination und stabile Sortierung nachweisen. Persönliche und organisatorische Kontexte, deaktiviertes Modul, fehlende Rechte, fremde IDs und abweichende globale Listentreffer abdecken.
- [x] Liste und Detail mit gemeinsamer Studio-UI, DE/EN, geordneten Koordinaten und Stationen sowie Leer- und Fehlerzuständen umsetzen. Datenanbieter nur bei berechtigter Sicht anzeigen. Browser-Abnahme über Liste, zweite Seite und Detail durchführen.

## 2. Touren als Entwürfe anlegen

- [x] Mit den Studio-Entwurfsdokumenten gegen Rails/MySQL belegen, dass beide Entwurfspfade mit genau einer Schreibmutation atomar unveröffentlicht persistieren. Tourenentwürfe entstehen stets neu. Ortsentwürfe mit passender externer ID dürfen nur nach zusätzlicher Autorisierung bestehende Orte ändern. Schreibprincipals und Folgefehler abdecken.
- [x] Standard-Content-Pfad mit `tours.tour` und bestätigtem `tours.create` anbinden. Die bisherigen Ansichten durch Weiterleitungen auf die entsprechenden `/admin/tours`-Routen ersetzen. Den Entwurf über den bestehenden Principal-, DataProvider-, Validierungs- und Idempotenzpfad anlegen und frisch lesen.
- [x] POI-nahe Formularbausteine für `Basis`, `Route und Ort`, `Stationen`, `Medien` und `Historie` verwenden. Koordinaten strukturiert pflegen und Stationen per Tastatur sortieren. Historie, Projektion und Reconciliation für Create einbinden.
- [x] Ab dem ersten Projektionseinsatz zentrale Leseflächen an `tours.read` binden und `active=false, visible=true` in der Vollprojektion als veröffentlicht ausweisen. Berechtigte können Entwürfe anlegen und Bestandsdetails öffnen. Unbestätigte Aktionen sind auch bei direkt aufgerufenen Endpunkten unverfügbar.
- [x] Ortsentwürfe mit `visible: false` in derselben Create-Mutation schreiben, per Detailabfrage bestätigen und Teilerfolge zur Abstimmung melden.
- [x] Mainserver-Staging `c47b1490` und SaaS `51cd230e` mit dem Patch aus !1110 anhand des laufenden App-Stands und des ausgelieferten GraphQL-Schemas verifizieren.
- [x] Auf Studio-Staging gegen den neuen Mainserver je genau eine GraphQL-Schreibmutation für einen neuen Touren- und Ortsentwurf belegen. Der [Promote für `8f1ce800`](https://github.com/smart-village-solutions/sva-studio/actions/runs/45858421311) lieferte die getestete Version. Die Mainserver-Logs bestätigen eine Mutation je Neuanlage und zwei anschließende Leseaufrufe. Die Staging-Detailansichten zeigten beide Entwürfe unveröffentlicht.

## 3. Bestandsbearbeitung und vollständige Fachliste

- [x] Den Mainserver-Vertrag für den freigegebenen Patch auf Name, Länge, Beschreibung, Route und Stationen lokal gegen Rails/MySQL bestätigen. Fehlende und fremde IDs erzeugen keine Tour. Die Tests decken Stopp-Identität, Reihenfolge, leere Geometrie, verdeckte Werte und veraltete Revisionen ab. Weitere Felder benötigen einen eigenen Erhaltungsnachweis.
- [x] `tours.update` über den bestehenden Host-Pfad integrieren. Persistierte Stationen erst nach Bestätigung entfernen. Der Redaktion bleibt der gespeicherte Stand nach dem Update verfügbar.
- [ ] `tours.delete`, Veröffentlichung und Inhabertransfer nach jeweiligem Vertragsnachweis integrieren. Sichtbarkeitswechsel und Löschung anhand ihres jeweiligen Endzustands prüfen.
- [x] Nach Einzeländerungen prüfen, dass die gezielte Projektion `active=false, visible=true` als veröffentlicht ausweist. PATCH aktualisiert die Projektion für die betroffene Tour mit demselben Principal.
- [ ] Namenssuche und Filter für Kategorie, Aktivität und Veröffentlichung vor der Pagination auf den vollständigen autorisierten Umfang anwenden. Streckenkarte mit dauerhaft verfügbarer strukturierter Alternative ergänzen.
- [x] Mapping, Validierung, Bestandsfelder, Kontextgrenzen und Fehler lokal absichern. Der Studio-Browsertest prüft Anlegen, Stationsreihenfolge, Routenänderung, Speichern und erneutes Laden mit gemockter Host-Fassade. Der separate Rails/MySQL-Vertragstest führt die beiden Studio-GraphQL-Dokumente aus.
- [ ] Bestandsbearbeitung nach Mainserver-Migration und Capability-Freigabe auf Studio-Staging abnehmen.
- [ ] Den App-Konfigurationsabgleich aus #1428 mit dem derzeit belegten Ergebnis dokumentieren, dass keine exklusiven Touren-Einstellungen vorliegen.
