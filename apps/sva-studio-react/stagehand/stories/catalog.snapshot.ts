export const stagehandStoryCatalogSnapshot = {
  scope: 'IAM',
  updatedAt: '2026-03-19',
  packages: [
    {
      id: 'IAM-P4',
      stories: [
        {
          id: 20,
          packageId: 'IAM-P4',
          role: 'Organisations-Admin',
          story: 'Als Organisations-Admin möchte ich Gruppen erstellen können, damit ich Berechtigungen bündeln kann.',
          acceptanceCriteria: [
            'Eine neue Gruppe kann mit Name und fachlichem Zweck angelegt werden.',
            'Gruppenmitglieder oder nachgelagerte Berechtigungen koennen der Gruppe zugeordnet werden.',
            'Die neu angelegte Gruppe ist anschliessend in Zuweisungs- oder Rechteansichten verfuegbar.',
          ],
        },
        {
          id: 21,
          packageId: 'IAM-P4',
          role: 'Organisations-Admin',
          story: 'Als Organisations-Admin möchte ich Berechtigungen simulieren, damit ich Fehler vermeide.',
          acceptanceCriteria: [
            'Eine Rechte-Simulation kann vor dem Speichern einer Aenderung aufgerufen werden.',
            'Die Simulation zeigt mindestens zusaetzliche, entfallende oder geaenderte Rechtewirkungen an.',
            'Die Simulation veraendert den Ist-Zustand nicht stillschweigend.',
          ],
        },
        {
          id: 22,
          packageId: 'IAM-P4',
          role: 'Organisations-Admin',
          story:
            'Als Organisations-Admin möchte ich vor der Aktivierung einer Rolle prüfen können, welche effektiven Rechte sie erzeugt, damit ich keine zu weitreichenden Berechtigungen vergebe.',
          acceptanceCriteria: [
            'Vor der Aktivierung einer Rolle ist eine Vorschau der erwarteten Rechtewirkung verfuegbar.',
            'Die Vorschau macht sichtbar, welche Aktionen, Bereiche oder Daten durch die Rolle freigegeben werden.',
            'Eine Rolle kann vor der Produktivnutzung auf uebermaessige Berechtigungen geprueft werden.',
          ],
        },
        {
          id: 23,
          packageId: 'IAM-P4',
          role: 'Organisations-Admin',
          story:
            'Als Organisations-Admin möchte ich für einen Nutzer alle effektiven Rechte gebündelt einsehen können, damit ich Support-Anfragen schnell beantworten kann.',
          acceptanceCriteria: [
            'Fuer einen ausgewaehlten Nutzer gibt es eine gebuendelte Gesamtsicht aller effektiven Rechte.',
            'Die Gesamtsicht umfasst direkte, indirekte und vererbte Wirksamkeiten.',
            'Die Ansicht ist ausreichend konkret, um Support-Anfragen ohne Datenbankanalyse zu beantworten.',
          ],
        },
        {
          id: 24,
          packageId: 'IAM-P4',
          role: 'Support-Verantwortliche:r',
          story:
            'Als Support-Verantwortliche:r möchte ich für eine konkrete Aktion prüfen können, ob sie für einen Nutzer erlaubt ist, damit ich Rechteprobleme schnell erklären kann.',
          acceptanceCriteria: [
            'Eine konkrete Aktion kann fuer einen konkreten Nutzer gezielt geprueft werden.',
            'Die Auskunft liefert ein klares erlaubt oder nicht erlaubt fuer den gewaehlten Kontext.',
            'Die Pruefung ist fuer Support ohne technische Tiefenanalyse nutzbar.',
          ],
        },
        {
          id: 25,
          packageId: 'IAM-P4',
          role: 'Support-Verantwortliche:r',
          story:
            'Als Support-Verantwortliche:r möchte ich zu einer Berechtigungsentscheidung auch die Begründung sehen, damit ich Anwendern verständlich helfen kann.',
          acceptanceCriteria: [
            'Zu einer Berechtigungsentscheidung wird eine fachlich lesbare Begruendung angezeigt.',
            'Die Begruendung verweist auf Rolle, Gruppe, Organisation oder Vererbung als Ursache.',
            'Die Erklaerung reicht aus, um Anwender:innen den Fall nachvollziehbar zu erklaeren.',
          ],
        },
        {
          id: 26,
          packageId: 'IAM-P4',
          role: 'Organisations-Admin',
          story:
            'Als Organisations-Admin möchte ich testen können, welche Rechte ein Nutzer nach einer geplanten Rollenänderung hätte, damit ich Änderungen vorab absichern kann.',
          acceptanceCriteria: [
            'Eine geplante Rollenänderung kann fuer einen konkreten Nutzer vorab getestet werden.',
            'Die Vorschau zeigt die Rechtewirkung nach der geplanten Aenderung im Vergleich zum aktuellen Zustand.',
            'Der Testfall bleibt folgenlos, bis die Aenderung explizit bestaetigt wird.',
          ],
        },
        {
          id: 27,
          packageId: 'IAM-P4',
          role: 'Organisations-Admin',
          story:
            'Als Organisations-Admin möchte ich Rechteänderungen als Antrag einreichen können, damit kritische Änderungen nicht direkt ungeprüft wirksam werden.',
          acceptanceCriteria: [
            'Eine Rechteänderung kann als Antrag statt als Sofortänderung erfasst werden.',
            'Der Antrag ist einem konkreten Nutzer, einer Rolle oder einer Gruppe zuordenbar.',
            'Der Antragsstatus bleibt bis zur Entscheidung nachvollziehbar.',
          ],
        },
      ],
    },
    {
      id: 'IAM-P2',
      stories: [
        {
          id: 18,
          packageId: 'IAM-P2',
          role: 'Organisations-Admin',
          story: 'Als Organisations-Admin möchte ich neue Nutzer anlegen können, damit ich mein Team verwalten kann.',
          acceptanceCriteria: [
            'Ein neuer Nutzerzugang kann im Studio angelegt werden.',
            'Der Zugang ist einer Organisation oder einem fachlichen Kontext zuordenbar.',
            'Nach dem Anlegen ist der neue Nutzer in der Verwaltungsansicht auffindbar.',
          ],
        },
      ],
    },
    {
      id: 'IAM-P3',
      stories: [
        {
          id: 19,
          packageId: 'IAM-P3',
          role: 'Organisations-Admin',
          story:
            'Als Organisations-Admin möchte ich nur Nutzer, Rollen, Gruppen und Rechtstexte meines Mandanten sehen, damit Daten sauber getrennt bleiben.',
          acceptanceCriteria: [
            'Im aktiven Mandanten werden nur dessen Nutzer, Rollen, Gruppen und Rechtstexte angezeigt.',
            'Mandantenfremde Verwaltungsdaten erscheinen nicht in regulaeren Listen oder Details.',
            'Die Sicht ist fuer den Organisations-Admin ausreichend klar, um saubere Trennung zu pruefen.',
          ],
        },
      ],
    },
  ],
} as const;
