import { Link } from '@tanstack/react-router';

export default function Header() {
  return (
    <header className="border-b border-slate-800/70 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-sm text-slate-200">
        <Link className="font-semibold tracking-wide text-slate-100" to="/">
          SVA Studio
        </Link>
        <div className="flex items-center gap-4 text-slate-300">
          <Link className="transition hover:text-white" to="/">
            Home
          </Link>
          <Link className="transition hover:text-white" to="/demo">
            Demos
          </Link>
          <Link className="transition hover:text-white" to="/plugins/example">
            Plugin Example
          </Link>
        </div>
      </nav>
    </header>
  );
}
