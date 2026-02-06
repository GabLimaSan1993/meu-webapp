// src/pages/dashboards/DisponibilidadeMPDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
  Customized,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../../lib/supabaseClient";

/* =========================
   Helpers
========================= */
function brl(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function pctFromDecimal(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,00%";
  return (
    (n * 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "%"
  );
}
function pctShort(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n * 100)}%`;
}
function toISO(d) {
  if (!d) return null;
  if (typeof d === "string") {
    const s = d.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
        dt.getDate()
      ).padStart(2, "0")}`;
    }
    return null;
  }
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }
  return null;
}
function capMonthName(s) {
  const str = String(s || "");
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function safeKey(s) {
  return String(s ?? "").replace(/\s+/g, "_");
}
function isoYear(iso) {
  return iso ? String(iso).slice(0, 4) : "";
}
function isoMonthKey(iso) {
  return iso ? String(iso).slice(0, 7) : ""; // yyyy-MM
}
function monthLabelFromKey(monthKey) {
  if (!monthKey || monthKey.length !== 7) return "—";
  const iso = `${monthKey}-01`;
  try {
    const d = parseISO(iso);
    return capMonthName(format(d, "MMMM", { locale: ptBR }));
  } catch {
    return "—";
  }
}

/* label nos pontos (percentuais) */
function PointLabelPct({ x, y, value }) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  return (
    <text
      x={x}
      y={y - 10}
      fill="rgba(229,231,235,0.92)"
      fontSize={11}
      textAnchor="middle"
      style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.70)", strokeWidth: 3 }}
    >
      {pctShort(n)}
    </text>
  );
}

/* =========================
   Regras de Cálculo (DIÁRIO)
========================= */
function calcDisponibilidadeBase(r) {
  // disponibilidade (BASE) = disponibilidade + saldo_anterior
  return num(r?.disponibilidade) + num(r?.saldo_anterior);
}

function calcMpPrevTotDia(r) {
  // MP Prev (TOT) = (MP Prev % * disponibilidade_base) + captacao_fomento
  const dispBase = calcDisponibilidadeBase(r);
  const mpPct = num(r?.mp_prevista_percent); // decimal
  const capt = num(r?.captacao_fomento);
  return mpPct * dispBase + capt;
}

function calcRealizTotDia(r) {
  // Realiz (TOT) = realizado_mp + amortizacao_fom
  return num(r?.realizado_mp) + num(r?.amortizacao_fom);
}

function calcRealMpPctDia(r) {
  // Real MP % = (realizado_mp + amortizacao_fom - captacao_fomento - reserva_mp - saldo_anterior) / disponibilidade_base
  const dispBase = calcDisponibilidadeBase(r);
  if (!dispBase) return 0;

  const numer =
    num(r?.realizado_mp) +
    num(r?.amortizacao_fom) -
    num(r?.captacao_fomento) -
    num(r?.reserva_mp) -
    num(r?.saldo_anterior);

  return numer / dispBase;
}

function calcSaldoDia(r) {
  // saldo = (realizado_mp + amortizacao_fom) - mp_prevista_tot
  return calcRealizTotDia(r) - calcMpPrevTotDia(r);
}

/* =========================
   TOTALIZADOR (SEMANA / MÊS / ANO)
========================= */
function aggregateTotals(periodRows) {
  const rows = (periodRows || []).filter((r) => r && r.__data_iso);

  const totDispBase = rows.reduce((acc, r) => acc + calcDisponibilidadeBase(r), 0);
  const totCapt = rows.reduce((acc, r) => acc + num(r.captacao_fomento), 0);
  const totAmort = rows.reduce((acc, r) => acc + num(r.amortizacao_fom), 0);
  const totRealiz = rows.reduce((acc, r) => acc + calcRealizTotDia(r), 0);
  const totMpPrevTot = rows.reduce((acc, r) => acc + calcMpPrevTotDia(r), 0);

  // mpPrevTot = mpPct*dispBase + capt  => mpPct = (mpPrevTot - capt)/dispBase
  const mpPrevPctAgg = totDispBase ? (totMpPrevTot - totCapt) / totDispBase : 0;

  const realNumerSum = rows.reduce((acc, r) => {
    return (
      acc +
      (num(r.realizado_mp) +
        num(r.amortizacao_fom) -
        num(r.captacao_fomento) -
        num(r.reserva_mp) -
        num(r.saldo_anterior))
    );
  }, 0);

  const realMpPctAgg = totDispBase ? realNumerSum / totDispBase : 0;
  const saldoAgg = totRealiz - totMpPrevTot;

  return {
    totDispBase,
    totCapt,
    totMpPrevTot,
    totAmort,
    totRealiz,
    mpPrevPctAgg,
    realMpPctAgg,
    saldoAgg,
  };
}

