import type { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Input,
  StudioConfirmDialog,
  StudioDetailCard,
  StudioField,
  Textarea,
} from '@sva/studio-ui-react';
import { useState, type ReactNode } from 'react';

type Translate = ReturnType<typeof usePluginTranslation>;
export type Stop = {
  key: string;
  id?: string;
  name: string;
  description: string;
  latitude: string;
  longitude: string;
};
const createStop = (): Stop => ({
  key: crypto.randomUUID(),
  name: '',
  description: '',
  latitude: '',
  longitude: '',
});

function StationFields({
  pt,
  stop,
  number,
  onChange,
  children,
}: {
  pt: Translate;
  stop: Stop;
  number: number;
  onChange: (patch: Partial<Stop>) => void;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="font-medium">{pt('stopLabel', { number })}</legend>
      <StudioField id={`${stop.key}-name`} label={pt('name')}>
        <Input
          id={`${stop.key}-name`}
          required={!stop.id}
          maxLength={250}
          value={stop.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </StudioField>
      <StudioField id={`${stop.key}-description`} label={pt('tourDescription')}>
        <Textarea
          id={`${stop.key}-description`}
          value={stop.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </StudioField>
      <div className="grid gap-3 sm:grid-cols-2">
        <StudioField id={`${stop.key}-latitude`} label={pt('latitude')}>
          <Input
            id={`${stop.key}-latitude`}
            type="number"
            step="any"
            min={-90}
            max={90}
            value={stop.latitude}
            onChange={(event) => onChange({ latitude: event.target.value })}
          />
        </StudioField>
        <StudioField id={`${stop.key}-longitude`} label={pt('longitude')}>
          <Input
            id={`${stop.key}-longitude`}
            type="number"
            step="any"
            min={-180}
            max={180}
            value={stop.longitude}
            onChange={(event) => onChange({ longitude: event.target.value })}
          />
        </StudioField>
      </div>
      {children}
    </fieldset>
  );
}

export function Stations({
  pt,
  stops,
  setStops,
}: {
  pt: Translate;
  stops: Stop[];
  setStops: (next: Stop[]) => void;
}) {
  const [pendingRemoval, setPendingRemoval] = useState<Stop>();
  const remove = (stop: Stop) => setStops(stops.filter(({ key }) => key !== stop.key));
  const change = (index: number, patch: Partial<Stop>) =>
    setStops(
      stops.map((stop, indexOfStop) => (indexOfStop === index ? { ...stop, ...patch } : stop))
    );
  const move = (index: number, target: number) => {
    const next = [...stops];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setStops(next);
  };
  return (
    <StudioDetailCard title={pt('stops')}>
      <ol className="space-y-4">
        {stops.map((stop, index) => (
          <li key={stop.key}>
            <StationFields
              pt={pt}
              stop={stop}
              number={index + 1}
              onChange={(patch) => change(index, patch)}
            >
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  {pt('moveUp')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={index === stops.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  {pt('moveDown')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => (stop.id ? setPendingRemoval(stop) : remove(stop))}
                >
                  {pt('removeStop')}
                </Button>
              </div>
            </StationFields>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="secondary"
        disabled={stops.length >= 200}
        onClick={() => setStops([...stops, createStop()])}
      >
        {pt('addStop')}
      </Button>
      {pendingRemoval && (
        <RemoveStationDialog
          pt={pt}
          stop={pendingRemoval}
          onClose={() => setPendingRemoval(undefined)}
          onRemove={remove}
        />
      )}
    </StudioDetailCard>
  );
}

function RemoveStationDialog({
  pt,
  stop,
  onClose,
  onRemove,
}: {
  pt: Translate;
  stop: Stop;
  onClose: () => void;
  onRemove: (stop: Stop) => void;
}) {
  return (
    <StudioConfirmDialog
      open
      title={pt('confirmRemoveStop')}
      description={pt('confirmRemoveStopDescription', { name: stop.name })}
      confirmLabel={pt('removeStop')}
      cancelLabel={pt('cancel')}
      onCancel={onClose}
      onConfirm={() => {
        onRemove(stop);
        onClose();
      }}
    />
  );
}
