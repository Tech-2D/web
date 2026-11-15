import { Calculator, ChevronDown } from "lucide-react";
import { PageHeading } from "../../PageHeading";

export function AppHeader({ year, onChangeYear }: { year: number; onChangeYear: () => void }) {
  return (
    <div className="portal-toolbar-heading">
      <PageHeading icon={Calculator} title="Notaki" />
      <button type="button" onClick={onChangeYear} className="portal-control"
        aria-label={`${year}º ano Tech. Trocar de ano`}>
        {year}º ano Tech <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
