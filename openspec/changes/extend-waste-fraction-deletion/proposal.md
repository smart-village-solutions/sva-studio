# Change: Abfallfraktionen mit Auswirkungsvorschau löschen oder ersetzen

## Warum

Der bestehende Fraktions-Löschpfad weist verwendete Fraktionen mit HTTP 409 zurück. Der bestehende Löschdialog benötigt eine Auswahl zum gezielten Entfernen oder Ersetzen ihrer Zuordnungen; der Vorschlag erweitert die vorhandenen Handler, Repositories und Dialoge, da dort Autorisierung, Tenant-Bindung, Tourlöschung und Synchronisation bereits liegen.

## Ziel und Grenze

Ziel ist das kontrollierte Löschen einer einzelnen Abfallfraktion mit Vorschau, optionaler Tourlöschung oder Ersetzung und Schutz vor dadurch entstehenden Dubletten.

Maximal betroffen sind die bestehenden Waste-Verträge, das Waste-Plugin, die Waste-Runtime einschließlich tenantlokaler Datenzugriffe und Terminauflösung sowie die zugehörigen Tests, Benutzerhilfe und Architekturabschnitte 05 und 08. Nicht-Ziele sind automatische Tourzusammenführung, allgemeine Bestandsbereinigung, Änderung der Wiederholungsregeln, neue Services oder Packages, ein Contract-Cutover der Fraktionsnormalisierung und Rollouts. Die bestehende Mehrfachlöschung erhält keine neue kaskadierende Wirkung.

## Bedienung

Der bestehende Einzellöschdialog zeigt serverseitig ermittelte Auswirkungen für die gewählte Variante: betroffene Touren mit Status und weiteren Fraktionen, abhängige gespeicherte Termine, Verschiebungen und Abholortzuordnungen. Gespeicherte Datensätze und aus Regeln berechnete Termine werden sprachlich unterschieden. Auch inaktive und archivierte Touren werden erfasst.

- **Touren erhalten und Fraktion entfernen:** Nur anbieten, wenn jede betroffene Tour mindestens eine weitere Fraktion behält. Quelle aus allen Touren entfernen, dann Quelle löschen; Touren, Termine und andere Fraktionen erhalten. Bei unbenutzter Quelle ist die einfache Löschung ohne zusätzliche Auswahl möglich.
- **Touren und Termine mitlöschen:** Alle der Quelle zugeordneten Touren vollständig löschen, einschließlich ihrer abhängigen Tour-Fraktions-Zuordnungen, Abholortverknüpfungen, Einsätze, standortbezogenen Termine und tourbezogenen Verschiebungen. Gemeinsam genutzte Touren und die Auswirkungen auf ihre anderen Fraktionen ausdrücklich benennen. Andere Fraktionsstammdaten, Abholorte, unbetroffene Touren und globale Regeln bleiben erhalten.
- **Durch andere Fraktion ersetzen:** Eine bestehende aktive Fraktion desselben Tenants auswählen; Quelle und Ziel müssen verschieden sein. Tour-IDs, Terminregeln, Termine, Hinweise und Abholortzuordnungen bleiben erhalten. Die Quelle wird in den Fraktionslisten ersetzt und anschließend gelöscht. Ist das Ziel bereits enthalten, bleibt es genau einmal an seiner bisherigen Position; andernfalls ersetzt es die Quelle an deren Position. Die Reihenfolge aller übrigen Fraktionen bleibt erhalten.

Es gibt keine vorausgewählte destruktive Variante. Bestätigung benennt Variante, Quelle, gegebenenfalls Ziel und die Auswirkungen. Auswahlwechsel erfordern eine neue Vorschau. Bestehende gemeinsame Dialog- und Auswahlkomponenten verwenden, sämtliche Texte in Deutsch und Englisch übersetzen, Tastaturbedienung, Fokus und Fehleransage erhalten.

## Dubletten und Terminkonflikte

Eine Tour-Fraktions-Zuordnung existiert höchstens einmal. Außerdem darf die Ersetzung keine zusätzlichen Überschneidungen verschiedener Touren für denselben Abholort, dieselbe Zielfraktion und denselben wirksamen Abholtag erzeugen. Die Prüfung verwendet die bestehende fachliche Terminauflösung einschließlich Gültigkeit, Wiederholungen, expliziter Termine, Tourstatus und Verschiebungen. Ein gleicher Tag an verschiedenen Abholorten oder für unterschiedliche Fraktionen ist kein Konflikt.

Die Prüfung betrifft die durch die Ersetzung neu entstehenden Kollisionen mit anderen betroffenen oder unveränderten Touren. Bereits vorher bestehende, unveränderte Konflikte außerhalb dieser Änderung lösen keine allgemeine Bereinigung aus. Konflikte werden mit Touren, Abholort und Datum angezeigt; die Mutation bleibt blockiert. Touren, Termine oder Hinweise werden nicht automatisch zusammengeführt oder verworfen. Ein willkürlich begrenztes Vorschauzeitfenster darf keine Konfliktfreiheit außerhalb dieses Fensters behaupten; kann der relevante Gültigkeitsbereich nicht vollständig geprüft werden, wird die Ausführung mit konkretem Hinweis verweigert.

