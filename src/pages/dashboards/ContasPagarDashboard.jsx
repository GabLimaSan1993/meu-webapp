import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const STATUS_VENCIDO = "VENCIDO";
const STATUS_A_VENCER = "A VENCER";

/* =========================
   Helpers
========================= */
function brl(n) {
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function safeStr(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "(vazio)";
}
function sum(arr) {
  return (arr || []).reduce((acc, x) => acc + (Number(x) || 0), 0);
}
function uniq(arr) {
  return Array.from(new Set(arr || []));
}
function agingBucketLabel(aging) {
  const a = String(aging ?? "").trim();
  return a.length ? a.toUpperCase() : "(SEM AGING)";
}

// tenta normalizar datas para ISO yyyy-mm-dd
function toISO(d) {
  if (!d && d !== 0) return null;

  if (typeof d === "string") {
    const s = d.trim();
    if (!s) return null;

    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // dd/mm/yyyy
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
        dt.getDate()
      ).padStart(2, "0")}`;
    }
    return null;
  }

  // Date
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
      2,
      "0"
    )}`;
  }

  return null;
}

// compara ISO yyyy-mm-dd lexicograficamente
function isBeforeOrEq(isoA, isoB) {
  if (!isoA || !isoB) return false;
  return isoA <= isoB;
}
function isAfter(isoA, isoB) {
  if (!isoA || !isoB) return false;
  return isoA > isoB;
}

