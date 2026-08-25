## ADDED Requirements

### Requirement: Dokumentationsmetadaten sind Teil der kanonischen Route-Registry

Die zentrale Route-Registry MUST für jede produktive Seitenroute einen typisierten Dokumentationsvertrag materialisieren. Der Vertrag MUST entweder eine stabile Dokumentations-ID oder einen zulässigen Ausschlussgrund enthalten und darf nicht durch eine app-lokale parallele URL-Zuordnung ersetzt werden.

#### Scenario: Statische UI-Route wird materialisiert

- **WENN** `@sva/routing` eine statische produktive UI-Route erzeugt
- **DANN** überträgt die Route-Factory deren Dokumentationsvertrag in die Route-Metadaten
- **UND** kann die App den Vertrag aus dem aktiven Route-Match lesen

#### Scenario: Admin-Ressourcenroute wird materialisiert

- **WENN** der Host aus einer registrierten Admin-Ressource eine Listen-, Anlegen-, Detail- oder Verlaufsroute erzeugt
- **DANN** leitet er die Dokumentations-ID deterministisch aus stabiler Ressourcen-ID und tatsächlichem Routentyp ab
- **UND** erzeugt er keinen Katalogeintrag für eine nicht exponierte Route

#### Scenario: Freie Plugin-Route wird materialisiert

- **WENN** der Host eine freie Plugin-Route aus dem validierten Plugin-Snapshot erzeugt
- **DANN** übernimmt er deren validierten Dokumentationsvertrag in die Route-Metadaten

#### Scenario: Tiefste aktive Route bestimmt die Hilfe

- **WENN** mehrere Route-Matches für die aktuelle Navigation aktiv sind
- **DANN** verwendet die App den Dokumentationsvertrag des tiefsten aktiven dokumentierbaren Seiten-Matches
- **UND** konkrete Path- und Search-Parameter verändern die Dokumentations-ID nicht

#### Scenario: Technische Route ist ausgeschlossen

- **WENN** eine Route ausschließlich Hilfe, Support, Lizenz, Auth-Technik, Debugging, Redirect, Fehler oder Not-found-Verhalten besitzt
- **DANN** trägt sie einen typisierten Ausschlussgrund
- **UND** die Registry behandelt das Fehlen einer Dokumentations-ID nicht als unbemerkte Lücke
