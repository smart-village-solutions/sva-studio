# Vorbereitung: E-Mail-Bestätigung zuerst in Staging, danach Havelland

Stand: 30.10.2026. **Vorbereitung, kein Deploymentnachweis.** Die unten genannten
Dienste und Digests wurden ausschließlich lesend über Quantum geprüft; alle
beobachteten App-Tasks liefen. Es wurden keine Mails verschickt oder Realms
verändert. Die vom Nutzer bereits in allen Realms gepflegten Absendernamen
bleiben unverändert.

## Ziel und Grenze

Die Plattformadministration erhält je Instanz einen Editor für die deutschen
Bestätigungstexte. Die bestehende gemeinsame Main-Server-Methode für Registrierung
und Adressänderung verwendet `send-verify-email`. Einladung und Passwort-Reset,
Registrierungspasswort und Benachrichtigung an die alte Adresse bleiben erhalten.
Keine neue automatische Anmeldung und keine zusätzliche Mail. Migration `0111`
führt beide Instanzvorlagen in `iam.instance_mail_templates` zusammen und ergänzt
die allgemeine Bestätigungsvorlage im bestehenden serverweiten Bestand. Die
bestehende allgemeine Einladung bleibt erhalten. Die Migration schreibt keine
Keycloak-Texte. Die bisherige Einladungsspalte bleibt befristeter Schreib- und
Lesekompatibilitätseingang für alte App-Versionen: Ein Invoker-Trigger übernimmt
Writes atomar in die gemeinsame Quelle; der neue Einladungsschreiber sperrt
zuerst die Instanz, prüft die gemeinsame Revision und nutzt denselben Eingang.
Reine Sync-Metadaten lösen keine Spiegelung aus. Damit sind Migration vor App-Wechsel
und ein zulässiger App-Digest-Rollback ohne Down möglich. Alte Clients behalten
bis zur Ablösung ihre bisherige NULL/Revision-0-Reset-Semantik; neue Clients prüfen
die monotone gemeinsame Revision. Vorher Backup. Die Legacy-Spalte, Brücke und
Schreibfunktion werden erst in einem separat freigegebenen Contract-Schritt nach
Nachweis des Endes aller alten App- und Rollback-Versionen entfernt; vorher müssen
Legacy- und gemeinsame Quelle vollständig übereinstimmen.

## Lesend festgestellter Ausgangsstand

Quantum-Endpoint: `sva`. Keycloak: `https://keycloak.smart-village.app`, Version
`26.8.1`. Havellands Realm ist `bb-havelland`.

| Ziel                  | Stack / App-Service                                                 | Aktuelles Image                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio-Staging        | `studio-staging` / `studio-staging_app`                             | `ghcr.io/smart-village-solutions/sva-studio@sha256:b3921187e6c34888772f95f31cb85504864a8facd69f70b32c3658337500e1c0`                                |
| Main-Server-Staging   | `saas-mainserver-staging` / `saas-mainserver-staging_app`           | `registry.gitlab.tpwd.de/ikusei/smart-village-app-mainserver:saas-staging@sha256:1327ea970519fd36d56186455c3a316e3b652260b0b802f97f0aeb881d68e132`  |
| Studio-Production     | `studio` / `studio_app`                                             | `ghcr.io/smart-village-solutions/sva-studio@sha256:2499c83d7eea5f02359f9aa373f0dd717998b8602e4a9c0e8f8a85258a08ec42`                                |
| Havelland-Main-Server | `bb-havelland-main_server-sva` / `bb-havelland-main_server-sva_app` | `registry.gitlab.tpwd.de/ikusei/smart-village-app-mainserver:saas-releases@sha256:a7212d925a9308c85fa5cca82be592e1f07c2b50e6341ed627c8c16aa08fb7c8` |

Die Services eines Stacks können getrennt aktualisiert werden; sie verwenden
jedoch gemeinsame Release-Tags. Ein neuer Tag allein begrenzt keinen Rollout
auf Havelland. Vor dem tatsächlichen Lauf sind aktuelle Digests und Taskzustände
erneut zu lesen. Diese historischen Werte autorisieren keine Mutation.

## Isolierter Main-Server-Fix

Der [vorbereitete Patch](mainserver-email-verification.patch) enthält ausschließlich
`README.md`, `app/services/keycloak/realms_service.rb` und
`spec/services/keycloak/realms_service_spec.rb`. Seine Anwendbarkeit wurde gegen
den lokalen Release-Ref `gitlab/saas-releases` (`6469e648`) mit `git apply --check`
in einem temporären Verzeichnis geprüft. Die drei Dateien unterscheiden sich vom
Release-Ref nur durch diesen Fix. Das ersetzt weder einen aktuellen Fetch noch
den Nachweis der OCI-Revision des laufenden oder künftig gebauten Images.

## Reihenfolge der Freigabe

