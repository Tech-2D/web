import { agendaMenuUrl } from "../menuShortcuts";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "../dataClient";
import { isClassPreferenceChange } from "../classPreference";
import { observeCatalog } from "../professores/publicQueries";
import { savePreferredClass } from "../professores/classPreference";
import type { Schedule } from "../professores/types";
import { useNotebook } from "./lib/useNotebook";
import { ChevronDown, Search } from "lucide-react";
import { calculateSemesters, DEFAULT_N1_WEIGHT, type InputMode, type Modes, type Situation } from "./lib/grades";
import type { Year } from "./data/subjects";
import { findTechClass, readNotakiClass, subjectsForClass, TECH_CLASSES } from "./classSubjects";
import { Formulas } from "./components/Formulas";
import { Summary } from "./components/Summary";
import { GRID, SITUATION, SubjectRow, toGrade, type Grades } from "./components/SubjectRow";
import { SubjectDetail } from "./components/SubjectDetail";
import { ExportPdf } from "./components/ExportPdf";
import { Segmented } from "./components/Segmented";
import { AppHeader } from "./components/AppHeader";
import { ClearGrades } from "./components/ClearGrades";
import { ImportBoletim } from "./components/ImportBoletim";
import type { BoletimMatch } from "./lib/boletim";

const CLOUD_GRADES_ENABLED = import.meta.env.VITE_PEGAKI_CLOUD_GRADES === 'true';
const EMPTY: Grades = {
  s1n1: "",
  s1n2: "",
  s2n1: "",
  s2n2: "",
  s1avg: "",
  s2avg: "",
  rec: "",
  s1Weight: DEFAULT_N1_WEIGHT,
  s2Weight: DEFAULT_N1_WEIGHT,
};

type Filter = "todas" | Situation;
const FILTERS: Filter[] = ["todas", "aprovado", "aprovado-rec", "recuperacao", "reprovado", "andamento"];

const MODES: { value: InputMode; label: string }[] = [
  { value: "notas", label: "N1 e N2" },
  { value: "media", label: "Média" },
];


const modeHint = (m: InputMode) => (m === "media" ? "Média" : "N1 · N2 · Média");
const swapIn = (m: InputMode) => (m === "media" ? "animate-swap-in-right" : "animate-swap-in-left");

// Campos que são nota (o resto, como os pesos, é configuração).
const GRADE_FIELDS = ["s1n1", "s1n2", "s2n1", "s2n2", "s1avg", "s2avg", "rec"] as const;

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(CLOUD_GRADES_ENABLED ? undefined : null);
  useEffect(() => { if (CLOUD_GRADES_ENABLED) return onAuthStateChanged(auth, setUser); }, []);
  const [preferredClass, setPreferredClass] = useState(readNotakiClass);
  const [profileClass, setProfileClass] = useState<string | null>();
  const [choosingClass, setChoosingClass] = useState(false);
  const uid = auth.currentUser?.uid;
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (isClassPreferenceChange(event)) setPreferredClass(readNotakiClass());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (preferredClass || !uid) return;
    let active = true;
    void getDoc(doc(db, "userProfiles", uid)).then(record => {
      const name: unknown = record.data()?.className;
      if (active) setProfileClass(typeof name === "string" && name.trim() ? name.trim() : null);
    }).catch(() => { if (active) setProfileClass(null); });
    return () => { active = false; };
  }, [preferredClass, uid]);

  const className = preferredClass ?? profileClass ?? null;
  const turma = findTechClass(className);
  if (user === undefined) return <NotakiStatus><p role="status">Carregando sua conta…</p></NotakiStatus>;
  if (!preferredClass && uid && profileClass === undefined) return <NotakiStatus><p role="status">Buscando sua turma…</p></NotakiStatus>;
  if (!turma || choosingClass) return (
    <NotakiStatus className={className ?? undefined}>
      <label className="flex flex-wrap items-center gap-2">
        <span>{className && !turma ? "Escolha uma turma do Tech" : "Qual é a sua turma?"}</span>
        <select className="portal-control" value={turma?.name ?? ""} onChange={event => {
          const name = event.target.value;
          savePreferredClass(name);
          setPreferredClass(name);
          setChoosingClass(false);
        }}>
          <option value="" disabled>Selecione a turma</option>
          {TECH_CLASSES.map(item => <option key={item.name}>{item.name}</option>)}
        </select>
      </label>
      {choosingClass && <button type="button" className="portal-control" onClick={() => setChoosingClass(false)}>Voltar</button>}
    </NotakiStatus>
  );
  return <ClassGrades key={turma.name} turma={turma} user={user} onChangeClass={() => setChoosingClass(true)} />;
}

