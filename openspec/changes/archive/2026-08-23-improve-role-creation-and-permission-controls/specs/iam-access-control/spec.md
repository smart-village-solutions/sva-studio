## ADDED Requirements

### Requirement: Custom-Rollen erhalten serverseitig eine stabile technische Identität

Das System MUST den technischen Schlüssel einer über die normale Studio-UI angelegten tenantlokalen Custom-Rolle serverseitig aus dem fachlichen Anzeigenamen erzeugen, innerhalb der Instanz eindeutig machen und nach der Anlage unveränderlich behandeln. Der Schlüssel darf nicht aus den Assignment-Scopes `own`, `organization` oder `all` abgeleitet werden. Explizite technische Schlüssel bleiben ausschließlich als validierter Kompatibilitätspfad für bestehende API-Clients zulässig und werden nicht in der Rollen-UI angeboten.

#### Scenario: Anzeigename wird in einen technischen Schlüssel normalisiert

- **WENN** eine Custom-Rolle mit dem Anzeigenamen `Redaktion Märkische Höhe` angelegt wird
- **DANN** erzeugt der Server daraus den technischen Schlüssel `redaktion_maerkische_hoehe`
- **UND** persistiert er Anzeigename und technischen Schlüssel als getrennte Felder
- **UND** bleibt der Anzeigename die fachlich führende Bezeichnung

#### Scenario: Normalisierung ergibt keinen alphanumerischen Bestandteil

- **WENN** die Normalisierung des gültigen Anzeigenamens keinen verwendbaren alphanumerischen Bestandteil ergibt
- **DANN** verwendet der Server `rolle` als technischen Basisschlüssel
- **UND** wendet er anschließend dieselbe Kollisionsauflösung wie für andere Basisschlüssel an

#### Scenario: Normalisierter Schlüssel unterschreitet die Mindestlänge

- **WENN** der normalisierte Anzeigename weniger als drei Zeichen enthält
- **DANN** erweitert der Server ihn deterministisch mit dem Präfix `rolle_`
- **UND** erfüllt der resultierende Basisschlüssel die bestehende Schlüsselvalidierung

#### Scenario: Technischer Schlüssel kollidiert innerhalb der Instanz

- **WENN** der erzeugte Basisschlüssel in derselben Instanz bereits existiert
- **DANN** verwendet der Server den kleinsten freien Suffix `_2`, `_3` oder fortlaufend höher
- **UND** kürzt er den Basisschlüssel bei Bedarf so, dass der vollständige Schlüssel einschließlich Suffix die maximale Länge einhält
- **UND** sichern Transaktion und Unique-Constraint parallele Anlagen gegen doppelte Schlüssel ab
- **UND** erzeugt eine idempotent wiederholte Anfrage keine zusätzliche Rolle

#### Scenario: Gleichnamige Rolle existiert in anderer Instanz

- **WENN** derselbe technische Basisschlüssel nur in einer anderen Instanz existiert
- **DANN** darf die neue Rolle den Basisschlüssel ohne Suffix verwenden
- **UND** bleibt die technische Identität instanzgebunden

#### Scenario: Anzeigename einer bestehenden Rolle wird geändert

- **WENN** der Anzeigename einer bestehenden Custom-Rolle geändert wird
- **DANN** bleibt ihr technischer Rollenschlüssel unverändert
- **UND** ändern bestehende Zuweisungen, Auditbezüge und technische Referenzen ihre Identität nicht

#### Scenario: Bestehender API-Client sendet einen expliziten technischen Schlüssel

- **WENN** ein autorisierter Legacy-Client bei der Rollenanlage weiterhin einen expliziten technischen Schlüssel übermittelt
- **DANN** prüft der Server ihn mit der bestehenden Format-, Längen- und Eindeutigkeitsvalidierung
- **UND** erzeugt er keinen abweichenden Schlüssel aus dem Anzeigenamen
- **UND** bleibt dieser Kompatibilitätspfad in der Studio-UI verborgen

### Requirement: roleLevel bleibt intern verwaltet und aus normalen Rollenformularen entfernt

Das System SHALL `roleLevel` bis zu einem separaten Rückbau als internes Kompatibilitäts- und Schutzfeld erhalten. Neue Autorisierungssemantik darf daraus nicht abgeleitet werden, und normale Rollen-Create- oder Update-UI darf den Wert weder verlangen noch verändern.

#### Scenario: Custom-Rolle wird ohne roleLevel angelegt

- **WENN** eine berechtigte Rollenanlage kein `roleLevel` übermittelt
- **DANN** persistiert der Server für die neue Custom-Rolle `roleLevel = 0`
- **UND** bleibt die Rollenanlage ohne technische Hierarchiekenntnis vollständig

#### Scenario: Custom-Rolle wird ohne roleLevel aktualisiert

- **WENN** ein Update einer bestehenden Custom-Rolle kein `roleLevel` enthält
- **DANN** bleibt der gespeicherte Wert unverändert
- **UND** setzt der Server ihn weder auf `0` zurück noch leitet er ihn aus Permissions oder Assignment-Scopes neu ab

#### Scenario: Technisch verwaltete Sonderrolle wird abgeglichen

- **WENN** Seed, Provisioning oder Reconcile eine geschützte technische Sonderrolle materialisiert
- **DANN** darf dieser serverseitig verwaltete Pfad weiterhin den normativ vorgesehenen Kompatibilitätswert setzen
- **UND** wird daraus kein frei bearbeitbares Feld der tenantlokalen Rollen-UI

#### Scenario: Interne Hierarchieprüfung verweigert eine Mutation

- **WENN** eine bestehende serverseitige Schutzprüfung eine Rollen- oder Zielkontenmutation wegen der internen Hierarchie ablehnt
- **DANN** bleibt die Mutation fail-closed
- **UND** beschreibt der öffentliche Fehler eine geschützte Verwaltungsgrenze ohne Offenlegung oder notwendige Kenntnis des numerischen `roleLevel`

### Requirement: Veröffentlichungs- und Sichtbarkeitsrechte bleiben positive getrennte Grants

Das System SHALL `content.publish` und `content.changeStatus` als getrennt auswählbare und serverseitig erzwungene Allow-Grants behandeln. Ein allgemeines Create- oder Update-Recht darf weder Veröffentlichung noch sonstige geschützte Sichtbarkeitswechsel implizit erlauben.

#### Scenario: Rolle darf bearbeiten, aber nicht veröffentlichen

- **WENN** eine Rolle ein passendes Create- oder Update-Recht, aber kein `content.publish` besitzt
- **DANN** darf ein Benutzer mit dieser Rolle den unterstützten Entwurf bearbeiten
- **UND** wird ein Übergang in den veröffentlichten beziehungsweise erstmals sichtbaren Zustand serverseitig abgelehnt

#### Scenario: Rolle darf veröffentlichen

- **WENN** eine Rolle zusätzlich `content.publish` im passenden Assignment-Scope besitzt
- **DANN** darf der Veröffentlichungsübergang nur für Datensätze erfolgen, die diesen Scope erfüllen
- **UND** bleibt `content.changeStatus` für andere separat geschützte Statuswechsel eigenständig auswertbar
