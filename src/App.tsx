import { FormEvent, useEffect, useMemo, useState } from "react";

type Habit = {
  id: string;
  name: string;
  goal: string;
  completions: Record<string, boolean>;
};

type StoredData = Record<string, Habit[]>;

type MonthSelection = {
  year: number;
  month: number;
};

type LicenseRecord = {
  createdAt: string;
  usedAt?: string;
};

type LicenseStore = Record<string, LicenseRecord>;

const STORAGE_KEY = "suivi-habitudes-dashboard-v1";
const LICENSE_STORE_KEY = "suivi-habitudes-licences-v1";
const LICENSE_ACCESS_KEY = "suivi-habitudes-acces-definitif-v1";
const ADMIN_SESSION_KEY = "suivi-habitudes-admin-session-v1";
const ADMIN_PASSWORD = "Tulipes23!";
const LICENSE_COUNT = 5000;

const monthNames = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const weekdayNames = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const weekPalette = [
  {
    name: "rose",
    bg: "#fff1f2",
    soft: "#ffe4e6",
    line: "#fb7185",
    solid: "#f43f5e",
    text: "#9f1239",
  },
  {
    name: "vert",
    bg: "#f0fdf4",
    soft: "#dcfce7",
    line: "#4ade80",
    solid: "#22c55e",
    text: "#166534",
  },
  {
    name: "jaune",
    bg: "#fefce8",
    soft: "#fef3c7",
    line: "#facc15",
    solid: "#eab308",
    text: "#854d0e",
  },
  {
    name: "bleu",
    bg: "#eff6ff",
    soft: "#dbeafe",
    line: "#60a5fa",
    solid: "#3b82f6",
    text: "#1d4ed8",
  },
  {
    name: "violet",
    bg: "#f5f3ff",
    soft: "#ede9fe",
    line: "#a78bfa",
    solid: "#8b5cf6",
    text: "#5b21b6",
  },
];

const habitTemplates = [
  ["Boire 2 L d'eau", "A"],
  ["Méditation", "10 min"],
  ["Marcher", "8 000 pas"],
  ["Lecture", "20 min"],
  ["Sommeil avant 23 h", "B"],
  ["Étirements", "15 min"],
  ["Journal personnel", "C"],
  ["Fruits et légumes", "5 portions"],
  ["Sans sucre ajouté", "5/7"],
  ["Apprentissage", "30 min"],
  ["Rangement rapide", "10 min"],
  ["Appeler un proche", "2/7"],
];

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function clampMonth(year: number, month: number): MonthSelection {
  const date = new Date(year, month, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function createId(prefix = "habitude") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSampleCompletions(index: number, year: number, month: number) {
  const daysInMonth = getDaysInMonth(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const visibleDays = isCurrentMonth ? today.getDate() : daysInMonth;
  const targetRates = [92, 86, 83, 78, 74, 81, 68, 72, 64, 76, 58, 52];
  const completions: Record<string, boolean> = {};

  for (let day = 1; day <= visibleDays; day += 1) {
    const score = (day * 17 + index * 23 + month * 11 + year) % 100;
    completions[String(day)] = score < targetRates[index % targetRates.length];
  }

  return completions;
}

function createDefaultHabits(year: number, month: number, withSamples = true): Habit[] {
  return habitTemplates.map(([name, goal], index) => ({
    id: `modele-${year}-${month + 1}-${index}`,
    name,
    goal,
    completions: withSamples ? createSampleCompletions(index, year, month) : {},
  }));
}

function cloneHabitsForNewMonth(habits: Habit[], year: number, month: number) {
  if (habits.length === 0) {
    return createDefaultHabits(year, month, false);
  }

  return habits.map((habit, index) => ({
    id: `${habit.id}-copie-${year}-${month + 1}-${index}`,
    name: habit.name,
    goal: habit.goal,
    completions: {},
  }));
}

function loadStoredData(initialSelection: MonthSelection): StoredData {
  const initialKey = getMonthKey(initialSelection.year, initialSelection.month);

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        [initialKey]: createDefaultHabits(initialSelection.year, initialSelection.month),
      };
    }

    const parsed = JSON.parse(raw) as StoredData;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Format de stockage invalide");
    }

    if (!parsed[initialKey]) {
      parsed[initialKey] = createDefaultHabits(initialSelection.year, initialSelection.month);
    }

    return parsed;
  } catch {
    return {
      [initialKey]: createDefaultHabits(initialSelection.year, initialSelection.month),
    };
  }
}

