## Context

Waste-Fachdaten liegen pro Studio-Instanz in einer eigenen PostgreSQL-Datenbank. Die vorhandenen Importe sind auf vier Eingangsprofile zugeschnitten und bilden unter anderem Fraktionen, Abstandspresets, Feiertagsregeln und portable Einstellungen nicht vollständig ab. Der Spezialimport für Tourzuordnungen kann fehlende Entitäten anhand fachlicher Namen erzeugen, verwendet dafür aber bewusst vereinfachte Defaults und ist deshalb kein verlustfreier Roundtrip-Vertrag.

Der neue Datenaustausch dient primär dazu, realistische Fachdaten aus Produktion in Testumgebungen zu übernehmen. Er ist weder ein Datenbank-Dump noch ein Tenant-Klon: Zielseitig vorhandene, im Import nicht enthaltene Datensätze werden nicht implizit gelöscht. Personenbezogene und operative Daten des E-Mail-Abodienstes gehören ausdrücklich nicht zum Transfer.

## Goals / Non-Goals

### Goals

- vollständige und symmetrische Import-/Exportverträge für alle transferrelevanten Waste-Fachdaten
- JSON als kanonisches Format für jedes einzelne Profil
- optionale verlustfreie CSV-/XLSX-Adapter für geeignete Profile
- ein versioniertes ZIP-Paket für eine auswählbare Menge eigenständiger JSON-Profile
- eindeutige Semantik für Pflichtwerte, optionale Werte, Defaults, `null` und ausgelassene Felder
- kontrollierte Produktion-zu-Test-Übertragung mit Preflight, Referenzprüfung und verständlichem Ergebnisbericht
- automatische Erkennung neuer, noch nicht klassifizierter Waste-Modellfelder

### Non-Goals

- bitidentischer Tenant- oder Datenbank-Klon
- implizites Löschen von Datensätzen, die nur im Ziel existieren
- öffentlicher Bürger-Export oder öffentlicher Waste-Feed
- Transfer von E-Mail-Abonnements, personenbezogenen Adressauswahlen, Consent, Token oder Outbox-Einträgen
- Transfer von Credentials, Datenbank-URLs, Instanzidentitäten, IAM-, Audit-, Job- oder Monitoringdaten
- Kopieren binärer Medienartefakte; portable konfigurierte Referenzen werden als Fachdaten übertragen, ihre Zielgültigkeit wird im Preflight ausgewiesen

## Decisions

### Decision: Ein kanonischer Datenprofilvertrag führt Import und Export

Jedes fachliche Profil besitzt genau eine versionierte Schemaquelle. Sie beschreibt Profil-ID, Formatversion, Entitäten, Felder, Typen, Referenzen, Eingabekategorie, Default und Transferklassifikation. Parser, Validierung, Importkatalog, Exportserialisierung, Templates und Dokumentation leiten sich aus diesem Vertrag ab oder werden dagegen vollständig geprüft.

Die Eingabekategorie eines enthaltenen Feldes ist eine der folgenden:

- `required`: Der Wert muss vorhanden und gültig sein.
- `optional`: Fachliche Abwesenheit ist zulässig; explizites `null` leert einen nullable Zielwert.
- `defaultable`: Beim Erstellen darf der Wert fehlen und erhält den versionierten Profildefault. Beim Aktualisieren bewirkt ein fehlender Wert keine Änderung.

Zusätzlich erhält jedes relevante Modellfeld eine Transferklassifikation:

- `included`: Das Feld wird von allen für das Profil angebotenen Formaten verlustfrei übertragen.
- `intentionally-excluded`: Das Feld wird mit einer stabilen fachlichen oder technischen Begründung ausgeschlossen.

Systemexporte materialisieren alle `included`-Felder einschließlich optionaler `null`-Werte und bereits wirksamer Defaults. Damit bleibt der Roundtrip deterministisch, während manuelle Teilimporte Defaults nur beim Erstellen auslösen.

Alternativen:

- getrennte Import- und Exportschemata wurden verworfen, weil sie erneut unbemerkte Drift erlauben würden
- direkte Ableitung allein aus dem PostgreSQL-Schema wurde verworfen, weil DB-Nullability keine ausreichende fachliche Pflicht-/Defaultsemantik beschreibt