1. Studio-Änderung isoliert reviewen und über den kanonischen
   [Build-/Promote-Prozess](../../guides/studio-rollout-process.md) nach Dev und
   danach Staging bringen. Git-Revision, Image-Digest und erfolgreiche Main-E2E-
   Evidenz müssen zusammenpassen; das verpflichtende Backup vor Staging bleibt
   bestehen. Migration `0111` ist Bestandteil dieses Releases; RLS, übernommenen
   Einladungstext und Quellrevision prüfen. Es gibt keinen einmaligen automatischen
   Realm-Write beim Start. Der vollständige Release-Diff bestimmt die Workflow-Modi.
2. Den Main-Server-Fix ebenfalls isoliert für Staging bauen und prüfen. Der lokale
   Main-Server-Checkout enthält andere Arbeiten. Nur die Änderung in
   `app/services/keycloak/realms_service.rb`, die zugehörigen Service-Tests und der
   README-Hinweis gehören zu diesem Fix. Der vorhandene Main-Server-Workflow
   `.gitlab-ci.yml` deployt `saas-mainserver`; er belegt weder den gezielten
   `saas-mainserver-staging`- noch den Havelland-Releaseweg. Den vorhandenen
   Betriebsweg und freigegebenen Source-Stand vor einer Veröffentlichung klären;
   keinen neuen Deploy-Workflow und keinen direkten Ersatzpfad improvisieren.
3. Eine explizite Testinstanz im Staging-Studio und deren tatsächlichen
   Main-Server-/Realm-Bezug festlegen. Die Auswahl nicht aus ähnlich klingenden
   Namen oder dem Root-Realm `studio-staging` ableiten. Zuerst wirksame Texte und
   je drei rohe Einladung-/Bestätigungsschlüssel und vorhandene Overrides sichern,
   ohne Zugangsdaten oder Empfänger zu dokumentieren. Vorlagen im Studio öffnen;
   Studio-Quelle, kompilierten Kommunennamen und Startseiten-Link mit Keycloak
   vergleichen. Bei Abweichungen ausdrücklich übernehmen oder übertragen. Nicht
   verlustfrei importierbares HTML gesondert prüfen; keine stillschweigende Reduktion.
   Neutrale Bestätigungsvorlage speichern, dann kontrolliert übertragen und den
   Readback prüfen. Einen simulierten Sync-Fehler, externen Edit, veraltete Revision
   und geänderte Kommunendaten prüfen. Einladung darf bei bekannter Abweichung nicht
   versendet werden; Hinweis und Behebungslink müssen sichtbar sein. Fehlende Rechte
   oder nicht erreichbares Keycloak bleiben blockierend, ohne globalen Fallback.
   Die Vererbung mit zwei ausdrücklich isolierten Staging-Instanzen nachweisen:
   Instanz A ohne Override, Instanz B mit eigenem Bestätigungstext. Auf der
   Templates-Seite den allgemeinen Standard ändern; nur A darf Keycloak-Writes
   erhalten. B muss Quelle und Realm-Texte behalten. An B „Allgemeine Vorlage
   verwenden“ ausführen; B muss den aktuellen Standard verwenden und bei dessen
   nächster Änderung wieder mitlaufen. Auch allgemeinen Reset, parallele
   Standardbearbeitung, einen gleichzeitig angelegten Override und einen
   fehlgeschlagenen Instanzabgleich prüfen. Die allgemeine Quelle muss bei
   einem Fehler gespeichert bleiben, offene Instanzen müssen angezeigt werden.
   Vor einer allgemeinen Staging-Änderung sämtliche erbenden Registry-Ziele und
   deren Realm-Zuordnungen prüfen: kein Produktionsrealm darf in diesem Testscope
   liegen. Keine ungeprüfte Produktionskopie für den allgemeinen Abgleich verwenden.
4. Mit einem ausdrücklich festgelegten Testkonto und Empfänger Registrierung und
   Adressänderung abnehmen: richtige Bestätigungsmail, genau ein Bestätigungslink,
   Passwort bleibt erhalten, vor Bestätigung kein Login, nach Bestätigung kein
   neu eingeführter automatischer Login. Die bestehende Nachricht an die alte
   Adresse bleibt erhalten. Einladung und Reset gezielt gegenprüfen. Einfache
   vorhandene Rücksprünge genügen; keine neue Redirect-Konstruktion.
5. Erst nach grüner Staging-Abnahme denselben Studio-Digest über den geschützten
   Production-Promote freigeben. Die Codebereitstellung des Editors ist zentral;
   sie verteilt beim Start keine Texte auf alle Realms. Bestehende Einladungstexte
   vor Produktionsfreigabe kontrolliert mit den gespeicherten Sollwerten abgleichen:
   exakt passende Bestandswerte bleiben nach aktuellem lesendem Vergleich verwendbar;
   abweichende oder nicht bestätigte Werte blockieren den Versand bis zur Behebung.
   Änderungen einer allgemeinen Vorlage für Einladung oder Bestätigung synchronisieren
   alle erbenden Realms des jeweiligen Anlasses;
   deshalb während des Havelland-Piloten ausschließlich instanzbezogen arbeiten.
