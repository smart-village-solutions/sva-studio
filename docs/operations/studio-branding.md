# Studio-Branding je Server-Umgebung

Die Server-Umgebungsvariable `SVA_STUDIO_BRANDING` wählt ein benanntes Branding-Profil zur Laufzeit. Ein Image kann dadurch in unterschiedlichen Umgebungen einen eigenen Produktnamen und eigene Starttexte anzeigen. Die Auswahl gilt für alle Hosts und Mandanten desselben Server-Prozesses.

| Wert            | Verhalten                                                    |
| --------------- | ------------------------------------------------------------ |
| `sva-studio`    | Bestehender Name und bestehende Studio-Starttexte (Standard) |
| `kassel-dialog` | Kassel DIALOG als durchgängiger Name mit eigenen Starttexten |

Das Profil `kassel-dialog` zeigt auf Deutsch:

- **Kassel DIALOG**
- Die Steueroberfläche für den virtuellen Dolmetscher.
- Melden Sie sich an, um Ihre Einstellungen und Benutzer zu verwalten.

In diesem Profil werden die Sidebar-Einträge `Inhalte`, `Schnittstellen`,
`Module`, `App` und `Cockpit` nicht angezeigt. `Inhalte` bleibt unabhängig von
vorhandenen Datentypen und Berechtigungen ausgeblendet. Der Bereich
`Anwendungen` enthält damit nur Anwendungen, die für die aktive Instanz effektiv
als Modul verfügbar sind.

Der Produktname erscheint auf der Startseite vor und nach dem Login, in der Sidebar sowie im Browser-Titel. Die Texte liegen in den deutschen und englischen Übersetzungsressourcen. Die Profilauswahl und die zugehörigen Übersetzungsschlüssel sind zentral in `apps/sva-studio-react/src/lib/studio-branding.ts` definiert. Weitere bestätigte Branding-Eigenschaften können dort ergänzt werden.

## Konfiguration

Lokal kann `SVA_STUDIO_BRANDING=kassel-dialog` in der Server-Umgebung gesetzt werden. Für verwaltete Umgebungen wird der Wert im zuständigen Profil unter `config/runtime/remote/` gesetzt und über den [kanonischen Rollout-Prozess](../guides/studio-rollout-process.md) ausgeliefert. Die Compose-Konfiguration reicht ihn an den App-Prozess weiter. Änderungen an einem verwalteten Profil durchlaufen vollständig `Build` → Dev → Staging → Production; dabei wird der vom Konfigurations-Commit erzeugte, revisionsgebundene Image-Digest von Staging nach Production übernommen.

Fehlende Konfiguration verwendet `sva-studio`. Der Deployment-Vertrag lehnt unbekannte Werte ab; außerhalb dieses Vertrags fällt die Anwendung bei unbekannten Werten auf das Standardprofil zurück. Der Browser erhält ausschließlich die öffentliche Profilkennung über die Root-Route und einen Meta-Tag, sodass die Auswahl auch bei clientseitiger Navigation erhalten bleibt.
