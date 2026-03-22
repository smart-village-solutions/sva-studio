import React from 'react';

import { Button } from './ui/button';

type RichTextEditorProps = {
  readonly id: string;
  readonly labelId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly commands: {
    readonly bold: string;
    readonly italic: string;
    readonly underline: string;
    readonly paragraph: string;
    readonly heading: string;
    readonly bulletList: string;
    readonly clearFormatting: string;
  };
};

const PLACEHOLDER_DESCRIPTION_SUFFIX = '-placeholder';

const runCommand = (command: string, commandValue?: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  const execCommand = Reflect.get(document, 'execCommand');
  if (typeof execCommand !== 'function') {
    return;
  }

  try {
    Reflect.apply(execCommand, document, [command, false, commandValue]);
  } catch {
    return;
  }
};

export const RichTextEditor = ({ id, labelId, value, onChange, placeholder, commands }: RichTextEditorProps) => {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const placeholderDescriptionId = `${id}${PLACEHOLDER_DESCRIPTION_SUFFIX}`;

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.innerHTML === value) {
      return;
    }

    editor.innerHTML = value;
  }, [value]);

  const syncValue = React.useCallback(() => {
    onChange(editorRef.current?.innerHTML ?? '');
  }, [onChange]);

  const applyCommand = (command: string, commandValue?: string) => {
    runCommand(command, commandValue);
    syncValue();
    editorRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('bold')}>
          {commands.bold}
        </Button>
        <Button type="button" size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('italic')}>
          {commands.italic}
        </Button>
        <Button type="button" size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('underline')}>
          {commands.underline}
        </Button>
        <Button type="button" size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('formatBlock', '<p>')}>
          {commands.paragraph}
        </Button>
        <Button type="button" size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('formatBlock', '<h2>')}>
          {commands.heading}
        </Button>
        <Button type="button" size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('insertUnorderedList')}>
          {commands.bulletList}
        </Button>
        <Button type="button" size="sm" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('removeFormat')}>
          {commands.clearFormatting}
        </Button>
      </div>
      <div
        id={id}
        ref={editorRef}
        aria-labelledby={labelId}
        aria-describedby={placeholder ? placeholderDescriptionId : undefined}
        contentEditable
        suppressContentEditableWarning
        className="min-h-56 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        data-placeholder={placeholder}
        onInput={syncValue}
        onBlur={syncValue}
      />
      {placeholder ? <p id={placeholderDescriptionId} className="sr-only">{placeholder}</p> : null}
    </div>
  );
};
