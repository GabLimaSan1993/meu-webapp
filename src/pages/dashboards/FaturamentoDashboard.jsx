// src/pages/dashboards/FaturamentoDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";
import {
  format,
  parseISO,
  startOfWeek,
  addDays,
  isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../../lib/supabaseClient";

/**
 * Ajuste aqui se seu campo de valor tiver outro nome.
 * Pelo que você mostrou, é "valor_total" e "data_emissao" (date).
 */
const VALUE_FIELD = "valor_total";
const DATE_FIELD = "data_emissao";

// labels meses
const MONTHS = [
  { k: 0, label: "Jan" },
  { k: 1, label: "Fev" },
  { k: 2, label: "Mar" },
  { k: 3, label: "Abr" },
  { k: 4, label: "Mai" },
  { k: 5, label: "Jun" },
  { k: 6, label: "Jul" },
  { k: 7, label: "Ago" },
  { k: 8, label: "Set" },
  { k: 9, label: "Out" },
  { k: 10, label: "Nov" },
  { k: 11, label: "Dez" },
];

// ===== helpers =====
function brl(n) {
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function num(n) {
  return Number(n || 0);
}
function safeStr(s) {
  return (s ?? "").toString().trim();
}
function parseDate(d) {
  if (!d) return null;
  try {
    return parseISO(String(d));
  } catch {
    return null;
  }
}
function groupAgg(items, keyFn, valueFn, qtyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    const v = valueFn(it);
    const q = qtyFn(it);

    const prev = m.get(k) || { total: 0, qty: 0 };
    prev.total += v;
    prev.qty += q;
    m.set(k, prev);
  }
  return m;
}
function topNFromMapAgg(map, n = 10) {
  return Array.from(map.entries())
    .map(([name, obj]) => ({
      name,
      total: obj.total,
      qty: obj.qty,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

// “Família” simples: 1ª palavra da descrição
function inferFamily(desc) {
  const d = safeStr(desc);
  if (!d) return "Sem família";
  const first = d.split(" ")[0];
  return first ? first.toUpperCase() : "Sem família";
}

// ✅ fetch com paginação
async function fetchAllFaturamentoRows({ projectId }) {
  const pageSize = 1000;
  let from = 0;
  let all = [];

  const columns = [
    "id",
    "projeto_id",
    "data_emissao",
    "valor_total",
    "razao_social",
    "nome_fantasia",
    "descricao",
    "cidade",
    "estado",
  ].join(",");

  while (true) {
    const { data, error } = await supabase
      .from("faturamento")
      .select(columns)
      .eq("projeto_id", projectId)
      .order("data_emissao", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const batch = data || [];
    all = all.concat(batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

// ===== labels nos pontos (dinheiro / quantidade) =====
function LinePointLabelMoney({ x, y, value }) {
  if (!value) return null;
  return (
    <text
      x={x}
      y={y - 10}
      fill="rgba(245, 198, 63, 0.95)"
      fontSize={12}
      textAnchor="middle"
      style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.65)", strokeWidth: 3 }}
    >
      {brl(value).replace("R$", "").trim()}
    </text>
  );
}

function LinePointLabelQty({ x, y, value }) {
  if (!value) return null;
  return (
    <text
      x={x}
      y={y + 18}
      fill="rgba(147, 197, 253, 0.95)"
      fontSize={12}
      textAnchor="middle"
      style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.65)", strokeWidth: 3 }}
    >
      {Number(value).toLocaleString("pt-BR")}
    </text>
  );
}

export default function FaturamentoDashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");

  const [rows, setRows] = useState([]);

  /**
   * view:
   * - "ano": barras por ano (default)
   * - "mes": linha mês-a-mês do ano selecionado
   * - "semana": linha dia-a-dia (do mês selecionado)
   */
  const [view, setView] = useState("ano");

  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // ===== Load projects =====
  useEffect(() => {
    let alive = true;

    async function loadProjects() {
      setErr("");
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        setErr("Você precisa estar logado.");
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("id,title")
        .or(`manager_id.eq.${user.id},consultant_to.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!alive) return;
      if (error) {
        console.error(error);
        setErr("Não foi possível carregar seus projetos.");
        return;
      }

      setProjects(data || []);
      if (!projectId && data?.length) setProjectId(data[0].id);
    }

    loadProjects();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Load faturamento rows when project changes =====
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!projectId) return;

      setLoading(true);
      setErr("");

      try {
        const all = await fetchAllFaturamentoRows({ projectId });

        if (!alive) return;
        setRows(all);

        // ano default = ano do max(date)
        const dates = all.map((r) => parseDate(r[DATE_FIELD])).filter(Boolean);
        if (dates.length) {
          const maxD = dates[dates.length - 1];
          setSelectedYear(maxD.getFullYear());
        } else {
          setSelectedYear(null);
        }

        setView("ano");
        setSelectedMonth(null);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || "Erro ao carregar dados do faturamento.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [projectId]);

  // ===== Derived ranges / available years =====
  const dateStats = useMemo(() => {
    const dates = rows.map((r) => parseDate(r[DATE_FIELD])).filter(Boolean);
    if (!dates.length) return { min: null, max: null };

    const min = dates[0];
    const max = dates[dates.length - 1];
    return { min, max };
  }, [rows]);

  const availableYears = useMemo(() => {
    if (!dateStats.min || !dateStats.max) return [];
    const ys = [];
    for (let y = dateStats.max.getFullYear(); y >= dateStats.min.getFullYear(); y--) {
      ys.push(y);
    }
    return ys;
  }, [dateStats]);

  const projectTitle = useMemo(() => {
    const p = projects.find((x) => x.id === projectId);
    return p?.title || "—";
  }, [projects, projectId]);

  // ===== Filtering logic based on view =====
  const filteredRows = useMemo(() => {
    if (!rows.length) return [];

    if (view === "ano") return rows;

    if (view === "mes") {
      if (!selectedYear) return [];
      return rows.filter((r) => {
        const d = parseDate(r[DATE_FIELD]);
        return d && d.getFullYear() === selectedYear;
      });
    }

    // ✅ "semana" aqui na prática será "diário do mês selecionado"
    if (view === "semana") {
      if (!selectedYear || selectedMonth == null) return [];
      return rows.filter((r) => {
        const d = parseDate(r[DATE_FIELD]);
        return d && d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      });
    }

    return rows;
  }, [rows, view, selectedYear, selectedMonth]);

  // ===== evolution (agora com total + volume) =====
  const evolutionData = useMemo(() => {
    if (!rows.length) return [];

    if (view === "ano") {
      // barras por ano (total + volume)
      const map = groupAgg(
        rows,
        (r) => {
          const d = parseDate(r[DATE_FIELD]);
          return d ? String(d.getFullYear()) : "Sem data";
        },
        (r) => num(r[VALUE_FIELD]),
        () => 1 // volume = quantidade de linhas
      );

      return Array.from(map.entries())
        .filter(([k]) => k !== "Sem data")
        .map(([year, obj]) => ({ label: year, total: obj.total, volume: obj.qty }))
        .sort((a, b) => Number(a.label) - Number(b.label));
    }

    if (view === "mes") {
      // linha por mês do ano selecionado
      const map = groupAgg(
        filteredRows,
        (r) => {
          const d = parseDate(r[DATE_FIELD]);
          return d ? d.getMonth() : -1;
        },
        (r) => num(r[VALUE_FIELD]),
        () => 1
      );

      const arr = [];
      for (let m = 0; m < 12; m++) {
        const obj = map.get(m) || { total: 0, qty: 0 };
        arr.push({
          label: MONTHS[m].label,
          monthIndex: m,
          total: obj.total,
          volume: obj.qty,
        });
      }
      return arr;
    }

    if (view === "semana") {
      // diário do mês selecionado (label = dd/MM)
      const totals = new Map(); // yyyy-mm-dd -> {total, qty}
      for (const r of filteredRows) {
        const d = parseDate(r[DATE_FIELD]);
        if (!d) continue;
        const iso = format(d, "yyyy-MM-dd");
        const prev = totals.get(iso) || { total: 0, qty: 0 };
        prev.total += num(r[VALUE_FIELD]);
        prev.qty += 1;
        totals.set(iso, prev);
      }

      const days = Array.from(totals.entries())
        .map(([iso, obj]) => {
          const d = parseISO(iso);
          return {
            label: format(d, "dd/MM", { locale: ptBR }),
            iso,
            total: obj.total,
            volume: obj.qty,
          };
        })
        .sort((a, b) => (a.iso > b.iso ? 1 : -1));

      return days;
    }

    return [];
  }, [rows, filteredRows, view]);

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const base = view === "ano" ? rows : filteredRows;

    const faturamento = base.reduce((acc, r) => acc + num(r[VALUE_FIELD]), 0);
    const notas = base.length;
    const ticket = notas ? faturamento / notas : 0;

    return { faturamento, notas, ticket };
  }, [rows, filteredRows, view]);

  // ===== monthsCount (para médias) =====
  const monthsCount = useMemo(() => {
    const base = view === "ano" ? rows : filteredRows;
    const set = new Set();
    for (const r of base) {
      const d = parseDate(r[DATE_FIELD]);
      if (!d) continue;
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return Math.max(1, set.size);
  }, [rows, filteredRows, view]);

  // ===== TOPs (agora com total + qty + media/mês) =====
  const topClients = useMemo(() => {
    const base = view === "ano" ? rows : filteredRows;

    // ✅ prioridade: nome_fantasia (como você pediu), depois razao_social
    const m = groupAgg(
      base,
      (r) =>
        safeStr(r.nome_fantasia) ||
        safeStr(r.razao_social) ||
        "Sem cliente",
      (r) => num(r[VALUE_FIELD]),
      () => 1
    );

    return topNFromMapAgg(m, 10);
  }, [rows, filteredRows, view]);

  const topProducts = useMemo(() => {
    const base = view === "ano" ? rows : filteredRows;

    const m = groupAgg(
      base,
      (r) => safeStr(r.descricao) || "Sem produto",
      (r) => num(r[VALUE_FIELD]),
      () => 1
    );

    return topNFromMapAgg(m, 10);
  }, [rows, filteredRows, view]);

  const byUF = useMemo(() => {
    const base = view === "ano" ? rows : filteredRows;

    const m = groupAgg(
      base,
      (r) => safeStr(r.estado) || "—",
      (r) => num(r[VALUE_FIELD]),
      () => 1
    );

    return topNFromMapAgg(m, 10);
  }, [rows, filteredRows, view]);

  const byFamily = useMemo(() => {
    const base = view === "ano" ? rows : filteredRows;

    const m = groupAgg(
      base,
      (r) => inferFamily(r.descricao),
      (r) => num(r[VALUE_FIELD]),
      () => 1
    );

    return topNFromMapAgg(m, 10);
  }, [rows, filteredRows, view]);

  // ===== Interactions =====
  function onPickYear(y) {
    setSelectedYear(y);
    setSelectedMonth(null);
    setView("mes");
  }

  function onPickMonth(mIndex) {
    setSelectedMonth(mIndex);
    // ✅ clicar no mês = abrir visão diária do mês
    setView("semana");
  }

  const evolutionTitle = useMemo(() => {
    if (view === "ano") return "Evolução (por ano)";
    if (view === "mes") return `Evolução (mês a mês — ${selectedYear || "—"})`;
    if (view === "semana") return `Evolução (por dia — ${MONTHS[selectedMonth ?? 0]?.label || "—"}/${selectedYear || "—"})`;
    return "Evolução";
  }, [view, selectedYear, selectedMonth]);

  // ===== UI =====
  return (
    <div style={page}>
      <header style={header}>
        <div>
          <h1 style={title}>
            Faturamento —{" "}
            <span style={{ color: "rgba(245, 198, 63, 0.95)" }}>{projectTitle}</span>
          </h1>
        </div>

        <div style={projectPickerWrap}>
          <div style={projectLabel}>Projeto</div>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={projectSelect}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </header>

      {err ? <div style={errorBox}>{err}</div> : null}

      <section style={filtersCard}>
        <div style={filtersGrid}>
          <div>
            <div style={filtersKicker}>ANO</div>
            <div style={chipsRow}>
              {availableYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => onPickYear(y)}
                  style={{ ...chip, ...(selectedYear === y ? chipActiveGold : null) }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={filtersKicker}>VISÃO</div>
            <div style={chipsRow}>
              <button
                type="button"
                onClick={() => setView("ano")}
                style={{ ...chip, ...(view === "ano" ? chipActiveGold : null) }}
              >
                Ano
              </button>
              <button
                type="button"
                onClick={() => setView("mes")}
                style={{ ...chip, ...(view === "mes" ? chipActiveGold : null) }}
              >
                Mês
              </button>
              <button
                type="button"
                onClick={() => setView("semana")}
                style={{ ...chip, ...(view === "semana" ? chipActiveGold : null) }}
              >
                Diário
              </button>
            </div>
          </div>
        </div>

        <div style={{ ...divider, margin: "14px 0" }} />

        <div>
          <div style={filtersKicker}>MESES</div>
          <div style={chipsRowWrap}>
            {MONTHS.map((m) => (
              <button
                key={m.k}
                type="button"
                onClick={() => onPickMonth(m.k)}
                style={{ ...chipSmall, ...(selectedMonth === m.k ? chipActiveSilver : null) }}
                disabled={!selectedYear}
                title={!selectedYear ? "Selecione um ano primeiro" : undefined}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section style={kpiGrid}>
        <div style={{ ...kpiCard, ...kpiGlowGold }}>
          <div style={kpiLabel}>Faturamento</div>
          <div style={kpiValue}>{brl(kpis.faturamento)}</div>
        </div>

        <div style={{ ...kpiCard, ...kpiGlowTeal }}>
          <div style={kpiLabel}>Notas</div>
          <div style={kpiValue}>{kpis.notas.toLocaleString("pt-BR")}</div>
        </div>

        <div style={{ ...kpiCard, ...kpiGlowPurple }}>
          <div style={kpiLabel}>Ticket Médio</div>
          <div style={kpiValue}>{brl(kpis.ticket)}</div>
        </div>
      </section>

      {/* EVOLUÇÃO */}
      <section style={bigCard}>
        <div style={bigTitleRow}>
          <h2 style={bigTitle}>{evolutionTitle}</h2>
          <div style={smallMeta}>
            {dateStats.min && dateStats.max ? (
              <>
                Período:{" "}
                <b>
                  {format(dateStats.min, "dd/MM/yyyy", { locale: ptBR })} –{" "}
                  {format(dateStats.max, "dd/MM/yyyy", { locale: ptBR })}
                </b>
              </>
            ) : (
              "Sem datas"
            )}
          </div>
        </div>

        <div style={{ height: 360 }}>
          {loading ? (
            <div style={loadingBox}>Carregando dashboard...</div>
          ) : view === "ano" ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolutionData} barCategoryGap={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(229,231,235,0.75)" }} />
                <YAxis
                  yAxisId="money"
                  tick={{ fill: "rgba(229,231,235,0.75)" }}
                  tickFormatter={(v) => brl(v).replace("R$", "").trim()}
                  width={72}
                />
                <YAxis
                  yAxisId="qty"
                  orientation="right"
                  tick={{ fill: "rgba(229,231,235,0.75)" }}
                  tickFormatter={(v) => Number(v).toLocaleString("pt-BR")}
                  width={60}
                />
                <Tooltip
                  formatter={(v, name) => (name === "volume" ? Number(v).toLocaleString("pt-BR") : brl(v))}
                  labelStyle={{ color: "#111" }}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Legend />
                <Bar
                  yAxisId="money"
                  dataKey="total"
                  name="Faturamento"
                  fill="rgba(245, 198, 63, 0.85)"
                  radius={[10, 10, 0, 0]}
                  onClick={(d) => {
                    const y = Number(d?.label);
                    if (!Number.isNaN(y)) onPickYear(y);
                  }}
                />
                <Bar
                  yAxisId="qty"
                  dataKey="volume"
                  name="Volume"
                  fill="rgba(147, 197, 253, 0.55)"
                  radius={[10, 10, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(229,231,235,0.75)" }} />
                <YAxis
                  yAxisId="money"
                  tick={{ fill: "rgba(229,231,235,0.75)" }}
                  tickFormatter={(v) => brl(v).replace("R$", "").trim()}
                  width={72}
                />
                <YAxis
                  yAxisId="qty"
                  orientation="right"
                  tick={{ fill: "rgba(229,231,235,0.75)" }}
                  tickFormatter={(v) => Number(v).toLocaleString("pt-BR")}
                  width={60}
                />
                <Tooltip
                  formatter={(v, name) => (name === "volume" ? Number(v).toLocaleString("pt-BR") : brl(v))}
                  labelStyle={{ color: "#111" }}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Legend />
                <Line
                  yAxisId="money"
                  type="monotone"
                  dataKey="total"
                  name="Faturamento"
                  stroke="rgba(245, 198, 63, 0.95)"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList content={<LinePointLabelMoney />} />
                </Line>

                <Line
                  yAxisId="qty"
                  type="monotone"
                  dataKey="volume"
                  name="Volume"
                  stroke="rgba(147, 197, 253, 0.95)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList content={<LinePointLabelQty />} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* TOPs */}
      <section style={grid2}>
        <div style={card}>
          <div style={cardTitle}>Top 10 Clientes</div>
          <MiniTable data={topClients} monthsCount={monthsCount} />
        </div>

        <div style={card}>
          <div style={cardTitle}>Top 10 Produtos</div>
          <MiniTable data={topProducts} monthsCount={monthsCount} />
        </div>

        <div style={card}>
          <div style={cardTitle}>Faturamento por UF</div>
          <MiniTable data={byUF} monthsCount={monthsCount} />
        </div>

        <div style={card}>
          <div style={cardTitle}>Faturamento por Família (aprox.)</div>
          <MiniTable data={byFamily} monthsCount={monthsCount} />
        </div>
      </section>
    </div>
  );
}

/**
 * ✅ MiniTable com:
 * - header com mesma altura da linha (minHeight 54)
 * - setinhas (ordenar) por coluna, sem dropdown
 * - colunas: Item | Total | Média/Mês | Qtd/Mês
 */
function MiniTable({ data, monthsCount }) {
  const [sortKey, setSortKey] = useState("total"); // total | avgMoney | avgQty
  const [sortDir, setSortDir] = useState("desc"); // asc | desc

  const rows = useMemo(() => {
    const base = (data || []).map((r) => ({
      ...r,
      avgMoney: (r.total || 0) / Math.max(1, monthsCount || 1),
      avgQty: (r.qty || 0) / Math.max(1, monthsCount || 1),
    }));

    const dir = sortDir === "asc" ? 1 : -1;

    return base.sort((a, b) => {
      const va = Number(a[sortKey] || 0);
      const vb = Number(b[sortKey] || 0);
      return va > vb ? dir : va < vb ? -dir : 0;
    });
  }, [data, monthsCount, sortKey, sortDir]);

  function toggleSort(nextKey) {
    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDir("desc");
      return;
    }
    setSortDir((d) => (d === "desc" ? "asc" : "desc"));
  }

  const Arrow = ({ active, dir }) => (
    <span style={{ marginLeft: 8, opacity: active ? 1 : 0.35, fontSize: 12 }}>
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );

  return (
    <div style={miniTable}>
      {/* ✅ header compacto (mesma altura da linha) */}
      <div style={miniHeader}>
        <div style={{ ...miniCell, justifyContent: "flex-start", fontWeight: 900 }}>
          Item
        </div>

        <button type="button" onClick={() => toggleSort("total")} style={miniHeadBtn}>
          Total
          <Arrow active={sortKey === "total"} dir={sortDir} />
        </button>

        <button type="button" onClick={() => toggleSort("avgMoney")} style={miniHeadBtn}>
          Média/Mês
          <Arrow active={sortKey === "avgMoney"} dir={sortDir} />
        </button>

        <button type="button" onClick={() => toggleSort("avgQty")} style={miniHeadBtn}>
          Qtd/Mês
          <Arrow active={sortKey === "avgQty"} dir={sortDir} />
        </button>
      </div>

      {/* linhas */}
      {rows?.length ? (
        rows.map((r, idx) => (
          <div key={idx} style={miniRow}>
            <div style={miniName} title={r.name}>
              {r.name}
            </div>

            <div style={miniValueGold}>{brl(r.total)}</div>

            <div style={miniValueSoft}>{brl(r.avgMoney)}</div>

            <div style={miniValueQty}>{Number(r.avgQty).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</div>
          </div>
        ))
      ) : (
        <div style={miniEmpty}>Sem dados.</div>
      )}
    </div>
  );
}

/* =======================
   ESTILO (preto + dourado)
======================= */

const page = {
  minHeight: "100%",
  padding: "0.5rem 0.2rem",
  color: "#e5e7eb",
};

const header = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: "1rem",
};

const title = {
  margin: 0,
  fontSize: "2.15rem",
  fontWeight: 850,
  letterSpacing: "0.01em",
};

const projectPickerWrap = { display: "flex", alignItems: "center", gap: 12 };
const projectLabel = { fontSize: "0.9rem", color: "rgba(229,231,235,0.7)" };
const projectSelect = {
  padding: "0.65rem 0.8rem",
  borderRadius: "0.95rem",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "#0b0b0b",
  color: "#f9fafb",
  fontSize: "1rem",
  outline: "none",
};

const errorBox = {
  fontSize: "0.92rem",
  color: "#fecaca",
  backgroundColor: "rgba(127,29,29,0.25)",
  border: "1px solid rgba(239,68,68,0.35)",
  padding: "0.7rem 0.85rem",
  borderRadius: "0.9rem",
  marginBottom: "1rem",
};

const filtersCard = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "1.2rem",
  padding: "1rem",
  boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
  marginBottom: "1rem",
};

const filtersGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
  gap: "1rem",
  alignItems: "center",
};

const filtersKicker = {
  fontSize: "0.78rem",
  color: "rgba(229,231,235,0.55)",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  marginBottom: "0.55rem",
};

const chipsRow = { display: "flex", gap: 10, flexWrap: "wrap" };
const chipsRowWrap = { display: "flex", gap: 10, flexWrap: "wrap" };

const chip = {
  padding: "0.55rem 0.9rem",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.35)",
  color: "#f9fafb",
  cursor: "pointer",
  fontWeight: 700,
};

const chipSmall = {
  padding: "0.45rem 0.75rem",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.35)",
  color: "#f9fafb",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "0.92rem",
};

const chipActiveGold = {
  border: "1px solid rgba(245, 198, 63, 0.65)",
  background: "linear-gradient(135deg, rgba(245, 198, 63, 0.18), rgba(255,255,255,0.06))",
  boxShadow: "0 10px 24px rgba(245,198,63,0.10)",
};

const chipActiveSilver = {
  border: "1px solid rgba(209,213,219,0.55)",
  background: "linear-gradient(135deg, rgba(209,213,219,0.14), rgba(255,255,255,0.05))",
  boxShadow: "0 10px 24px rgba(209,213,219,0.10)",
};

const divider = { height: 1, background: "rgba(255,255,255,0.08)" };

const kpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "1rem",
  marginBottom: "1rem",
};

const kpiCard = {
  position: "relative",
  borderRadius: "1.2rem",
  padding: "1rem",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
  overflow: "hidden",
};

const kpiGlowGold = {
  background:
    "radial-gradient(800px 280px at 18% 30%, rgba(245,198,63,0.20), rgba(0,0,0,0.35))",
};

const kpiGlowTeal = {
  background:
    "radial-gradient(800px 280px at 18% 30%, rgba(45,212,191,0.18), rgba(0,0,0,0.35))",
};

const kpiGlowPurple = {
  background:
    "radial-gradient(800px 280px at 18% 30%, rgba(167,139,250,0.18), rgba(0,0,0,0.35))",
};

const kpiLabel = { color: "rgba(229,231,235,0.7)", fontSize: "0.95rem" };
const kpiValue = { marginTop: 8, fontSize: "2.0rem", fontWeight: 850 };

const bigCard = {
  borderRadius: "1.2rem",
  padding: "1rem",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
  marginBottom: "1rem",
};

const bigTitleRow = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: 10,
};

const bigTitle = { margin: 0, fontSize: "1.6rem", fontWeight: 850 };
const smallMeta = { color: "rgba(229,231,235,0.6)", fontSize: "0.92rem" };

const loadingBox = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  color: "rgba(229,231,235,0.65)",
  padding: "0.6rem",
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "1rem",
};

const card = {
  borderRadius: "1.2rem",
  padding: "1rem",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
};

const cardTitle = { fontSize: "1.05rem", fontWeight: 800, marginBottom: 10 };

/* ✅ MINI TABLE (correção do seu problema) */
const miniTable = { display: "flex", flexDirection: "column", gap: 8 };

/**
 * ✅ miniHeader e miniRow com a MESMA “altura visual”
 * - ambos com minHeight: 54
 * - padding igual
 */
const miniHeader = {
  display: "grid",
  gridTemplateColumns: "minmax(150px, 1fr) 170px 170px 130px",
  gap: 10,
  alignItems: "center",
  padding: "0.55rem 0.7rem",
  minHeight: 54,
  borderRadius: "0.9rem",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.35)",
};

const miniRow = {
  display: "grid",
  gridTemplateColumns: "minmax(150px, 1fr) 170px 170px 130px",
  gap: 10,
  alignItems: "center",
  padding: "0.55rem 0.7rem",
  minHeight: 54,
  borderRadius: "0.9rem",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.35)",
};

const miniCell = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(229,231,235,0.9)",
};

const miniHeadBtn = {
  appearance: "none",
  border: "none",
  background: "transparent",
  color: "rgba(229,231,235,0.92)",
  fontWeight: 900,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const miniName = {
  color: "rgba(229,231,235,0.95)",
  fontWeight: 900,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  paddingRight: 8,
};

const miniValueGold = { fontWeight: 900, color: "rgba(245, 198, 63, 0.92)", textAlign: "center" };
const miniValueSoft = { fontWeight: 800, color: "rgba(229,231,235,0.88)", textAlign: "center" };
const miniValueQty = { fontWeight: 900, color: "rgba(147, 197, 253, 0.92)", textAlign: "center" };

const miniEmpty = { color: "rgba(229,231,235,0.6)" };
