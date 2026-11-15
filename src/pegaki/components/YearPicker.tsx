import { ArrowRight, Calculator, Lock } from "lucide-react";
import { PageHeading } from "../../PageHeading";
import { SUBJECTS_BY_YEAR, YEARS, type Year } from "../data/subjects";

export function YearPicker({ onPick }: { onPick: (y: Year) => void }) {
  return (
    <main className="portal-main space-y-4">
      <div className="portal-toolbar interface-panel">
        <PageHeading icon={Calculator} title="Notaki" />
        <h2 className="portal-tool-row text-sm font-semibold">Qual ano do Tech você quer consultar?</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {YEARS.map(y => {
          const count = SUBJECTS_BY_YEAR[y].length;
          const ready = count > 0;
          return (
            <button
              key={y}
              onClick={() => ready && onPick(y)}
              disabled={!ready}
              type="button"
              className="interface-panel flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand enabled:cursor-pointer enabled:hover:border-brand disabled:cursor-not-allowed"
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-lg text-lg font-bold ${
                  ready
                    ? "bg-brand-soft text-brand-ink"
                    : "bg-ink/5 text-muted"
                }`}
              >
                {y}º
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${ready ? "" : "text-muted"}`}>{y}º ano Tech</span>
                <span className="block text-xs text-muted">{ready ? `${count} disciplinas` : "Em breve"}</span>
              </span>
              {ready ? (
                <ArrowRight
                  size={20}
                  aria-hidden
                  className="shrink-0 text-muted"
                />
              ) : (
                <Lock size={18} aria-hidden className="text-muted sm:self-end" />
              )}
            </button>
          );
        })}
      </div>
    </main>
  );
}
