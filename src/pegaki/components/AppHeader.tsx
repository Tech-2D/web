import { Calculator } from "lucide-react";
import { PageHeading } from "../../PageHeading";

export function AppHeader({ className }: { className?: string }) {
  return (
    <div className="portal-toolbar-heading">
      <PageHeading icon={Calculator} title="Notaki" />
      {className && <span className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-ink">{className}</span>}
    </div>
  );
}
