export const pluginSurveysStructureEnTranslations = {
  navigation: {
    title: 'Surveys',
  },
  actions: {
    create: 'Create survey',
    edit: 'View survey',
    update: 'Save survey',
    delete: 'Delete survey',
    moderate: 'Moderate free text',
    export: 'Export results',
    addTargetArea: 'Add target area',
    removeTargetArea: 'Remove target area {{name}}',
    addQuestion: 'Add question',
    addOption: 'Add answer',
    deleteFreeText: 'Delete answer {{index}}',
    moveQuestionUp: 'Move question {{index}} up',
    moveQuestionDown: 'Move question {{index}} down',
    deleteQuestion: 'Delete question {{index}}',
    moveOptionUp: 'Move answer {{index}} up',
    moveOptionDown: 'Move answer {{index}} down',
    deleteOption: 'Delete answer {{index}}',
    closeOverlay: 'Close',
    confirmDelete: 'Delete',
    cancelDelete: 'Cancel',
    back: 'Back',
  },
  pages: {
    createTitle: 'Create survey',
    editTitle: 'Edit survey',
    createDescription:
      'The survey is prepared in the standard content flow and already uses the stable editor frame.',
    editDescription:
      'The survey is already part of the standard content flow and uses the same editor frame as the create flow.',
  },
  tabs: {
    ariaLabel: 'Survey sections',
    basis: {
      label: 'Basics',
      title: 'Basics',
      description: 'Administrative survey frame.',
    },
    content: {
      label: 'Content',
      title: 'Content',
      description: 'Editorial survey content and questions.',
    },
    moderation: {
      label: 'Moderation',
      title: 'Moderation',
      description: 'Free-text approvals and moderation.',
    },
    results: {
      label: 'Results',
      title: 'Results',
      description: 'Overview, evaluation, and export.',
    },
    history: {
      label: 'History',
      title: 'History',
      description: 'Survey change history.',
    },
  },
  cards: {
    basis: {
      title: 'Basics',
      description: 'Status, schedule, target area, and survey metadata.',
      identity: {
        title: 'Identity',
        description: 'Survey title and status.',
      },
      schedule: {
        title: 'Schedule',
        description: 'Survey start and end window.',
      },
      targetArea: {
        title: 'Target area',
        description: 'Optional target areas for the survey.',
      },
      metadata: {
        title: 'Metadata',
        description: 'Temporal survey metadata.',
      },
    },
    content: {
      title: 'Content frame',
      description: 'Description, notices, and the survey question editor.',
      descriptions: {
        title: 'Description',
        description: 'Short and long survey description.',
      },
      participation: {
        title: 'Participation and visibility',
        description: 'Participation options and result visibility.',
      },
      notices: {
        title: 'Notices',
        description: 'Privacy and transparency notices.',
      },
      questions: {
        title: 'Questions',
        description: 'Survey questions and answers.',
      },
    },
    moderation: {
      title: 'Moderation frame',
      description: 'Free-text approvals become available after the first save.',
    },
    results: {
      title: 'Results frame',
      description: 'Survey results and exports.',
      summary: {
        title: 'Overview',
        description: 'Compact overview of the running survey.',
      },
      questions: {
        title: 'Question results',
        description: 'Aggregated results per question.',
      },
      export: {
        title: 'Export',
        description: 'Internal exports of the survey results.',
      },
    },
    history: {
      title: 'History frame',
      description: 'History entries become available after the first save.',
    },
  },
} as const;
