import { Select, Textarea, RichTextHtmlEditor } from '@sva/studio-ui-react';
import { useVoucherFormFields, type VoucherFormProps } from './vouchers.form-fields.js';
import { VoucherMediaFields } from './vouchers.form-media.js';
export function VoucherBasicsFields(props: VoucherFormProps) {
  const { t, section, field, text } = useVoucherFormFields(props);
  const toolbarLabels = voucherToolbarLabels(t);
  return section(
    'basics',
    <>
      {field('title', text('title', 'text', true), true)}
      {field(
        'teaser',
        <Textarea
          id="voucher-teaser"
          value={props.draft.teaser}
          onChange={(event) => props.change('teaser', event.target.value)}
        />
      )}
      {field(
        'body',
        <RichTextHtmlEditor
          id="voucher-body"
          value={props.draft.body}
          onChange={(value) => props.change('body', value)}
          blockTypeOptions={[{ value: 'paragraph', label: t('rich.paragraph') }]}
          toolbarLabels={toolbarLabels}
        />
      )}
      {field(
        'categories',
        <Select
          id="voucher-categories"
          multiple
          value={props.draft.categories.map((item) => item.name)}
          onChange={(event) =>
            props.change(
              'categories',
              Array.from(event.target.selectedOptions, (item) => ({ name: item.value }))
            )
          }
        >
          {Array.from(
            new Set([
              ...props.categories.map((item) => item.name),
              ...props.draft.categories.map((item) => item.name),
            ])
          ).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      )}
      <VoucherMediaFields {...props} />
    </>
  );
}
function voucherToolbarLabels(t: (key: string) => string) {
  const toolbarLabels = Object.fromEntries(
    [
      'mode',
      'visualMode',
      'htmlMode',
      'blockType',
      'bulletList',
      'orderedList',
      'bold',
      'italic',
      'underline',
      'clearFormatting',
      'undo',
      'redo',
      'link',
      'linkPrompt',
    ].map((key) => [key, t(`rich.${key}`)])
  ) as Record<
    | 'mode'
    | 'visualMode'
    | 'htmlMode'
    | 'blockType'
    | 'bulletList'
    | 'orderedList'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'clearFormatting'
    | 'undo'
    | 'redo'
    | 'link'
    | 'linkPrompt',
    string
  >;
  return toolbarLabels;
}
