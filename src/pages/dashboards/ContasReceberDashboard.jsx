// src/pages/dashboards/ContasReceberDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/* =========================
   Helpers
========================= */
const STATUS_VENCIDO = "VENCIDO";
const STATUS_A_VENCER = "A VENCER";

function brl(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sumValor(arr) {
  return (arr || []).reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
}

function safeStr(v, fallback = "(vazio)") {
  const s = String(v ?? "").trim();
  return s.length ? s : fallback;
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const it of arr || []) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

// status “do arquivo” normalizado
function normStatus(s) {
  const x = String(s || "").trim().toUpperCase();
  if (!x) return "SEM STATUS";
  if (x.includes("VENC")) return STATUS_VENCIDO;
  if (x.includes("AVENC") || x.includes("A VENC")) return STATUS_A_VENCER;
  return x;
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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return null;
}

// compara ISO yyyy-mm-dd lexicograficamente funciona
function isBeforeOrEq(isoA, isoB) {
  if (!isoA || !isoB) return false;
  return isoA <= isoB;
}
function isAfter(isoA, isoB) {
  if (!isoA || !isoB) return false;
  return isoA > isoB;
}

function agingBucketLabel(aging) {
  const a = String(aging ?? "").trim();
  return a.length ? a.toUpperCase() : "SEM AGING";
}

function diasBucketLabel(d) {
  const n = Number(d);
  if (!Number.isFinite(n)) return "(sem dias)";
  if (n <= 0) return "0";
  if (n <= 7) return "1-7";
  if (n <= 15) return "8-15";
  if (n <= 30) return "16-30";
  if (n <= 60) return "31-60";
  if (n <= 90) return "61-90";
  return "90+";
}

/* =========================
   Component
========================= */
export default function ContasReceberDashboard() {
  const [user, setUser] = useState(null);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");

  const projectTitle = useMemo(
    () => projects.find((p) => p.id === projectId)?.title || "",
    [projects, projectId]
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filtro Data Base
  const [dataBaseSelected, setDataBaseSelected] = useState("__ALL__");

  // ✅ ORDEM NOVA: Fundos → Inadimplência → Hierarquia
  const [view, setView] = useState("fundos"); // fundos | inadimplencia | hierarquia

  // Expand sets (separados por view)
  const [openHier, setOpenHier] = useState(() => new Set());
  const [openFundos, setOpenFundos] = useState(() => new Set());
  const [openInad, setOpenInad] = useState(() => new Set());

  // Aging toggles (por view)
  // Hierarquia: abre/fecha aging para Vencido/A Vencer
  const [hierAgingOpenVenc, setHierAgingOpenVenc] = useState(false);
  const [hierAgingOpenAV, setHierAgingOpenAV] = useState(false);

  // Fundos: A Vencer abre/fecha aging
  const [fundosAgingOpen, setFundosAgingOpen] = useState(false);

  // Inadimplência: A Vencer abre/fecha aging (e aging abre dias quando clicar no bucket)
  const [inadAgingOpenAV, setInadAgingOpenAV] = useState(false);
  const [openDiasByAging, setOpenDiasByAging] = useState(() => new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  // Carrega projetos do user
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

  // Carrega contas_receber
  useEffect(() => {
    if (!projectId) return;

    (async () => {
      setLoading(true);
      setErr("");

      // reset UI relevantes ao mudar projeto
      setOpenHier(new Set());
      setOpenFundos(new Set());
      setOpenInad(new Set());

      setHierAgingOpenVenc(false);
      setHierAgingOpenAV(false);
      setFundosAgingOpen(false);
      setInadAgingOpenAV(false);
      setOpenDiasByAging(new Set());
      setDataBaseSelected("__ALL__");

      try {
        const { data, error } = await supabase
          .from("contas_receber")
          .select(
            `
            id, projeto_id,
            tipo, subtipo, grupo, classificacao, nat_financeira, sacado,
            portador, operacao,
            status, aging, dias,
            valor,
            data_de_vencimento,
            data_base
          `
          )
          .eq("projeto_id", projectId)
          .limit(20000);

        if (error) throw error;

        // normaliza datas para garantir comparação
        const norm = (data || []).map((r) => ({
          ...r,
          __data_base_iso: toISO(r.data_base),
          __venc_iso: toISO(r.data_de_vencimento),
        }));

        setRows(norm);
      } catch (e) {
        console.error(e);
        setErr(e.message || "Erro ao consultar contas_receber.");
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

      let calc = normStatus(r.status); // fallback se não tiver datas
      if (ref && venc) {
        if (isBeforeOrEq(venc, ref)) calc = STATUS_VENCIDO;
        else if (isAfter(venc, ref)) calc = STATUS_A_VENCER;
      }

      return { ...r, __status_calc: calc };
    });
  }, [rows, dataBaseSelected]);

  /* =========================
     Totals (by calc status)
  ========================= */
  const totals = useMemo(() => {
    const total = sumValor(filteredRows);
    const vencido = sumValor(filteredRows.filter((r) => r.__status_calc === STATUS_VENCIDO));
    const avencer = sumValor(filteredRows.filter((r) => r.__status_calc === STATUS_A_VENCER));
    return { total, vencido, avencer };
  }, [filteredRows]);

  /* =========================
     Aging buckets (by calc status)
  ========================= */
  const agingBuckets = useMemo(() => {
    const venc = Array.from(
      new Set(
        filteredRows
          .filter((r) => r.__status_calc === STATUS_VENCIDO)
          .map((r) => agingBucketLabel(r.aging))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    const av = Array.from(
      new Set(
        filteredRows
          .filter((r) => r.__status_calc === STATUS_A_VENCER)
          .map((r) => agingBucketLabel(r.aging))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return { vencido: venc, aVencer: av };
  }, [filteredRows]);

  /* =========================
     Inad: dias helpers
  ========================= */
  function toggleAgingDias(agingLabel) {
    setOpenDiasByAging((prev) => {
      const next = new Set(prev);
      if (next.has(agingLabel)) next.delete(agingLabel);
      else next.add(agingLabel);
      return next;
    });
  }

  function isAgingDiasOpen(agingLabel) {
    return openDiasByAging.has(agingLabel);
  }

  /* =========================
     VIEW 1 — HIERARQUIA
     Tipo → Subtipo → Grupo → Classificação → Nat Financeira → Sacado

     ✅ Colunas: VENCIDO | A VENCER | TOTAL (TOTAL por último)
     ✅ Aging abre/fecha clicando nos headers de VENCIDO / A VENCER
     ✅ Quando aberto, clicar em qualquer bucket header fecha e volta (mesma UX)
  ========================= */
  const colsHier = useMemo(() => {
    // base: vencido + avencer + total
    if (!hierAgingOpenVenc && !hierAgingOpenAV) {
      return [
        { id: "vencido", label: "VENCIDO", kind: STATUS_VENCIDO },
        { id: "avencer", label: "A VENCER", kind: STATUS_A_VENCER },
        { id: "total", label: "TOTAL" },
      ];
    }

    const cols = [];

    if (hierAgingOpenVenc) {
      const buckets = agingBuckets.vencido.length ? agingBuckets.vencido : ["SEM AGING"];
      for (const a of buckets) cols.push({ id: `v:${a}`, label: `VENCIDO · ${a}`, kind: STATUS_VENCIDO, aging: a });
    } else {
      cols.push({ id: "vencido", label: "VENCIDO", kind: STATUS_VENCIDO });
    }

    if (hierAgingOpenAV) {
      const buckets = agingBuckets.aVencer.length ? agingBuckets.aVencer : ["SEM AGING"];
      for (const a of buckets) cols.push({ id: `a:${a}`, label: `A VENCER · ${a}`, kind: STATUS_A_VENCER, aging: a });
    } else {
      cols.push({ id: "avencer", label: "A VENCER", kind: STATUS_A_VENCER });
    }

    cols.push({ id: "total", label: "TOTAL" }); // TOTAL sempre por último
    return cols;
  }, [hierAgingOpenVenc, hierAgingOpenAV, agingBuckets]);

  function valueForHierCol(nodeRows, col) {
    if (col.id === "total") return sumValor(nodeRows);
    const filtered = (nodeRows || []).filter((r) => r.__status_calc === col.kind);
    if (!col.aging) return sumValor(filtered);
    return sumValor(filtered.filter((r) => agingBucketLabel(r.aging) === col.aging));
  }

  const treeHier = useMemo(() => {
    const root = [];
    const lvl1 = groupBy(filteredRows, (r) => safeStr(r.tipo, "SEM TIPO"));

    for (const [tipo, tipoRows] of lvl1.entries()) {
      const nodeTipo = { key: `tipo:${tipo}`, label: tipo, rows: tipoRows, children: [] };

      const lvl2 = groupBy(tipoRows, (r) => safeStr(r.subtipo, "SEM SUBTIPO"));
      for (const [subtipo, subRows] of lvl2.entries()) {
        const nodeSub = { key: `subtipo:${tipo}|${subtipo}`, label: subtipo, rows: subRows, children: [] };

        const lvl3 = groupBy(subRows, (r) => safeStr(r.grupo, "SEM GRUPO"));
        for (const [grupo, gRows] of lvl3.entries()) {
          const nodeG = { key: `grupo:${tipo}|${subtipo}|${grupo}`, label: grupo, rows: gRows, children: [] };

          const lvl4 = groupBy(gRows, (r) => safeStr(r.classificacao, "SEM CLASSIFICAÇÃO"));
          for (const [cls, cRows] of lvl4.entries()) {
            const nodeC = { key: `cls:${tipo}|${subtipo}|${grupo}|${cls}`, label: cls, rows: cRows, children: [] };

            const lvl5 = groupBy(cRows, (r) => safeStr(r.nat_financeira, "SEM NAT FIN"));
            for (const [nat, nRows] of lvl5.entries()) {
              const nodeN = { key: `nat:${tipo}|${subtipo}|${grupo}|${cls}|${nat}`, label: nat, rows: nRows, children: [] };

              const lvl6 = groupBy(nRows, (r) => safeStr(r.sacado, "SEM SACADO"));
              for (const [sacado, sRows] of lvl6.entries()) {
                nodeN.children.push({
                  key: `sacado:${tipo}|${subtipo}|${grupo}|${cls}|${nat}|${sacado}`,
                  label: sacado,
                  rows: sRows,
                  children: [],
                });
              }

              nodeC.children.push(nodeN);
            }

            nodeG.children.push(nodeC);
          }

          nodeSub.children.push(nodeG);
        }

        nodeTipo.children.push(nodeSub);
      }

      root.push(nodeTipo);
    }

    const sortRec = (nodes) => {
      nodes.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
      for (const n of nodes) sortRec(n.children || []);
    };
    sortRec(root);

    return root;
  }, [filteredRows]);

  function renderNodeHier(node, depth = 0) {
    const expanded = openHier.has(node.key);
    const hasChildren = (node.children || []).length > 0;

    return (
      <React.Fragment key={node.key}>
        <div style={{ ...rowWrap, paddingLeft: 14 + depth * 18 }}>
          <div style={rowLeft}>
            {hasChildren ? (
              <button
                type="button"
                style={expBtn}
                onClick={() =>
                  setOpenHier((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.key)) next.delete(node.key);
                    else next.add(node.key);
                    return next;
                  })
                }
              >
                {expanded ? "▾" : "▸"}
              </button>
            ) : (
              <div style={{ width: 36 }} />
            )}
            <div style={rowLabel}>{node.label}</div>
          </div>

          <div style={{ ...rowGrid, gridTemplateColumns: `repeat(${colsHier.length}, minmax(160px, 1fr))` }}>
            {colsHier.map((c) => (
              <div key={c.id} style={cell}>
                <span style={cellValue}>{brl(valueForHierCol(node.rows, c))}</span>
              </div>
            ))}
          </div>
        </div>

        {expanded && hasChildren ? node.children.map((ch) => renderNodeHier(ch, depth + 1)) : null}
      </React.Fragment>
    );
  }

  function renderHeadHier() {
    return (
      <div style={tableHeadWrap}>
        <div style={headLeft}>ESTRUTURA</div>

        <div style={{ ...headGrid, gridTemplateColumns: `repeat(${colsHier.length}, minmax(160px, 1fr))` }}>
          {colsHier.map((c) => {
            const isVClosed = c.id === "vencido";
            const isAClosed = c.id === "avencer";

            const isVBucket = String(c.id).startsWith("v:");
            const isABucket = String(c.id).startsWith("a:");

            // ✅ VENCIDO (fechado) abre
            if (isVClosed) {
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{ ...headCellBtn, color: "#fecaca" }}
                  onClick={() => setHierAgingOpenVenc(true)}
                  title="Abrir Aging do Vencido"
                >
                  {c.label}
                </button>
              );
            }

            // ✅ VENCIDO bucket: clicar fecha e volta pro fechado
            if (isVBucket) {
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{ ...headCellBtn, color: "#fecaca" }}
                  onClick={() => setHierAgingOpenVenc(false)}
                  title="Fechar Aging do Vencido"
                >
                  {c.label}
                </button>
              );
            }

            // ✅ A VENCER (fechado) abre
            if (isAClosed) {
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{ ...headCellBtn, color: "#bbf7d0" }}
                  onClick={() => setHierAgingOpenAV(true)}
                  title="Abrir Aging do A Vencer"
                >
                  {c.label}
                </button>
              );
            }

            // ✅ A VENCER bucket: clicar fecha e volta pro fechado
            if (isABucket) {
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{ ...headCellBtn, color: "#bbf7d0" }}
                  onClick={() => setHierAgingOpenAV(false)}
                  title="Fechar Aging do A Vencer"
                >
                  {c.label}
                </button>
              );
            }

            // TOTAL (sempre por último)
            return (
              <div key={c.id} style={headCell}>
                {c.label}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* =========================
     VIEW 2 — FUNDOS
     Portador → Operação

     ✅ Colunas: VENCIDO | A VENCER (ou aging buckets) | TOTAL
     ✅ A VENCER abre aging; clique em bucket header fecha
  ========================= */
  const fundosAgingBuckets = useMemo(() => {
    if (!fundosAgingOpen) return [];
    const all = Array.from(new Set(filteredRows.map((r) => agingBucketLabel(r.aging))));
    all.sort((a, b) => a.localeCompare(b, "pt-BR"));
    return all;
  }, [filteredRows, fundosAgingOpen]);

  const treeFundos = useMemo(() => {
    const root = [];
    const lvl1 = groupBy(filteredRows, (r) => safeStr(r.portador, "SEM PORTADOR"));

    for (const [portador, pRows] of lvl1.entries()) {
      const nodeP = { key: `portador:${portador}`, label: portador, rows: pRows, children: [] };

      const lvl2 = groupBy(pRows, (r) => safeStr(r.operacao, "SEM OPERAÇÃO"));
      for (const [op, oRows] of lvl2.entries()) {
        nodeP.children.push({
          key: `op:${portador}|${op}`,
          label: op,
          rows: oRows,
          children: [],
        });
      }

      nodeP.children.sort((a, b) => sumValor(b.rows) - sumValor(a.rows));
      root.push(nodeP);
    }

    root.sort((a, b) => sumValor(b.rows) - sumValor(a.rows));
    return root;
  }, [filteredRows]);

  function sumByStatus(rowsArr, statusWanted, agingWanted = null) {
    const base = (rowsArr || []).filter((r) => r.__status_calc === statusWanted);
    if (!agingWanted) return sumValor(base);
    return sumValor(base.filter((r) => agingBucketLabel(r.aging) === agingWanted));
  }

  function renderNodeFundos(node, depth = 0) {
    const expanded = openFundos.has(node.key);
    const hasChildren = (node.children || []).length > 0;

    const colCount = fundosAgingOpen ? 1 + fundosAgingBuckets.length + 2 : 3; // VENCIDO + (AV buckets) + TOTAL = 2 + buckets + 1 (vencido)

    return (
      <React.Fragment key={node.key}>
        <div style={{ ...rowWrap, paddingLeft: 14 + depth * 18 }}>
          <div style={rowLeft}>
            {hasChildren ? (
              <button
                type="button"
                style={expBtn}
                onClick={() =>
                  setOpenFundos((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.key)) next.delete(node.key);
                    else next.add(node.key);
                    return next;
                  })
                }
              >
                {expanded ? "▾" : "▸"}
              </button>
            ) : (
              <div style={{ width: 36 }} />
            )}
            <div style={rowLabel}>{node.label}</div>
          </div>

          <div style={{ ...rowGrid, gridTemplateColumns: `repeat(${colCount}, minmax(180px, 1fr))` }}>
            {/* VENCIDO */}
            <div style={cell}>
              <span style={{ ...cellValue, color: "#fecaca" }}>{brl(sumByStatus(node.rows, STATUS_VENCIDO))}</span>
            </div>

            {/* A VENCER (ou buckets) */}
            {!fundosAgingOpen ? (
              <div style={cell}>
                <span style={{ ...cellValue, color: "#bbf7d0" }}>{brl(sumByStatus(node.rows, STATUS_A_VENCER))}</span>
              </div>
            ) : (
              fundosAgingBuckets.map((a) => (
                <div key={`av:${node.key}:${a}`} style={cell}>
                  <span style={{ ...cellValue, color: "#bbf7d0" }}>
                    {brl(sumByStatus(node.rows, STATUS_A_VENCER, a))}
                  </span>
                </div>
              ))
            )}

            {/* TOTAL por último */}
            <div style={cell}>
              <span style={cellValue}>{brl(sumValor(node.rows))}</span>
            </div>
          </div>
        </div>

        {expanded && hasChildren ? node.children.map((ch) => renderNodeFundos(ch, depth + 1)) : null}
      </React.Fragment>
    );
  }

  function renderHeadFundos() {
    // ✅ ordem: VENCIDO | A VENCER (ou buckets) | TOTAL
    const labels = fundosAgingOpen
      ? ["VENCIDO", ...fundosAgingBuckets.map((a) => `A VENCER · ${a}`), "TOTAL"]
      : ["VENCIDO", "A VENCER", "TOTAL"];

    return (
      <div style={tableHeadWrap}>
        <div style={headLeft}>PORTADOR / OPERAÇÃO</div>

        <div style={{ ...headGrid, gridTemplateColumns: `repeat(${labels.length}, minmax(180px, 1fr))` }}>
          {labels.map((label) => {
            // VENCIDO (fixo)
            if (label === "VENCIDO") {
              return (
                <div key={label} style={{ ...headCell, color: "#fecaca" }}>
                  {label}
                </div>
              );
            }

            // A VENCER (fechado) abre aging
            if (label === "A VENCER") {
              return (
                <button
                  key={label}
                  type="button"
                  style={{ ...headCellBtn, color: "#bbf7d0" }}
                  onClick={() => setFundosAgingOpen(true)}
                  title="Abrir Aging do A Vencer"
                >
                  {label}
                </button>
              );
            }

            // buckets: clicar fecha aging
            if (label.startsWith("A VENCER ·")) {
              return (
                <button
                  key={label}
                  type="button"
                  style={{ ...headCellBtn, color: "#bbf7d0" }}
                  onClick={() => setFundosAgingOpen(false)}
                  title="Fechar Aging do A Vencer"
                >
                  {label}
                </button>
              );
            }

            // TOTAL
            return (
              <div key={label} style={headCell}>
                {label}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* =========================
     VIEW 3 — INADIMPLÊNCIA
     Sacado → Portador

     ✅ Colunas: VENCIDO | A VENCER | TOTAL
     ✅ Ao clicar em A VENCER abre aging
     ✅ Ao clicar em bucket header do aging fecha e volta pra A VENCER
     ✅ Ao clicar no bucket (célula) abre DIAS (igual você já tinha)
  ========================= */
  const treeInad = useMemo(() => {
    const root = [];
    const lvl1 = groupBy(filteredRows, (r) => safeStr(r.sacado, "SEM SACADO"));

    for (const [sacado, sRows] of lvl1.entries()) {
      const nodeS = { key: `sacado:${sacado}`, label: sacado, rows: sRows, children: [] };

      const lvl2 = groupBy(sRows, (r) => safeStr(r.portador, "SEM PORTADOR"));
      for (const [portador, pRows] of lvl2.entries()) {
        nodeS.children.push({
          key: `inad:${sacado}|${portador}`,
          label: portador,
          rows: pRows,
          children: [],
        });
      }

      nodeS.children.sort((a, b) => sumValor(b.rows) - sumValor(a.rows));
      root.push(nodeS);
    }

    root.sort((a, b) => sumValor(b.rows) - sumValor(a.rows));
    return root;
  }, [filteredRows]);

  function sumByAgingAndStatus(rowsArr, statusWanted, agingLabel) {
    const base = (rowsArr || []).filter((r) => r.__status_calc === statusWanted);
    return sumValor(base.filter((r) => agingBucketLabel(r.aging) === agingLabel));
  }

  function diasBucketsFor(rowsArr, statusWanted, agingLabel) {
    const only = (rowsArr || []).filter((r) => r.__status_calc === statusWanted && agingBucketLabel(r.aging) === agingLabel);

    const m = new Map();
    for (const r of only) {
      const k = diasBucketLabel(r.dias);
      m.set(k, (m.get(k) || 0) + Number(r.valor || 0));
    }

    const keys = Array.from(m.keys());
    const order = ["0", "1-7", "8-15", "16-30", "31-60", "61-90", "90+", "(sem dias)"];
    keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    return keys.map((k) => ({ label: k, value: m.get(k) || 0 }));
  }

  function renderNodeInad(node, depth = 0) {
    const expanded = openInad.has(node.key);
    const hasChildren = (node.children || []).length > 0;

    const avBuckets = agingBuckets.aVencer.length ? agingBuckets.aVencer : ["SEM AGING"];
    const colCount = inadAgingOpenAV ? 1 + avBuckets.length + 2 : 3; // VENCIDO + (AV buckets) + TOTAL

    return (
      <React.Fragment key={node.key}>
        <div style={{ ...rowWrap, paddingLeft: 14 + depth * 18 }}>
          <div style={rowLeft}>
            {hasChildren ? (
              <button
                type="button"
                style={expBtn}
                onClick={() =>
                  setOpenInad((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.key)) next.delete(node.key);
                    else next.add(node.key);
                    return next;
                  })
                }
              >
                {expanded ? "▾" : "▸"}
              </button>
            ) : (
              <div style={{ width: 36 }} />
            )}
            <div style={rowLabel}>{node.label}</div>
          </div>

          <div style={{ ...rowGrid, gridTemplateColumns: `repeat(${colCount}, minmax(180px, 1fr))` }}>
            {/* VENCIDO */}
            <div style={cell}>
              <span style={{ ...cellValue, color: "#fecaca" }}>
                {brl(sumByStatus(node.rows, STATUS_VENCIDO))}
              </span>
            </div>

            {/* A VENCER (ou buckets) */}
            {!inadAgingOpenAV ? (
              <div style={cell}>
                <span style={{ ...cellValue, color: "#bbf7d0" }}>
                  {brl(sumByStatus(node.rows, STATUS_A_VENCER))}
                </span>
              </div>
            ) : (
              avBuckets.map((a) => {
                const v = sumByAgingAndStatus(node.rows, STATUS_A_VENCER, a);
                return (
                  <div
                    key={`inad:${node.key}:av:${a}`}
                    style={{ ...cell, cursor: "pointer", textDecoration: "underline" }}
                    title="Clique para abrir/fechar Dias"
                    onClick={() => toggleAgingDias(`AV|${a}`)}
                  >
                    <span style={{ ...cellValue, color: "#bbf7d0" }}>{brl(v)}</span>
                  </div>
                );
              })
            )}

            {/* TOTAL por último */}
            <div style={cell}>
              <span style={cellValue}>{brl(sumValor(node.rows))}</span>
            </div>
          </div>
        </div>

        {/* filhos Sacado → Portador */}
        {expanded && hasChildren ? node.children.map((ch) => renderNodeInad(ch, depth + 1)) : null}

        {/* Dias breakdown somente no nível Portador (folha) */}
        {inadAgingOpenAV && !hasChildren && expanded ? (
          (agingBuckets.aVencer.length ? agingBuckets.aVencer : ["SEM AGING"]).map((a) => {
            const k = `AV|${a}`;
            if (!openDiasByAging.has(k)) return null;

            const diasRows = diasBucketsFor(node.rows, STATUS_A_VENCER, a);
            if (!diasRows.length) return null;

            return (
              <div key={`dias:${node.key}:${a}`} style={{ padding: "0 16px 8px", marginTop: 4 }}>
                <div style={{ color: "#9ca3af", fontWeight: 900, fontSize: 12, marginBottom: 6 }}>
                  {node.label} · {a} · Dias (A Vencer)
                </div>

                {diasRows.map((d) => (
                  <div
                    key={`dias:${node.key}:${a}:${d.label}`}
                    style={{
                      ...dataRow,
                      padding: "10px 12px",
                      display: "grid",
                      gridTemplateColumns: "minmax(420px, 1fr) 220px",
                      gap: 10,
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ ...cell, justifyContent: "flex-start" }}>
                      <div style={{ fontWeight: 900 }}>DIAS · {d.label}</div>
                    </div>
                    <div style={{ ...cell, textAlign: "right" }}>
                      <span style={{ ...cellValue, color: "#bbf7d0" }}>{brl(d.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        ) : null}
      </React.Fragment>
    );
  }

  function renderHeadInad() {
    const avBuckets = agingBuckets.aVencer.length ? agingBuckets.aVencer : ["SEM AGING"];

    // ✅ ordem: VENCIDO | A VENCER (ou buckets) | TOTAL
    const labels = inadAgingOpenAV
      ? ["VENCIDO", ...avBuckets.map((a) => `A VENCER · ${a}`), "TOTAL"]
      : ["VENCIDO", "A VENCER", "TOTAL"];

    return (
      <div style={tableHeadWrap}>
        <div style={headLeft}>SACADO / PORTADOR</div>

        <div style={{ ...headGrid, gridTemplateColumns: `repeat(${labels.length}, minmax(180px, 1fr))` }}>
          {labels.map((label) => {
            if (label === "VENCIDO") {
              return (
                <div key={label} style={{ ...headCell, color: "#fecaca" }}>
                  {label}
                </div>
              );
            }

            if (label === "A VENCER") {
              return (
                <button
                  key={label}
                  type="button"
                  style={{ ...headCellBtn, color: "#bbf7d0" }}
                  onClick={() => setInadAgingOpenAV(true)}
                  title="Abrir Aging do A Vencer"
                >
                  {label}
                </button>
              );
            }

            if (label.startsWith("A VENCER ·")) {
              // ✅ bucket header clicável fecha e volta pro fechado
              return (
                <button
                  key={label}
                  type="button"
                  style={{ ...headCellBtn, color: "#bbf7d0" }}
                  onClick={() => setInadAgingOpenAV(false)}
                  title="Fechar Aging do A Vencer"
                >
                  {label}
                </button>
              );
            }

            return (
              <div key={label} style={headCell}>
                {label}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function sumByStatus(rowsArr, st) {
    return sumValor((rowsArr || []).filter((r) => r.__status_calc === st));
  }

  /* =========================
     UI
  ========================= */
  return (
    <div style={page}>
      <div style={topLine}>
        <div>
          <h1 style={h1}>Contas a Receber</h1>
          <div style={sub}>Posição de Fundos, Inadimplência e Posição Vencidos/A Vencer (por Data Base).</div>
        </div>

        <div style={rightControls}>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={select}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

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

      {err ? <div style={errorBox}>{err}</div> : null}

      {/* KPIs (colunas não importam, mas mantém padrão) */}
      <div style={cards}>
        <div style={card}>
          <div style={kicker}>LINHAS</div>
          <div style={big}>{filteredRows.length}</div>
        </div>

        <div style={card}>
          <div style={{ ...kicker, color: "#fecaca" }}>VENCIDO</div>
          <div style={big}>{brl(totals.vencido)}</div>
        </div>

        <div style={card}>
          <div style={{ ...kicker, color: "#bbf7d0" }}>A VENCER</div>
          <div style={big}>{brl(totals.avencer)}</div>
        </div>

        <div style={card}>
          <div style={kicker}>TOTAL</div>
          <div style={big}>{brl(totals.total)}</div>
        </div>
      </div>

      {/* Tabs (ordem nova) */}
      <div style={tabsRow}>
        <button
          type="button"
          onClick={() => setView("fundos")}
          style={{ ...tabBtn, ...(view === "fundos" ? tabBtnActive : null) }}
        >
          Posição de Fundos
        </button>

        <button
          type="button"
          onClick={() => setView("inadimplencia")}
          style={{ ...tabBtn, ...(view === "inadimplencia" ? tabBtnActive : null) }}
        >
          Inadimplência
        </button>

        <button
          type="button"
          onClick={() => setView("hierarquia")}
          style={{ ...tabBtn, ...(view === "hierarquia" ? tabBtnActive : null) }}
        >
          Posição Vencidos e A Vencer
        </button>
      </div>

      <div style={panel}>
        <div style={panelHead}>
          <div>
            {view === "fundos" ? (
              <>
                <div style={panelTitle}>Posição de Fundos</div>
                <div style={panelHint}>Portador → Operação. A Vencer abre Aging.</div>
              </>
            ) : view === "inadimplencia" ? (
              <>
                <div style={panelTitle}>Inadimplência</div>
                <div style={panelHint}>Sacado → Portador. A Vencer abre Aging e Aging abre Dias.</div>
              </>
            ) : (
              <>
                <div style={panelTitle}>Posição Vencidos e A Vencer</div>
                <div style={panelHint}>Hierarquia completa. Vencido/A Vencer abrem Aging. Total sempre por último.</div>
              </>
            )}
          </div>
        </div>

        {view === "fundos" ? renderHeadFundos() : view === "inadimplencia" ? renderHeadInad() : renderHeadHier()}

        {loading ? (
          <div style={{ padding: 18, color: "#9ca3af" }}>Carregando…</div>
        ) : (
          <div style={{ paddingBottom: 10 }}>
            {view === "fundos"
              ? treeFundos.map((n) => renderNodeFundos(n, 0))
              : view === "inadimplencia"
              ? treeInad.map((n) => renderNodeInad(n, 0))
              : treeHier.map((n) => renderNodeHier(n, 0))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, color: "#9ca3af", fontSize: 12 }}>
        Projeto atual: <b style={{ color: "#e5e7eb" }}>{projectTitle}</b>
      </div>
    </div>
  );
}

/* ======================
   Styles (dark premium)
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

const cards = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 14 };
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

const tableHeadWrap = { display: "grid", gridTemplateColumns: "minmax(320px, 1fr) 3fr", gap: 10, padding: "10px 16px" };
const headLeft = { color: "#e5e7eb", fontWeight: 950, letterSpacing: "0.12em", fontSize: 12 };
const headGrid = { display: "grid", gap: 10, alignItems: "center" };
const headCell = { color: "#e5e7eb", fontWeight: 950, letterSpacing: "0.10em", fontSize: 12, textAlign: "right" };
const headCellBtn = {
  appearance: "none",
  border: "0",
  background: "transparent",
  fontWeight: 950,
  letterSpacing: "0.10em",
  fontSize: 12,
  textAlign: "right",
  cursor: "pointer",
};

const rowWrap = {
  display: "grid",
  gridTemplateColumns: "minmax(320px, 1fr) 3fr",
  gap: 10,
  padding: "10px 16px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const rowLeft = { display: "flex", alignItems: "center", gap: 10, minWidth: 0 };
const expBtn = {
  width: 36,
  height: 36,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "#e5e7eb",
  fontWeight: 900,
  cursor: "pointer",
};
const rowLabel = { fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

const rowGrid = { display: "grid", gap: 10, alignItems: "center" };
const cell = { textAlign: "right" };
const cellValue = { fontWeight: 950, fontSize: 16 };

const dataRow = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.18)",
};
