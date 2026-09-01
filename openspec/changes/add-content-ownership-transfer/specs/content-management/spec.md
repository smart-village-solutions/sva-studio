## MODIFIED Requirements

### Requirement: Erstellungs- und Bearbeitungsansicht für Inhalte

Das System MUST eine Erstellungs- und eine Bearbeitungsansicht für Inhalte bereitstellen und Ownership serverseitig nach IAM-Regeln setzen. Eine spätere Änderung des Inhabers SHALL ausschließlich über den getrennten, bestätigungspflichtigen Ownership-Transfer erfolgen und nicht als normales Metadatenfeld editierbar sein.

#### Scenario: Inhalt anlegen

- **WENN** ein berechtigter Benutzer einen neuen Inhalt anlegt
- **DANN** kann er mindestens Inhaltstyp, Titel, Veröffentlichungsdatum, Payload und Status erfassen
- **UND** das System setzt Erstellungsdatum, Änderungsdatum, Autor, `ownerUserId` und bei aktiver Organisation `ownerOrganizationId` systemseitig
- **UND** der gespeicherte Inhalt ist nach erfolgreichem Speichern in der Inhaltsliste sichtbar, wenn derselbe Scope auch den Detailzugriff erlauben würde

#### Scenario: Inhalt bearbeiten

- **WENN** ein berechtigter Benutzer einen bestehenden Inhalt bearbeitet
- **DANN** kann er Titel, Veröffentlichungsdatum, Payload und Status mit den jeweils erforderlichen Update-Permissions ändern
- **UND** kann er `ownerUserId` oder `ownerOrganizationId` nicht über die normale Bearbeitungsmutation ändern
- **UND** das Änderungsdatum wird nach erfolgreichem Speichern aktualisiert
- **UND** die Bearbeitungsansicht zeigt die aktuellen Metadaten des Inhalts an
- **UND** ein normales Update ändert weder Inhaber noch sichtbaren Autor automatisch

#### Scenario: Separater Transfer ist verfügbar

- **GIVEN** ein Benutzer besitzt `content.transferOwnership` im passenden Scope für den aktuellen Inhalt
- **AND** der Content-Typ unterstützt den Transfer
- **WHEN** er die Detail- oder Bearbeitungsansicht öffnet
- **THEN** bietet die Oberfläche eine getrennte Aktion „Inhalt übertragen“ an
- **AND** behandelt sie nicht als normales Formularfeld oder impliziten Speichereffekt

## ADDED Requirements

### Requirement: Bearbeitungsansichten zeigen den aktuellen Inhaber einheitlich im ersten Tab

Das System SHALL im Bearbeitungsmodus jedes vorhandenen Content-Editors den aktuellen Inhaber genau einmal am Anfang des ersten fachlichen Tabs anzeigen. Die Inhaberanzeige SHALL von der Auswahl des Erstellungs- oder Mutationsprincipals getrennt sein und für transferfähige wie nicht transferfähige Inhaltstypen denselben gemeinsamen UI-Vertrag verwenden.

Bei Mainserver-Inhalten SHALL der aktuelle Inhaber ausschließlich aus dem `dataProvider` des frisch gelesenen Datensatzes stammen. Audit, History, Actor, aktiver Organisationskontext, Credential-Quelle und lokale Owner-Projektion SHALL den angezeigten aktuellen Inhaber nicht überschreiben. Bei lokalen Inhalten SHALL genau eines der technischen Owner-Felder den aktuellen Inhaber bestimmen.

#### Scenario: Mainserver-Inhalt zeigt DataProvider als aktuellen Inhaber

- **GIVEN** ein bestehender Mainserver-Inhalt liefert im Fresh Read einen DataProvider
- **WHEN** ein Benutzer den ersten fachlichen Tab der Bearbeitungsansicht öffnet
- **THEN** zeigt der Inhaberbereich diesen DataProvider als aktuellen Inhaber an
- **AND** zeigt er bei eindeutiger Principal-Bindung den Typ „Persönlicher Account“ oder „Organisation“ und den verständlichen Namen
- **AND** bezeichnet er den DataProvider nicht als „ursprünglich“, wenn er den aktuellen Zustand darstellt

#### Scenario: DataProvider besitzt keine eindeutige Principal-Bindung