6. Anschließend nur Havellands Main-Server auf den geprüften Fix-Stand bringen
   und nur dessen drei `emailVerification*`-Texte über einen bewussten
   Instanz-Override samt Abgleich in der Plattformadministration anpassen. Den
   allgemeinen Produktionsstandard während dieses Piloten nicht ändern; eine solche
   Änderung benötigt einen gesondert abgestimmten Scope aller erbenden Realms. Den bereits gepflegten Absendernamen und sämtliche `executeActions*`-
   Texte unverändert lassen. Die finale Abnahme an ein festgelegtes Testkonto
   binden; andere kommunale Main-Server bleiben auf ihren bisherigen Digests.

## Quellprüfung des Bestätigungslinks

Im passenden Keycloak-26.8.1-Quellstand setzt der gemeinsame
[Action-Token-Handler](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/actiontoken/AbstractActionTokenHandler.java#L90-L94)
für eine frisch erzeugte Aktionssession `END_AFTER_REQUIRED_ACTIONS=true`.
Das ist die bestehende Keycloak-Begrenzung des Ablaufs und kein neu eingeführter
Studio-Autologin. Die echte Staging-Prüfung muss das Verhalten einschließlich
vorhandener Browser-Sessions trotzdem nachweisen.

## Theme und Rückweg

Für `bb-havelland` ist `sva-kern2` als E-Mail-Theme eingetragen, es fehlte jedoch
in der abgefragten Theme-Liste. Die effektiven Texte entsprachen dem eingebauten
Standard und erwähnten eine Kontoerstellung auch bei Adressänderung. Der direkte
Dateizugriff auf den laufenden Keycloak-Container scheiterte mit Quantum-Proxyfehler
502; die wirksamen Texte wurden stattdessen über die lesende Keycloak-Ressource
`/resources/bb-havelland/email/de` geprüft.

Der Editor schreibt Realm-Overrides und verändert die Theme-Auswahl nicht.
Vor Freigabe sind dennoch Verfügbarkeit und tatsächliche Darstellung mit dem
laufenden Theme zu prüfen. Ein API-Readback ersetzt keinen echten Mail-/Linktest.

Als Rückweg dienen die vor dem jeweiligen Lauf frisch erfassten App-Digests und
die vorher gesicherten drei Realm-Texte. Vorher fehlende Overrides dürfen beim
Rückweg nicht versehentlich als neue feste Werte angelegt werden. SMTP,
Einladungsschlüssel und Themes sind nicht Teil dieser Rücknahme. Ein Studio-
App-Rollback erfolgt nur im zulässigen Rollout-/Recovery-Prozess. Migration `0111`
Down behält die bereits gespiegelten Einladungsvorlagen, entfernt jedoch Bestätigungsvorlagen und
Sync-Metadaten sowie den neuen allgemeinen Bestätigungseintrag; diese vorher sichern. Keycloak-Texte werden durch einen DB-/App-
Rollback nicht automatisch zurückgesetzt.

## Noch offen vor einem echten Rollout

- Review, isolierter Quellstand und gebaute Ziel-Digests für Studio und Main-Server.
- Bestehender gezielter Main-Server-Releaseweg für Staging und Havelland.
- Explizite Staging-Testinstanz und Testempfänger samt Freigabe des Mailversands.
- Echte Staging-Abnahme einschließlich Vererbung; Mail-/Linktest und Havelland nur nach gesonderter Freigabe.

Implementierung und lokale Gates stehen im
[Change](../../../openspec/changes/add-email-verification-template-editor/tasks.md).

## Lokale Vorbereitung geprüft

Die getrennten Nachweise umfassen Core-Compiler und externe Übernahme, Repository-
CAS, echte PostgreSQL-Migration/Rückmigration und RLS in einer isolierten Testdatenbank,
HTTP-Autorisierung, Readback-Fehler, kommunale Kontextänderung, initialen und erneuten
Einladungsversand sowie bestehende UI-Editoren. Die laufende Aufgabenliste enthält
[die finalen Gate-Stände](../../../openspec/changes/add-email-verification-template-editor/tasks.md).
Lokale Tests sind keine freigegebene Commit-/Image-Kombination und ersetzen keine
Staging-Abnahme mit dem aktiven Theme. Staging- und Havelland-Deployment sowie echte
Mailtests sind weiterhin ausdrücklich nicht ausgeführt.

## Ergänzung: allgemeine Bestätigung mit Instanz-Overrides

Für beide Anlässe gilt jetzt Instanz-Override → allgemeine Vorlage → eingebauter
Standard. Die allgemeine Bestätigung ist unter `/admin/templates` bearbeitbar.
Migration `0111` erweitert die bestehende globale Tabelle um `email_verification`,
Revision 0 und einen leeren Override. Sie kopiert keine Instanztexte in den Standard
und ändert keine Keycloak-Texte. RLS erlaubt globale Änderungen ausschließlich
im Plattformkontext. Die instanzbezogene Überspringprüfung beim allgemeinen
Abgleich geschieht unter derselben Instanzsperre wie die tatsächliche Synchronisierung.
