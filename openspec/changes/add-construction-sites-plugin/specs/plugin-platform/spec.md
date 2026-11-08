## ADDED Requirements

### Requirement: Baustellen besitzen einen eigenständigen begrenzten Plugin-Vertrag

Das System MUST `@sva/plugin-construction-sites` mit Plugin-/Modul-ID `construction-sites`, Content-Type `construction-sites.construction-site` und den Fachrechten `construction-sites.read`, `construction-sites.create` und `construction-sites.update` unterstützen. Das Plugin MUST vorhandene Host-/SDK-Verträge verwenden und ohne Runtime-Abhängigkeit auf andere Fachplugins bestehen. Dieser Lieferumfang MUST ohne Delete- oder Bulk-Funktion auskommen.

#### Scenario: Fachlicher Zugriff prüft Baustellenrechte

- **WHEN** eine Operation über den fachlichen Baustellenpfad erfolgt
- **THEN** prüft der Host das passende Recht im Namespace `construction-sites` sowie Instanz-, Organisations-, Objekt- und Provider-Zugriff
- **AND** ersetzt ein FAQ-, Projekte- oder Generic-Items-Recht das Baustellenrecht auf diesem Pfad nicht
- **AND** gelten für explizite Sichtbarkeitsänderungen zusätzlich die bestehenden Host-Veröffentlichungsrechte

#### Scenario: Deaktiviertes Plugin bietet keinen Fachzugriff

- **GIVEN** das Baustellenplugin ist für die aktive Instanz nicht aktiviert
- **WHEN** eine Person dessen Fachroute oder Mutation direkt aufruft
- **THEN** verweigert der Host den Fachzugriff nach dem bestehenden Aktivierungsvertrag
- **AND** ist eine ausgeblendete Navigation nicht der einzige Schutz

#### Scenario: Begrenzter Umfang registriert keine Löschfunktion

- **WHEN** die Baustellenbeiträge registriert werden
- **THEN** entstehen keine Baustellen-Delete-/Bulk-Aktion, Löschoberfläche oder fachliche Löschroute
- **AND** erweitert die Verwendung eines Standard-Helpers den vereinbarten Umfang nicht implizit

### Requirement: Baustellen übernehmen die exakte bestehende GenericItem-Zuständigkeit

Das System MUST die Zuständigkeit für exakt `ConstructionSite` über die vorhandene Build-time-Registry deklarieren und die bestehenden Regeln zur eindeutigen gemeinsamen Inhaltsprojektion anwenden. Das Plugin MUST nicht parallel als generischer Ersatz in derselben Übersicht erscheinen. Der separat autorisierte technische Generic-Items-Zugriff MUST seinen bestehenden Vertrag behalten.

#### Scenario: Registrierte Baustelle erscheint genau einmal

- **GIVEN** die Registry enthält die Baustellenzuständigkeit
- **WHEN** die gemeinsame Inhaltsübersicht ein GenericItem vom Typ `ConstructionSite` klassifiziert
- **THEN** verwendet sie ausschließlich `construction-sites.construction-site`
- **AND** erfolgen Klassifikation und Fachrechteprüfung nach den bestehenden getrennten Host-Verträgen

#### Scenario: Fehlendes Fachrecht erzeugt keinen Fallback

- **GIVEN** die Baustellenzuständigkeit ist registriert und eine Person besitzt nur `generic-items.read`
- **WHEN** sie die gemeinsame Inhaltsübersicht aufruft
- **THEN** erhält sie dort keinen generischen Ersatz für die nicht autorisierte Baustelle
- **AND** bleibt ein Zugriff im eigenständigen technischen Generic-Items-Modul allein nach dessen bestehenden Regeln möglich