- **GIVEN** der Fresh Read liefert einen DataProvider ohne eindeutige aktuelle Studio-Principal-Bindung
- **WHEN** die Bearbeitungsansicht den Inhaberbereich rendert
- **THEN** zeigt sie den verfügbaren DataProvider-Namen als aktuellen Inhaber
- **AND** kennzeichnet sie, dass keine eindeutige Zuordnung zu einem persönlichen Account oder einer Organisation vorliegt
- **AND** erfindet sie keine Zuordnung aus Actor, Credential-Kontext, Projektion oder Audit

#### Scenario: Inhaltstyp unterstützt noch keinen Transfer

- **GIVEN** ein vorhandener Content-Editor ist laut serverseitiger Capability-Matrix nicht transferfähig
- **WHEN** ein Benutzer seinen ersten fachlichen Tab öffnet
- **THEN** zeigt die Oberfläche trotzdem den aktuellen Inhaber im gemeinsamen Inhaberbereich
- **AND** zeigt sie keine aktive Transferaktion
- **AND** erklärt sie, dass die Übertragung für diesen Inhaltstyp noch nicht verfügbar ist

#### Scenario: Neuer Inhalt besitzt noch keinen bisherigen Inhaber

- **WHEN** ein Benutzer die Erstellungsansicht eines Inhalts öffnet
- **THEN** behauptet die Oberfläche keinen bisherigen Inhaber
- **AND** zeigt sie die getrennte zulässige Auswahl des Erstellungsprincipals
- **AND** bietet sie vor dem ersten erfolgreichen Speichern keinen Ownership-Transfer an

### Requirement: Normales Speichern erklärt die unveränderte Ownership

Das System SHALL in der Bearbeitungsansicht dauerhaft erklären, dass normales Speichern den aktuellen Inhaber nicht ändert. Der Hinweis SHALL im Inhaberbereich stehen und in kompakter Form in der Nähe der Speichern-Aktion wiederholt werden. Normales Speichern SHALL dafür keinen wiederkehrenden blockierenden Bestätigungsdialog öffnen.

#### Scenario: Benutzer darf bearbeiten, aber nicht übertragen

- **GIVEN** ein Benutzer darf den Inhalt bearbeiten
- **AND** besitzt für ihn kein wirksames `content.transferOwnership`
- **WHEN** er die Bearbeitungsansicht oder die Speichern-Aktion verwendet
- **THEN** erklärt die Oberfläche, dass Speichern den Inhaber nicht ändert
- **AND** erklärt sie, dass der Benutzer den Inhalt bearbeiten, aber nicht übertragen darf
- **AND** zeigt sie keine aktive Transferaktion

#### Scenario: Benutzer darf den Inhalt übertragen

- **GIVEN** ein Benutzer darf den Inhalt bearbeiten und übertragen
- **AND** der Inhaltstyp besitzt eine positive Transfer-Capability
- **WHEN** er die Bearbeitungsansicht oder die Speichern-Aktion verwendet
- **THEN** erklärt die Oberfläche, dass normales Speichern den Inhaber nicht ändert
- **AND** verweist sie auf die getrennte Aktion „Inhalt übertragen“

#### Scenario: Mutationsprincipal weicht vom Inhaber ab

- **GIVEN** die normale Bearbeitung wird mit einem anderen zulässigen Principal als dem aktuellen Inhaber ausgeführt
- **WHEN** die Bearbeitungsansicht den Ownership-Hinweis zeigt
- **THEN** benennt sie verständlich den Mutationsprincipal und den unverändert bleibenden Inhaber
- **AND** stellt sie die Bearbeitung nicht als implizite Übertragung dar

### Requirement: Transferziel unterscheidet persönliche Accounts und Organisationen

Das System SHALL die serverseitig paginierte Zielauswahl in persönliche Accounts und Organisationen gliedern oder explizit danach filtern. Organisationen SHALL über ihre Anzeige suchbar sein. Persönliche Accounts SHALL in V1 ohne zusätzliche Suche über verschlüsselte Namens- oder E-Mail-Felder paginiert auswählbar sein. Eine exakte Gesamtzahl ist nicht erforderlich, sofern die Navigation keine verfügbaren Treffer ausblendet. Jeder Treffer SHALL einen textlich wahrnehmbaren Typ und einen verständlichen Namen besitzen. Der aktuelle Inhaber und serverseitig nicht transferfähige Ziele SHALL nicht auswählbar sein. Ein Mainserver-Ziel, dessen verwendbare Credentials erst bei Bestätigung an einen DataProvider gebunden werden müssen, SHALL einen verständlichen Hinweis auf diese sichere Prüfung tragen.

