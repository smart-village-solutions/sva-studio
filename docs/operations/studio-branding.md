# Studio-Branding je Server-Umgebung

Die Server-Umgebungsvariable `SVA_STUDIO_BRANDING` wählt ein benanntes Branding-Profil zur Laufzeit. Ein Image kann dadurch in unterschiedlichen Umgebungen unterschiedliche Starttexte anzeigen. Die Auswahl gilt für alle Hosts und Mandanten desselben Server-Prozesses.

| Wert            | Verhalten vor dem Login                                      |
| --------------- | ------------------------------------------------------------ |
| `sva-studio`    | Bestehender Name und bestehende Studio-Starttexte (Standard) |
| `kassel-dialog` | Kassel Dialog mit den unten aufgeführten Starttexten         |

Das Profil `kassel-dialog` zeigt auf Deutsch:

- **Kassel Dialog**
- Die Steueroberfläche für den virtuellen Dolmetscher.
- Melden Sie sich an, um Ihre Einstellungen und Benutzer zu verwalten.

Die Texte liegen in den deutschen und englischen Übersetzungsressourcen. Die Profilauswahl und die zugehörigen Übersetzungsschlüssel sind zentral in `apps/sva-studio-react/src/lib/studio-branding.ts` definiert. Weitere bestätigte Branding-Eigenschaften können dort ergänzt werden. Aktuell steuert das Profil ausschließlich die drei Texte der Startseite vor dem Login.

## Konfiguration

Lokal kann `SVA_STUDIO_BRANDING=kassel-dialog` in der Server-Umgebung gesetzt werden. Für verwaltete Umgebungen wird der Wert im zuständigen Profil unter `config/runtime/remote/` gesetzt und über den [kanonischen Rollout-Prozess](../guides/studio-rollout-process.md) ausgeliefert. Die Compose-Konfiguration reicht ihn an den App-Prozess weiter; für eine Änderung genügt ein regulärer Rollout mit aktualisierter Laufzeitkonfiguration und demselben Image. Ein neuer Frontend-Build ist für die Profilauswahl nicht erforderlich.

Fehlende Konfiguration verwendet `sva-studio`. Der Deployment-Vertrag lehnt unbekannte Werte ab; außerhalb dieses Vertrags fällt die Anwendung bei unbekannten Werten auf das Standardprofil zurück. Der Browser erhält ausschließlich die öffentliche Profilkennung über die Root-Route und einen Meta-Tag, sodass die Auswahl auch bei clientseitiger Navigation erhalten bleibt.