### Decision: JSON funktioniert eigenständig pro Profil

Jedes Profil kann als einzelne JSON-Datei exportiert und wieder importiert werden. Der Envelope enthält mindestens `formatVersion`, `pluginId`, `profileId`, `exportedAt` und `records`. Quellinstanz-Metadaten dürfen nur nicht-sensitive Diagnosewerte enthalten und sind keine Zielidentität.

CSV/XLSX bleiben Adapter desselben Profils. Ein Adapter darf nur registriert werden, wenn er jedes `included`-Feld verlustfrei abbildet. Komplexe Arrays oder Objekte dürfen nicht stillschweigend verworfen werden; sie benötigen eine kanonische Kodierung oder das Format wird für dieses Profil nicht angeboten.

Alternativen:

- JSON nur innerhalb eines Gesamtpakets wurde verworfen, weil einzelne Profile unabhängig austauschbar und testbar bleiben sollen
- ausschließlich CSV/XLSX wurde verworfen, weil verschachtelte Übersetzungs-, Reminder- und Terminstrukturen dort unnötig fehleranfällig sind

### Decision: Das ZIP-Paket orchestriert unabhängige Profile

Ein Paket enthält ein Manifest, eine auswählbare Menge eigenständiger Profil-JSON-Dateien, deren Versionen, Abhängigkeiten, Datensatzanzahlen und Prüfsummen. Das Manifest definiert keine zweite Fachdatenrepräsentation.

Der Import begrenzt Pakete vor der Dekompression auf 16 MiB komprimierte Daten, zehn flache und eindeutige Einträge, 16 MiB je Eintrag, 64 MiB unkomprimierte Gesamtdaten sowie 256 KiB für das Manifest. Dadurch können hoch komprimierte oder strukturell missbräuchliche Archive den Worker nicht unbegrenzt belegen.

Die fachliche Reihenfolge ist mindestens:

1. Fraktionen, Geografie und Abstandspresets
2. Touren
3. Abholort–Tour-Zuordnungen und Tour-Einsätze
4. Ausweichtermine und Feiertagsregeln
5. portable Facheinstellungen

Einzelprofile prüfen fehlende Abhängigkeiten gegen den Zielbestand. Pakete prüfen sie zusätzlich innerhalb des Manifests.

### Decision: Die erste Profilmenge deckt das kanonische Waste-Fachmodell ab

Die erste verpflichtende Menge umfasst:

- Fraktionen einschließlich PDF-Kürzel, Übersetzungen, Behältergröße, Farbe, Beschreibung, Aktivstatus und fachlicher Reminder-Konfiguration
- Regionen, Orte einschließlich Postleitzahl, Straßen, Hausnummern und Abholorte
- benutzerdefinierte Abstandspresets
- Touren einschließlich Fraktionsreferenzen, Wiederholung, Presetreferenz, Gültigkeit, individuellen Terminen und Aktivstatus
- Abholort–Tour-Zuordnungen
- generische Tour-Einsätze einschließlich Datum, Hinweis und mehreren Abholorten
- globale und tourbezogene Ausweichtermine
- Feiertagsregeln
- portable statische Ausgabe- und Facheinstellungen

Stabile fachliche IDs werden übertragen, damit Referenzen profilübergreifend erhalten bleiben. `createdAt`/`updatedAt` gelten als technische Zielmetadaten und werden begründet ausgeschlossen. Das Legacy-Modell `waste_location_tour_pickup_dates` wird nicht als zweite Source of Truth übertragen; die kanonischen Tour-Einsätze decken dessen migrierten Fachinhalt ab.

Der bestehende Spezialimport für Tourzuordnungen nach Fraktionen bleibt separat. Er darf weiterhin fehlende Entitäten mit dokumentierten Defaults erzeugen, gilt aber weder als Exportprofil noch als Nachweis vollständiger Roundtrip-Fähigkeit.

### Decision: E-Mail-Abodaten sind außerhalb der Transfergrenze

Alle Tabellen und Verträge des operativen E-Mail-Abodienstes sind ausgeschlossen, insbesondere:

- `waste_email_reminder_subscriptions`
- `waste_email_reminder_subscription_items`
- `waste_email_reminder_outbox`
- personenbezogene Adressauswahlen, Consent-Zeitpunkte und -Versionen
- DOI-/Abmeldetoken beziehungsweise deren Hashes
- Versandpayloads, Deduplizierung, Lease-, Retry- und Fehlerzustände

