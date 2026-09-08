import type { usePluginTranslation } from '@sva/plugin-sdk';

export const createSsfEditorLabels = (pt: ReturnType<typeof usePluginTranslation>) => ({
  blockTypeOptions: [
    { value: 'paragraph' as const, label: pt('richText.paragraph') },
    { value: 'heading-2' as const, label: pt('richText.heading2') },
    { value: 'heading-3' as const, label: pt('richText.heading3') },
    { value: 'blockquote' as const, label: pt('richText.quote') },
  ],
  toolbarLabels: {
    mode: pt('richText.mode'),
    visualMode: pt('richText.visual'),
    htmlMode: pt('richText.html'),
    blockType: pt('richText.block'),
    bulletList: pt('richText.bullets'),
    orderedList: pt('richText.ordered'),
    bold: pt('richText.bold'),
    italic: pt('richText.italic'),
    underline: pt('richText.underline'),
    clearFormatting: pt('richText.clear'),
    undo: pt('richText.undo'),
    redo: pt('richText.redo'),
    link: pt('richText.link'),
    linkPrompt: pt('richText.linkPrompt'),
  },
});
