export const tourAudioTranslations = {
  de: {
    ownAudio: 'Eigene Hörbeiträge',
    inheritedPoiAudio: 'Hörbeiträge des verknüpften Orts',
    addAudio: 'Hörbeitrag hinzufügen',
    audioDescription:
      'Laden Sie eine MP3-Datei hoch, wählen Sie sie aus der Medienbibliothek oder fügen Sie einen Direktlink ein.',
    audioEmpty: 'Keine eigenen Hörbeiträge.',
    audioLibraryEmpty: 'Keine öffentlichen MP3-Dateien gefunden.',
    audioReady: 'Verfügbar',
    audioPending: 'Wird beim Speichern zugeordnet',
    audioUpload: 'MP3-Datei hochladen',
    audioUrl: 'Direktlink zum Hörbeitrag',
    audioReview: 'Hörbeitrag prüfen',
    audioSearch: 'Nach MP3-Dateien suchen',
    audioSelect: 'Hörbeitrag auswählen',
    audioSelectFile: 'MP3-Datei auswählen',
    audioSupport: 'Unterstütztes Format: MP3.',
    audioMetadata: 'Ergänzen Sie Beschriftung und Urheberangabe.',
    audioUrlInvalid: 'Geben Sie einen dauerhaft nutzbaren Direktlink zum Hörbeitrag ein.',
    audioPickerError: 'Die MP3-Datei konnte nicht übernommen werden.',
    audioMoved: 'Hörbeitrag verschoben.',
    audioRemoved: 'Hörbeitrag entfernt.',
    audioReferenceError:
      'Die Tour wurde gespeichert. Speichern Sie erneut, um die Medienverknüpfungen zu synchronisieren.',
    audioReferencesLoading:
      'Medienverknüpfungen werden geladen. Andere Felder können Sie weiterhin bearbeiten.',
    audioReferencesLoadError:
      'Medienverknüpfungen konnten nicht geladen werden. Hörbeiträge und die Reihenfolge betroffener Stationen bleiben gesperrt.',
    audioReferencesUnavailable:
      'Für Änderungen an Hörbeiträgen und der Reihenfolge betroffener Stationen fehlt die Medienberechtigung.',
    audioReferencesRetry: 'Medienverknüpfungen erneut laden',
  },
  en: {
    ownAudio: 'Own audio',
    inheritedPoiAudio: 'Audio from the linked place',
    addAudio: 'Add audio',
    audioDescription:
      'Upload an MP3 file, choose one from the media library, or enter a direct link.',
    audioEmpty: 'No own audio.',
    audioLibraryEmpty: 'No public MP3 files found.',
    audioReady: 'Available',
    audioPending: 'Will be linked when saved',
    audioUpload: 'Upload MP3 file',
    audioUrl: 'Direct audio link',
    audioReview: 'Review audio',
    audioSearch: 'Search for MP3 files',
    audioSelect: 'Select audio',
    audioSelectFile: 'Choose MP3 file',
    audioSupport: 'Supported format: MP3.',
    audioMetadata: 'Add a caption and credit.',
    audioUrlInvalid: 'Enter a stable direct link to the audio.',
    audioPickerError: 'The MP3 file could not be added.',
    audioMoved: 'Audio moved.',
    audioRemoved: 'Audio removed.',
    audioReferenceError: 'The tour was saved. Save again to synchronize the media references.',
    audioReferencesLoading: 'Loading media references. You can still edit other fields.',
    audioReferencesLoadError:
      'The media references could not be loaded. Audio and the order of affected stops cannot be changed.',
    audioReferencesUnavailable:
      'You need media permissions to edit audio or change the order of affected stops.',
    audioReferencesRetry: 'Retry loading media references',
  },
} as const;