#### Scenario: Benutzer durchsucht mögliche Zielinhaber

- **WHEN** ein berechtigter Benutzer die Zielauswahl für „Inhalt übertragen“ öffnet
- **THEN** kann er zwischen „Persönliche Accounts“ und „Organisationen“ unterscheiden
- **AND** kann er Organisationen suchen und persönliche Accounts seitenweise auswählen
- **AND** bleibt der Principal-Typ im gewählten `targetPrincipal` erhalten
- **AND** zeigt die Oberfläche keine technische DataProvider-ID
- **AND** zeigt sie keine E-Mail-Adresse

#### Scenario: Noch nicht gebundenes Mainserver-Ziel erklärt die Verifikation

- **GIVEN** ein auswählbarer Ziel-Principal besitzt den Zustand `verification_required`
- **WHEN** die Oberfläche ihn in der Auswahl oder im Bestätigungsschritt zeigt
- **THEN** erklärt sie, dass die DataProvider-Zuordnung beim bestätigten Transfer sicher geprüft wird
- **AND** zeigt sie weder Credentials noch eine technische DataProvider-ID

#### Scenario: Benutzer bestätigt die Wirkung des Transfers

- **GIVEN** ein gültiger Ziel-Principal wurde ausgewählt
- **WHEN** der Benutzer zum Bestätigungsschritt wechselt
- **THEN** zeigt die Oberfläche aktuellen und neuen Inhaber mit Typ und Name als gerichteten Wechsel
- **AND** erklärt sie die typabhängige Wirkung auf die sichtbare Autorenanzeige
- **AND** warnt sie vor möglichem Verlust des anschließenden Zugriffs
- **AND** führt sie die Mutation erst nach ausdrücklicher Bestätigung aus

#### Scenario: Actor verliert nach erfolgreichem Transfer den Detailzugriff

- **GIVEN** der Server hat den neuen Inhaber bestätigt
- **AND** der Actor darf den Inhalt im Ziel-Scope nicht mehr lesen
- **WHEN** die Oberfläche den Transfer abschließt
- **THEN** zeigt sie zuerst eine eindeutige Erfolgsmeldung
- **AND** navigiert sie anschließend kontrolliert in die Inhaltsliste
- **AND** stellt sie den erwarteten Zugriffsverlust nicht als fehlgeschlagenen Transfer dar

## MODIFIED Requirements

### Requirement: Ownership-Transfer autorisiert den aktuellen Inhalt

Das System SHALL Ownership-Transfers als eigene Mutation am aktuellen Inhalt autorisieren. Der Actor benötigt dafür `content.transferOwnership` im passenden Scope auf dem Quellinhalt. Normale Update-Permissions SHALL keinen Ownership-Transfer autorisieren. Der Ziel-Owner SHALL validiert werden, setzt aber keine zusätzliche Lese- oder Update-Berechtigung des Actors auf den Zielbereich voraus.

#### Scenario: Eigener Inhalt wird an anderen Benutzer übertragen

- **GIVEN** ein Benutzer besitzt `content.transferOwnership` mit Scope `own`
- **AND** ein Inhalt gehört diesem Benutzer über `ownerUserId` oder eine bestätigte persönliche DataProvider-Bindung
- **WHEN** der Benutzer den Inhalt an einen anderen gültigen Benutzer derselben Instanz übergibt
- **THEN** erlaubt das System die Mutation ohne zusätzliche Zielbereich-Berechtigung
- **AND** anschließende Lesezugriffe werden anhand der neuen Ownership erneut autorisiert

#### Scenario: Organisationsinhalt wird in andere Organisation übertragen

- **GIVEN** ein Benutzer besitzt `content.transferOwnership` im aktuellen Organisationsscope des Quellinhalts
- **WHEN** der Benutzer den Inhalt an eine andere gültige Organisation derselben Instanz übergibt
- **THEN** entscheidet die Autorisierung über den aktuellen Inhalt vor der Änderung
- **AND** der Zielwert wird auf Existenz, Aktivstatus, Instanzzugehörigkeit und zulässigen Owner-Typ validiert

