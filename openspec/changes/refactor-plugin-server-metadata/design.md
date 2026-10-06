## Bestandsgrenze

- `plugin-catalog-loader.ts` löst einen `PluginDefinition` über
  `entryPoints.browser` auf. `resolvePluginCatalogAsync` validiert erst danach
  und erstellt `PluginSnapshot`/`BuildTimeRegistry`.
- `plugin-server-runtime.server.ts` importiert diesen Snapshot aus
  `plugins.ts`; `plugin-activation-policy-bootstrap.server.ts` lädt das
  Browsermodul dynamisch. `plugin-operation-runtime.server.ts` besitzt eine
  zweite Katalogmaterialisierung, deren Descriptoren ebenfalls aus
  Browsermodulen stammen.
- `PluginRouteDefinition.component` und einzelne Plugin-Dateien
  (`plugin-ssf`, `plugin-waste-management`) ziehen Fachseiten bereits bei
  Definition der Metadaten in den Importgraphen. Die meisten Standard-Content-
  Plugins tragen dagegen nur deklarative Beiträge in `plugin.tsx`, während
  ihre `index.ts`-Entry-Points Seiten exportieren.

Am Ausgangsstand `60059753b161236d0fd0b1ca6ffd99ab5feb2a48` haben alle
elf Plugin-Pakete ein Manifest mit Browser-Entry-Point; SSF und Waste haben
zusätzlich Server-Entry-Points, SSF auch einen Job-Entry-Point. Von den
geprüften `plugin.tsx`-Definitionen importieren SSF und Waste direkt
Fachseiten. Ein offener PR zu #1509, #1511 oder #1512 war am 06.10.2026
nicht vorhanden. Die gezielten Ausgangstests sind grün: Server-Runtime
6/6, Job-Runtime 18/18, Aktivierungsbootstrap 10/10. Diese Tests belegen
noch nicht, dass ein serverseitig unladbarer Browser-Entry-Point toleriert
wird; dafür ist D1 vorgesehen.

## Entscheidung

Der Manifestvertrag erhält `entryPoints.descriptor`. Dieser Pfad exportiert
den deklarativen Plugin-Descriptor. Er ist die einzige Quelle für Identität,
Actions, Permissions, Routenbeschreibung, IAM, Lifecycle, Server-Handler-
Deskriptoren und Job-Typen. Browser-Entry-Points exportieren nur zusätzliche
View-Bindings und andere Browser-Funktionen. Für die bereits vorhandenen
Profile werden Descriptor-Module in den bestehenden Build-Inputs registriert;
die allgemeine Paketauflösung bleibt #1512.

Der SDK-Vertrag trennt Routenbeschreibung und ausführbare Browser-Komponente
typisiert. Der bestehende Katalogresolver validiert den Descriptor einmal je
Buildkontext und erstellt daraus die gemeinsamen Registry-Metadaten. Die
Browser-Bindung ergänzt Komponenten anhand validierter Route-IDs und lehnt
fehlende, fremde oder doppelte Bindings ab. Server und Worker laden nur den
Descriptor und ihre jeweiligen Server-/Job-Entry-Points. Es entsteht keine
zweite Pluginliste und kein Katalog-Fallback auf Browsermodule.

Die Descriptoren der vorhandenen Plugins werden aus ihren `plugin.tsx`-
Definitionen extrahiert; die Browsermodule importieren denselben Descriptor
und binden Views. Ersetzte Browser-Metadatenpfade werden im selben Abschnitt
entfernt. Der vorhandene `studio`-/`ssf`-Profilfilter gilt vor jedem
Descriptor-Import. Die bestehende Fehlerbehandlung für fehlende Module,
inkompatible Manifeste und kollidierende Beiträge bleibt fail-closed.

## Invarianten und Nachweise

| Invariante | Verletzungsszenario | Geplanter Nachweis |
| --- | --- | --- |
| D1: Server/Worker werten keinen Browser-Entry-Point aus | Browsermodul wirft beim Node-Import | Echte Modulauflösung eines Fixtures, das im Browser-Entry-Point absichtlich wirft; Bootstrap, HTTP- und Job-Beitrag funktionieren |
| D2: Ein validierter Metadatenbestand | Browser- und Server-Liste driften auseinander | Gleiche Descriptor-/Registry-Signatur beider Kontexte; Bindings werden gegen validierte Route-IDs geprüft |
| D3: Abgelehnte Plugins liefern nichts | Plugin ist deaktiviert, inkompatibel oder Descriptor fehlt | Negativmatrix für Server-Handler, Jobs, IAM, Lifecycle und Browser-Views |
| D4: Bestehende Funktionen bleiben erhalten | Descriptor-Auslagerung verliert SSF-/Waste-Beiträge | Gezielte Bootstrap-, Server-, Job- und Plugin-Katalogtests sowie `check:server-runtime` und Profil-Builds |

Die HTTP-/IAM-/Job-Trust-Boundaries werden nicht neu definiert. Ein fehlender
Descriptor stoppt die Veröffentlichung der betroffenen Beiträge vor
Request-Annahme; bei einem ausgewählten, für Bootstrap erforderlichen Plugin
bleibt der Start fail-closed. Ein technischer Importfehler darf nicht als
erfolgreich deaktiviertes Plugin umgedeutet werden. Die bestehenden
Distributionsprofile müssen mit und ohne SSF denselben physischen Umfang wie
vorher behalten.

## Zuschnitt

Dies ist ein zusammenhängender Vertragsschnitt: Serverfähige Descriptoren
ohne Migration der ausgewählten Plugin-Definitionen und aller drei Consumer
würden einen parallelen, inkonsistenten Snapshot hinterlassen. #1512 erhält
den finalen Descriptorvertrag, erweitert aber erst später die Auflösung
gepackter Fremd-Distributionen. #1509 kann dieselben Browser-Bindings später
für plugin-eigene Fachseiten verwenden; deren Routingumbau gehört nicht zu
diesem Change.