function NotakiStatus({ className, children }: { className?: string; children: ReactNode }) {
  return <main className="portal-main"><div className="portal-toolbar interface-panel">
    <AppHeader className={className} />
    <div className="portal-tool-row text-sm text-muted">{children}</div>
  </div></main>;
}

function ClassGrades({ turma, user, onChangeClass }: {
  turma: { name: string; year: Year };
  user: User | null;
  onChangeClass: () => void;
}) {
  const [academicYear, setAcademicYear] = useState(() => new Date().getFullYear());
  const [subjects, setSubjects] = useState<string[]>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => observeCatalog<{ schedules: Schedule[] }>('schedules', data => {
    setSubjects(subjectsForClass(turma.name, data.schedules));
    setFailed(false);
  }, () => setFailed(true), turma.name), [turma.name, retry]);

  if (!subjects?.length) return <NotakiStatus className={turma.name}>
    {failed ? <>
      <p role="alert">Não foi possível carregar as disciplinas da turma.</p>
      <button type="button" className="portal-control" onClick={() => { setFailed(false); setRetry(value => value + 1); }}>Tentar novamente</button>
    </> : subjects ? <>
      <p>Nenhuma disciplina cadastrada na grade desta turma.</p>
      <button type="button" className="portal-control" onClick={onChangeClass}>Alterar turma padrão</button>
    </> : <p role="status">Carregando as disciplinas da turma…</p>}
  </NotakiStatus>;

  return <GradesView key={academicYear} className={turma.name} year={turma.year} subjects={subjects}
    user={user} academicYear={academicYear} onAcademicYear={setAcademicYear} />;
}