## Konsistenz, Grenzen und Fehler

- Vorschau und Ausführung benötigen `waste-management.master-data.manage`, den serverseitigen Tenant-Kontext und den bestehenden CSRF-Schutz. Ressourcen werden ausschließlich tenantlokal aufgelöst; PII gelangt nicht in Logs oder Audit-Metadaten.
- Die bestätigte Vorschau wird an Quelle, Variante, Ziel und den relevanten Bestandsstand gebunden. Den bestehenden Ansatz der Adressmutationsvorschau auf Wiederverwendung prüfen, ohne eine neue generische Infrastruktur einzuführen.
- Ausführung und erneute Prüfung erfolgen in einer Transaktion unter geeigneter Serialisierung auch gegenüber konkurrierenden Tour-, Zuordnungs- und Terminänderungen. Geänderte Auswirkungen oder Konflikte erfordern eine neue Vorschau; kein stilles Ausweiten der bestätigten Löschung. Fehler und Wiederholungen erzeugen keinen Teilzustand.
- Den vorhandenen referenziellen Löschschutz erhalten. Ein direkter Löschaufruf ohne ausdrücklich bestätigte Variante darf weiterhin keine zugeordneten Touren entfernen. Bestehenden transaktionalen Schreibvertrag für Tour-Fraktions-Zuordnungen nutzen; Arrays und Beziehungstabelle dürfen auch während Expand nicht auseinanderlaufen.
- Vorhandenes Verhalten für die zur gelöschten Fraktion gehörenden E-Mail-Erinnerungsauswahlen beibehalten und in der Vorschau benennen: Sie werden entfernt, nicht auf die Zielfraktion übertragen. Bestehenden Umgang mit ausstehenden Erinnerungen prüfen und sicherstellen, dass keine späteren Nachrichten auf gelöschte Fraktionen oder Termine verweisen. Keine automatische Umbuchung von Abos oder Übertragung unterschiedlicher Reminder-Slots einführen.
- Audit und sichtbaren Status über bestehende Wege aktualisieren. Nach erfolgreichem Commit vorhandenen wasteTypes-Sync einreihen und Änderungen für den bestehenden Tour-/Termin-Sync erfassen. Sync-Fehler als Warnung mit bestehender Wiederholmöglichkeit anzeigen; keine Rücknahme bereits bestätigter lokaler Speicherung und keine Erfolgsmeldung über einen noch nicht abgeschlossenen externen Sync.

## Nachweise vor Umsetzung und Merge

Vor Implementierung die zuständigen Kalenderverbraucher und den vollständigen relevanten Prüfbereich bestimmen; konkrete Referenzimplementierungen über XERJ prüfen, sofern verfügbar. Der bestehende Löschpfad liegt in `handlers/fractions.ts` und `repositories/master-data.fractions.ts`, der Tourpfad in `repositories/master-data.tours.ts`; die tenantlokalen Kaskaden liegen im vorhandenen Operations-Schema.

Unit-Tests decken Optionsverfügbarkeit, Auswahlvalidierung, Ersetzungsreihenfolge, Dubletten und Fehleranzeigen ab. PostgreSQL-Integrationstests belegen vollständige Kaskaden, Erhalt unbetroffener Daten, Rollback, veraltete Vorschauen, Tenant-Isolation und konkurrierende Änderungen. Termintests verwenden echte Wiederholungs- und Verschiebungsfälle sowie Konflikte außerhalb eines üblichen Kalenderfensters. UI-Nachweise prüfen Vorschau, Mehrfraktionswarnung, Fokus und blockierte Bestätigung. Scope und Pflicht-Gates gemäß DEVELOPMENT_RULES auswählen; keine vorsorglichen Vollsuite-Läufe.

## Bezug zu bestehenden Spezifikationen

Ergänzt `waste-management`. Die Vorgaben von `normalize-waste-tour-fractions` gelten weiter: Eine noch referenzierte Fraktion ist nicht direkt löschbar; die neue Mutation löst ihre Zuordnungen ausdrücklich vor der Löschung innerhalb derselben Transaktion auf. Kein neuer Deploy- oder Migrationspfad.

## Freigabestand

Die drei Bedienvarianten einschließlich des bedingten Ausblendens von „Touren erhalten“ sind im Gespräch bestätigt. Der schriftliche Vorschlag wurde am 13.11.2026 mit „Setze das um“ freigegeben. Die Umsetzung erfolgt im separaten Worktree; ein Deployment ist nicht Teil dieses Auftrags.
