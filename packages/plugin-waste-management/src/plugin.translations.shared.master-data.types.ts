export type MasterDataFractionsCreateViewCopy = Readonly<{
  title: string;
  description: string;
  colorPickerLabel: string;
  sections: Readonly<
    Record<
      | 'basics'
      | 'basicsHint'
      | 'presentation'
      | 'presentationHint'
      | 'visibility'
      | 'visibilityHint',
      string
    >
  >;
  fieldHints: Readonly<
    Record<
      | 'name'
      | 'description'
      | 'translationDe'
      | 'translationEn'
      | 'pdfShortLabel'
      | 'containerSize'
      | 'color'
      | 'active',
      string
    >
  >;
  statusHints: Readonly<Record<'active' | 'inactive', string>>;
  validation: Readonly<Record<'nameRequired' | 'pdfShortLabelRequired' | 'colorRequired', string>>;
  meta: Readonly<{ descriptionCounter: string }>;
  actions: Readonly<Record<'backToList' | 'cancel' | 'savePrimary', string>>;
  preview: Readonly<
    Record<
      | 'title'
      | 'description'
      | 'placeholderName'
      | 'placeholderDescription'
      | 'placeholderContainerSize'
      | 'tableTitle'
      | 'tableBody',
      string
    >
  >;
  help: Readonly<Record<'title' | 'body', string>>;
}>;