function GradesView({ className, year, subjects, user, academicYear, onAcademicYear }: {
  className: string;
  year: Year;
  subjects: string[];
  user: User | null;
  academicYear: number;
  onAcademicYear: (year: number) => void;
}) {
  const cloud = useNotebook(user, year, academicYear);
  const { grades, setGrades, modes, setModes } = cloud;
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  // Modo de cada semestre, para todas as disciplinas; as notas de cada modo ficam guardadas separadas.
  // Só anima o cabeçalho da tabela depois que o modo foi trocado (não ao abrir a página).
  const [modeTouched, setModeTouched] = useState(false);


  // Disciplina aberta na tela de detalhe. Entra no histórico para o "voltar" do celular fechar a tela.
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const onPop = () => setOpen(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const openSubject = (name: string) => {
    history.pushState({ subject: name }, "");
    setOpen(name);
  };
  const closeSubject = () => history.back();

  const update = (name: string, patch: Partial<Grades>) => setGrades((g) => ({ ...g, [name]: { ...EMPTY, ...g[name], ...patch } }));

  // Apaga as notas do ano (mantém os pesos, que são configuração) e devolve como desfazer.
  const clearGrades = () => {
    const before = grades;
    setGrades((g) =>
      Object.fromEntries(
        Object.entries(g).map(([name, v]) => [name, subjects.includes(name)
          ? { ...EMPTY, s1Weight: v.s1Weight ?? DEFAULT_N1_WEIGHT, s2Weight: v.s2Weight ?? DEFAULT_N1_WEIGHT }
          : v]),
      ),
    );
    return () => setGrades(before);
  };

  // Lança as médias e a recuperação do boletim importado. Os semestres que vieram com nota passam
  // para o modo "Média" (as N1/N2 já digitadas continuam guardadas). Devolve como desfazer.
  const importGrades = (matched: BoletimMatch["matched"]) => {
    const before = { grades, modes };
    const text = (n: number) => n.toFixed(2).replace(".", ",");
    setGrades((g) => {
      const next = { ...g };
      for (const { subject, row } of matched) {
        const patch: Partial<Grades> = {};
        if (row.s1 !== null) patch.s1avg = text(row.s1);
        if (row.s2 !== null) patch.s2avg = text(row.s2);
        if (row.rf !== null) patch.rec = text(row.rf);
        next[subject] = { ...EMPTY, ...g[subject], ...patch };
      }
      return next;
    });
    const has = (k: "s1" | "s2") => matched.some(({ row }) => row[k] !== null);
    const nextModes: Modes = { s1: has("s1") ? "media" : modes.s1, s2: has("s2") ? "media" : modes.s2 };
    if (nextModes.s1 !== modes.s1 || nextModes.s2 !== modes.s2) setModeTouched(true);
    setModes(nextModes);
    return () => {
      setGrades(before.grades);
      setModes(before.modes);
    };
  };

  const { rows, savedOutsideClass } = useMemo(() => {
    const otherSubjects = Object.keys(grades).filter(name =>
      !subjects.includes(name) && GRADE_FIELDS.some(field => Boolean(grades[name][field])),
    );
    const calculate = (name: string) => {
      // Notas salvas antes do modo "media" e dos pesos não têm s1avg/s2avg nem os pesos.
      const g = { ...EMPTY, ...grades[name] };
      const r = calculateSemesters(
        { mode: modes.s1, n1: toGrade(g.s1n1), n2: toGrade(g.s1n2), avg: toGrade(g.s1avg), weight: g.s1Weight },
        { mode: modes.s2, n1: toGrade(g.s2n1), n2: toGrade(g.s2n2), avg: toGrade(g.s2avg), weight: g.s2Weight },
        toGrade(g.rec),
      );
      return { name, g, r };
    };
    return { rows: subjects.map(calculate), savedOutsideClass: otherSubjects.map(calculate) };
  }, [subjects, grades, modes]);
  const detail = rows.find((x) => x.name === open) ?? savedOutsideClass.find((x) => x.name === open);
  const q = query.trim().toLowerCase();
  const visible = rows.filter(({ name, r }) => (filter === "todas" || r.situation === filter) && (!q || name.toLowerCase().includes(q)));

  return (
    <>
      <main className="portal-main space-y-4">
        <div className="portal-toolbar interface-panel">
          <AppHeader className={className} />
          <section aria-label="Notas da sua conta" className="portal-tool-row">
          {user ? <>
            <label className="inline-flex items-center gap-2 text-sm">
              Ano letivo
              <span className="relative inline-flex">
                <select aria-label="Ano letivo" className="portal-control notaki-year-select appearance-none"
                  disabled={cloud.loading || cloud.saving} value={academicYear}
                  onChange={event => {
                    const next = Number(event.target.value);
                    void cloud.save().then(saved => { if (!cloud.dirty || saved) onAcademicYear(next); });
                  }}>
                  {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() + 1 - index).map(value => <option key={value}>{value}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
              </span>
            </label>
            <span className="text-sm text-muted" role="status">{cloud.loading ? 'Carregando notas…' : cloud.saving ? 'Salvando…' : cloud.error ? (cloud.ready ? 'Salvamento pendente' : 'Não foi possível carregar as notas') : cloud.dirty ? 'Aguardando para salvar…' : 'Notas salvas na conta'}</span>
            {cloud.canImport && <button type="button" className="text-sm text-brand-ink underline" onClick={cloud.importLocal}>Importar notas deste navegador</button>}
            {cloud.error && <p role="alert" className="w-full text-sm">{cloud.error}</p>}
            {!cloud.ready && !cloud.loading && <button type="button" className="portal-control" onClick={cloud.retry}>Tentar novamente</button>}
            {cloud.conflict && <button type="button" onClick={()=>{if(window.confirm('Recarregar as notas da conta e descartar as alterações desta tela?'))cloud.reload()}}>Recarregar notas da conta</button>}
          </> : <><p className="flex-1 text-sm text-muted">{CLOUD_GRADES_ENABLED ? 'Suas notas ficam neste navegador. Entre para salvá-las na conta e acessar em outros dispositivos.' : 'Suas notas ficam salvas neste navegador.'}</p>{CLOUD_GRADES_ENABLED && <a className="text-sm text-brand-ink underline" href={agendaMenuUrl("profiles")}>Entrar ou criar conta</a>}</>}
          </section>
          {cloud.ready && (
          <section className="portal-tool-row" aria-label="Como lançar as notas">
              {(["s1", "s2"] as const).map((sem, i) => (
                <div key={sem} className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted">
                    {i + 1}º semestre
                  </span>
                  <Segmented
                    ariaLabel={`Como lançar as notas do ${i + 1}º semestre`}
                    options={MODES}
                    value={modes[sem]}
                    onChange={(v) => {
                      setModeTouched(true);
                      setModes((x) => ({ ...x, [sem]: v }));
                    }}
                    className="interface-segments"
                    indicatorClassName="rounded-[.4375rem] bg-brand"
                  />
                </div>
              ))}
          </section>
          )}
        </div>

        {cloud.ready && <>
        <Summary
          rows={rows}
          action={
            <>
              <ClearGrades
                year={year}
                filled={rows.filter(({ g }) => GRADE_FIELDS.some((f) => g[f] !== "")).length}
                onClear={clearGrades}
              />
              <ImportBoletim year={year} subjects={subjects} onImport={importGrades} />
              <ExportPdf className={className} rows={rows.map(({ name, g, r }) => ({ name, r, rec: toGrade(g.rec) }))} />
            </>
          }
        />

        <section className="portal-toolbar interface-panel" aria-labelledby="notaki-subjects">
          <h2 id="notaki-subjects" className="text-base font-semibold">Disciplinas da turma</h2>
          <div className="portal-tool-row justify-between">
          <div
            className="interface-segments max-w-full flex-wrap"
            role="group"
            aria-label="Filtrar por situação"
          >
            {FILTERS.map((f) => {
              const active = filter === f;
              const n = f === "todas" ? rows.length : rows.filter((x) => x.r.situation === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  type="button"
                  className="cursor-pointer"
                >
                  {f === "todas" ? "Todas" : SITUATION[f].text}{" "}
                  <span key={n} className="inline-block animate-pop opacity-70 tabular-nums">
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="portal-search w-full sm:w-64">
            <span className="sr-only">Buscar disciplina</span>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar disciplina"
            />
          </label>
          </div>
        </section>

        <section aria-labelledby="notaki-subjects" className="notaki-grades lg:overflow-hidden">
          <div className={`hidden border-b border-line px-4 py-3 pl-5 text-xs font-semibold lg:grid ${GRID}`}>
            <span>Disciplinas</span>
            <span>
              1º Semestre{" "}
              <span key={modes.s1} className={`block font-normal text-muted ${modeTouched ? swapIn(modes.s1) : ""}`}>
                {modeHint(modes.s1)}
              </span>
            </span>
            <span>
              2º Semestre{" "}
              <span key={modes.s2} className={`block font-normal text-muted ${modeTouched ? swapIn(modes.s2) : ""}`}>
                {modeHint(modes.s2)}
              </span>
            </span>
            <span>Média Anual</span>
            <span>Rec. Final</span>
            <span>Média Final</span>
            <span>Situação</span>
          </div>

          {/* A key muda com o filtro para a lista entrar de novo em cascata. */}
          <ul key={filter + q} className="space-y-3 lg:space-y-0 lg:divide-y lg:divide-line">
            {visible.map(({ name, g, r }, i) => (
              <SubjectRow
                key={name}
                name={name}
                modes={modes}
                grades={g}
                result={r}
                index={i}
                onChange={(p) => update(name, p)}
                onOpen={() => openSubject(name)}
              />
            ))}
          </ul>

          {visible.length === 0 && (
            <p className="animate-fade-up rounded-xl bg-surface p-8 text-center text-sm text-muted shadow-card lg:rounded-none lg:shadow-none">
              Nenhuma disciplina com esse filtro.
            </p>
          )}
        </section>

        {savedOutsideClass.length > 0 && (
          <details className="interface-panel">
            <summary className="cursor-pointer text-sm font-semibold">Notas salvas de outras disciplinas</summary>
            <ul className="mt-3 space-y-2">
              {savedOutsideClass.map(({ name, r }) => (
                <li key={name}>
                  <button type="button" className="portal-control w-full justify-between text-left" onClick={() => openSubject(name)}>
                    {name} <span className="text-xs text-muted">{SITUATION[r.situation].text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <details
          className="group interface-panel notaki-formulas [&_summary::-webkit-details-marker]:hidden"
          open
        >
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between rounded-2xl px-5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand">
            Como as médias são calculadas
            <ChevronDown size={20} aria-hidden className="text-muted transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-4 sm:px-5 sm:pb-5">
            <Formulas />
          </div>
        </details>
        </>}
      </main>

      {detail && (
        <SubjectDetail
          name={detail.name}
          modes={modes}
          grades={detail.g}
          result={detail.r}
          onChange={(p) => update(detail.name, p)}
          onClose={closeSubject}
        />
      )}
    </>
  );
}