#### Scenario: Ownerloser Inhalt wird ohne globale Berechtigung zugewiesen

- **GIVEN** ein Inhalt besitzt weder lokale Owner-Felder noch eine konfliktfrei zugeordnete DataProvider-Bindung
- **AND** ein Benutzer besitzt `content.transferOwnership` nur mit `own`- oder `organization`-Scope
- **WHEN** der Benutzer dem Inhalt einen Owner zuweisen will
- **THEN** verweigert das System die Mutation
- **AND** nur `content.transferOwnership` mit Scope `all` kann ownerlose Inhalte zuweisen

#### Scenario: Normales Update versucht Ownership zu ändern

- **GIVEN** ein Benutzer besitzt `content.updateMetadata`, aber nicht `content.transferOwnership`
- **WHEN** er `ownerUserId`, `ownerOrganizationId` oder einen Ziel-Principal über einen normalen Update-Pfad sendet
- **THEN** weist der Server die Ownership-Änderung ab
- **AND** bleiben Inhalt, Inhaber und Projektion unverändert

#### Scenario: Transferziel liegt außerhalb der Instanz

- **GIVEN** ein Benutzer besitzt `content.transferOwnership` für den Quellinhalt
- **WHEN** er einen Account oder eine Organisation einer anderen Instanz als Ziel übermittelt
- **THEN** weist der Server den Transfer fail-closed ab
- **AND** legt die Antwort keine Ziel- oder Credential-Details offen

### Requirement: Sichtbare Autorenanzeige ist von Ownership getrennt

Das System SHALL die sichtbare Autorenanzeige eines lokalen Inhalts als fachliche Inhaltsmetadaten modellieren und von technischer IAM-Ownership trennen. Für Mainserver-basierte Inhalte SHALL der bestätigte GraphQL-`dataProvider` den aktuellen fachlichen Inhaber und sichtbaren Autor bestimmen. Ein Mainserver-Inhabertransfer SHALL daher beide Werte gemeinsam ändern, während ein lokaler Ownership-Transfer die Autorenanzeige nicht automatisch ändert.

Bei lokalen Inhalten SHALL `ownerUserId` und `ownerOrganizationId` ausschließlich Autorisierung und technische Zuständigkeit steuern. Bei Mainserver-Inhalten dürfen diese Felder nur aus einer konfliktfreien automatischen DataProvider-Bindung als rekonstruierbare IAM-Projektion abgeleitet werden. Ein freier `author`-String, aktueller Credential-Kontext, Actor oder lokale History-Metadaten SHALL keinen Mainserver-Inhaber begründen.

#### Scenario: Lokaler Inhalt wird mit Organisationsanzeige angelegt

- **GIVEN** ein Actor legt im aktiven Organisationskontext einen lokalen Inhalt an
- **WHEN** keine abweichende Autorenanzeige gewählt wird
- **THEN** setzt das System technische Ownership aus dem aktiven Kontext
- **AND** setzt die sichtbare Autorenanzeige standardmäßig auf die Organisation, sofern eine Organisation verfügbar ist

#### Scenario: Organisation erzwingt Organisationsanzeige für lokalen Inhalt

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_only'`
- **WHEN** ein Benutzer persönliche Autorenanzeige für einen lokalen Inhalt speichern möchte
- **THEN** weist das System die Änderung mit einem Validierungsfehler ab
- **AND** technische Ownership bleibt unverändert

#### Scenario: Persönliche Anzeige ist für lokalen Inhalt zulässig

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_or_personal'`
- **AND** der Actor ist für persönliche Anzeige zulässig
- **WHEN** der Actor persönliche Autorenanzeige auswählt
- **THEN** speichert das System den Modus getrennt von `ownerUserId` und `ownerOrganizationId`
- **AND** spätere lokale Ownership-Änderungen ändern die Anzeige nicht stillschweigend

#### Scenario: Mainserver liefert den aktuellen Inhaber

- **GIVEN** ein Mainserver-Inhalt besitzt einen DataProvider
- **WHEN** Studio Inhalt oder Listenprojektion anzeigt
- **THEN** verwendet es Namen und Identität dieses DataProviders als aktuellen fachlichen Inhaber und sichtbaren Autor
- **AND** lokale Owner-Projektionen oder ein abweichender `author`-String überschreiben die Anzeige nicht

