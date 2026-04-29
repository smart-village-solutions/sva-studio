## 1. Spezifikation

- [x] 1.1 den Standardpfad fuer CRUD-artige Content-Plugins ueber host-owned `adminResources` und kanonische `/admin/...`-Routen spezifizieren
- [x] 1.2 den Spezialisierungspfad fuer plugin-spezifische List-, Detail- und Editor-Views innerhalb dieses Host-Rahmens spezifizieren
- [x] 1.3 den Ausnahme-Pfad ueber freie `plugin.routes` auf echte Nicht-CRUD-Sonderfaelle begrenzen und gegen Missbrauch fuer normales CRUD abgrenzen
- [x] 1.4 die Referenzmigration fuer `@sva/plugin-news`, `@sva/plugin-events` und `@sva/plugin-poi` als verbindlichen Teil des Changes spezifizieren
- [x] 1.5 `openspec validate refactor-p3-content-ui-specialization-boundaries --strict` ausfuehren

## 2. Umsetzung

- [x] 2.1 den bestehenden `adminResources`- und Routing-Vertrag so erweitern, dass spezialisierte Plugin-Views fuer Standard-Content-Plugins registriert und host-owned materialisiert werden koennen
- [x] 2.2 den Host so erweitern, dass fehlende Spezialisierungen deterministisch auf die host-owned Standardansicht zurueckfallen und unzulaessige Registrierungen build-time abgewiesen werden
- [x] 2.3 `@sva/plugin-news`, `@sva/plugin-events` und `@sva/plugin-poi` auf den neuen Standardpfad migrieren, ohne Host-Shell, Routing, Guards, Save-Verhalten oder globale Aktionen pluginseitig zu uebernehmen
- [x] 2.4 bestehende oder kuenftige freie `plugin.routes` fuer diese Plugins nur fuer dokumentierte Nicht-CRUD-Sonderfaelle weiter zulassen
- [x] 2.5 Tests fuer Registrierungsvalidierung, Fallback-Verhalten, Pfadwahl Standard vs. Ausnahme, Host-Shell-Grenzen und die Referenzintegration aller bestehenden Content-Plugins ergaenzen