/* =========================
   Agrupadores (mês -> semana -> dia)
========================= */
function buildGroups(rows) {
  const byMonth = new Map();

  for (const r of rows) {
    if (!r.__data_iso) continue;

    const d = parseISO(r.__data_iso);
    const monthKey = format(d, "yyyy-MM");
    const monthLabel = capMonthName(format(d, "MMMM", { locale: ptBR }));
    const yearLabel = format(d, "yyyy");
    const monthTitle = `${monthLabel} ${yearLabel}`;

    const week = r.semana ?? "—";
    const weekKey = `${monthKey}::${safeKey(week)}`;

    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, {
        monthKey,
        monthTitle,
        rows: [],
        weeks: new Map(),
      });
    }

    const m = byMonth.get(monthKey);
    m.rows.push(r);

    if (!m.weeks.has(weekKey)) {
      m.weeks.set(weekKey, { weekKey, week, rows: [] });
    }
    m.weeks.get(weekKey).rows.push(r);
  }

  const months = Array.from(byMonth.values());

  for (const m of months) {
    const ws = Array.from(m.weeks.values());
    ws.sort((a, b) => {
      const na = Number(a.week);
      const nb = Number(b.week);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a.week).localeCompare(String(b.week));
    });
    m.weeksArr = ws;
  }

  return months;
}

/* =========================
   Área hachurada (Percentuais)
   ✅ desenha por "seções" e fecha em interseções (para nunca ficar “sem pintar”)
========================= */
function DiffFillHatched({ data, xAxisMap, yAxisMap, offset, clipPathId }) {
  if (!data?.length) return null;

  const xAxis = xAxisMap?.[Object.keys(xAxisMap || {})[0]];
  const yAxis = yAxisMap?.[Object.keys(yAxisMap || {})[0]];
  if (!xAxis?.scale || !yAxis?.scale) return null;

  const xScale = xAxis.scale;
  const yScale = yAxis.scale;

  const left = offset?.left ?? 0;
  const top = offset?.top ?? 0;

  // Se for band scale (categorical), centraliza no meio do “band”
  const bw = typeof xScale.bandwidth === "function" ? xScale.bandwidth() : 0;

  const getX = (iso) => {
    const x0 = xScale(iso);
    if (x0 === undefined || x0 === null) return null;
    return left + x0 + bw / 2;
  };
  const getY = (val) => top + yScale(val);

  const pts = data
    .map((d) => {
      const x = getX(d.iso);
      if (x === null) return null;
      const prev = num(d.mp_prevista_percent);
      const real = num(d.real_mp_percent_calc);
      return { x, prev, real, sign: real - prev };
    })
    .filter(Boolean);

  if (pts.length < 2) return null;

  // separa em segmentos contínuos por sinal, mas corta na interseção quando cruza
  const segments = [];
  let cur = [pts[0]];

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];

    // se ambos do mesmo lado (ou colado), segue
    if (a.sign === 0 || b.sign === 0 || (a.sign > 0 && b.sign > 0) || (a.sign < 0 && b.sign < 0)) {
      cur.push(b);
      continue;
    }

    // cruzou: calcula interseção por interpolação linear no eixo X
    const denom = (b.real - b.prev) - (a.real - a.prev);
    const t = denom !== 0 ? (0 - (a.real - a.prev)) / denom : 0.5; // fallback

    const xCross = a.x + (b.x - a.x) * t;
    const prevCross = a.prev + (b.prev - a.prev) * t;
    const realCross = prevCross; // no cruzamento, iguais

    const cross = { x: xCross, prev: prevCross, real: realCross, sign: 0 };

    // fecha o segmento atual no cross
    cur.push(cross);
    segments.push(cur);

    // abre próximo segmento começando no cross
    cur = [cross, b];
  }
  if (cur.length >= 2) segments.push(cur);

  const polys = segments
    .filter((seg) => seg.length >= 2)
    .map((seg, idx) => {
      // decide a cor pelo “meio” do segmento
      const mid = seg[Math.floor(seg.length / 2)];
      const fill = mid.real >= mid.prev ? "url(#hatchGreen)" : "url(#hatchRed)";

      // monta polígono: linha prev (ida) + linha real (volta)
      const topLine = seg.map((p) => `${p.x},${getY(p.prev)}`).join(" ");
      const bottomLine = seg
        .slice()
        .reverse()
        .map((p) => `${p.x},${getY(p.real)}`)
        .join(" ");

      const points = `${topLine} ${bottomLine}`;

      return (
        <polygon
          key={`diff-${idx}`}
          points={points}
          fill={fill}
          opacity={1}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      );
    });

  return <g clipPath={clipPathId ? `url(#${clipPathId})` : undefined}>{polys}</g>;
}