#### Scenario: Mainserver-Inhalt wird übertragen

- **GIVEN** ein Mainserver-Transfer ändert den bestätigten DataProvider von `dp-source` auf `dp-target`
- **WHEN** Studio den Inhalt nach dem Provider-Erfolg anzeigt
- **THEN** verwendet es `dp-target` als aktuellen fachlichen Inhaber und sichtbaren Autor
- **AND** historisiert es `dp-source` ausschließlich als vorherigen Inhaber

#### Scenario: Lokaler Inhalt wird übertragen

- **GIVEN** ein lokaler Inhalt besitzt eine redaktionell gesetzte Autorenanzeige
- **WHEN** seine technische Ownership an einen anderen Account oder eine andere Organisation übertragen wird
- **THEN** bleibt die redaktionelle Autorenanzeige unverändert
- **AND** wird ihre Änderung weiterhin als getrennte Inhaltsmutation autorisiert und historisiert

#### Scenario: Fehlende Principal-Bindung erfindet keinen lokalen Inhaber

- **GIVEN** die aktuelle Credential-Version besitzt keine konfliktfreie Identity-Bindung
- **WHEN** Studio einen Mainserver-Inhalt anzeigt oder autorisiert
- **THEN** zeigt es den Content-DataProvider soweit vorhanden an
- **AND** erfindet keine lokale Owner-Zuordnung
- **AND** lehnt der automatische Resolver eine Scope-Mutation fail-closed ab

### Requirement: Mainserver-Schreibaktionen behandeln Inhaber und Mutationsprincipal getrennt

Das System SHALL bei der Erstellung eines Mainserver-basierten Contents den serverseitig validierten `actingPrincipalType` als Quelle der OAuth-Credentials verwenden und den daraus vom Mainserver gesetzten `dataProvider` als initialen Inhaber übernehmen. Vor dem Create SHALL der Identity-Endpunkt die aktuelle Credential-Version binden; der bestätigte Create-DataProvider SHALL diese Bindung anschließend konsistent bestätigen.

Jede Studio-initiierte Schreibaktion zum Erstellen, Aktualisieren, Veröffentlichen, Archivieren, Wiederherstellen, Übertragen oder Löschen SHALL einen expliziten Principal-Typ verwenden. Beim Create SHALL `contentAuthorPolicy` die zulässige Eigentümerwahl begrenzen. Bei normalen Mutationen bestehender eigener oder organisatorischer Inhalte SHALL die konfliktfreie DataProvider-Bindung zusammen mit der Ressourcen-Capability den Principal und die Credential-Quelle bestimmen; diese Mutationen SHALL den bestehenden DataProvider erhalten. Ausschließlich der separate, mit `content.transferOwnership` autorisierte Transferpfad darf einen serverseitig aufgelösten Ziel-Principal in eine Ziel-DataProvider-ID übersetzen und den DataProvider ändern.

Keine Aktion SHALL ein neues Principal-Mapping allein aus einem Content-Read begründen. Der Browser SHALL weder Credentials noch Principal- oder DataProvider-IDs zur Credential-Auswahl oder als freie Provider-Auswahl liefern können.

#### Scenario: Organisation erstellt einen Inhalt mit vorab verifizierter Bindung

- **GIVEN** die aktive Organisation erlaubt organisatorisches Handeln und besitzt Mainserver-Credentials
- **AND** der Identity-Endpunkt hat die aktuelle Credential-Version konfliktfrei gebunden
- **WHEN** ein Benutzer einen Inhalt mit `actingPrincipalType = organization` erstellt
- **THEN** führt der Server den Create ausschließlich mit deren Credentials aus
- **AND** liest er den bestätigten DataProvider aus Response oder Same-Credential-Re-Read
- **AND** bestätigt er damit ausschließlich die bereits verifizierte credential-versionierte Organisationsbindung

#### Scenario: Person erstellt einen Inhalt mit vorab verifizierter Bindung

- **GIVEN** persönliches Handeln ist zulässig
- **AND** der Identity-Endpunkt hat die aktuelle persönliche Credential-Version konfliktfrei gebunden
- **WHEN** ein Benutzer einen Inhalt mit `actingPrincipalType = user` erstellt
- **THEN** führt der Server den Create ausschließlich mit den persönlichen Credentials aus
- **AND** bestätigt der Content-DataProvider ausschließlich die bereits verifizierte Bindung

