import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioField, Textarea } from '@sva/studio-ui-react';
import { useState } from 'react';

const EMBED_CODE_ID = 'waste-settings-calendar-embed-code';

const buildEmbedCode = (calendarWebUrl: string | undefined): string | null => {
  if (!calendarWebUrl) return null;
  try {
    const url = new URL(calendarWebUrl);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
      return null;
    }
    const scriptUrl = new URL('/embed.js', url.origin).href
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return [
      '<div data-public-waste-calendar></div>',
      `<script type="module" src="${scriptUrl}"></script>`,
    ].join('\n');
  } catch {
    return null;
  }
};

export const WasteCalendarEmbedCode = ({
  calendarWebUrl,
}: Readonly<{ calendarWebUrl?: string }>) => {
  const pt = usePluginTranslation('wasteManagement');
  const [copyStatus, setCopyStatus] = useState<'copied' | 'copyFailed' | null>(null);
  const code = buildEmbedCode(calendarWebUrl);
  if (!code) return null;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('copyFailed');
    }
  };

  return (
    <div className="space-y-2">
      <StudioField id={EMBED_CODE_ID} label={pt('settings.fields.calendarEmbedCode')}>
        <Textarea
          id={EMBED_CODE_ID}
          value={code}
          rows={3}
          readOnly
          spellCheck={false}
          className="font-mono"
        />
      </StudioField>
      <Button type="button" variant="secondary" onClick={() => void copyCode()}>
        {pt('settings.actions.copyCalendarEmbedCode')}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {copyStatus &&
          pt(
            copyStatus === 'copied'
              ? 'settings.messages.calendarEmbedCodeCopied'
              : 'settings.messages.calendarEmbedCodeCopyFailed'
          )}
      </p>
    </div>
  );
};
