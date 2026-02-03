// src/pages/dashboards/FaturamentoDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../../lib/supabaseClient";

/**
 * Campos principais
 */
const VALUE_FIELD = "valor_total";
const DATE_FIELD = "data_emissao";

/**
 * ✅ Auto-detect de quantidade (produtos vendidos)
 * Ajuste/adicione aqui caso seu campo tenha outro nome.
 */
const QTY_CANDIDATES = [
  "quantidade",
  "qtd",
  "qtde",
  "quant",
  "quantidade_vendida",
  "qtd_vendida",
  "qtd_item",
  "qtd_itens",
  "quantidade_itens",
  "quantidade_produtos",
  "qtd_produtos",
];

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

/**
 * num robusto:
 * - aceita número
 * - aceita string pt-BR "1.234,56"
 * - aceita string "1234.56"
 */
function num(n) {
  if (n == null) return 0;
  if (typeof n === "number") return Number.isFinite(n) ? n : 0;

  const s0 = String(n).trim();
  if (!s0) return 0;

  const s = s0.replace(/\s|\u00A0/g, "");
  const pt = s.replace(/\./g, "").replace(",", ".");
  const v = Number(pt);
  if (!Number.isNaN(v)) return v;

  const v2 = Number(s);
  return Number.isNaN(v2) ? 0 : v2;
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

// “Grupo” simples: 1ª palavra da descrição
function inferGroup(desc) {
  const d = safeStr(desc);
  if (!d) return "Sem grupo";
  const first = d.split(" ")[0];
  return first ? first.toUpperCase() : "Sem grupo";
}

// ✅ UF -> Região
const UF_TO_REGION = {
  // Norte
  AC: "Norte",
  AP: "Norte",
  AM: "Norte",
  PA: "Norte",
  RO: "Norte",
  RR: "Norte",
  TO: "Norte",
  // Nordeste
  AL: "Nordeste",
  BA: "Nordeste",
  CE: "Nordeste",
  MA: "Nordeste",
  PB: "Nordeste",
  PE: "Nordeste",
  PI: "Nordeste",
  RN: "Nordeste",
  SE: "Nordeste",
  // Centro-Oeste
  DF: "Centro-Oeste",
  GO: "Centro-Oeste",
  MT: "Centro-Oeste",
  MS: "Centro-Oeste",
  // Sudeste
  ES: "Sudeste",
  MG: "Sudeste",
  RJ: "Sudeste",
  SP: "Sudeste",
  // Sul
  PR: "Sul",
  RS: "Sul",
  SC: "Sul",
};

function regionFromUF(uf) {
  const u = safeStr(uf).toUpperCase();
  if (!u) return "—";
  return UF_TO_REGION[u] || "Outros";
}

/**
 * ✅ Auto-detect do campo de quantidade por linha (produtos vendidos)
 */
function qtyFromRowAuto(r) {
  if (!r) return 0;

  for (const k of QTY_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(r, k)) {
      const v = num(r[k]);
      if (v) return v;
    }
  }

  const keys = Object.keys(r);
  const possible = keys.filter((k) => /qtd|qtde|quant|quantidade/i.test(k));
  for (const k of possible) {
    const v = num(r[k]);
    if (v) return v;
  }

  return 0;
}

