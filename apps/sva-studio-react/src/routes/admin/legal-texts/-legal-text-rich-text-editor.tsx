import { RichTextHtmlEditor } from '@sva/studio-ui-react';

import { t } from '../../../i18n';
import { sanitizeLegalTextHtml } from '../../../lib/legal-text-html-sanitizer';

export const LegalTextRichTextEditor = ({
  id,
  labelId,
  value,
  onChange,
  disabled = false,
}: Readonly<{
  id: string;
  labelId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}>) => {
  const blockTypeOptions = [
    { value: 'paragraph' as const, label: t('admin.legalTexts.editor.paragraph') },
    { value: 'heading-2' as const, label: t('admin.legalTexts.editor.heading2') },
    { value: 'heading-3' as const, label: t('admin.legalTexts.editor.heading3') },
    { value: 'heading-4' as const, label: t('admin.legalTexts.editor.heading4') },
    { value: 'blockquote' as const, label: t('admin.legalTexts.editor.blockquote') },
  ];
  const toolbarLabels = {
    mode: t('admin.legalTexts.editor.mode'),
    visualMode: t('admin.legalTexts.editor.visualMode'),
    htmlMode: t('admin.legalTexts.editor.htmlMode'),
    blockType: t('admin.legalTexts.editor.blockType'),
    bulletList: t('admin.legalTexts.editor.bulletList'),
    orderedList: t('admin.legalTexts.editor.orderedList'),
    bold: t('admin.legalTexts.editor.bold'),
    italic: t('admin.legalTexts.editor.italic'),
    underline: t('admin.legalTexts.editor.underline'),
    undo: t('admin.legalTexts.editor.undo'),
    redo: t('admin.legalTexts.editor.redo'),
    link: t('admin.legalTexts.editor.applyLink'),
    linkPrompt: t('admin.legalTexts.editor.linkInput'),
  };

  return (
    <RichTextHtmlEditor
      id={id}
      labelId={labelId}
      value={value}
      onChange={onChange}
      disabled={disabled}
      normalizeHtml={sanitizeLegalTextHtml}
      blockTypeOptions={blockTypeOptions}
      toolbarLabels={toolbarLabels}
    />
  );
};
