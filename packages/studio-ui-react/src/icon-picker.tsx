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
const arrowSteps: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 3,
  ArrowLeft: -1,
  ArrowUp: -3,
};
function useIconPicker(props: IconPickerProps) {
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
  const onSearch = (value: string) => {
    setSearch(value);
    setLimit(60);
    setActive(0);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const step = arrowSteps[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setActive((index) => {
        const next = Math.max(0, Math.min(visible.length - 1, index + step));
        document.getElementById(`${props.id}-icon-${next}`)?.scrollIntoView?.({ block: 'nearest' });
        return next;
      });
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (visible[active]) choose(visible[active]);
    }
  };
  return {
    open,
    setOpen,
    search,
    limit,
    setLimit,
    active,
    trigger,
    matches,
    visible,
    close,
    choose,
    onSearch,
    onKeyDown,
  };
}
type PickerParts = { props: IconPickerProps; picker: ReturnType<typeof useIconPicker> };
function PickerTrigger({ props, picker }: PickerParts) {
  const describedBy = [props.describedBy, props.error ? `${props.id}-error` : undefined]
    .filter(Boolean)
    .join(' ');
  return (
    <Popover.Trigger asChild>
      <Button
        ref={picker.trigger}
        id={props.id}
        type="button"
        variant="secondary"
        disabled={props.disabled}
        aria-label={props.label}
        aria-invalid={Boolean(props.error) || undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'min-h-11 w-full justify-between bg-surface-inset px-3 font-normal',
          props.error && 'border-destructive'
        )}
      >
        <span className="truncate">{props.value || props.placeholder}</span>
        <IconChevronDown aria-hidden="true" size={16} />
      </Button>
    </Popover.Trigger>
  );
}
function PickerOptions({ props, picker }: PickerParts) {
  return (
    <div
      id={`${props.id}-options`}
      role="listbox"
      aria-label={props.label}
      className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto"
    >
      {picker.visible.map((name, index) => (
        <button
          key={name}
          id={`${props.id}-icon-${index}`}
          type="button"
          role="option"
          tabIndex={-1}
          aria-selected={props.value === name}
          className={cn(
            'flex min-h-16 flex-col items-center justify-center gap-1 rounded-md p-2 text-xs hover:bg-accent',
            index === picker.active || name === props.value
              ? 'bg-accent ring-1 ring-ring'
              : 'bg-surface-inset'
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => picker.choose(name)}
        >
          <TablerIcon name={name} size={20} />
          <span className="max-w-full truncate">{name}</span>
        </button>
      ))}
    </div>
  );
}
function PickerContent({ props, picker }: PickerParts) {
  return (
    <Popover.Content
      align="start"
      sideOffset={4}
      className="z-50 w-[min(25rem,calc(100vw-2rem))] rounded-md border border-input bg-popover p-3 text-popover-foreground shadow-lg"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        picker.trigger.current?.focus();
      }}
    >
      <label htmlFor={`${props.id}-search`} className="mb-1 block">
        {props.searchLabel}
      </label>
      <Input
        id={`${props.id}-search`}
        type="search"
        role="combobox"
        aria-expanded={picker.open}
        aria-autocomplete="list"
        value={picker.search}
        onChange={(event) => picker.onSearch(event.target.value)}
        aria-controls={`${props.id}-options`}
        aria-activedescendant={
          picker.visible[picker.active] ? `${props.id}-icon-${picker.active}` : undefined
        }
        onKeyDown={picker.onKeyDown}
      />
      <PickerOptions props={props} picker={picker} />
      {!picker.matches.length ? (
        <p role="status" className="py-3">
          {props.emptyText}
        </p>
      ) : null}
      {picker.matches.length > picker.limit ? (
        <Button
          type="button"
          variant="tertiary"
          onClick={() => picker.setLimit((count) => count + 60)}
        >
          {props.moreLabel}
        </Button>
      ) : null}
    </Popover.Content>
  );
}
export const IconPicker = (props: IconPickerProps) => {
  const picker = useIconPicker(props);
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
        <Popover.Root
          open={picker.open}
          onOpenChange={(next) => (next ? picker.setOpen(true) : picker.close())}
        >
          <PickerTrigger props={props} picker={picker} />
          <Popover.Portal>
            {picker.open ? <PickerContent props={props} picker={picker} /> : null}
          </Popover.Portal>
        </Popover.Root>
      )}
      {props.hint ? <p className="text-xs text-muted-foreground">{props.hint}</p> : null}
      {props.error ? (
        <p id={`${props.id}-error`} role="alert" className="text-destructive">
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
