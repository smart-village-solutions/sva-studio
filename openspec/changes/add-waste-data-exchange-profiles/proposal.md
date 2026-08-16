# Change: Vollständige Waste-Datenaustauschprofile ergänzen

## Why

Produktive Waste-Fachdaten sollen kontrolliert in Testumgebungen übertragen werden können, ohne einen Tenant-Klon oder einen öffentlichen Export-Feed einzuführen. Die vorhandenen Importprofile decken das Waste-Fachmodell nur teilweise ab, besitzen keine symmetrischen Exportverträge und unterscheiden nur zwischen Pflicht- und optionalen Spalten. Dadurch bleiben neue oder komplexe Felder unbemerkt außerhalb des Transfers und sinnvolle Defaults sind nicht einheitlich definiert.

## What Changes

- führt kanonische, versionierte Waste-Datenprofile ein, die Import und Export aus demselben Feldvertrag ableiten
- klassifiziert jedes transferrelevante Feld als Pflichtwert, optionalen Wert oder defaultfähigen Wert und dokumentiert seine Transferentscheidung
- unterstützt JSON für jedes einzelne Profil sowie ein manifestbasiertes ZIP-Paket für mehrere Profile
- behält CSV/XLSX nur dort bei, wo das jeweilige Profil vollständig und verlustfrei abgebildet werden kann
- ergänzt vollständige Profile für Fraktionen, Geografie und Abholorte, Abstandspresets, Touren, Zuordnungen, Einsätze, Ausweichtermine, Feiertagsregeln und portable Facheinstellungen
- erhält den bestehenden adress- und fraktionsorientierten Spezialimport als getrennten Fremddatenimport
- führt exportierte Daten standardmäßig per kontrolliertem Upsert und ohne implizite Löschungen in eine Zielinstanz ein
- ergänzt Preflight, Abhängigkeitsprüfung, atomare Verarbeitung, strukturierte Ergebnisberichte und Roundtrip-/Coverage-Gates
- schließt den E-Mail-Abodienst einschließlich Abonnements, Consent, Token, Subscription-Items und Outbox-Daten aus Datenschutzgründen vollständig aus
- schließt Credentials, Datenbankverbindungen, Instanzidentitäten, Studio-Governance, Audit-/Jobhistorien und andere umgebungsspezifische Betriebsdaten aus
- erweitert die generische Plugin-Operations-Plattform um deklarative Exportprofile und geschützt herunterladbare Ergebnisartefakte

## Impact

- Affected specs: `waste-management`, `plugin-operations-platform`
- Affected code: `packages/core`, `packages/plugin-sdk`, `packages/waste-management-contracts`, `packages/waste-management-runtime`, `packages/data-repositories`, `packages/auth-runtime`, `packages/plugin-waste-management`, `apps/sva-studio-react`
- Affected docs: Waste-Data-Tools-Guide, Changelog und technische Transferdokumentation
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
- Keine geplante Änderung des Waste-Datenbankschemas; falls die Implementierung doch Schemaänderungen erfordert, sind `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` im selben Change fortzuschreiben.
