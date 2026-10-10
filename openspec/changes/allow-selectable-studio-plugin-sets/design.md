## Kontext

Studio besitzt die benannten Build-Auswahlen `studio` und `ssf`. Der Abnahmefall
von #1503 benötigt dagegen `categories,news,ssf`. Eine feste Kassel-Distribution
würde den Kundenfall in die Plattform einbauen. Dieser Lieferabschnitt erweitert
die bestehenden Build-, Katalog- und Artefaktpfade um eine explizite,
unveränderliche Auswahl vorhandener Workspace-Plugins.

## Ziele und Nicht-Ziele

- Eine explizite Plugin-Menge validieren und ihre Beiträge sowie Artefaktnachweise
  an genau diese Auswahl binden.
- Die bestehenden `studio`- und `ssf`-Auswahlen mit ihren Inhalten und Aufrufen
  erhalten.
- Medien bleiben Host-Funktionalität; es entsteht kein `plugin-media`.
- Keine Änderungen an Kasseler Diensten, Keycloak, Mainserver-Daten, Tenants oder
  Traefik. Keine Plugin-Erweiterung durch Laufzeitvariablen oder Hot-Loading.

## Entscheidungen

- Die optionale Eingabe `plugin_ids` des bestehenden Build-Workflows enthält eine
  kommagetrennte Workspace-Plugin-Menge. Die Auswahl wird auf Katalogreihenfolge
  normalisiert; leere, doppelte, unbekannte oder widersprüchliche Eingaben
  brechen vor dem Image-Build ab.
- Der vorhandene Plugin-Katalog begrenzt die auswählbaren Pakete. Der bestehende
  Vite-Plugin-Einstieg erzeugt für `custom` statische Import-Registries für
  Browser, Metadaten, Server, Jobs und Mainserver-Ownership. Die benannten
  Distributionen behalten ihre bisherigen festen Eingaben.
- Alle Custom-Registries und das Runtime-Manifest verwenden dieselbe aufgelöste
  Auswahl. Die Host-Validierung der Deskriptoren bleibt wirksam. Zur Laufzeit
  kann keine Variable zusätzliche Plugin-Imports erzeugen.
- Der vorhandene Provisioning-Worker liest bei `custom` die beim Build erzeugten
  Aktivierungs-, IAM- und Lifecycle-Beiträge aus dem Manifest. Gemischte Sätze
  verwenden die regulären Content-Routen; SSF-Prüfschritte richten sich nach
  der tatsächlich enthaltenen SSF-ID.
- Nur ein manueller Build mit `plugin_ids` erzeugt zusätzlich ein Custom-Image.
  Es verwendet das vorhandene Studio-Repository und einen Tag aus Quell-SHA und
  Auswahl-Fingerprint. Reguläre Studio-/SSF-Images werden weiterhin erzeugt;
  das Custom-Image wird nicht automatisch nach Dev ausgerollt.
- Manifest, Chunk-Provenienz und OCI-Metadaten binden den normalisierten Satz
  über einen SHA-256-Fingerprint. Paketbereinigung und Positiv-/Negativprüfung
  verwenden denselben Satz. Das bestehende Image-Gate prüft Repository, Digest,
  Revision, Distribution, Fingerprint, Paketinventar und tatsächliche Chunk-Bytes.
- Media ist eine Host-Modulfähigkeit und keine auswählbare Plugin-ID.

## Risiken und Nachweise

- Auswahl und Registries können auseinanderlaufen. Gezielte Tests prüfen die
  Auswahl `categories,news,ssf` und ausgeschlossene Plugin-Imports; der echte
  Build erzeugt das Manifest und die Provenienz aus dem finalen Artefakt.
- Einige bisherige Host-Abhängigkeiten bleiben im Image erhalten, darunter die
  gemeinsamen Waste-Runtime-Pakete. Das ist kein Nachweis ihrer vollständigen
  physischen Optionalität; deren Entkopplung ist ein eigener Lieferabschnitt.
  Ausgeschlossene `plugin-*`-Beiträge dürfen weiterhin in keinem Chunk liegen.
- Ein Custom-Image muss über seinen verifizierten Digest verwendet werden;
  ein Tag oder ein lokaler Build ersetzt keine Registry-Digest-Verifikation.
- Grüne Unit-Tests ersetzen weder den Image-Laufzeitnachweis noch die spätere
  authentifizierte Kassel-Staging-Abnahme. Der Evidenzstand wird in `assurance.md`
  mit diesen Grenzen festgehalten.

## Einführung und Rückweg

1. Bestehende benannte Build-Auswahlen erhalten und die explizite Menge ergänzen.
2. Custom-Registries, Manifest und Provenienz aus dem validierten Satz erzeugen.
3. Den bestehenden Build und Image-Verifier für den optionalen Custom-Build
   erweitern und die bisherigen Vertragstests erhalten.
4. Den Ziel-Satz `categories,news,ssf` mit Positiv-/Negativinventar prüfen.
5. Nach Review und Merge die separate Kassel-Staging-Installation in einem
   eigenen Lieferabschnitt mit verifiziertem Digest vorbereiten.

Ein späterer Rückweg verwendet den vorherigen unveränderlichen Image-Digest.
Diese Änderung führt keine Datenmigration aus und verändert keine Deployments.

## Offener Folgeabschnitt

Vor Kassel Staging sind Hostname, getrennte Mainserver-/SSF-Testkontexte,
DNS/TLS, Auth-Redirects und Datenpfade zu klären. Diese Angaben gehören zum
Staging-Auftrag und blockieren die allgemeine Build-Auswahl nicht.