export default function DisponibilidadeMPDashboard() {
  const [user, setUser] = useState(null);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const projectTitle = useMemo(
    () => projects.find((p) => p.id === projectId)?.title || "—",
    [projects, projectId]
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ✅ removido "evolucao"
  const [analysis, setAnalysis] = useState("tabela"); // tabela | percentuais

  const [expandedMonths, setExpandedMonths] = useState(() => new Set());
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set());

  const [monthSortAsc, setMonthSortAsc] = useState(true);

  // filtros Percentuais (Ano / Mês / Semana)
  const [yearSel, setYearSel] = useState("__ALL__");
  const [monthSel, setMonthSel] = useState("__ALL__");
  const [weekSel, setWeekSel] = useState("__ALL__");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  // projetos do user
  useEffect(() => {
    if (!user) return;

    (async () => {
      setErr("");
      const { data, error } = await supabase
        .from("projects")
        .select("id,title")
        .or(`manager_id.eq.${user.id},consultant_to.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setErr("Não foi possível carregar seus projetos.");
        return;
      }

      setProjects(data || []);
      if (!projectId && data?.length) setProjectId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // carregar dados
  useEffect(() => {
    if (!projectId) return;

    (async () => {
      setLoading(true);
      setErr("");
      setRows([]);
      setYearSel("__ALL__");
      setMonthSel("__ALL__");
      setWeekSel("__ALL__");

      try {
        const { data, error } = await supabase
          .from("disp_mp_v1")
          .select(
            `
            id, projeto_id,
            data, semana,
            saldo_anterior, disponibilidade,
            mp_prevista_percent,
            captacao_fomento, reserva_mp,
            realizado_mp, amortizacao_fom,
            created_at
          `
          )
          .eq("projeto_id", projectId)
          .order("data", { ascending: true })
          .limit(20000);

        if (error) throw error;

        const norm = (data || []).map((r) => ({
          ...r,
          __data_iso: toISO(r.data),
        }));

        setRows(norm);

        // auto-expand último mês + últimas 2 semanas
        const rowsAsc = norm
          .filter((r) => r.__data_iso)
          .slice()
          .sort((a, b) => (a.__data_iso > b.__data_iso ? 1 : -1));

        const months = buildGroups(rowsAsc);
        if (months.length) {
          const newestMonthKey = months
            .map((m) => m.monthKey)
            .sort((a, b) => (a < b ? 1 : -1))[0];

          if (newestMonthKey) {
            setExpandedMonths((prev) => {
              const next = new Set(prev);
              next.add(newestMonthKey);
              return next;
            });

            const newestMonth = months.find((m) => m.monthKey === newestMonthKey);
            const w = newestMonth?.weeksArr || [];
            const lastTwo = w.slice(Math.max(0, w.length - 2));

            setExpandedWeeks((prev) => {
              const next = new Set(prev);
              for (const wk of lastTwo) next.add(wk.weekKey);
              return next;
            });
          }
        }
      } catch (e) {
        console.error(e);
        setErr(e?.message || "Erro ao consultar disp_mp_v1.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const rowsByDateAsc = useMemo(() => {
    return rows
      .filter((r) => r.__data_iso)
      .slice()
      .sort((a, b) => (a.__data_iso > b.__data_iso ? 1 : -1));
  }, [rows]);

  // opções Ano / Mês
  const yearOptions = useMemo(() => {
    const set = new Set();
    for (const r of rowsByDateAsc) set.add(isoYear(r.__data_iso));
    const arr = Array.from(set).filter(Boolean);
    arr.sort((a, b) => (a > b ? 1 : -1));
    return arr;
  }, [rowsByDateAsc]);

  const monthOptionsForYear = useMemo(() => {
    const set = new Set();
    for (const r of rowsByDateAsc) {
      const y = isoYear(r.__data_iso);
      if (yearSel !== "__ALL__" && y !== yearSel) continue;
      set.add(isoMonthKey(r.__data_iso));
    }
    const arr = Array.from(set).filter(Boolean);
    arr.sort((a, b) => (a > b ? 1 : -1));
    return arr;
  }, [rowsByDateAsc, yearSel]);

  // opções Semana (aparece quando escolher Mês; também respeita Ano)
  const weekOptionsForYearMonth = useMemo(() => {
    if (monthSel === "__ALL__") return [];
    const set = new Set();

    for (const r of rowsByDateAsc) {
      const y = isoYear(r.__data_iso);
      const mk = isoMonthKey(r.__data_iso);

      if (yearSel !== "__ALL__" && y !== yearSel) continue;
      if (mk !== monthSel) continue;

      const w = r.semana ?? null;
      if (w !== null && w !== undefined && String(w).trim() !== "") set.add(String(w));
    }

    const arr = Array.from(set);
    arr.sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
    return arr;
  }, [rowsByDateAsc, yearSel, monthSel]);

  // KPIs (última linha do dataset)
  const kpis = useMemo(() => {
    const totalLinhas = rowsByDateAsc.length;
    const last = totalLinhas ? rowsByDateAsc[totalLinhas - 1] : null;

    return {
      linhas: totalLinhas,
      disponibilidadeBase: calcDisponibilidadeBase(last),
      mpPrevTot: calcMpPrevTotDia(last),
      realizTot: calcRealizTotDia(last),
      saldo: calcSaldoDia(last),
    };
  }, [rowsByDateAsc]);

  const monthGroups = useMemo(() => {
    const months = buildGroups(rowsByDateAsc);
    months.sort((a, b) => {
      if (monthSortAsc) return a.monthKey > b.monthKey ? 1 : -1;
      return a.monthKey < b.monthKey ? 1 : -1;
    });
    return months;
  }, [rowsByDateAsc, monthSortAsc]);

  // series Percentuais com filtro Ano/Mês/Semana
  const seriesPercent = useMemo(() => {
    let base = rowsByDateAsc;

    if (yearSel !== "__ALL__") base = base.filter((r) => isoYear(r.__data_iso) === yearSel);
    if (monthSel !== "__ALL__") base = base.filter((r) => isoMonthKey(r.__data_iso) === monthSel);
    if (weekSel !== "__ALL__") base = base.filter((r) => String(r.semana ?? "") === String(weekSel));

    return base.map((r) => {
      const d = parseISO(r.__data_iso);
      return {
        iso: r.__data_iso, // X
        label: format(d, "dd/MM", { locale: ptBR }),
        mp_prevista_percent: num(r.mp_prevista_percent),
        real_mp_percent_calc: calcRealMpPctDia(r),
      };
    });
  }, [rowsByDateAsc, yearSel, monthSel, weekSel]);

  // TOTAL GERAL (ano) no fim da tabela
  const totalGeralRows = useMemo(() => {
    let base = rowsByDateAsc;
    if (yearSel !== "__ALL__") base = base.filter((r) => isoYear(r.__data_iso) === yearSel);
    return base;
  }, [rowsByDateAsc, yearSel]);

  const totalGeralAgg = useMemo(() => aggregateTotals(totalGeralRows), [totalGeralRows]);

  function toggleMonth(monthKey) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }

  function toggleWeek(weekKey) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  }

  const monthSortArrow = monthSortAsc ? "⬇" : "⬆";
  const monthSortLabel = monthSortAsc ? "Antigo → Recente" : "Recente → Antigo";

  function pickYear(y) {
    setYearSel(y);
    setMonthSel("__ALL__");
    setWeekSel("__ALL__");
  }
  function pickMonth(mk) {
    setMonthSel(mk);
    setWeekSel("__ALL__");
  }
  function pickWeek(w) {
    setWeekSel(w);
  }

  return (
    <div style={page}>
      <div style={topLine}>
        <div>
          <h1 style={h1}>Disponibilidade x Matéria Prima</h1>
          <div style={sub}>Tabela • Percentuais (Ano/Mês/Semana)</div>
        </div>

        <div style={rightControls}>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={select}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err ? <div style={errorBox}>{err}</div> : null}

      {/* KPIs */}
      <div style={cards}>
        <div style={card}>
          <div style={kicker}>LINHAS</div>
          <div style={big}>{kpis.linhas.toLocaleString("pt-BR")}</div>
        </div>
        <div style={card}>
          <div style={kicker}>DISPONIBILIDADE (BASE)</div>
          <div style={big}>{brl(kpis.disponibilidadeBase)}</div>
        </div>
        <div style={card}>
          <div style={kicker}>MP PREVISTA (TOT)</div>
          <div style={big}>{brl(kpis.mpPrevTot)}</div>
        </div>
        <div style={card}>
          <div style={kicker}>REALIZADO (TOT)</div>
          <div style={big}>{brl(kpis.realizTot)}</div>
        </div>
        <div style={card}>
          <div style={kicker}>SALDO (CALC)</div>
          <div style={big}>{brl(kpis.saldo)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabsRow}>
        <button
          type="button"
          onClick={() => setAnalysis("tabela")}
          style={{ ...tabBtn, ...(analysis === "tabela" ? tabBtnActive : null) }}
        >
          Tabela
        </button>
        <button
          type="button"
          onClick={() => setAnalysis("percentuais")}
          style={{ ...tabBtn, ...(analysis === "percentuais" ? tabBtnActive : null) }}
        >
          Percentuais
        </button>
      </div>

      <div style={panel}>
        <div style={panelHead}>
          <div style={panelTitle}>
            {analysis === "tabela"
              ? "Tabela (Mês / Semana / Dia) + Total Geral"
              : "Percentuais (MP PREV % x MP REAL %)"}
          </div>
          <div style={panelHint}>
            Projeto atual: <b style={{ color: "#e5e7eb" }}>{projectTitle}</b>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 18, color: "#9ca3af" }}>Carregando…</div>
        ) : !rowsByDateAsc.length ? (
          <div style={{ padding: 18, color: "#9ca3af" }}>Sem dados para o projeto selecionado.</div>
        ) : analysis === "tabela" ? (
          <div style={{ padding: 16 }}>
            {/* filtro de ano para Total Geral */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ color: "#9ca3af", fontWeight: 900, letterSpacing: "0.12em", fontSize: 12 }}>
                TOTAL POR ANO:
              </div>
              <select value={yearSel} onChange={(e) => pickYear(e.target.value)} style={{ ...select, minWidth: 180 }}>
                <option value="__ALL__">Todos</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div style={tableWrap}>
              <div style={tableHead}>
                <div
                  style={headCellBtn}
                  onClick={() => setMonthSortAsc((v) => !v)}
                  title={`Ordenar meses: ${monthSortLabel}`}
                >
                  MÊS {monthSortArrow}
                </div>
                <div style={headCell}>SEMANA</div>

                <div style={{ ...headCellRight, textAlign: "right" }}>DISPON. (BASE)</div>
                <div style={{ ...headCellRight, textAlign: "right" }}>CAPT. FOM.</div>
                <div style={{ ...headCellRight, textAlign: "right" }}>MP PREV (TOT)</div>
                <div style={{ ...headCellRight, textAlign: "right" }}>AMORT FOM.</div>
                <div style={{ ...headCellRight, textAlign: "right" }}>REALIZ (TOT)</div>
                <div style={{ ...headCellRight, textAlign: "right" }}>MP PREV %</div>
                <div style={{ ...headCellRight, textAlign: "right" }}>REAL MP %</div>
                <div style={{ ...headCellRight, textAlign: "right" }}>SALDO</div>
              </div>

              {monthGroups.map((m) => {
                const isMonthOpen = expandedMonths.has(m.monthKey);
                const totM = aggregateTotals(m.rows);

                return (
                  <React.Fragment key={m.monthKey}>
                    <div style={{ ...tableRow, ...rowMonth }}>
                      <div style={cellPrimary}>
                        <button type="button" onClick={() => toggleMonth(m.monthKey)} style={expandBtn}>
                          {isMonthOpen ? "▾" : "▸"}
                        </button>
                        <span style={rowTitle}>{m.monthTitle}</span>
                      </div>

                      <div style={{ color: "rgba(229,231,235,0.85)" }}>—</div>

                      <div style={cellRight}>{brl(totM.totDispBase)}</div>
                      <div style={cellRight}>{brl(totM.totCapt)}</div>
                      <div style={cellRight}>{brl(totM.totMpPrevTot)}</div>
                      <div style={cellRight}>{brl(totM.totAmort)}</div>
                      <div style={cellRight}>{brl(totM.totRealiz)}</div>
                      <div style={cellRight}>{pctFromDecimal(totM.mpPrevPctAgg)}</div>
                      <div style={cellRight}>{pctFromDecimal(totM.realMpPctAgg)}</div>
                      <div style={cellRight}>{brl(totM.saldoAgg)}</div>
                    </div>

                    {isMonthOpen
                      ? m.weeksArr.map((w) => {
                          const isWeekOpen = expandedWeeks.has(w.weekKey);
                          const totW = aggregateTotals(w.rows);

                          return (
                            <React.Fragment key={w.weekKey}>
                              <div style={{ ...tableRow, ...rowWeek }}>
                                <div style={cellMuted}>—</div>

                                <div style={cellPrimary}>
                                  <button type="button" onClick={() => toggleWeek(w.weekKey)} style={expandBtn}>
                                    {isWeekOpen ? "▾" : "▸"}
                                  </button>
                                  <span style={rowTitle}>Semana {w.week}</span>
                                </div>

                                <div style={cellRight}>{brl(totW.totDispBase)}</div>
                                <div style={cellRight}>{brl(totW.totCapt)}</div>
                                <div style={cellRight}>{brl(totW.totMpPrevTot)}</div>
                                <div style={cellRight}>{brl(totW.totAmort)}</div>
                                <div style={cellRight}>{brl(totW.totRealiz)}</div>
                                <div style={cellRight}>{pctFromDecimal(totW.mpPrevPctAgg)}</div>
                                <div style={cellRight}>{pctFromDecimal(totW.realMpPctAgg)}</div>
                                <div style={cellRight}>{brl(totW.saldoAgg)}</div>
                              </div>

                              {isWeekOpen
                                ? w.rows.map((r) => {
                                    const dLabel = r.__data_iso
                                      ? format(parseISO(r.__data_iso), "dd/MM/yyyy", { locale: ptBR })
                                      : "—";

                                    const dispBaseD = calcDisponibilidadeBase(r);
                                    const mpPrevTotD = calcMpPrevTotDia(r);
                                    const realizTotD = calcRealizTotDia(r);
                                    const saldoD = calcSaldoDia(r);

                                    return (
                                      <div key={r.id} style={{ ...tableRow, ...rowDay }}>
                                        <div style={cellMuted}>
                                          {capMonthName(format(parseISO(r.__data_iso), "MMMM", { locale: ptBR }))}
                                        </div>

                                        <div style={cellMuted}>
                                          <span style={dayPill}>{dLabel}</span>
                                        </div>

                                        <div style={cellRight}>{brl(dispBaseD)}</div>
                                        <div style={cellRight}>{brl(num(r.captacao_fomento))}</div>
                                        <div style={cellRight}>{brl(mpPrevTotD)}</div>
                                        <div style={cellRight}>{brl(num(r.amortizacao_fom))}</div>
                                        <div style={cellRight}>{brl(realizTotD)}</div>
                                        <div style={cellRight}>{pctFromDecimal(num(r.mp_prevista_percent))}</div>
                                        <div style={cellRight}>{pctFromDecimal(calcRealMpPctDia(r))}</div>
                                        <div style={cellRight}>{brl(saldoD)}</div>
                                      </div>
                                    );
                                  })
                                : null}
                            </React.Fragment>
                          );
                        })
                      : null}
                  </React.Fragment>
                );
              })}

              {/* ✅ LINHA TOTAL GERAL */}
              <div style={{ ...tableRow, ...rowTotal }}>
                <div style={cellPrimary}>
                  <span style={{ ...rowTitle, color: "rgba(245,198,63,0.95)" }}>
                    TOTAL {yearSel === "__ALL__" ? "(TODOS OS ANOS)" : `(ANO ${yearSel})`}
                  </span>
                </div>

                <div style={{ color: "rgba(229,231,235,0.85)" }}>—</div>

                <div style={cellRight}>{brl(totalGeralAgg.totDispBase)}</div>
                <div style={cellRight}>{brl(totalGeralAgg.totCapt)}</div>
                <div style={cellRight}>{brl(totalGeralAgg.totMpPrevTot)}</div>
                <div style={cellRight}>{brl(totalGeralAgg.totAmort)}</div>
                <div style={cellRight}>{brl(totalGeralAgg.totRealiz)}</div>
                <div style={cellRight}>{pctFromDecimal(totalGeralAgg.mpPrevPctAgg)}</div>
                <div style={cellRight}>{pctFromDecimal(totalGeralAgg.realMpPctAgg)}</div>
                <div style={cellRight}>{brl(totalGeralAgg.saldoAgg)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            {/* Botões Ano/Mês/Semana */}
            <div style={filtersWrap}>
              <div style={filterGroup}>
                <div style={filterLabel}>Ano</div>
                <div style={pillRow}>
                  <button
                    type="button"
                    onClick={() => pickYear("__ALL__")}
                    style={{ ...pill, ...(yearSel === "__ALL__" ? pillActive : null) }}
                  >
                    Todos
                  </button>
                  {yearOptions.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => pickYear(y)}
                      style={{ ...pill, ...(yearSel === y ? pillActive : null) }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div style={filterGroup}>
                <div style={filterLabel}>Mês</div>
                <div style={pillRow}>
                  <button
                    type="button"
                    onClick={() => pickMonth("__ALL__")}
                    style={{ ...pill, ...(monthSel === "__ALL__" ? pillActive : null) }}
                  >
                    Todos
                  </button>
                  {monthOptionsForYear.map((mk) => (
                    <button
                      key={mk}
                      type="button"
                      onClick={() => pickMonth(mk)}
                      style={{ ...pill, ...(monthSel === mk ? pillActive : null) }}
                      title={mk}
                    >
                      {monthLabelFromKey(mk)}
                    </button>
                  ))}
                </div>
              </div>

              {monthSel !== "__ALL__" ? (
                <div style={filterGroup}>
                  <div style={filterLabel}>Semana</div>
                  <div style={pillRow}>
                    <button
                      type="button"
                      onClick={() => pickWeek("__ALL__")}
                      style={{ ...pill, ...(weekSel === "__ALL__" ? pillActive : null) }}
                    >
                      Todas
                    </button>
                    {weekOptionsForYearMonth.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => pickWeek(w)}
                        style={{ ...pill, ...(String(weekSel) === String(w) ? pillActive : null) }}
                      >
                        {`Semana ${w}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ height: 380, marginTop: 10 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesPercent} margin={{ top: 14, right: 18, left: 6, bottom: 0 }}>
                  <defs>
                    <pattern id="hatchRed" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                      <rect width="8" height="8" fill="rgba(239, 68, 68, 0.10)" />
                      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(239, 68, 68, 0.35)" strokeWidth="3" />
                    </pattern>

                    <pattern id="hatchGreen" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                      <rect width="8" height="8" fill="rgba(34, 197, 94, 0.10)" />
                      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(34, 197, 94, 0.35)" strokeWidth="3" />
                    </pattern>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />

                  <XAxis
                    dataKey="iso"
                    tick={{ fill: "rgba(229,231,235,0.75)" }}
                    tickFormatter={(iso) => {
                      try {
                        return format(parseISO(iso), "dd/MM", { locale: ptBR });
                      } catch {
                        return iso;
                      }
                    }}
                    allowDuplicatedCategory={false}
                  />

                  <YAxis
                    domain={[0, 1]}
                    tick={{ fill: "rgba(229,231,235,0.75)" }}
                    tickFormatter={(v) =>
                      `${Number(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`
                    }
                    width={85}
                  />

                  <Tooltip
                    labelFormatter={(iso) => {
                      try {
                        return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
                      } catch {
                        return iso;
                      }
                    }}
                    labelStyle={{ color: "#111" }}
                    contentStyle={{ borderRadius: 12 }}
                    formatter={(v, name) => [pctFromDecimal(v), name]}
                  />

                  <Legend />

                  <Customized
                    component={(props) => (
                      <DiffFillHatched
                        data={seriesPercent}
                        xAxisMap={props.xAxisMap}
                        yAxisMap={props.yAxisMap}
                        offset={props.offset}
                        clipPathId={props.clipPathId}
                      />
                    )}
                  />

                  <Line
                    type="monotone"
                    dataKey="mp_prevista_percent"
                    name="MP PREV %"
                    stroke="rgba(245, 198, 63, 0.95)"
                    strokeWidth={3}
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  >
                    <LabelList content={<PointLabelPct />} />
                  </Line>

                  <Line
                    type="monotone"
                    dataKey="real_mp_percent_calc"
                    name="MP REAL %"
                    stroke="rgba(147, 197, 253, 0.95)"
                    strokeWidth={3}
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  >
                    <LabelList content={<PointLabelPct />} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ======================
   Styles
====================== */
const page = { minHeight: "100%", padding: "0.5rem 0.2rem", color: "#e5e7eb" };

const topLine = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const h1 = { margin: 0, fontSize: "2.2rem", fontWeight: 900, letterSpacing: "0.01em" };
const sub = { marginTop: 6, color: "#9ca3af", fontSize: 14 };

const rightControls = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };

const select = {
  padding: "0.75rem 0.9rem",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.35)",
  color: "#f9fafb",
  fontWeight: 800,
  minWidth: 320,
};

const errorBox = {
  fontSize: "0.9rem",
  color: "#fecaca",
  backgroundColor: "rgba(127,29,29,0.25)",
  border: "1px solid rgba(239,68,68,0.35)",
  padding: "0.75rem 0.9rem",
  borderRadius: 14,
  marginBottom: 12,
};

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const card = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 18,
  padding: "14px 16px",
  boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
};

const kicker = { fontSize: 12, color: "#9ca3af", fontWeight: 900, letterSpacing: "0.14em" };
const big = { marginTop: 8, fontSize: 22, fontWeight: 950 };

const tabsRow = { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" };
const tabBtn = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.30)",
  color: "rgba(229,231,235,0.90)",
  padding: "10px 12px",
  borderRadius: 14,
  fontWeight: 900,
  cursor: "pointer",
};
const tabBtnActive = {
  border: "1px solid rgba(245,198,63,0.45)",
  background: "linear-gradient(135deg, rgba(245,198,63,0.16), rgba(0,0,0,0.45))",
  boxShadow: "0 14px 35px rgba(245,198,63,0.08)",
};

const panel = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 18,
  boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
  overflow: "hidden",
};

