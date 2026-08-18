## MODIFIED Requirements

### Requirement: Push Notification Is Explicitly Authorized If Exposed

Wenn der News-Editor `pushNotification` als auswählbare Operation anbietet, MUST das System den Versand über die vollständig qualifizierte Permission `news.pushNotification` explizit und zusätzlich zur zugrunde liegenden Create- oder Update-Aktion autorisieren. Weder `news.create`, `news.update` noch `content.publish` dürfen den Push-Versand implizit erlauben.

#### Scenario: Berechtigter Benutzer löst Push während News-Create aus

- **WENN** ein Benutzer mit `news.create` und `news.pushNotification` eine neue Nachricht mit aktivierter Push-Option speichert
- **DANN** machen UI-Action-Metadaten und Host-Autorisierung die zusätzliche Operation `news.pushNotification` explizit
- **UND** darf der Server den Push erst nach erfolgreicher Prüfung beider Permissions an den Mainserver weitergeben

#### Scenario: Berechtigter Benutzer löst Push während News-Update aus

- **WENN** ein Benutzer mit `news.update` im passenden Datensatz-Scope und `news.pushNotification` eine bestehende Nachricht mit aktivierter Push-Option speichert
- **DANN** prüft der Server sowohl die Update-Berechtigung für den konkreten Datensatz als auch das Push-Recht
- **UND** startet er ohne beide erfolgreichen Entscheidungen keinen Mainserver-Aufruf

#### Scenario: Basisrecht ohne Push-Recht reicht nicht aus

- **WENN** ein Benutzer die passende `news.create`- oder `news.update`-Permission, aber kein `news.pushNotification` besitzt
- **UND** ein Client dennoch `pushNotification = true` sendet
- **DANN** lehnt der Server die gesamte Mutation vor dem Mainserver-Aufruf fail-closed ab
- **UND** nennt der strukturierte Denial `news.pushNotification` als fehlende Permission

#### Scenario: Publish-Recht ersetzt das Push-Recht nicht

- **WENN** ein Benutzer `content.publish`, aber kein `news.pushNotification` besitzt
- **UND** derselbe Speichervorgang eine Veröffentlichung und einen Push auslösen würde
- **DANN** erlaubt das Publish-Recht ausschließlich den passenden Veröffentlichungsübergang
- **UND** bleibt die Mutation wegen des fehlenden Push-Rechts abgelehnt

#### Scenario: Push-Recht ersetzt notwendige Publish-Berechtigung nicht

- **WENN** ein Benutzer `news.pushNotification`, aber kein für den angeforderten Übergang notwendiges `content.publish` besitzt
- **UND** derselbe Speichervorgang die Nachricht erstmals veröffentlichen und einen Push senden würde
- **DANN** bleibt der Veröffentlichungsübergang serverseitig verweigert
- **UND** erlaubt das Push-Recht weder Veröffentlichung noch eine Umgehung der Lifecycle-Autorisierung

#### Scenario: Bestehende Custom-Rollen erhalten keinen impliziten Push-Grant

- **WENN** `news.pushNotification` im Tenant materialisiert oder abgeglichen wird
- **DANN** bleiben bestehende Grants benutzerdefinierter Rollen unverändert
- **UND** wird die Permission nur durch bewusste Rollenpflege oder den bestehenden verwalteten Vollzugriffsvertrag von `system_admin` wirksam
