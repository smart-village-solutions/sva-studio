# Waste-Fachdaten austauschen

Der Waste-Datenaustausch überträgt realistische Fachdaten zwischen Studio-Instanzen. Er ist kein Tenant- oder Datenbankklon: Zielseitig vorhandene Datensätze werden nicht gelöscht, Instanzidentität, Zugangsdaten, IAM-, Audit-, Job- und Monitoringdaten bleiben im Ziel.

## Datenschutzgrenze

Nicht exportiert oder importiert werden:

- E-Mail-Abonnements und deren ausgewählte Empfängeradressen
- Consent-Zeitpunkte und -Versionen
- DOI- und Abmeldetoken beziehungsweise deren Hashes
- Reminder-Outbox, Versandpayloads, Leases, Retries und Fehlerzustände
- Datenbank-URLs, Credentials und technische Instanzidentitäten

Die Reminder-Konfiguration einer Fraktion bleibt enthalten. Sie beschreibt nur das fachliche Kanalverhalten und enthält keine Abonnenten. Beim Import portabler Einstellungen bleibt eine bereits vorhandene E-Mail-Konfiguration des Ziels unverändert.

## Profile und Formate

Für Fraktionen, Geografie und Abholorte, Abstandspresets, Touren, Abholort-Tour-Zuordnungen, Tour-Einsätze, Ausweichtermine, Feiertagsregeln sowie portable Einstellungen existiert jeweils ein versioniertes JSON-Profil. Ein einzelnes Profil kann als JSON exportiert und importiert werden. Mehrere ausgewählte Profile werden als ZIP-Paket mit Manifest, Abhängigkeiten, Datensatzanzahlen und SHA-256-Prüfsummen übertragen.

Die bisherigen CSV-/XLSX-Importe bleiben als kompatible, einseitige Eingangsadapter bestehen. Sie sind kein vollständiger Roundtrip-Vertrag. Der CSV-Spezialimport „Tourzuordnungen nach Fraktionen“ bleibt separat und erzeugt fehlende Fachdaten weiterhin mit seinen dokumentierten Defaults.

## Feldsemantik

- `required`: Der Wert muss im Import vorhanden und gültig sein.
- `optional`: Der Wert darf fehlen. Explizites `null` leert ein nullable Zielfeld.
- `defaultable`: Beim Anlegen wird bei fehlendem Wert der dokumentierte Default verwendet. Beim Aktualisieren bleibt ein ausgelassener Wert unverändert.

Systemexporte schreiben alle enthaltenen Felder deterministisch aus. Technische Zeitstempel werden im Ziel neu verwaltet. Stabile fachliche IDs bleiben erhalten, damit Referenzen zwischen Profilen auflösbar sind.

## Ablauf im Studio

1. Unter „Datentools“ mit `waste-management.export.execute` ein Profil für JSON oder mehrere Profile für ZIP auswählen.
2. Den Exportjob starten und nach erfolgreichem Abschluss das geschützte Artefakt herunterladen. Der Download wird erneut gegen Instanz, Actor und Berechtigung geprüft und läuft nach 24 Stunden ab.
3. In der Zielinstanz mit `waste-management.import.execute` das passende JSON-Profil oder „Waste-Datenpaket“ wählen und die Datei hochladen.
4. Optional zuerst einen Dry-Run ausführen. Er validiert Vertrag, Version, Pflichtwerte, Defaults und Referenzen und schreibt keine Fachdaten.
5. Den Import starten. Einzelprofile und Pakete werden ohne fachlichen Teilerfolg geschrieben. Portable Schnittstelleneinstellungen werden vor dem Waste-Datenbank-Commit gespeichert; schlägt der Commit danach fehl, stellt das System die vorherige Schnittstellenkonfiguration wieder her.

Portable Kalender- und Feiertagseinstellungen werden zusätzlich in der ausgewählten Schnittstellenkonfiguration aktualisiert. Binäre Branding-Artefakte werden nicht kopiert; lediglich ihre konfigurierte Referenz ist portabel.

## Paketgrenzen

Ein Export akzeptiert höchstens neun Profile. JSON ist auf genau ein Profil beschränkt. Ein ZIP wird vollständig vor der Mutation validiert und in kanonischer Abhängigkeitsreihenfolge importiert. Für importierte ZIP-Pakete gelten folgende Grenzen:

- höchstens 16 MiB komprimierte Paketgröße
- höchstens zehn flache, eindeutig benannte Einträge, einschließlich Manifest
- höchstens 16 MiB unkomprimierte Größe je Eintrag
- höchstens 64 MiB unkomprimierte Gesamtgröße
- höchstens 256 KiB für `manifest.json`

Einträge werden anhand ihrer ZIP-Metadaten vor der Dekompression abgewiesen, sobald eine Grenze überschritten wird. Exportartefakte liegen nicht öffentlich im Media-Speicher und werden nicht als Bürger-Feed angeboten.
