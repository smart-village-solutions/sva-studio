import * as React from 'react';

type MotionArtworkProps = Readonly<{
  reducedMotion: boolean;
}>;

export const ContentAssemblyArtwork = ({ reducedMotion }: MotionArtworkProps) => {
  const mediaFillId = React.useId();

  return (
    <svg
      aria-hidden="true"
      className="h-24 w-32 overflow-visible"
      data-motion={reducedMotion ? 'reduced' : 'animated'}
      data-testid="studio-content-assembly"
      fill="none"
      viewBox="0 0 160 116"
    >
      <defs>
        <linearGradient id={mediaFillId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--primary))" stopOpacity="0.28" />
          <stop offset="1" stopColor="rgb(var(--primary))" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <rect
        className="studio-motion-frame-line stroke-primary/55"
        height="94"
        rx="12"
        strokeWidth="2"
        width="134"
        x="13"
        y="11"
      />
      <path
        className="studio-motion-frame-line stroke-primary/30"
        d="M13 33H147"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle className="studio-motion-accent fill-primary" cx="27" cy="22" r="3" />
      <circle className="fill-primary/30" cx="37" cy="22" r="2.4" />
      <rect
        className="studio-motion-block fill-primary/70"
        height="7"
        rx="3.5"
        width="55"
        x="28"
        y="47"
      />
      <rect
        className="studio-motion-block fill-muted-foreground/25"
        height="5"
        rx="2.5"
        width="73"
        x="28"
        y="62"
      />
      <rect
        className="studio-motion-block fill-muted-foreground/15"
        height="5"
        rx="2.5"
        width="59"
        x="28"
        y="73"
      />
      <rect
        className="studio-motion-block stroke-primary/35"
        fill={`url(#${mediaFillId})`}
        height="39"
        rx="7"
        strokeWidth="1.5"
        width="32"
        x="109"
        y="47"
      />
    </svg>
  );
};

const WorkbenchDefinitions = ({
  blockFillId,
  gridId,
}: {
  readonly blockFillId: string;
  readonly gridId: string;
}) => (
  <defs>
    <pattern height="28" id={gridId} patternUnits="userSpaceOnUse" width="28">
      <path className="stroke-primary/12" d="M28 0H0V28" strokeWidth="1" />
    </pattern>
    <linearGradient id={blockFillId} x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stopColor="rgb(var(--primary))" stopOpacity="0.24" />
      <stop offset="1" stopColor="rgb(var(--primary))" stopOpacity="0.05" />
    </linearGradient>
  </defs>
);

const WorkbenchConnectors = () => (
  <g className="stroke-primary/28" strokeLinecap="round" strokeWidth="2">
    <path className="studio-workbench-connector" d="M170 102C236 102 235 170 302 170" />
    <path className="studio-workbench-connector" d="M550 96C482 96 488 170 418 170" />
    <path className="studio-workbench-connector" d="M184 265C244 265 245 208 306 208" />
    <path className="studio-workbench-connector" d="M536 263C478 263 475 208 414 208" />
  </g>
);

const WorkbenchBlocks = ({ blockFillId }: { readonly blockFillId: string }) => (
  <g fill={`url(#${blockFillId})`} strokeWidth="1.5">
    <rect
      className="studio-workbench-block stroke-primary/35"
      height="72"
      rx="16"
      width="106"
      x="65"
      y="66"
    />
    <rect
      className="studio-workbench-block stroke-primary/30"
      height="72"
      rx="16"
      width="106"
      x="549"
      y="60"
    />
    <rect
      className="studio-workbench-block stroke-primary/30"
      height="72"
      rx="16"
      width="106"
      x="79"
      y="229"
    />
    <rect
      className="studio-workbench-block stroke-primary/35"
      height="72"
      rx="16"
      width="106"
      x="535"
      y="227"
    />
    <rect
      className="studio-workbench-block stroke-primary/45"
      height="96"
      rx="22"
      width="124"
      x="298"
      y="142"
    />
  </g>
);

const WorkbenchDetails = () => (
  <g className="fill-primary/45">
    <rect height="8" rx="4" width="52" x="92" y="91" />
    <rect height="8" rx="4" width="46" x="579" y="85" />
    <circle cx="132" cy="265" r="13" />
    <path d="M567 258H612V268H567zM577 245H602V255H577z" />
    <rect height="9" rx="4.5" width="72" x="324" y="174" />
    <rect className="fill-primary/25" height="7" rx="3.5" width="54" x="324" y="193" />
  </g>
);

export const WorkbenchArtwork = ({ reducedMotion }: MotionArtworkProps) => {
  const gridId = React.useId();
  const blockFillId = React.useId();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-motion={reducedMotion ? 'reduced' : 'animated'}
      data-testid="studio-workbench-artwork"
    >
      <svg
        className="h-full w-full"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 720 360"
      >
        <WorkbenchDefinitions blockFillId={blockFillId} gridId={gridId} />
        <rect className="studio-workbench-grid" fill={`url(#${gridId})`} height="360" width="720" />
        <WorkbenchConnectors />
        <WorkbenchBlocks blockFillId={blockFillId} />
        <WorkbenchDetails />
      </svg>
    </div>
  );
};