#### Scenario: Create kollidiert mit bestehender Bindung

- **GIVEN** die aktuelle Credential-Version ist bereits einem anderen DataProvider zugeordnet
- **WHEN** ein erfolgreicher Create einen abweichenden DataProvider bestätigt
- **THEN** überschreibt Studio die Bindung nicht
- **AND** markiert Mapping und lokale Folgearbeit als `reconciliation_required`
- **AND** stellt den bestätigten Provider-Erfolg nicht als zurückgerollt dar

#### Scenario: Normale Bearbeitung verwendet den gebundenen Ownership-Principal

- **GIVEN** ein bestehender Inhalt besitzt einen DataProvider
- **AND** dessen konfliktfreie Bindung weist auf den persönlichen Principal des Actors oder die aktive Organisation
- **AND** Permission und Ressourcen-Capability erlauben die Bearbeitung
- **WHEN** ein Benutzer eine normale Inhaltsmutation ausführt
- **THEN** verwendet das System den gebundenen Ownership-Principal für Same-Credential-Pre-Read und Write
- **AND** zeigt weiterhin den bestehenden DataProvider als Inhaber
- **AND** ändert oder überträgt es die Ownership nicht

#### Scenario: Persönliches Eigentum bleibt ohne Transfer persönlich

- **GIVEN** ein Inhalt wurde zulässig mit `actingPrincipalType = user` erstellt
- **WHEN** die aktive Organisation, deren Autorenrichtlinie oder die Mitgliedschaft des Actors später wechselt
- **THEN** bleibt der bestätigte persönliche DataProvider Inhaber
- **AND** überträgt Studio den Inhalt nicht implizit auf eine Organisation

#### Scenario: Organisationseigentum bleibt ohne Transfer organisatorisch

- **GIVEN** ein Inhalt wurde zulässig mit `actingPrincipalType = organization` erstellt
- **WHEN** der ursprüngliche Actor die Organisation verlässt oder sein Account gesperrt wird
- **THEN** bleibt der bestätigte Organisations-DataProvider Inhaber
- **AND** können andere berechtigte Mitglieder der Organisation den Inhalt weiter verwalten

#### Scenario: Autorisierter Transfer verwendet Quell- und Ziel-Principal getrennt

- **GIVEN** ein Benutzer besitzt `content.transferOwnership` im passenden Scope auf dem Quellinhalt
- **AND** der Server hat einen aktiven Ziel-Principal derselben Instanz konfliktfrei an `dp-target` gebunden
- **WHEN** der Benutzer die Übergabe bestätigt
- **THEN** führt der gebundene Quell-Principal Fresh Pre-Read und Transfermutation aus
- **AND** sendet ausschließlich der Server `dataProviderId = dp-target` an die typisierte Mainserver-Mutation
- **AND** wird der Ziel-Principal nicht zum Actor der Mutation

#### Scenario: Transfer wird durch Ziel-Response bestätigt

- **GIVEN** der Mainserver bestätigt die Transfermutation
- **WHEN** Response oder Target-Re-Read den DataProvider `dp-target` liefert
- **THEN** finalisiert Studio `dp-target` als neuen Inhaber und sichtbaren Autor
- **AND** zieht es Projektion, Credential-Quelle, History und Audit reconciliation-fähig nach

#### Scenario: Jede Schreibaktion übermittelt den Principal explizit

- **GIVEN** ein Benutzer löst Erstellen, Aktualisieren, Veröffentlichen, Archivieren, Wiederherstellen, Übertragen oder Löschen aus
- **WHEN** der Server die jeweilige Mainserver-Mutation vorbereitet
- **THEN** liegt `actingPrincipalType` explizit als `organization` oder `user` vor
- **AND** eine fehlende oder ungültige Auswahl wird vor dem Mainserver-Aufruf abgewiesen

#### Scenario: Freie Principal- oder Autorenangabe ist unzulässig

- **WHEN** ein Client statt eines erlaubten `actingPrincipalType` und typisierten Ziel-Principals einen Namen, Credentials oder eine DataProvider-ID übermittelt
- **THEN** verwendet der Server diese Werte nicht zur Principal-, Mapping-, Provider- oder Credential-Auswahl
- **AND** lehnt einen ungültigen Transportvertrag vor dem Mainserver-Aufruf ab
