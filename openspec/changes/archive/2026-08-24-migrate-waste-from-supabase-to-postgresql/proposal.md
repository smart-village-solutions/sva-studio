# Change: Waste-Datenhaltung von Supabase zu PostgreSQL migrieren

## Why

Waste-Management und die öffentliche Waste-Web-App verwenden fachlich bereits direkte PostgreSQL-Zugriffe, sind in Konfiguration, Typen und Betriebsprüfung aber weiterhin an Supabase gekoppelt. Die einzige vorhandene produktive Waste-Supabase soll während eines geplanten Offline-Fensters einmalig in eine getrennte PostgreSQL-Datenbank der bestehenden Betriebsumgebung überführt werden.

## What Changes

- Ein generischer externer Schnittstellentyp `postgresql` wird in der hostgeführten Registry ergänzt; der bestehende Typ `supabase` bleibt unverändert verfügbar.
- Waste-Management löst seine instanzbezogene Fachdatenquelle als PostgreSQL-Schnittstelle auf und verlangt keine Supabase-Projekt-URL oder keinen Service-Role-Key mehr.
- Die öffentliche Waste-Web-App liest aus derselben PostgreSQL-Fachdatenbank wie die administrative Pflege.
- Die bestehende Supabase-Datenbank wird in einem einmaligen Sonntagsfenster bei vollständig gestoppten Waste-Runtimes per PostgreSQL-Dump und -Restore migriert; ein dauerhafter Anwendungs-Wartungsmodus wird nicht eingeführt.
- Die Ziel-Datenbank `sva_waste` trennt Owner-, Migrations-, administrative Runtime- und öffentliche Runtime-Rollen nach dem Least-Privilege-Prinzip.
- Cutover, Verifikation, verlustfreies Rollback-Gate vor neuen Zielschreibzugriffen und die anschließende 14-tägige schreibgeschützte Supabase-Aufbewahrung werden als wiederholbares Runbook dokumentiert.
- Backup und Restore werden um die getrennte Waste-Fachdatenbank erweitert.
- Supabase bleibt als allgemeiner Schnittstellentyp für andere oder spätere Integrationen erhalten.

## Impact

- Affected specs: `waste-management`, `public-waste-calendar`, `external-interface-registry`, `deployment-topology`, `architecture-documentation`
- Affected code: External-Interface-Registry und -UI, Waste-Datenquellenresolver, Waste-Settings und Host-Fassade, Public-Waste-Konfiguration, Compose-/Runtime-Konfiguration, Backup-/Restore-Abläufe, Migrations- und Betriebswerkzeuge
- Affected data: zentrale Registry-Metadaten im Studio-Postgres sowie die einmalig zu übertragende `waste_*`-Fachdatenbank
- Affected arc42 sections: `03-context-and-scope`, `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts`, `11-risks-and-technical-debt`
- Breaking operational change: Nach dem Cutover ist die lokale PostgreSQL-Datenbank die einzige führende Waste-Fachdatenquelle; die Supabase-Quelle ist nur noch zeitlich begrenzter, schreibgeschützter Rollback-Stand.
