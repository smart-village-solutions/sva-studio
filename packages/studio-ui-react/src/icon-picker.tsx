/** Accessible Tabler picker built from the Studio's Popover, Input and Button. */
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { IconChevronDown, IconLock } from '@tabler/icons-react';
import { Button } from './button.js';
import { Input } from './input.js';
import { cn } from './utils.js';
import { tablerIconNames } from './tabler-icon-catalog.js';
import { TablerIcon } from './tabler-icon.js';
export type IconPickerProps = Readonly<{
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  placeholder: string;
  searchLabel: string;
  emptyText: string;
  moreLabel: string;
  hint?: string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  describedBy?: string;
}>;
export const IconPicker = (props: IconPickerProps) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [limit, setLimit] = React.useState(60);
  const [active, setActive] = React.useState(0);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const matches = React.useMemo(
    () => tablerIconNames.filter((name) => name.includes(search.trim().toLowerCase())),
    [search]
  );
  const visible = matches.slice(0, limit);
  const close = () => {
    setOpen(false);
    setSearch('');
    setLimit(60);
    setActive(0);
  };
  React.useEffect(() => {
    if (props.disabled || props.readOnly) close();
  }, [props.disabled, props.readOnly]);
  const choose = (name: string) => {
    props.onValueChange(name);
    close();
    trigger.current?.focus();
  };
  const errorId = `${props.id}-error`;
  return (
    <div className="grid gap-1 text-sm text-foreground">
      <label htmlFor={props.id}>{props.label}</label>
      {props.readOnly ? (
        <div
          id={props.id}
          role="textbox"
          aria-readonly="true"
          aria-label={props.label}
          className="flex min-h-11 items-center gap-2 rounded-md border border-input bg-surface-inset px-3"
        >
          <span className="flex-1">{props.value || props.placeholder}</span>
          <IconLock aria-hidden="true" size={16} />
        </div>
      ) : (
        <Popover.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
          <Popover.Trigger asChild>
            <Button
              ref={trigger}
              id={props.id}
              type="button"
              variant="secondary"
              disabled={props.disabled}
              aria-label={props.label}
              aria-invalid={Boolean(props.error) || undefined}
              aria-describedby={
                [props.describedBy, props.error ? errorId : undefined].filter(Boolean).join(' ') ||
                undefined
              }
              className={cn(
                'min-h-11 w-full justify-between bg-surface-inset px-3 font-normal',
                props.error && 'border-destructive'
              )}
            >
              <span className="truncate">{props.value || props.placeholder}</span>
              <IconChevronDown aria-hidden="true" size={16} />
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            {open ? (
              <Popover.Content
                align="start"
                sideOffset={4}
                className="z-50 w-[min(25rem,calc(100vw-2rem))] rounded-md border border-input bg-popover p-3 text-popover-foreground shadow-lg"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  trigger.current?.focus();
                }}
              >
                <label htmlFor={`${props.id}-search`} className="mb-1 block">
                  {props.searchLabel}
                </label>
                <Input
                  id={`${props.id}-search`}
                  type="search"
                  role="combobox"
                  aria-expanded={open}
                  aria-autocomplete="list"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setLimit(60);
                    setActive(0);
                  }}
                  aria-controls={`${props.id}-options`}
                  aria-activedescendant={visible[active] ? `${props.id}-icon-${active}` : undefined}
                  onKeyDown={(e) => {
                    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
                      e.preventDefault();
                      const step =
                        e.key === 'ArrowDown'
                          ? 3
                          : e.key === 'ArrowUp'
                            ? -3
                            : e.key === 'ArrowLeft'
                              ? -1
                              : 1;
                      setActive((i) => {
                        const next = Math.max(0, Math.min(visible.length - 1, i + step));
                        document
                          .getElementById(`${props.id}-icon-${next}`)
                          ?.scrollIntoView?.({ block: 'nearest' });
                        return next;
                      });
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (visible[active]) choose(visible[active]);
                    }
                  }}
                />
                <div
                  id={`${props.id}-options`}
                  role="listbox"
                  aria-label={props.label}
                  className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto"
                >
                  {visible.map((name, index) => (
                    <button
                      key={name}
                      id={`${props.id}-icon-${index}`}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={props.value === name}
                      className={cn(
                        'flex min-h-16 flex-col items-center justify-center gap-1 rounded-md p-2 text-xs hover:bg-accent',
                        index === active || name === props.value
                          ? 'bg-accent ring-1 ring-ring'
                          : 'bg-surface-inset'
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(name)}
                    >
                      <TablerIcon name={name} size={20} />
                      <span className="max-w-full truncate">{name}</span>
                    </button>
                  ))}
                </div>
                {!matches.length ? (
                  <p role="status" className="py-3">
                    {props.emptyText}
                  </p>
                ) : null}
                {matches.length > limit ? (
                  <Button type="button" variant="tertiary" onClick={() => setLimit((n) => n + 60)}>
                    {props.moreLabel}
                  </Button>
                ) : null}
              </Popover.Content>
            ) : null}
          </Popover.Portal>
        </Popover.Root>
      )}
      {props.hint ? <p className="text-xs text-muted-foreground">{props.hint}</p> : null}
      {props.error ? (
        <p id={errorId} role="alert" className="text-destructive">
          {props.error}
        </p>
      ) : null}
      {props.value ? (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <TablerIcon name={props.value} size={20} />
          {props.value}
        </span>
      ) : null}
    </div>
  );
};
