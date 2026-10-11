# Assurance: buildgebundene Plugin-Menge

## Invarianten und Nachweise

| ID        | Invariante                                                                            | Geplanter Nachweis                                                                                                                            | Fehlerverhalten                                                        |
| --------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| PLUGSET-1 | Die Plugin-Menge ist beim Build validiert und während der Laufzeit nicht erweiterbar. | Unit-Tests für Normalisierung, bekannte IDs, Duplikate, leere/ungültige Auswahl; Runtime liest ausschließlich Manifest und generierte Inputs. | Build bricht vor Vite/Image-Publish ab.                                |
| PLUGSET-2 | Browser, Server, Worker, Routing, IAM, Module und Jobs sehen dieselbe Menge.          | Registrierungs-/Composition-Tests für die Auswahl `news,categories,ssf`; generierter Datei-Hash und Runtime-Manifest im Image.                | Kein partielles Registry-Set wird publiziert.                          |
| PLUGSET-3 | Nicht ausgewählte Plugins liefern weder ausführbaren Code noch Host-Beiträge.         | Verifier prüft finalen Client-/Server-Chunk-Ursprung, Paketinventar, Routen, IAM/OIDC/Jobs-Inventar für positives und negatives Set.          | Image-Verifikation schlägt fehl; Digest kann nicht freigegeben werden. |
| PLUGSET-4 | Auswahl, OCI-Metadaten, Manifest und Digest bezeichnen dasselbe Artefakt.             | Image contract test sowie `docker image inspect`/Manifest-/Provenienzvergleich im Build-Verifikationsjob.                                     | Build-Evidenz wird nicht erfolgreich und kein Deployment folgt.        |
| PLUGSET-5 | Die bestehenden `studio`- und `ssf`-Artefakte behalten ihre bisherigen Plugin-Mengen. | Bestehende Image-Contract-Fälle bleiben aktiv und werden für beide Distributionen ausgeführt.                                                 | Regression stoppt PR/Build.                                            |

## Systemgrenzen

- GitHub Build-Eingabe → Plugin-Auswahlvalidierung → generierte statische Registries → Vite-/Server-/Worker-Build → Image-Manifest und OCI-Metadaten → Image-Verifikation.
- Kein Kasseler Server, Keycloak, Mainserver, persistenter Tenant-Datensatz oder Traefik wird in diesem Lieferabschnitt verändert.

## Evidenzstand am 11.10.2026

- Auswahl-, Registry-, Routing- und Worker-Regressionstests sowie die Artefakt- und
  Image-Contract-Tests sind lokal erfolgreich. Die bisherigen Studio-/SSF-Fälle
  bleiben Bestandteil dieser Tests. Der App-Typecheck, Skript-Typecheck und die
  mitlaufenden Server-Package-Runtime-Prüfungen sind erfolgreich.
- Ein echter Custom-Build mit `categories,news,ssf` erzeugt 301 attestierte
  JavaScript-Dateien. Ihre SHA-256-Werte wurden gegen die finalen Dateien geprüft.
  Client und Server enthalten alle drei ausgewählten Plugins; die Provenienz
  enthält ausschließlich `plugin-categories`, `plugin-news`, `plugin-ssf` und
  das gemeinsame SDK. Das Manifest enthält denselben Satz und dessen
  Provisioning-Policies. Der Auswahl-Fingerprint lautet
  `f3b890292414506dd6a268f1bae9132bd68d34ebcddbbf52f8f264f88e8f2010`.
- Die Auslagerung der vorhandenen Chunk-Provenienzerzeugung in eine direkt
  verwendete Hilfsdatei hält das Artefaktskript innerhalb der Komplexitätsgrenzen;
  sie schafft keinen weiteren Build- oder Verifikationspfad.
- PLUGSET-4 ist bisher durch Vertragstests abgesichert. Der veröffentlichte
  Registry-Digest, die tatsächlichen OCI-Metadaten und der authentifizierte
  Image-Laufzeitlauf werden erst durch den bestehenden Build-/Image-Verify-Job
  nach dem Merge nachgewiesen. Dafür liegt noch kein erfolgreicher Lauf vor.
- Die Kassel-Staging-Abnahme und ein Rollout sind nicht durchgeführt. Sie bleiben
  ein separat zu beauftragender Folgeabschnitt.

## Rückweg

Ein fehlgeschlagener Build oder eine fehlgeschlagene Image-Verifikation liefert keinen freigegebenen Digest. Die Kassel-Bereitstellung samt Rückweg wird separat freigegeben. Für reguläre Studio-Rollouts gilt ausschließlich [der kanonische Rollout-Prozess](../../../docs/guides/studio-rollout-process.md).
