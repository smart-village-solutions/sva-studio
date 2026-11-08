## ADDED Requirements

### Requirement: Deklarierter Einstieg für Plugin-Einstellungen

Der bestehende Plugin-Plattformvertrag SHALL einen optionalen serialisierbaren Einstellungsbeitrag unterstützen, der eine registrierte Route desselben Plugins und ihren Modul-, Action- und Access-Bezug referenziert. Der Host MUST den Beitrag vor Veröffentlichung über den bestehenden Descriptor-/Snapshot-Pfad validieren. Das erste nutzende Plugin SHALL `application-workspace` sein; andere Plugins benötigen keinen Beitrag.

#### Scenario: Gültiger Einstellungsbeitrag

- **WHEN** ein Plugin eine eigene registrierte Einstellungsroute mit konsistentem Module-IAM- und Access-Bezug deklariert
- **THEN** veröffentlicht der Host den validierten Einstieg im kanonischen Snapshot
- **AND** löst er die Browser-Komponente ausschließlich über den vorhandenen Browser-Entry auf

#### Scenario: Unbekannte oder fremde Referenz

- **WHEN** ein Beitrag auf eine unbekannte Route, eine Route eines anderen Plugins oder einen inkonsistenten Modul-/Berechtigungsbezug verweist
- **THEN** lehnt die bestehende Plugin-Validierung den ungültigen Beitrag vor Veröffentlichung ab

#### Scenario: Plugin ohne Einstellungen oder deaktiviertes Plugin

- **WHEN** ein Plugin keinen Einstellungsbeitrag hat oder für die Instanz nicht wirksam aktiv ist
- **THEN** entsteht kein nutzbarer Einstellungseinstieg für dieses Plugin


### Requirement: Externes Paket mit deklarativen Shell-Beiträgen

Das Arbeitsplatz-Plugin SHALL in einem eigenständigen Git-Repository gepflegt und über den bestehenden Paket-Katalog geladen werden. Studio MUST ohne Quellcodeimporte aus diesem Repository auskommen. Der bestehende Navigationsvertrag SHALL einen Header-Einstieg auf eine eigene registrierte Route unterstützen; der Routenvertrag SHALL das seitenleistenfreie Layout `content-only` unterstützen. Der gemeinsame Icon-Picker und der verifizierte Speicher-/Audit-Adapter bleiben Host-Zuständigkeiten.

#### Scenario: Installation als unabhängiges Paket

- **WHEN** das separat gebaute Paket als direkte App-Abhängigkeit mit `linked-package` oder `installed-distribution` registriert wird
- **THEN** lädt Studio Descriptor, Browser und Server aus den manifestierten Paket-Entrypoints
- **AND** benötigt Studio keine Kopie unter `packages/plugin-application-workspace`

#### Scenario: Eigener Header-Einstieg und Layout

- **WHEN** das externe Paket einen konsistent autorisierten Header-Einstieg mit dem unterstützten Grid-Glyph und eine eigene `content-only`-Route deklariert
- **THEN** rendert der Host den Einstieg nur bei wirksamer Modulzuweisung und erfüllter Access-Anforderung
- **AND** blendet die Host-Shell auf dieser Route Seitenleiste und mobilen Navigationseinstieg aus

#### Scenario: Fremder oder inkonsistenter Header-Beitrag

- **WHEN** ein Header-Beitrag auf eine fremde Route verweist oder einen inkonsistenten Action-/Access-Bezug oder ein unbekanntes Glyph/Layout deklariert
- **THEN** lehnt die bestehende Registry-Validierung den Beitrag vor Veröffentlichung ab