const panelHead = { padding: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" };
const panelTitle = { fontWeight: 950, fontSize: 18 };
const panelHint = { marginTop: 6, color: "#9ca3af", fontSize: 13 };

/* Tabela */
const tableWrap = { display: "flex", flexDirection: "column", gap: 8 };

const tableHead = {
  display: "grid",
  gridTemplateColumns: "220px 150px 170px 160px 170px 160px 170px 140px 140px 170px",
  gap: 10,
  alignItems: "center",
  padding: "0.65rem 0.75rem",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(229,231,235,0.9)",
  fontWeight: 950,
  letterSpacing: "0.10em",
  fontSize: 12,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "220px 150px 170px 160px 170px 160px 170px 140px 140px 170px",
  gap: 10,
  alignItems: "center",
  padding: "0.65rem 0.75rem",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.28)",
  color: "rgba(229,231,235,0.92)",
  fontWeight: 850,
};

const headCell = { userSelect: "none" };
const headCellRight = { userSelect: "none" };

const headCellBtn = {
  userSelect: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const cellPrimary = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const cellMuted = { color: "rgba(229,231,235,0.78)" };

const cellRight = {
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const rowTitle = {
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const expandBtn = {
  width: 28,
  height: 28,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(229,231,235,0.92)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 10px 24px rgba(0,0,0,0.55)",
};

const rowMonth = {
  background: "linear-gradient(180deg, rgba(245,198,63,0.10), rgba(0,0,0,0.28))",
  border: "1px solid rgba(245,198,63,0.22)",
};

const rowWeek = { background: "rgba(0,0,0,0.30)" };
const rowDay = { background: "rgba(0,0,0,0.20)" };

const rowTotal = {
  background: "linear-gradient(180deg, rgba(245,198,63,0.14), rgba(0,0,0,0.35))",
  border: "1px solid rgba(245,198,63,0.35)",
};

const dayPill = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(229,231,235,0.92)",
  fontWeight: 900,
  fontSize: 12,
};

/* Percentuais: Botões */
const filtersWrap = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.28)",
};

const filterGroup = { display: "flex", flexDirection: "column", gap: 8 };
const filterLabel = {
  color: "#9ca3af",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const pillRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const pill = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(229,231,235,0.88)",
  fontWeight: 900,
  cursor: "pointer",
};

const pillActive = {
  border: "1px solid rgba(245,198,63,0.45)",
  background: "linear-gradient(135deg, rgba(245,198,63,0.16), rgba(0,0,0,0.45))",
  boxShadow: "0 14px 35px rgba(245,198,63,0.08)",
};