Diese Ausschlüsse sind positive Vertragsentscheidungen und keine Coverage-Lücken. Die fachliche Reminder-Konfiguration an Fraktionen bleibt dagegen Bestandteil des Fraktionsprofils, weil sie keine Abonnenten enthält und das fachliche Kanalverhalten beschreibt.

### Decision: Import bleibt Upsert-basiert und vorab prüfbar

Der Standardimport legt Datensätze mit stabilen IDs an oder aktualisiert sie. Nicht enthaltene Zielwerte werden nicht gelöscht. Vor dem Commit zeigt ein Preflight mindestens:

- neue, geänderte und unveränderte Datensätze
- angewendete Defaults
- ungültige Pflichtwerte und Typen
- fehlende, mehrdeutige oder konfliktbehaftete Referenzen
- unbekannte Profil-/Formatversionen
- nicht portable oder im Ziel ungültige konfigurierte Referenzen

Ein Einzelprofil wird atomar geschrieben. Ein Paket wird nach vollständigem Preflight in Abhängigkeitsreihenfolge und innerhalb einer gemeinsamen Transaktion geschrieben, soweit alle Profile dieselbe Waste-Fachdatenbank betreffen. Portable Schnittstelleneinstellungen werden innerhalb dieser Commit-Grenze vor dem Waste-Commit persistiert und bei einem nachfolgenden Commitfehler kompensierend auf ihren vorherigen Stand zurückgesetzt. Teilerfolge sind nicht zulässig.

### Decision: Exporte laufen als hostgeführte, autorisierte Jobs

Waste registriert Exportprofile und einen Export-Job über die generische Plugin-Operations-Plattform. Der Host löst die aktive Instanz serverseitig auf, autorisiert die vollqualifizierte Action `waste-management.export.execute`, erzeugt das Artefakt in einem geschützten Speicher und liefert eine zeitlich begrenzte Downloadreferenz. Das Artefakt oder seine Referenz wird nicht als öffentlicher Feed publiziert.

Import bleibt über `waste-management.import.execute` getrennt autorisiert. Ergebnisartefakte dürfen weder Credentials noch ausgeschlossene E-Mail-Abodaten enthalten. Dateinamen, Jobdetails und Logs enthalten keine personenbezogenen Inhalte oder rohen Fachdaten.

## Risks / Trade-offs

- Ein zentraler Profilvertrag ist umfangreicher als lose CSV-Definitionen, verhindert dafür aber Drift zwischen Import, Export, Templates und Dokumentation.
- Stabile IDs können mit bestehenden Zielwerten kollidieren. Der Preflight muss semantische Konflikte sichtbar machen und darf sie nicht still überschreiben.
- Große Geografieprofile können Arbeitsspeicher und Artefaktspeicher belasten. Export, Validierung und Import sollen streaming- oder batchfähig bleiben, ohne die atomare Commit-Grenze aufzugeben.
- Externe Branding-Referenzen können in einer Testumgebung ungültig sein. Sie werden nicht verschwiegen, sondern im Preflight als portable Referenz oder Warnung klassifiziert.
- Paketweite Transaktionen können lange laufen. Implementierung und Tests müssen Grenzwerte, Fortschritt und Rollback-Verhalten explizit prüfen.

## Migration Plan

1. Gemeinsamen Datenprofil- und Feldvertrag ergänzen, ohne bestehende Importprofil-IDs zu brechen.
2. Bestehende Importe auf die kanonischen Felddefinitionen umstellen und fehlende Felder/Profile ergänzen.
3. JSON-Import für jedes Profil und Roundtrip-Gates einführen.
4. Exportprofile, Exportjob und geschützte Artefakte ergänzen.
5. CSV/XLSX-Adapter profilweise nur nach Verlustfreiheitsnachweis freischalten.
6. ZIP-Manifest und paketweiten Preflight/Import ergänzen.
7. Data-Tools-UI, Rechte, Dokumentation und Architekturabschnitte aktualisieren.

Bestehende Spezialimporte bleiben kompatibel und werden nicht automatisch zu Roundtrip-Profilen umgedeutet.

## Open Questions

Keine offenen Produktentscheidungen.