// ✅ fetch com paginação (select("*") para garantir trazer a coluna de quantidade)
async function fetchAllFaturamentoRows({ projectId }) {
  const pageSize = 1000;
  let from = 0;
  let all = [];

  while (true) {
    const { data, error } = await supabase
      .from("faturamento")
      .select("*")
      .eq("projeto_id", projectId)
      .order(DATE_FIELD, { ascending: true })
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
   * - "ano": barras por ano
   * - "mes": linha mês-a-mês
   * - "semana": diário do mês selecionado
   */
  const [view, setView] = useState("ano");

  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  /**
   * Botões de análise
   */
  const [analysis, setAnalysis] = useState("evolucao");

  /**
   * ✅ Drill-down ABC Clientes
   */
  const [selectedClient, setSelectedClient] = useState(null);

  /**
   * ✅ Drill-down ABC Produtos
   */
  const [selectedProduct, setSelectedProduct] = useState(null);

  /**
   * ✅ Drill-down Por Grupo
   */
  const [selectedGroup, setSelectedGroup] = useState(null);

  /**
   * ✅ NOVO: Drill-down Por Região
   * - seleciona a Região (Norte, Nordeste, Sudeste...)
   * - lista UFs daquela região
   */
  const [selectedRegion, setSelectedRegion] = useState(null);

  // debug: avisar 1x se quantidade ficar 0
  const warnedQtyRef = useRef(false);

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
      warnedQtyRef.current = false;

      try {
        const all = await fetchAllFaturamentoRows({ projectId });

        if (!alive) return;
        setRows(all);

        const dates = all.map((r) => parseDate(r[DATE_FIELD])).filter(Boolean);
        if (dates.length) {
          const maxD = dates[dates.length - 1];
          setSelectedYear(maxD.getFullYear());
        } else {
          setSelectedYear(null);
        }

        setView("ano");
        setSelectedMonth(null);

        // ✅ reseta drill-down ao trocar projeto
        setSelectedClient(null);
        setSelectedProduct(null);
        setSelectedGroup(null);
        setSelectedRegion(null);
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

    if (view === "semana") {
      if (!selectedYear || selectedMonth == null) return [];
      return rows.filter((r) => {
        const d = parseDate(r[DATE_FIELD]);
        return d && d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      });
    }

    return rows;
  }, [rows, view, selectedYear, selectedMonth]);

  /**
   * ✅ BASE DO PERÍODO ATUAL (para os indicadores)
   */
  const basePeriodRows = useMemo(() => {
    return view === "ano" ? rows : filteredRows;
  }, [rows, filteredRows, view]);

  // ===== evolution (total + quantidade produtos) =====
  const evolutionData = useMemo(() => {
    if (!rows.length) return [];

    const qtyFn = (r) => qtyFromRowAuto(r);

    if (view === "ano") {
      const map = groupAgg(
        rows,
        (r) => {
          const d = parseDate(r[DATE_FIELD]);
          return d ? String(d.getFullYear()) : "Sem data";
        },
        (r) => num(r[VALUE_FIELD]),
        qtyFn
      );

      return Array.from(map.entries())
        .filter(([k]) => k !== "Sem data")
        .map(([year, obj]) => ({ label: year, total: obj.total, quantidade: obj.qty }))
        .sort((a, b) => Number(a.label) - Number(b.label));
    }

    if (view === "mes") {
      const map = groupAgg(
        filteredRows,
        (r) => {
          const d = parseDate(r[DATE_FIELD]);
          return d ? d.getMonth() : -1;
        },
        (r) => num(r[VALUE_FIELD]),
        qtyFn
      );

      const arr = [];
      for (let m = 0; m < 12; m++) {
        const obj = map.get(m) || { total: 0, qty: 0 };
        arr.push({
          label: MONTHS[m].label,
          monthIndex: m,
          total: obj.total,
          quantidade: obj.qty,
        });
      }
      return arr;
    }

    if (view === "semana") {
      const totals = new Map();
      for (const r of filteredRows) {
        const d = parseDate(r[DATE_FIELD]);
        if (!d) continue;
        const iso = format(d, "yyyy-MM-dd");
        const prev = totals.get(iso) || { total: 0, qty: 0 };
        prev.total += num(r[VALUE_FIELD]);
        prev.qty += qtyFn(r);
        totals.set(iso, prev);
      }

      const days = Array.from(totals.entries())
        .map(([iso, obj]) => {
          const d = parseISO(iso);
          return {
            label: format(d, "dd/MM", { locale: ptBR }),
            iso,
            total: obj.total,
            quantidade: obj.qty,
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
    const quantidade = base.reduce((acc, r) => acc + qtyFromRowAuto(r), 0);

    const notas = base.length;
    const ticket = notas ? faturamento / notas : 0;

    if (base.length && !quantidade && !warnedQtyRef.current) {
      warnedQtyRef.current = true;
      console.warn(
        "[FaturamentoDashboard] Quantidade ficou 0. Verifique o nome do campo de quantidade na tabela faturamento.",
        "Candidatos:",
        QTY_CANDIDATES,
        "Exemplo de chaves do primeiro registro:",
        Object.keys(base[0] || {})
      );
    }

    return { faturamento, quantidade, ticket };
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

  // ===== ABC Clientes (Top 10) =====
  const topClients = useMemo(() => {
    const base = basePeriodRows;

    const m = groupAgg(
      base,
      (r) => safeStr(r.nome_fantasia) || safeStr(r.razao_social) || "Sem cliente",
      (r) => num(r[VALUE_FIELD]),
      (r) => qtyFromRowAuto(r)
    );

    return topNFromMapAgg(m, 10);
  }, [basePeriodRows]);

  // ===== Drill-down: Produtos do Cliente selecionado =====
  const productsOfSelectedClient = useMemo(() => {
    if (!selectedClient) return [];

    const base = basePeriodRows.filter((r) => {
      const clientName = safeStr(r.nome_fantasia) || safeStr(r.razao_social) || "Sem cliente";
      return clientName === selectedClient;
    });

    const m = groupAgg(
      base,
      (r) => safeStr(r.descricao) || "Sem produto",
      (r) => num(r[VALUE_FIELD]),
      (r) => qtyFromRowAuto(r)
    );

    return topNFromMapAgg(m, 50);
  }, [basePeriodRows, selectedClient]);

  // ===== ABC Produtos (Top 10) =====
  const topProducts = useMemo(() => {
    const base = basePeriodRows;

    const m = groupAgg(
      base,
      (r) => safeStr(r.descricao) || "Sem produto",
      (r) => num(r[VALUE_FIELD]),
      (r) => qtyFromRowAuto(r)
    );

    return topNFromMapAgg(m, 10);
  }, [basePeriodRows]);

  // ===== Drill-down: Clientes que compraram o Produto selecionado =====
  const clientsOfSelectedProduct = useMemo(() => {
    if (!selectedProduct) return [];

    const base = basePeriodRows.filter((r) => {
      const prod = safeStr(r.descricao) || "Sem produto";
      return prod === selectedProduct;
    });

    const m = groupAgg(
      base,
      (r) => safeStr(r.nome_fantasia) || safeStr(r.razao_social) || "Sem cliente",
      (r) => num(r[VALUE_FIELD]),
      (r) => qtyFromRowAuto(r)
    );

    return topNFromMapAgg(m, 50);
  }, [basePeriodRows, selectedProduct]);

  // ===== Por Região (Top) =====
  const byRegion = useMemo(() => {
    const base = basePeriodRows;

    const m = groupAgg(
      base,
      (r) => regionFromUF(r.estado),
      (r) => num(r[VALUE_FIELD]),
      (r) => qtyFromRowAuto(r)
    );

    return topNFromMapAgg(m, 10);
  }, [basePeriodRows]);

  // ✅ NOVO: Drill-down Região -> UFs
  const ufsOfSelectedRegion = useMemo(() => {
    if (!selectedRegion) return [];

    const base = basePeriodRows.filter((r) => regionFromUF(r.estado) === selectedRegion);

    const m = groupAgg(
      base,
      (r) => safeStr(r.estado).toUpperCase() || "—",
      (r) => num(r[VALUE_FIELD]),
      (r) => qtyFromRowAuto(r)
    );

    // UFs não são muitas, mas deixo top 27
    return topNFromMapAgg(m, 27).sort((a, b) => b.total - a.total);
  }, [basePeriodRows, selectedRegion]);

  // ===== Por Grupo (Top) =====
  const byGroup = useMemo(() => {
    const base = basePeriodRows;

    const m = groupAgg(
      base,
      (r) => inferGroup(r.descricao),
      (r) => num(r[VALUE_FIELD]),
      (r) => qtyFromRowAuto(r)
    );

    return topNFromMapAgg(m, 10);
  }, [basePeriodRows]);

  // ✅ Drill-down: Produtos do Grupo selecionado
  const productsOfSelectedGroup = useMemo(() => {
    if (!selectedGroup) return [];

    const base = basePeriodRows.filter((r) => inferGroup(r.descricao) === selectedGroup);

    const m = groupAgg(
      base,
      (r) => safeStr(r.descricao) || "Sem produto",
      (r) => num(r[VALUE_FIELD]),
      (r) => qtyFromRowAuto(r)
    );

    return topNFromMapAgg(m, 50);
  }, [basePeriodRows, selectedGroup]);

  // ===== Interactions =====
  function onPickYear(y) {
    setSelectedYear(y);
    setSelectedMonth(null);
    setView("mes");
  }

  function onPickMonth(mIndex) {
    setSelectedMonth(mIndex);
    setView("semana");
  }

  const evolutionTitle = useMemo(() => {
    if (view === "ano") return "Evolução (por ano)";
    if (view === "mes") return `Evolução (mês a mês — ${selectedYear || "—"})`;
    if (view === "semana")
      return `Evolução (por dia — ${MONTHS[selectedMonth ?? 0]?.label || "—"}/${selectedYear || "—"})`;
    return "Evolução";
  }, [view, selectedYear, selectedMonth]);

  // ✅ Se o usuário troca de aba, reset do drill-down para evitar confusão
  useEffect(() => {
    if (analysis !== "abc_clientes") setSelectedClient(null);
    if (analysis !== "abc_produtos") setSelectedProduct(null);
    if (analysis !== "por_grupo") setSelectedGroup(null);
    if (analysis !== "por_regiao") setSelectedRegion(null);
  }, [analysis]);

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
          <div style={kpiLabel}>Quantidade</div>
          <div style={kpiValue}>{Number(kpis.quantidade || 0).toLocaleString("pt-BR")}</div>
        </div>

        <div style={{ ...kpiCard, ...kpiGlowPurple }}>
          <div style={kpiLabel}>Ticket Médio</div>
          <div style={kpiValue}>{brl(kpis.ticket)}</div>
        </div>
      </section>

      {/* BOTÕES DE ANÁLISE */}
      <div style={tabsRow}>
        <button
          type="button"
          onClick={() => setAnalysis("evolucao")}
          style={{ ...tabBtn, ...(analysis === "evolucao" ? tabBtnActive : null) }}
        >
          Evolução de Faturamento
        </button>

        <button
          type="button"
          onClick={() => setAnalysis("abc_clientes")}
          style={{ ...tabBtn, ...(analysis === "abc_clientes" ? tabBtnActive : null) }}
        >
          Curva ABC de Clientes
        </button>

        <button
          type="button"
          onClick={() => setAnalysis("abc_produtos")}
          style={{ ...tabBtn, ...(analysis === "abc_produtos" ? tabBtnActive : null) }}
        >
          Curva ABC de Produtos
        </button>

        <button
          type="button"
          onClick={() => setAnalysis("por_grupo")}
          style={{ ...tabBtn, ...(analysis === "por_grupo" ? tabBtnActive : null) }}
        >
          Faturamento por Grupo
        </button>

        <button
          type="button"
          onClick={() => setAnalysis("por_regiao")}
          style={{ ...tabBtn, ...(analysis === "por_regiao" ? tabBtnActive : null) }}
        >
          Faturamento por Região
        </button>
      </div>

      {/* CONTEÚDO DA ANÁLISE */}
      {analysis === "evolucao" ? (
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
                    width={70}
                  />
                  <Tooltip
                    formatter={(v, name) =>
                      name === "quantidade" ? Number(v).toLocaleString("pt-BR") : brl(v)
                    }
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
                    dataKey="quantidade"
                    name="Quantidade"
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
                    width={70}
                  />
                  <Tooltip
                    formatter={(v, name) =>
                      name === "quantidade" ? Number(v).toLocaleString("pt-BR") : brl(v)
                    }
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
                    dataKey="quantidade"
                    name="Quantidade"
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
      ) : analysis === "abc_clientes" ? (
        <section style={card}>
          {selectedClient ? (
            <>
              <div style={abcHeaderRow}>
                <button type="button" onClick={() => setSelectedClient(null)} style={backBtn}>
                  ← Voltar
                </button>
                <div style={abcHeaderTitle}>
                  Produtos comprados —{" "}
                  <span style={{ color: "rgba(245, 198, 63, 0.95)" }}>{selectedClient}</span>
                </div>
              </div>

              <MiniTable data={productsOfSelectedClient} monthsCount={monthsCount} showPMV pmvLabel="PMV CIMP" />
            </>
          ) : (
            <>
              <div style={abcHeaderTitle}>
                Curva ABC de Clientes (Top 10) —{" "}
                <span style={{ color: "rgba(229,231,235,0.65)", fontWeight: 700 }}>
                  clique no cliente para ver os produtos
                </span>
              </div>

              <MiniTable
                data={topClients}
                monthsCount={monthsCount}
                showPMV
                pmvLabel="PMV CIMP"
                onNameClick={(name) => setSelectedClient(name)}
                nameClickable
              />
            </>
          )}
        </section>
      ) : analysis === "abc_produtos" ? (
        <section style={card}>
          {selectedProduct ? (
            <>
              <div style={abcHeaderRow}>
                <button type="button" onClick={() => setSelectedProduct(null)} style={backBtn}>
                  ← Voltar
                </button>
                <div style={abcHeaderTitle}>
                  Clientes que compraram —{" "}
                  <span style={{ color: "rgba(245, 198, 63, 0.95)" }}>{selectedProduct}</span>
                </div>
              </div>

              <MiniTable data={clientsOfSelectedProduct} monthsCount={monthsCount} showPMV pmvLabel="PMV CIMP" />
            </>
          ) : (
            <>
              <div style={abcHeaderTitle}>
                Curva ABC de Produtos (Top 10) —{" "}
                <span style={{ color: "rgba(229,231,235,0.65)", fontWeight: 700 }}>
                  clique no produto para ver os clientes
                </span>
              </div>

              <MiniTable
                data={topProducts}
                monthsCount={monthsCount}
                showPMV
                pmvLabel="PMV CIMP"
                onNameClick={(name) => setSelectedProduct(name)}
                nameClickable
              />
            </>
          )}
        </section>
      ) : analysis === "por_grupo" ? (
        <section style={card}>
          {selectedGroup ? (
            <>
              <div style={abcHeaderRow}>
                <button type="button" onClick={() => setSelectedGroup(null)} style={backBtn}>
                  ← Voltar
                </button>
                <div style={abcHeaderTitle}>
                  Produtos do Grupo —{" "}
                  <span style={{ color: "rgba(245, 198, 63, 0.95)" }}>{selectedGroup}</span>
                </div>
              </div>

              <MiniTable data={productsOfSelectedGroup} monthsCount={monthsCount} showPMV pmvLabel="PMV CIMP" />
            </>
          ) : (
            <>
              <div style={abcHeaderTitle}>
                Faturamento por Grupo —{" "}
                <span style={{ color: "rgba(229,231,235,0.65)", fontWeight: 700 }}>
                  clique no grupo para ver os produtos
                </span>
              </div>

              <MiniTable
                data={byGroup}
                monthsCount={monthsCount}
                showPMV
                pmvLabel="PMV CIMP"
                onNameClick={(name) => setSelectedGroup(name)}
                nameClickable
              />
            </>
          )}
        </section>
      ) : (
        <section style={card}>
          {selectedRegion ? (
            <>
              <div style={abcHeaderRow}>
                <button type="button" onClick={() => setSelectedRegion(null)} style={backBtn}>
                  ← Voltar
                </button>
                <div style={abcHeaderTitle}>
                  Estados da Região —{" "}
                  <span style={{ color: "rgba(245, 198, 63, 0.95)" }}>{selectedRegion}</span>
                </div>
              </div>

              <MiniTable data={ufsOfSelectedRegion} monthsCount={monthsCount} showPMV pmvLabel="PMV CIMP" />
            </>
          ) : (
            <>
              <div style={abcHeaderTitle}>
                Faturamento por Região —{" "}
                <span style={{ color: "rgba(229,231,235,0.65)", fontWeight: 700 }}>
                  clique na região para ver os estados
                </span>
              </div>

              <MiniTable
                data={byRegion}
                monthsCount={monthsCount}
                showPMV
                pmvLabel="PMV CIMP"
                onNameClick={(name) => setSelectedRegion(name)}
                nameClickable
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * ✅ MiniTable
 * - Item | Total | Média/Mês | Quantidade | (opcional) PMV CIMP
 * - opção de clicar no nome (drill-down)
 */
function MiniTable({
  data,
  monthsCount,
  showPMV = false,
  pmvLabel = "PMV CIMP",
  onNameClick,
  nameClickable = false,
}) {
  const [sortKey, setSortKey] = useState("total"); // total | avgMoney | qty | pmv
  const [sortDir, setSortDir] = useState("desc"); // asc | desc

  const rows = useMemo(() => {
    const base = (data || []).map((r) => {
      const total = Number(r.total || 0);
      const qty = Number(r.qty || 0);

      return {
        ...r,
        total,
        qty,
        avgMoney: total / Math.max(1, monthsCount || 1),
        pmv: qty ? total / qty : 0,
      };
    });

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

  const gridCols = showPMV
    ? "minmax(150px, 1fr) 170px 170px 150px 170px"
    : "minmax(150px, 1fr) 170px 170px 150px";

  return (
    <div style={miniTable}>
      <div style={{ ...miniHeader, gridTemplateColumns: gridCols }}>
        <div style={{ ...miniCell, justifyContent: "flex-start", fontWeight: 900 }}>Item</div>

        <button type="button" onClick={() => toggleSort("total")} style={miniHeadBtn}>
          Total
          <Arrow active={sortKey === "total"} dir={sortDir} />
        </button>

        <button type="button" onClick={() => toggleSort("avgMoney")} style={miniHeadBtn}>
          Média/Mês
          <Arrow active={sortKey === "avgMoney"} dir={sortDir} />
        </button>

        <button type="button" onClick={() => toggleSort("qty")} style={miniHeadBtn}>
          Quantidade
          <Arrow active={sortKey === "qty"} dir={sortDir} />
        </button>

        {showPMV ? (
          <button type="button" onClick={() => toggleSort("pmv")} style={miniHeadBtn}>
            {pmvLabel}
            <Arrow active={sortKey === "pmv"} dir={sortDir} />
          </button>
        ) : null}
      </div>

      {rows?.length ? (
        rows.map((r, idx) => (
          <div key={idx} style={{ ...miniRow, gridTemplateColumns: gridCols }}>
            {nameClickable ? (
              <button type="button" style={nameBtn} title={r.name} onClick={() => onNameClick?.(r.name)}>
                {r.name}
              </button>
            ) : (
              <div style={miniName} title={r.name}>
                {r.name}
              </div>
            )}

            <div style={miniValueGold}>{brl(r.total)}</div>
            <div style={miniValueSoft}>{brl(r.avgMoney)}</div>
            <div style={miniValueQty}>{Number(r.qty).toLocaleString("pt-BR")}</div>

            {showPMV ? <div style={miniValueSoft}>{brl(r.pmv)}</div> : null}
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

const page = { minHeight: "100%", padding: "0.5rem 0.2rem", color: "#e5e7eb" };

const header = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: "1rem",
  flexWrap: "wrap",
};

const title = { margin: 0, fontSize: "2.15rem", fontWeight: 850, letterSpacing: "0.01em" };

const projectPickerWrap = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" };
const projectLabel = { fontSize: "0.9rem", color: "rgba(229,231,235,0.7)" };
const projectSelect = {
  padding: "0.65rem 0.8rem",
  borderRadius: "0.95rem",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "#0b0b0b",
  color: "#f9fafb",
  fontSize: "1rem",
  outline: "none",
  minWidth: 280,
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
  background: "radial-gradient(800px 280px at 18% 30%, rgba(245,198,63,0.20), rgba(0,0,0,0.35))",
};
const kpiGlowTeal = {
  background: "radial-gradient(800px 280px at 18% 30%, rgba(45,212,191,0.18), rgba(0,0,0,0.35))",
};
const kpiGlowPurple = {
  background: "radial-gradient(800px 280px at 18% 30%, rgba(167,139,250,0.18), rgba(0,0,0,0.35))",
};

const kpiLabel = { color: "rgba(229,231,235,0.7)", fontSize: "0.95rem" };
const kpiValue = { marginTop: 8, fontSize: "2.0rem", fontWeight: 850 };

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
  flexWrap: "wrap",
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

const card = {
  borderRadius: "1.2rem",
  padding: "1rem",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
};

const abcHeaderRow = { display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" };
const abcHeaderTitle = { fontSize: "1.05rem", fontWeight: 900 };

const backBtn = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.30)",
  color: "rgba(229,231,235,0.92)",
  padding: "8px 12px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const miniTable = { display: "flex", flexDirection: "column", gap: 8 };

const miniHeader = {
  display: "grid",
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
  gap: 10,
  alignItems: "center",
  padding: "0.55rem 0.7rem",
  minHeight: 54,
  borderRadius: "0.9rem",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.35)",
};

const miniCell = { display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(229,231,235,0.9)" };

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

const nameBtn = {
  appearance: "none",
  border: "none",
  background: "transparent",
  textAlign: "left",
  padding: 0,
  margin: 0,
  cursor: "pointer",
  color: "rgba(229,231,235,0.95)",
  fontWeight: 950,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const miniValueGold = { fontWeight: 900, color: "rgba(245, 198, 63, 0.92)", textAlign: "center" };
const miniValueSoft = { fontWeight: 800, color: "rgba(229,231,235,0.88)", textAlign: "center" };
const miniValueQty = { fontWeight: 900, color: "rgba(147, 197, 253, 0.92)", textAlign: "center" };
const miniEmpty = { color: "rgba(229,231,235,0.6)" };