export default function ContasPagarDashboard() {
  const [user, setUser] = useState(null);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState([]);

  // ✅ Tabs (igual Contas a Receber)
  const [view, setView] = useState("estrutura"); // estrutura (futuro: outra análise)

  // ✅ Filtro Data Base
  const [dataBaseSelected, setDataBaseSelected] = useState("__ALL__");

  // ✅ Aging por coluna (separado)
  const [openAgingVencido, setOpenAgingVencido] = useState(false);
  const [openAgingAVencer, setOpenAgingAVencer] = useState(false);

  // expand tree
  const [expanded, setExpanded] = useState(() => new Set());

  // =========================
  // Auth + Projects
  // =========================
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      setUser(data.user);
    })();
  }, []);

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
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================
  // Load Contas a Pagar
  // =========================
  useEffect(() => {
    if (!projectId) return;

    (async () => {
      setLoading(true);
      setErr("");

      // reset ui ao trocar projeto
      setExpanded(new Set());
      setOpenAgingVencido(false);
      setOpenAgingAVencer(false);
      setView("estrutura");
      setDataBaseSelected("__ALL__");

      try {
        const { data, error } = await supabase
          .from("contas_pagar")
          .select(
            "id, projeto_id, tipo, subtipo, grupo, classificacao, nat_financeira, favorecido, status, aging, valor, data_vencimento, data_base"
          )
          .eq("projeto_id", projectId);

        if (error) throw error;

        const norm = (data || []).map((r) => ({
          ...r,
          __data_base_iso: toISO(r.data_base),
          __venc_iso: toISO(r.data_vencimento),
        }));

        setRows(norm);
      } catch (e) {
        console.error(e);
        setErr(e.message || "Erro ao carregar contas a pagar.");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  /* =========================
     Data base options
  ========================= */
  const dataBaseOptions = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      if (r.__data_base_iso) set.add(r.__data_base_iso);
    }
    const arr = Array.from(set);
    arr.sort((a, b) => (a < b ? 1 : -1)); // desc
    return arr;
  }, [rows]);

  /* =========================
     Apply data_base filter + compute status by selected base
     (VENCIDO/A VENCER depende da data_base selecionada)
  ========================= */
  const filteredRows = useMemo(() => {
    const base = dataBaseSelected === "__ALL__" ? null : dataBaseSelected;

    const visible = rows.filter((r) => {
      if (!base) return true;
      return r.__data_base_iso === base;
    });

    return visible.map((r) => {
      const ref = base || r.__data_base_iso;
      const venc = r.__venc_iso;

      // fallback: usa status do arquivo se faltar data
      let calc = String(r.status || "").trim().toUpperCase();
      if (!calc) calc = "SEM STATUS";

      if (ref && venc) {
        if (isBeforeOrEq(venc, ref)) calc = STATUS_VENCIDO;
        else if (isAfter(venc, ref)) calc = STATUS_A_VENCER;
      }

      return { ...r, __status_calc: calc };
    });
  }, [rows, dataBaseSelected]);

  // =========================
  // Aging buckets por lado (baseado no status calculado)
  // =========================
  const agingBuckets = useMemo(() => {
    const venc = uniq(
      filteredRows
        .filter((r) => r.__status_calc === STATUS_VENCIDO)
        .map((r) => agingBucketLabel(r.aging))
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    const av = uniq(
      filteredRows
        .filter((r) => r.__status_calc === STATUS_A_VENCER)
        .map((r) => agingBucketLabel(r.aging))
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return { vencido: venc, aVencer: av };
  }, [filteredRows]);

  // =========================
  // Totais KPIs (baseado no status calculado)
  // =========================
  const totals = useMemo(() => {
    const total = sum(filteredRows.map((r) => r.valor));
    const venc = sum(filteredRows.filter((r) => r.__status_calc === STATUS_VENCIDO).map((r) => r.valor));
    const av = sum(filteredRows.filter((r) => r.__status_calc === STATUS_A_VENCER).map((r) => r.valor));
    return { total, venc, av };
  }, [filteredRows]);

  // =========================
  // Tree: Tipo -> ... -> Favorecido
  // (calculado em cima de filteredRows)
  // =========================
  const tree = useMemo(() => {
    const root = new Map();

    function getNode(map, keyLabel) {
      if (!map.has(keyLabel)) {
        map.set(keyLabel, { label: keyLabel, children: new Map(), rows: [] });
      }
      return map.get(keyLabel);
    }

    for (const r of filteredRows) {
      const tipo = safeStr(r.tipo);
      const subtipo = safeStr(r.subtipo);
      const grupo = safeStr(r.grupo);
      const classificacao = safeStr(r.classificacao);
      const nat = safeStr(r.nat_financeira);
      const fav = safeStr(r.favorecido);

      const n1 = getNode(root, tipo);
      const n2 = getNode(n1.children, subtipo);
      const n3 = getNode(n2.children, grupo);
      const n4 = getNode(n3.children, classificacao);
      const n5 = getNode(n4.children, nat);
      const n6 = getNode(n5.children, fav);

      n6.rows.push(r);
    }

    function totalOf(node) {
      if (node.rows?.length) return sum(node.rows.map((x) => x.valor));
      const childVals = Array.from(node.children?.values?.() || []).map(totalOf);
      return sum(childVals);
    }

    function mapToArr(m) {
      const arr = Array.from(m.values()).map((n) => ({
        ...n,
        childrenArr: mapToArr(n.children),
      }));
      arr.sort((a, b) => Math.abs(totalOf(b)) - Math.abs(totalOf(a)));
      return arr;
    }

    function collectRows(node) {
      if (node.rows?.length) return node.rows;
      let out = [];
      for (const c of node.childrenArr || []) out = out.concat(collectRows(c));
      return out;
    }

    function withTotals(node) {
      const allRows = collectRows(node);

      const total = sum(allRows.map((x) => x.valor));

      const vencRows = allRows.filter((x) => x.__status_calc === STATUS_VENCIDO);
      const avRows = allRows.filter((x) => x.__status_calc === STATUS_A_VENCER);

      const vencTotal = sum(vencRows.map((x) => x.valor));
      const avTotal = sum(avRows.map((x) => x.valor));

      const vencByAging = {};
      const avByAging = {};
      for (const a of agingBuckets.vencido) vencByAging[a] = 0;
      for (const a of agingBuckets.aVencer) avByAging[a] = 0;

      for (const x of vencRows) {
        const k = agingBucketLabel(x.aging);
        vencByAging[k] = (vencByAging[k] || 0) + Number(x.valor || 0);
      }
      for (const x of avRows) {
        const k = agingBucketLabel(x.aging);
        avByAging[k] = (avByAging[k] || 0) + Number(x.valor || 0);
      }

      return {
        ...node,
        __total: total,
        __vencido: vencTotal,
        __aVencer: avTotal,
        __vencByAging: vencByAging,
        __avByAging: avByAging,
        childrenArr: node.childrenArr.map(withTotals),
      };
    }

    return mapToArr(root).map(withTotals);
  }, [filteredRows, agingBuckets]);

  // =========================
  // Expand/Collapse single nodes
  // =========================
  function keyFor(pathArr) {
    return pathArr.join(" > ");
  }
  function isOpen(pathArr) {
    return expanded.has(keyFor(pathArr));
  }
  function toggleNode(pathArr) {
    const k = keyFor(pathArr);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  // =========================
  // ✅ Grid columns — ORDEM: VENCIDO | A VENCER | TOTAL (TOTAL no final)
  // =========================
  const gridCols = useMemo(() => {
    const vencOpen = openAgingVencido;
    const avOpen = openAgingAVencer;

    const vencN = Math.max(agingBuckets.vencido.length, 1);
    const avN = Math.max(agingBuckets.aVencer.length, 1);

    const vencCols = vencOpen ? `repeat(${vencN}, 180px)` : "180px";
    const avCols = avOpen ? `repeat(${avN}, 180px)` : "180px";

    // Estrutura + (VENCIDO) + (A VENCER) + TOTAL
    return `minmax(420px, 1fr) ${vencCols} ${avCols} 180px`;
  }, [openAgingVencido, openAgingAVencer, agingBuckets]);

  // =========================
  // Header + Rows render
  // =========================
  function renderHeader() {
    return (
      <div style={{ ...rowGrid, gridTemplateColumns: gridCols, ...headerRow }}>
        <div style={{ ...cell, ...headCell, justifyContent: "flex-start" }}>ESTRUTURA</div>

        {/* VENCIDO */}
        {!openAgingVencido ? (
          <button
            type="button"
            onClick={() => setOpenAgingVencido(true)}
            style={{ ...headBtn, color: "#fecaca" }}
            title="Clique para abrir Aging do Vencido"
          >
            VENCIDO
          </button>
        ) : agingBuckets.vencido.length ? (
          agingBuckets.vencido.map((a) => (
            <button
              key={`h-v-${a}`}
              type="button"
              onClick={() => setOpenAgingVencido(false)}
              style={{ ...headBtn, color: "#fecaca" }}
              title="Clique para fechar Aging do Vencido"
            >
              VENCIDO · {a}
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={() => setOpenAgingVencido(false)}
            style={{ ...headBtn, color: "#fecaca" }}
            title="Clique para fechar Aging do Vencido"
          >
            VENCIDO
          </button>
        )}

        {/* A VENCER */}
        {!openAgingAVencer ? (
          <button
            type="button"
            onClick={() => setOpenAgingAVencer(true)}
            style={{ ...headBtn, color: "#bbf7d0" }}
            title="Clique para abrir Aging do A Vencer"
          >
            A VENCER
          </button>
        ) : agingBuckets.aVencer.length ? (
          agingBuckets.aVencer.map((a) => (
            <button
              key={`h-a-${a}`}
              type="button"
              onClick={() => setOpenAgingAVencer(false)}
              style={{ ...headBtn, color: "#bbf7d0" }}
              title="Clique para fechar Aging do A Vencer"
            >
              A VENCER · {a}
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={() => setOpenAgingAVencer(false)}
            style={{ ...headBtn, color: "#bbf7d0" }}
            title="Clique para fechar Aging do A Vencer"
          >
            A VENCER
          </button>
        )}

        {/* TOTAL */}
        <div style={{ ...cell, ...headCell, textAlign: "right" }}>TOTAL</div>
      </div>
    );
  }

  function renderNode(node, depth, path) {
    const open = isOpen(path);
    const hasChildren = (node.childrenArr?.length || 0) > 0;

    return (
      <React.Fragment key={keyFor(path)}>
        <div style={{ ...rowGrid, gridTemplateColumns: gridCols, ...dataRow }}>
          {/* Estrutura */}
          <div style={{ ...cell, justifyContent: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: depth * 16 }}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleNode(path)}
                  style={expanderBtn}
                  aria-label={open ? "Recolher" : "Expandir"}
                >
                  {open ? "▾" : "▸"}
                </button>
              ) : (
                <div style={{ width: 34 }} />
              )}
              <div style={{ fontWeight: 900 }}>{node.label}</div>
            </div>
          </div>

          {/* VENCIDO */}
          {!openAgingVencido ? (
            <div style={{ ...cell, textAlign: "right", fontWeight: 900, color: "#fecaca" }}>{brl(node.__vencido)}</div>
          ) : (
            (agingBuckets.vencido.length ? agingBuckets.vencido : ["__single__"]).map((a) => (
              <div
                key={`${keyFor(path)}-v-${a}`}
                style={{ ...cell, textAlign: "right", fontWeight: 900, color: "#fecaca" }}
              >
                {a === "__single__" ? brl(node.__vencido) : brl(node.__vencByAging?.[a] || 0)}
              </div>
            ))
          )}

          {/* A VENCER */}
          {!openAgingAVencer ? (
            <div style={{ ...cell, textAlign: "right", fontWeight: 900, color: "#bbf7d0" }}>{brl(node.__aVencer)}</div>
          ) : (
            (agingBuckets.aVencer.length ? agingBuckets.aVencer : ["__single__"]).map((a) => (
              <div
                key={`${keyFor(path)}-a-${a}`}
                style={{ ...cell, textAlign: "right", fontWeight: 900, color: "#bbf7d0" }}
              >
                {a === "__single__" ? brl(node.__aVencer) : brl(node.__avByAging?.[a] || 0)}
              </div>
            ))
          )}

          {/* TOTAL */}
          <div style={{ ...cell, textAlign: "right", fontWeight: 900 }}>{brl(node.__total)}</div>
        </div>

        {open && hasChildren ? node.childrenArr.map((c) => renderNode(c, depth + 1, [...path, c.label])) : null}
      </React.Fragment>
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={page}>
      <div style={topRow}>
        <div>
          <div style={title}>Contas a Pagar</div>
          <div style={sub}>Aging Contas a Pagar (status por Data Base).</div>
        </div>

        <div style={controls}>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={select}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {/* ✅ filtro Data Base */}
          <select value={dataBaseSelected} onChange={(e) => setDataBaseSelected(e.target.value)} style={select}>
            <option value="__ALL__">Data Base: (Tudo)</option>
            {dataBaseOptions.map((d) => (
              <option key={d} value={d}>
                Data Base: {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div style={kpiGrid}>
        <div style={kpiCard}>
          <div style={kpiLabel}>LINHAS</div>
          <div style={kpiValue}>{filteredRows.length}</div>
        </div>
        <div style={kpiCard}>
          <div style={{ ...kpiLabel, color: "#fecaca" }}>VENCIDO</div>
          <div style={{ ...kpiValue, color: "#fecaca" }}>{brl(totals.venc)}</div>
        </div>
        <div style={kpiCard}>
          <div style={{ ...kpiLabel, color: "#bbf7d0" }}>A VENCER</div>
          <div style={{ ...kpiValue, color: "#bbf7d0" }}>{brl(totals.av)}</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>TOTAL</div>
          <div style={kpiValue}>{brl(totals.total)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabsRow}>
        <button
          type="button"
          onClick={() => setView("estrutura")}
          style={{ ...tabBtn, ...(view === "estrutura" ? tabBtnActive : null) }}
        >
          Aging por Estrutura
        </button>

        <button
          type="button"
          style={{ ...tabBtn, opacity: 0.5, cursor: "not-allowed" }}
          disabled
          title="Próxima análise (vamos montar depois)"
        >
          (Em breve) Outra Análise
        </button>
      </div>

      {err ? <div style={errBox}>{err}</div> : null}
      {loading ? <div style={hint}>Carregando…</div> : null}

      {!loading ? (
        <div style={card}>
          <div style={cardTitle}>Aging Contas a Pagar</div>

          <div style={{ marginTop: 14 }}>
            {renderHeader()}
            <div style={divider} />

            {tree.length ? tree.map((n) => renderNode(n, 0, [n.label])) : (
              <div style={{ padding: 16, color: "#9ca3af" }}>Sem dados para este projeto.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ======================
   Styles (dark premium)
====================== */
const page = { padding: "14px 14px 26px", color: "#e5e7eb" };

const topRow = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 14,
  flexWrap: "wrap",
};

const title = { fontSize: 34, fontWeight: 950, letterSpacing: "-0.02em" };
const sub = { marginTop: 6, color: "#9ca3af", fontSize: 13 };

const controls = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };

const select = {
  minWidth: 320,
  maxWidth: "70vw",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "#e5e7eb",
  fontWeight: 850,
  outline: "none",
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 12,
};

const kpiCard = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.35))",
  padding: 14,
  boxShadow: "0 18px 60px rgba(0,0,0,0.70)",
};

const kpiLabel = { fontSize: 12, color: "#9ca3af", letterSpacing: "0.14em", fontWeight: 900 };
const kpiValue = { marginTop: 6, fontSize: 20, fontWeight: 950 };

const tabsRow = { display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" };
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

const errBox = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(127,29,29,0.25)",
  color: "#fecaca",
  marginBottom: 14,
  fontWeight: 800,
};

const hint = { color: "#9ca3af", fontWeight: 800, marginBottom: 14 };

const card = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.55))",
  boxShadow: "0 26px 90px rgba(0,0,0,0.75)",
  padding: 16,
};

const cardTitle = { fontSize: 18, fontWeight: 950 };

const rowGrid = { display: "grid", alignItems: "center", gap: 10 };

const headerRow = { padding: "10px 10px" };

const dataRow = {
  padding: "12px 10px",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.18)",
  marginBottom: 10,
};

const cell = { display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: 34 };

const headCell = {
  fontSize: 12,
  fontWeight: 950,
  color: "rgba(229,231,235,0.85)",
  letterSpacing: "0.12em",
};

const headBtn = {
  all: "unset",
  cursor: "pointer",
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.25)",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.10em",
  textAlign: "right",
  justifyContent: "flex-end",
  display: "flex",
  alignItems: "center",
  minHeight: 34,
};

const divider = { height: 1, background: "rgba(255,255,255,0.08)", margin: "8px 0 12px" };

const expanderBtn = {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(229,231,235,0.90)",
  cursor: "pointer",
  fontWeight: 900,
};