function loadLicenseStore(): LicenseStore {
  try {
    const raw = window.localStorage.getItem(LICENSE_STORE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as LicenseStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateLicenseKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomValues = new Uint32Array(20);
  window.crypto.getRandomValues(randomValues);
  const body = Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("");
  return `HAB-${body.slice(0, 5)}-${body.slice(5, 10)}-${body.slice(10, 15)}-${body.slice(15, 20)}`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getWeekIndex(day: number) {
  return Math.min(4, Math.floor((day - 1) / 7));
}

function formatPercent(value: number) {
  return `${Math.round(value)} %`;
}

export default function App() {
  const today = useMemo(() => new Date(), []);
  const initialSelection = useMemo(
    () => ({ year: today.getFullYear(), month: today.getMonth() }),
    [today],
  );

  const [selection, setSelection] = useState<MonthSelection>(initialSelection);
  const [storedData, setStoredData] = useState<StoredData>(() => loadStoredData(initialSelection));
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitGoal, setNewHabitGoal] = useState("");
  const [route, setRoute] = useState(() => (window.location.hash === "#admin" ? "admin" : "app"));
  const [hasPermanentAccess, setHasPermanentAccess] = useState(
    () => window.localStorage.getItem(LICENSE_ACCESS_KEY) === "true",
  );
  const [licenseStore, setLicenseStore] = useState<LicenseStore>(() => loadLicenseStore());
  const [licenseInput, setLicenseInput] = useState("");
  const [licenseMessage, setLicenseMessage] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(
    () => window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "true",
  );
  const [adminMessage, setAdminMessage] = useState("");
  const [isGeneratingLicenses, setIsGeneratingLicenses] = useState(false);
  const [lastGeneratedKeys, setLastGeneratedKeys] = useState<string[]>([]);

  const monthKey = getMonthKey(selection.year, selection.month);
  const habits = storedData[monthKey] ?? [];
  const daysInMonth = getDaysInMonth(selection.year, selection.month);

  const days = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = new Date(selection.year, selection.month, day);
        return {
          day,
          weekday: weekdayNames[date.getDay()],
          weekIndex: getWeekIndex(day),
        };
      }),
    [daysInMonth, selection.month, selection.year],
  );

  const weekGroups = useMemo(
    () =>
      Array.from({ length: 5 }, (_, weekIndex) => ({
        weekIndex,
        label: `S${weekIndex + 1}`,
        days: days.slice(weekIndex * 7, weekIndex * 7 + 7),
        palette: weekPalette[weekIndex],
      })),
    [days],
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
  }, [storedData]);

  useEffect(() => {
    window.localStorage.setItem(LICENSE_STORE_KEY, JSON.stringify(licenseStore));
  }, [licenseStore]);

  useEffect(() => {
    function handleHashChange() {
      setRoute(window.location.hash === "#admin" ? "admin" : "app");
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const stats = useMemo(() => {
    const dailyCounts = days.map(({ day }) => ({
      day,
      count: habits.reduce((total, habit) => total + (habit.completions[String(day)] ? 1 : 0), 0),
    }));

    const totalDone = dailyCounts.reduce((total, current) => total + current.count, 0);
    const totalPossible = habits.length * daysInMonth;
    const monthlyProgress = totalPossible > 0 ? (totalDone / totalPossible) * 100 : 0;
    const completedDays = dailyCounts.filter(({ count }) => habits.length > 0 && count === habits.length).length;
    const remainingDays = daysInMonth - completedDays;

    let cumulativeDone = 0;
    const progressSeries = dailyCounts.map(({ day, count }) => {
      cumulativeDone += count;
      const possibleUntilDay = habits.length * day;
      return {
        day,
        value: possibleUntilDay > 0 ? (cumulativeDone / possibleUntilDay) * 100 : 0,
      };
    });

    const weeklyStats = weekGroups.map((week) => {
      const done = week.days.reduce((total, { day }) => {
        return total + habits.reduce((habitTotal, habit) => habitTotal + (habit.completions[String(day)] ? 1 : 0), 0);
      }, 0);
      const possible = habits.length * week.days.length;

      return {
        ...week,
        done,
        possible,
        progress: possible > 0 ? (done / possible) * 100 : 0,
      };
    });

    const topHabits = habits
      .map((habit) => {
        const completed = days.reduce((total, { day }) => total + (habit.completions[String(day)] ? 1 : 0), 0);
        return {
          ...habit,
          completed,
          percent: daysInMonth > 0 ? (completed / daysInMonth) * 100 : 0,
        };
      })
      .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, "fr"))
      .slice(0, 10);

    return {
      dailyCounts,
      totalDone,
      totalPossible,
      monthlyProgress,
      completedDays,
      remainingDays,
      progressSeries,
      weeklyStats,
      topHabits,
    };
  }, [days, daysInMonth, habits, weekGroups]);

  const lineChart = useMemo(() => {
    const width = 720;
    const height = 190;
    const padding = 22;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const divisor = Math.max(stats.progressSeries.length - 1, 1);

    const points = stats.progressSeries.map((point, index) => {
      const x = padding + (index / divisor) * plotWidth;
      const y = padding + (1 - point.value / 100) * plotHeight;
      return { x, y, ...point };
    });

    const pointString = points.map(({ x, y }) => `${x},${y}`).join(" ");
    const areaPath = points.length
      ? `M ${points[0].x} ${height - padding} L ${points.map(({ x, y }) => `${x} ${y}`).join(" L ")} L ${points[points.length - 1].x} ${height - padding} Z`
      : "";

    return { width, height, padding, points, pointString, areaPath };
  }, [stats.progressSeries]);

  function ensureMonth(target: MonthSelection, sourceKey = monthKey) {
    const normalized = clampMonth(target.year, target.month);
    const targetKey = getMonthKey(normalized.year, normalized.month);

    setStoredData((current) => {
      if (current[targetKey]) {
        return current;
      }

      return {
        ...current,
        [targetKey]: cloneHabitsForNewMonth(current[sourceKey] ?? habits, normalized.year, normalized.month),
      };
    });
    setSelection(normalized);
  }

  function updateHabit(habitId: string, updates: Partial<Pick<Habit, "name" | "goal">>) {
    setStoredData((current) => ({
      ...current,
      [monthKey]: (current[monthKey] ?? []).map((habit) =>
        habit.id === habitId ? { ...habit, ...updates } : habit,
      ),
    }));
  }

  function toggleCompletion(habitId: string, day: number) {
    setStoredData((current) => ({
      ...current,
      [monthKey]: (current[monthKey] ?? []).map((habit) => {
        if (habit.id !== habitId) {
          return habit;
        }

        const key = String(day);
        return {
          ...habit,
          completions: {
            ...habit.completions,
            [key]: !habit.completions[key],
          },
        };
      }),
    }));
  }

  function deleteHabit(habitId: string) {
    setStoredData((current) => ({
      ...current,
      [monthKey]: (current[monthKey] ?? []).filter((habit) => habit.id !== habitId),
    }));
  }

  function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newHabitName.trim();
    const goal = newHabitGoal.trim() || "A";

    if (!name || habits.length >= 30) {
      return;
    }

    const habit: Habit = {
      id: createId(),
      name,
      goal,
      completions: {},
    };

    setStoredData((current) => ({
      ...current,
      [monthKey]: [...(current[monthKey] ?? []), habit],
    }));
    setNewHabitName("");
    setNewHabitGoal("");
  }

  async function handleLicenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedKey = licenseInput.trim().toUpperCase();

    if (!normalizedKey) {
      setLicenseMessage("Veuillez saisir une clé de licence.");
      return;
    }

    const hash = await sha256(normalizedKey);
    const record = licenseStore[hash];

    if (!record) {
      setLicenseMessage("Clé invalide. Vérifiez le format ou contactez l'administrateur.");
      return;
    }

    setLicenseStore((current) => ({
      ...current,
      [hash]: {
        ...current[hash],
        usedAt: current[hash]?.usedAt ?? new Date().toISOString(),
      },
    }));
    window.localStorage.setItem(LICENSE_ACCESS_KEY, "true");
    setHasPermanentAccess(true);
    setLicenseInput("");
    setLicenseMessage("Licence validée. Votre accès est désormais définitif sur cet appareil.");
  }

  function handleAdminLogout() {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminUnlocked(false);
    setAdminPassword("");
    setAdminMessage("Session admin fermée.");
  }

  function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (adminPassword === ADMIN_PASSWORD) {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      setAdminUnlocked(true);
      setAdminPassword("");
      setAdminMessage("Accès admin validé.");
      return;
    }

    setAdminMessage("Mot de passe incorrect. Respectez la casse exacte.");
  }

  async function generateLicenseBatch() {
    setIsGeneratingLicenses(true);
    setAdminMessage("Génération des clés en cours...");

    const keys = new Set<string>();
    while (keys.size < LICENSE_COUNT) {
      keys.add(generateLicenseKey());
    }

    const now = new Date().toISOString();
    const entries = await Promise.all(
      Array.from(keys).map(async (key) => [await sha256(key), { createdAt: now }] as const),
    );

    setLicenseStore((current) => ({
      ...current,
      ...Object.fromEntries(entries),
    }));
    setLastGeneratedKeys(Array.from(keys));
    setAdminMessage(`${LICENSE_COUNT} clés licence ont été générées et ajoutées au coffre local.`);
    setIsGeneratingLicenses(false);
  }

  function downloadLastLicenseCsv() {
    if (lastGeneratedKeys.length === 0) {
      setAdminMessage("Générez d'abord un lot de clés avant de télécharger le CSV.");
      return;
    }

    downloadCsv(`licences-habitudes-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["cle_licence", "type_acces", "duree"],
      ...lastGeneratedKeys.map((key) => [key, "definitif", "illimitee"]),
    ]);
  }

  function downloadLicenseAuditCsv() {
    const rows = Object.entries(licenseStore).map(([hash, record]) => [
      hash,
      record.createdAt,
      record.usedAt ?? "non utilisee",
    ]);

    downloadCsv(`audit-licences-habitudes-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["hash_sha256", "cree_le", "utilisee_le"],
      ...rows,
    ]);
  }

  const monthTitle = `${monthNames[selection.month]} ${selection.year}`;
  const progressDegrees = Math.max(0, Math.min(100, stats.monthlyProgress)) * 3.6;
  const nameColumnWidth = 260;
  const goalColumnWidth = 150;
  const dayColumnWidth = 48;
  const tableMinWidth = nameColumnWidth + goalColumnWidth + daysInMonth * dayColumnWidth + 196;

  if (route === "admin") {
    return (
      <AdminPage
        adminPassword={adminPassword}
        adminUnlocked={adminUnlocked}
        adminMessage={adminMessage}
        isGeneratingLicenses={isGeneratingLicenses}
        licenseCount={Object.keys(licenseStore).length}
        usedLicenseCount={Object.values(licenseStore).filter((record) => record.usedAt).length}
        lastGeneratedCount={lastGeneratedKeys.length}
        onAdminPasswordChange={setAdminPassword}
        onLogin={handleAdminLogin}
        onLogout={handleAdminLogout}
        onGenerate={generateLicenseBatch}
        onDownloadLast={downloadLastLicenseCsv}
        onDownloadAudit={downloadLicenseAuditCsv}
      />
    );
  }

  if (!hasPermanentAccess) {
    return (
      <LicenseGate
        licenseInput={licenseInput}
        licenseMessage={licenseMessage}
        availableLicenseCount={Object.keys(licenseStore).length}
        onLicenseInputChange={setLicenseInput}
        onSubmit={handleLicenseSubmit}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-slate-900">
      <main className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(71,85,105,0.14)] backdrop-blur">
          <div className="grid gap-6 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
            <div className="flex min-h-[330px] flex-col justify-between rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-inner shadow-white/5 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.28em] text-rose-200">Suivi des habitudes</p>
                  <h1 className="mt-3 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">{monthTitle}</h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                    Tableau de bord mensuel avec progression automatique, vue hebdomadaire et grille de suivi quotidienne.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 p-1 text-sm backdrop-blur">
                  <button
                    type="button"
                    onClick={() => ensureMonth({ year: selection.year, month: selection.month - 1 })}
                    className="rounded-full px-3 py-2 text-slate-200 transition hover:bg-white/15 hover:text-white"
                    aria-label="Mois précédent"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => ensureMonth({ year: today.getFullYear(), month: today.getMonth() })}
                    className="rounded-full bg-white px-3 py-2 font-semibold text-slate-900 transition hover:bg-rose-100"
                  >
                    Aujourd'hui
                  </button>
                  <button
                    type="button"
                    onClick={() => ensureMonth({ year: selection.year, month: selection.month + 1 })}
                    className="rounded-full px-3 py-2 text-slate-200 transition hover:bg-white/15 hover:text-white"
                    aria-label="Mois suivant"
                  >
                    Suivant
                  </button>
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Kpi label="Terminé" value={stats.completedDays} detail="jours à 100 %" tone="text-emerald-200" />
                <Kpi label="Restant à faire" value={stats.remainingDays} detail="jours non finalisés" tone="text-amber-200" />
                <Kpi label="Nombre de jours" value={daysInMonth} detail={`${habits.length} habitudes suivies`} tone="text-blue-200" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-rows-[auto_1fr]">
              <div className="grid gap-4 sm:grid-cols-[190px_1fr]">
                <div className="flex items-center justify-center rounded-[1.5rem] bg-slate-50 p-5">
                  <div
                    className="relative grid h-36 w-36 place-items-center rounded-full transition-all duration-700 ease-out"
                    style={{
                      background: `conic-gradient(#8b5cf6 ${progressDegrees}deg, #e2e8f0 ${progressDegrees}deg)`,
                    }}
                    aria-label={`Progression globale ${formatPercent(stats.monthlyProgress)}`}
                  >
                    <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center shadow-inner">
                      <div>
                        <p className="text-3xl font-bold tracking-tight text-slate-950">{formatPercent(stats.monthlyProgress)}</p>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">global</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-slate-50 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Navigation rapide</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-600">
                      Mois
                      <select
                        value={selection.month}
                        onChange={(event) => ensureMonth({ year: selection.year, month: Number(event.target.value) })}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                      >
                        {monthNames.map((monthName, index) => (
                          <option key={monthName} value={index}>
                            {monthName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-600">
                      Année
                      <input
                        type="number"
                        min="2020"
                        max="2035"
                        value={selection.year}
                        onChange={(event) => ensureMonth({ year: Number(event.target.value), month: selection.month })}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                      />
                    </label>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    Chaque mois conserve ses propres coches dans le navigateur. La liste d'habitudes est recopiée automatiquement lors d'un nouveau mois.
                  </p>
                </div>
              </div>

              <section className="rounded-[1.5rem] bg-slate-50 p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950">Évolution du progrès global</h2>
                    <p className="text-sm text-slate-500">Courbe cumulée des habitudes accomplies sur le mois.</p>
                  </div>
                  <p className="text-sm font-semibold text-violet-700">{stats.totalDone} / {stats.totalPossible} cases cochées</p>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl bg-white">
                  <svg className="h-48 w-full" viewBox={`0 0 ${lineChart.width} ${lineChart.height}`} role="img" aria-label="Graphique linéaire du progrès mensuel">
                    <defs>
                      <linearGradient id="progressArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.36" />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    {[0, 25, 50, 75, 100].map((tick) => {
                      const y = lineChart.padding + (1 - tick / 100) * (lineChart.height - lineChart.padding * 2);
                      return (
                        <g key={tick}>
                          <line x1={lineChart.padding} x2={lineChart.width - lineChart.padding} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 8" />
                          <text x={lineChart.padding - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-medium">
                            {tick}%
                          </text>
                        </g>
                      );
                    })}
                    {lineChart.areaPath ? <path d={lineChart.areaPath} fill="url(#progressArea)" /> : null}
                    <polyline
                      points={lineChart.pointString}
                      fill="none"
                      stroke="#7c3aed"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="4"
                      className="drop-shadow-sm"
                    />
                    {lineChart.points.map((point, index) =>
                      index === lineChart.points.length - 1 || index % 5 === 0 ? (
                        <circle key={point.day} cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#7c3aed" strokeWidth="3" />
                      ) : null,
                    )}
                  </svg>
                </div>
              </section>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(71,85,105,0.10)] backdrop-blur lg:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Vue hebdomadaire</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Aperçu en 5 semaines</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-500">
              Les couleurs pastel séparent les semaines et se retrouvent dans la grille quotidienne.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {stats.weeklyStats.map((week) => (
              <article key={week.label} className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ background: `linear-gradient(180deg, ${week.palette.bg}, #ffffff 70%)` }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">{week.label}</h3>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: week.palette.text }}>
                      {formatPercent(week.progress)} accompli
                    </p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: week.palette.soft, color: week.palette.text }}>
                    {week.done}/{week.possible}
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/70">
                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${week.progress}%`, backgroundColor: week.palette.solid }} />
                </div>

                <div className="mt-4 grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-1 text-center text-xs">
                  <div className="text-left font-semibold text-slate-400">Jour</div>
                  {Array.from({ length: 7 }, (_, index) => {
                    const day = week.days[index];
                    return day ? (
                      <div key={day.day} className="rounded-lg bg-white/80 px-1 py-2 font-semibold text-slate-700">
                        <span className="block text-[10px] text-slate-400">{day.weekday}</span>
                        {day.day}
                      </div>
                    ) : (
                      <div key={`vide-${index}`} className="rounded-lg bg-white/40 px-1 py-2 text-slate-300">-</div>
                    );
                  })}

                  <div className="py-2 text-left font-semibold text-slate-500">Terminé</div>
                  {Array.from({ length: 7 }, (_, index) => {
                    const day = week.days[index];
                    const count = day ? stats.dailyCounts.find((entry) => entry.day === day.day)?.count ?? 0 : null;
                    return (
                      <div key={`done-${index}`} className="rounded-lg bg-white/70 px-1 py-2 font-bold text-slate-800">
                        {count ?? ""}
                      </div>
                    );
                  })}

                  <div className="py-2 text-left font-semibold text-slate-500">Semaine</div>
                  <div className="col-span-7 rounded-lg bg-white/70 px-2 py-2 text-left font-semibold text-slate-700">
                    Progrès hebdomadaire : <span style={{ color: week.palette.text }}>{formatPercent(week.progress)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(71,85,105,0.10)] backdrop-blur lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Top 10</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Habitudes les plus réussies</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">≥ 80 %</span>
            </div>

            <div className="mt-5 space-y-3">
              {stats.topHabits.length > 0 ? (
                stats.topHabits.map((habit, index) => {
                  const highlighted = habit.percent >= 80;
                  return (
                    <div key={habit.id} className={`group rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5 ${highlighted ? "border-emerald-200 bg-emerald-50/80" : "border-slate-100 bg-white"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${highlighted ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate font-semibold text-slate-900">{habit.name}</p>
                            <p className={`font-bold ${highlighted ? "text-emerald-700" : "text-slate-700"}`}>{formatPercent(habit.percent)}</p>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full transition-all duration-700 ${highlighted ? "bg-emerald-500" : "bg-violet-400"}`} style={{ width: `${habit.percent}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Ajoutez une habitude pour afficher le classement.</p>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(71,85,105,0.10)] backdrop-blur lg:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Personnalisation</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Ajouter une habitude</h2>
              </div>
              <p className="text-sm font-semibold text-slate-500">{habits.length}/30 habitudes</p>
            </div>

            <form onSubmit={addHabit} className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_auto]">
              <input
                type="text"
                value={newHabitName}
                onChange={(event) => setNewHabitName(event.target.value)}
                placeholder="Ex. Yoga du matin"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                maxLength={60}
              />
              <input
                type="text"
                value={newHabitGoal}
                onChange={(event) => setNewHabitGoal(event.target.value)}
                placeholder="Objectif A/B/C ou fréquence"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                maxLength={24}
              />
              <button
                type="submit"
                disabled={!newHabitName.trim() || habits.length >= 30}
                className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:translate-y-0"
              >
                Ajouter
              </button>
            </form>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              Modifiez directement les noms et objectifs dans la grille. Les coches, ajouts et suppressions sont sauvegardés automatiquement en local.
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-[0_18px_60px_rgba(71,85,105,0.12)] backdrop-blur lg:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Grille quotidienne</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Suivi détaillé des habitudes</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {weekPalette.map((palette, index) => (
                <span key={palette.name} className="rounded-full px-3 py-1" style={{ backgroundColor: palette.soft, color: palette.text }}>
                  S{index + 1}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white">
            <table className="border-separate border-spacing-0 text-sm" style={{ minWidth: tableMinWidth, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: nameColumnWidth }} />
                <col style={{ width: goalColumnWidth }} />
                {days.map(({ day }) => (
                  <col key={`col-jour-${day}`} style={{ width: dayColumnWidth }} />
                ))}
                <col style={{ width: 70 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 96 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky left-0 z-30 border-b border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-700" style={{ width: nameColumnWidth, minWidth: nameColumnWidth }}>Nom de l'habitude</th>
                  <th className="sticky z-30 border-b border-slate-200 bg-white px-3 py-3 text-left font-semibold text-slate-700" style={{ left: nameColumnWidth, width: goalColumnWidth, minWidth: goalColumnWidth }}>Objectif</th>
                  {days.map(({ day, weekday, weekIndex }) => (
                    <th key={day} className="w-12 border-b border-slate-200 px-2 py-3 text-center font-semibold" style={{ backgroundColor: weekPalette[weekIndex].soft, color: weekPalette[weekIndex].text }}>
                      <span className="block text-[10px] font-bold uppercase">{weekday}</span>
                      <span>{day}</span>
                    </th>
                  ))}
                  <th className="w-20 border-b border-slate-200 bg-white px-3 py-3 text-center font-semibold text-slate-700">Total</th>
                  <th className="w-20 border-b border-slate-200 bg-white px-3 py-3 text-center font-semibold text-slate-700">%</th>
                  <th className="w-24 border-b border-slate-200 bg-white px-3 py-3 text-center font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {habits.length > 0 ? (
                  habits.map((habit) => {
                    const total = days.reduce((sum, { day }) => sum + (habit.completions[String(day)] ? 1 : 0), 0);
                    const percent = daysInMonth > 0 ? (total / daysInMonth) * 100 : 0;

                    return (
                      <tr key={habit.id} className="group">
                        <td className="sticky left-0 z-20 border-b border-slate-100 bg-white px-3 py-2 shadow-[8px_0_18px_rgba(148,163,184,0.10)]" style={{ width: nameColumnWidth, minWidth: nameColumnWidth }}>
                          <input
                            type="text"
                            value={habit.name}
                            onChange={(event) => updateHabit(habit.id, { name: event.target.value })}
                            className="w-full rounded-xl border border-transparent bg-transparent px-2 py-2 font-semibold text-slate-900 outline-none transition group-hover:border-slate-200 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                            aria-label={`Nom de l'habitude ${habit.name}`}
                          />
                        </td>
                        <td className="sticky z-20 border-b border-slate-100 bg-white px-3 py-2 shadow-[8px_0_18px_rgba(148,163,184,0.08)]" style={{ left: nameColumnWidth, width: goalColumnWidth, minWidth: goalColumnWidth }}>
                          <input
                            type="text"
                            value={habit.goal}
                            onChange={(event) => updateHabit(habit.id, { goal: event.target.value })}
                            className="w-full rounded-xl border border-transparent bg-transparent px-2 py-2 text-slate-600 outline-none transition group-hover:border-slate-200 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                            aria-label={`Objectif de ${habit.name}`}
                          />
                        </td>
                        {days.map(({ day, weekIndex }) => {
                          const palette = weekPalette[weekIndex];
                          const checked = Boolean(habit.completions[String(day)]);
                          return (
                            <td key={`${habit.id}-${day}`} className="border-b border-slate-100 px-2 py-3 text-center" style={{ backgroundColor: palette.bg }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCompletion(habit.id, day)}
                                className="h-4 w-4 cursor-pointer rounded border-slate-300 transition duration-200 hover:scale-110"
                                style={{ accentColor: palette.solid }}
                                aria-label={`${habit.name}, jour ${day}`}
                              />
                            </td>
                          );
                        })}
                        <td className="border-b border-slate-100 bg-white px-3 py-3 text-center font-bold text-slate-800">{total}</td>
                        <td className="border-b border-slate-100 bg-white px-3 py-3 text-center">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${percent >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {formatPercent(percent)}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 bg-white px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => deleteHabit(habit.id)}
                            className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={days.length + 5} className="px-4 py-10 text-center text-slate-500">
                      Aucune habitude pour ce mois. Ajoutez une ligne pour commencer votre suivi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/15">
      <p className="text-sm font-medium text-slate-300">{label}</p>
      <p className={`mt-2 text-4xl font-bold tracking-tight ${tone}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{detail}</p>
    </div>
  );
}

function LicenseGate({
  licenseInput,
  licenseMessage,
  availableLicenseCount,
  onLicenseInputChange,
  onSubmit,
}: {
  licenseInput: string;
  licenseMessage: string;
  availableLicenseCount: number;
  onLicenseInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="min-h-screen bg-[#f7f3ee] px-4 py-8 text-slate-900">
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl place-items-center">
        <section className="grid w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_24px_80px_rgba(71,85,105,0.16)] backdrop-blur lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-8 text-white sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-rose-200">Licence requise</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Suivi des habitudes quotidiennes</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Entrez une clé licence valide une seule fois. Après validation, l'accès à l'application reste définitif sur cet appareil.
            </p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/10 p-5 text-sm leading-6 text-slate-200">
              Clés disponibles dans ce navigateur : <span className="font-bold text-white">{availableLicenseCount}</span>. Utilisez le lien admin pour générer et télécharger les licences CSV.
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Activer l'application</h2>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-slate-600">
                Clé licence
                <input
                  value={licenseInput}
                  onChange={(event) => onLicenseInputChange(event.target.value)}
                  placeholder="HAB-XXXXX-XXXXX-XXXXX-XXXXX"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </label>
              <button type="submit" className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-700">
                Valider la licence
              </button>
            </form>
            {licenseMessage ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">{licenseMessage}</p> : null}
            <a href="#admin" className="mt-6 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-violet-300 hover:text-violet-700">
              Accès admin
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function AdminPage({
  adminPassword,
  adminUnlocked,
  adminMessage,
  isGeneratingLicenses,
  licenseCount,
  usedLicenseCount,
  lastGeneratedCount,
  onAdminPasswordChange,
  onLogin,
  onLogout,
  onGenerate,
  onDownloadLast,
  onDownloadAudit,
}: {
  adminPassword: string;
  adminUnlocked: boolean;
  adminMessage: string;
  isGeneratingLicenses: boolean;
  licenseCount: number;
  usedLicenseCount: number;
  lastGeneratedCount: number;
  onAdminPasswordChange: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
  onGenerate: () => void;
  onDownloadLast: () => void;
  onDownloadAudit: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#f7f3ee] px-4 py-8 text-slate-900">
      <main className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-[0_24px_80px_rgba(71,85,105,0.16)] sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-rose-200">Administration</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Paramètres de l'application</h1>
              <p className="mt-4 max-w-2xl text-slate-300">Générez 5000 clés licence, téléchargez le fichier CSV et suivez les activations locales.</p>
            </div>
            <a href="#" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-100">
              Retour application
            </a>
          </div>
        </header>

        {!adminUnlocked ? (
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_18px_60px_rgba(71,85,105,0.10)] sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Connexion admin</h2>
            <form onSubmit={onLogin} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => onAdminPasswordChange(event.target.value)}
                placeholder="Mot de passe admin"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
              <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-violet-700">
                Se connecter
              </button>
            </form>
            {adminMessage ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">{adminMessage}</p> : null}
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(71,85,105,0.10)]">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Coffre licences</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">État actuel</h2>
              <div className="mt-6 grid gap-3">
                <AdminStat label="Licences stockées" value={licenseCount} />
                <AdminStat label="Licences utilisées" value={usedLicenseCount} />
                <AdminStat label="Dernier lot généré" value={lastGeneratedCount} />
              </div>
              {adminMessage ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">{adminMessage}</p> : null}
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(71,85,105,0.10)]">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Actions</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Générer et exporter</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={onGenerate} disabled={isGeneratingLicenses} className="rounded-2xl bg-slate-950 px-5 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-700 disabled:cursor-wait disabled:bg-slate-400">
                  {isGeneratingLicenses ? "Génération..." : `Générer ${LICENSE_COUNT} clés`}
                </button>
                <button type="button" onClick={onDownloadLast} className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 font-semibold text-violet-800 transition hover:-translate-y-0.5 hover:bg-violet-100">
                  Télécharger le dernier CSV
                </button>
                <button type="button" onClick={onDownloadAudit} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300">
                  Télécharger l'audit CSV
                </button>
                <button type="button" onClick={onLogout} className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100">
                  Fermer la session admin
                </button>
              </div>
              <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                Les clés en clair ne sont affichées qu'au moment de la génération et dans le CSV téléchargé. L'application conserve uniquement leurs empreintes SHA-256 dans le stockage local.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function AdminStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}