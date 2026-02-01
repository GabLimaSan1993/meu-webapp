// src/pages/UploadPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import Papa from "papaparse";

const INDICATORS = [
  { key: "faturamento", label: "Faturamento", accept: ".csv,.xlsx" },
  { key: "contas_pagar", label: "Contas a Pagar", accept: ".csv,.xlsx" },
  { key: "contas_receber", label: "Contas a Receber", accept: ".csv,.xlsx" },
  { key: "taxas", label: "Taxas", accept: ".csv,.xlsx" },
  { key: "disp_mp", label: "Disponibilidade x Matéria Prima", accept: ".csv,.xlsx" },
  { key: "estoque", label: "Estoque", accept: ".csv,.xlsx" },
  { key: "fc_realizado", label: "Fluxo de Caixa Realizado", accept: ".csv,.xlsx,.ofx" },
  { key: "fc_projetado", label: "Fluxo de Caixa Projetado (futuro)", accept: ".csv,.xlsx", disabled: true },
  { key: "dre", label: "DRE (futuro)", accept: ".csv,.xlsx", disabled: true },
  { key: "balanco", label: "Balanço (futuro)", accept: ".csv,.xlsx", disabled: true },
  { key: "balancete", label: "Balancete (futuro)", accept: ".csv,.xlsx", disabled: true },
];

const PREVIEW_LIMIT = 20;
const UPSERT_BATCH_SIZE = 500;

// ✅ precisa existir índice único (projeto_id, import_hash) nas tabelas
const FATURAMENTO_ON_CONFLICT = "projeto_id,import_hash";
const CONTAS_PAGAR_ON_CONFLICT = "projeto_id,import_hash";

// ✅ aba preferida por indicador (quando XLSX)
const SHEET_PREF_BY_INDICATOR = {
  contas_pagar: "BD",
  // se no futuro faturamento vier em outra aba, você põe aqui também
  // faturamento: "BD",
};

function UploadPage() {
  const [user, setUser] = useState(null);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");

  const [indicatorKey, setIndicatorKey] = useState("faturamento");
  const indicator = useMemo(
    () => INDICATORS.find((i) => i.key === indicatorKey) || INDICATORS[0],
    [indicatorKey]
  );

  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // fluxo
  const [step, setStep] = useState("upload"); // upload | preview | done
  const [storagePath, setStoragePath] = useState("");
  const [rows, setRows] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [importBatchId, setImportBatchId] = useState(null);

  // relatório
  const [rowsProcessed, setRowsProcessed] = useState(0);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      setUser(data.user);
    }
    init();
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadProjects() {
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
    }

    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function resetMessages() {
    setMsg("");
    setErr("");
  }

  function onChangeFile(e) {
    resetMessages();
    const f = e.target.files?.[0];
    if (!f) return setFile(null);
    setFile(f);

    // reset fluxo
    setStep("upload");
    setStoragePath("");
    setRows([]);
    setPreviewRows([]);
    setImportBatchId(null);

    // reset relatório
    setRowsProcessed(0);
    setDuplicatesRemoved(0);
  }

  function normalizeFilename(name) {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]+/g, "_");
  }

  // ============================
  // Utils de parsing / normalização
  // ============================

  function normHeader(s = "") {
    return s
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^\w_]/g, "");
  }

  function normalizeRowKeys(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[normHeader(k)] = v;
    return out;
  }

  function toNumber(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return v;
    const s = v.toString().trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function toBool(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "boolean") return v;
    const s = v.toString().trim().toLowerCase();
    if (["1", "true", "sim", "s", "yes", "y"].includes(s)) return true;
    if (["0", "false", "nao", "não", "n", "no"].includes(s)) return false;
    return null;
  }

  function toDateISO(v) {
    if (!v && v !== 0) return null;

    // Excel serial
    if (typeof v === "number") {
      const d = XLSX.SSF.parse_date_code(v);
      if (d?.y && d?.m && d?.d) {
        return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      }
    }

    const s = v.toString().trim();
    if (!s) return null;

    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // dd/mm/yyyy
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    return null;
  }

  function cleanStr(v) {
    return String(v ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  // ============================
  // Hashes (dedup)
  // ============================

  function makeImportHashFaturamento(row) {
    const dataISO = toDateISO(row.data_de_emissao);

    const parts = [
      cleanStr(dataISO),
      cleanStr(row.nf),
      cleanStr(row.pedido),
      cleanStr(row.cod_produto),
      cleanStr(toNumber(row.quantidade)),
      cleanStr(toNumber(row.valor_total)),
      cleanStr(row.cfop),
      cleanStr(row.empresa_emissora),
    ];

    return parts.join("|");
  }

  // ✅ Contas a pagar: chave pode repetir, então usamos um “business key” mais robusto
  function makeImportHashContasPagar(row) {
    const vencISO = toDateISO(row.data_de_vencimento);
    const emiISO = toDateISO(row.data_de_emissao);
    const baseISO = toDateISO(row.data_base);

    const parts = [
      cleanStr(row.empresa_do_grupo),
      cleanStr(row.favorecido),
      cleanStr(row.documento),
      cleanStr(row.parcela),
      cleanStr(vencISO),
      cleanStr(emiISO),
      cleanStr(baseISO),
      cleanStr(row.tipo),
      cleanStr(row.subtipo),
      cleanStr(row.grupo),
      cleanStr(row.classificacao),
      cleanStr(row.nat_financeira),
      cleanStr(row.ecg),
      cleanStr(row.exi_disp),
      cleanStr(row.status),
      cleanStr(toNumber(row.valor)),
      cleanStr(row.chave), // entra, mas não depende só dele
    ];

    return parts.join("|");
  }

  async function downloadFromStorage(path) {
    const { data, error } = await supabase.storage.from("uploads").download(path);
    if (error) throw error;
    return data; // Blob
  }

  // ✅ escolhe aba por indicador (XLSX)
  function pickWorksheet(wb, indicatorKey) {
    const pref = SHEET_PREF_BY_INDICATOR[indicatorKey];
    if (!pref) return wb.Sheets[wb.SheetNames[0]];

    // tenta match exato
    if (wb.Sheets[pref]) return wb.Sheets[pref];

    // tenta case-insensitive
    const foundName = wb.SheetNames.find((n) => n.toLowerCase() === pref.toLowerCase());
    if (foundName && wb.Sheets[foundName]) return wb.Sheets[foundName];

    // fallback
    return wb.Sheets[wb.SheetNames[0]];
  }

  async function parseFileFromBlob(blob, ext, indicatorKey) {
    const buf = await blob.arrayBuffer();

    if (ext === "csv") {
      const text = new TextDecoder("utf-8").decode(buf);
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      return (parsed.data || []).map(normalizeRowKeys);
    }

    // xlsx
    const wb = XLSX.read(buf, { type: "array" });
    const ws = pickWorksheet(wb, indicatorKey);
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
    return json.map(normalizeRowKeys);
  }

  // ============================
  // Mappers (DB payload)
  // ============================

  function mapRowToFaturamento(row, projetoId, batchId) {
    const import_hash = makeImportHashFaturamento(row);

    return {
      projeto_id: projetoId,
      import_batch_id: batchId,
      import_hash,

      data_emissao: toDateISO(row.data_de_emissao),

      empresa_emissora: row.empresa_emissora ?? null,
      pedido: row.pedido ?? null,
      tipo_nf: row.tipo_nf ?? null,
      nf: row.nf ?? null,
      cfop: row.cfop ?? null,

      razao_social: row.razao_social ?? null,
      nome_fantasia: row.nome_fantasia ?? null,

      cod_produto: row.cod_produto ?? null,
      descricao: row.descricao ?? null,
      unidade: row.unidade ?? null,

      quantidade: toNumber(row.quantidade),
      vendedor: row.vendedor ?? null,

      valor_unit: toNumber(row.valor_unit),
      valor_total: toNumber(row.valor_total),

      cidade: row.cidade ?? null,
      estado: row.estado ?? null,

      pmv_cimp: toNumber(row.pmv_cimp),
      grupo: row.grupo ?? null,
      familia: row.familia ?? null,
      faturado: toBool(row.faturado),
    };
  }

  function mapRowToContasPagar(row, projetoId, batchId) {
    const import_hash = makeImportHashContasPagar(row);

    return {
      projeto_id: projetoId,
      import_batch_id: batchId,
      import_hash,

      // EMPRESA DO GRUPO vira projeto_id, então não salva aqui (a menos que você queira guardar também)
      documento: row.documento ? String(row.documento).trim() : null,
      favorecido: row.favorecido ? String(row.favorecido).trim() : null,

      data_emissao: toDateISO(row.data_de_emissao), // pode null
      data_vencimento: toDateISO(row.data_de_vencimento), // sempre vem

      parcela: row.parcela ? String(row.parcela).trim() : null,
      valor: toNumber(row.valor),

      data_base: toDateISO(row.data_base),

      chave: row.chave ? String(row.chave).trim() : null,
      descricao: row.descricao ? String(row.descricao).trim() : null,

      tipo: row.tipo ? String(row.tipo).trim() : null,
      subtipo: row.subtipo ? String(row.subtipo).trim() : null,
      grupo: row.grupo ? String(row.grupo).trim() : null,
      classificacao: row.classificacao ? String(row.classificacao).trim() : null,
      nat_financeira: row.nat_financeira ? String(row.nat_financeira).trim() : null,

      ecg: row.ecg ? String(row.ecg).trim() : null,
      exi_disp: row.exi_disp ? String(row.exi_disp).trim() : null,
      status: row.status ? String(row.status).trim() : null,

      dias: toNumber(row.dias),
      aging: row.aging ? String(row.aging).trim() : null,
    };
  }

  // ============================
  // Upload -> Preview
  // ============================

  async function handleUpload(e) {
    e.preventDefault();
    resetMessages();

    if (!user) return setErr("Você precisa estar logado.");
    if (!projectId) return setErr("Selecione um projeto.");
    if (!file) return setErr("Selecione um arquivo.");
    if (indicator.disabled) return setErr("Este indicador está marcado como futuro (ainda não habilitado).");

    setLoading(true);

    try {
      const safeName = normalizeFilename(file.name);
      const path = `${projectId}/${indicatorKey}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        console.error(uploadError);
        setErr(
          uploadError.message?.includes("Bucket not found")
            ? 'Bucket "uploads" não existe no Storage. Crie o bucket "uploads" no Supabase e tente novamente.'
            : uploadError.message || "Erro ao enviar arquivo."
        );
        return;
      }

      setStoragePath(path);

      const ext = safeName.split(".").pop().toLowerCase();
      if (!["csv", "xlsx"].includes(ext)) {
        setMsg("Arquivo enviado com sucesso ✅ (Preview não disponível para este formato)");
        setStep("upload");
        return;
      }

      const blob = await downloadFromStorage(path);
      const parsed = await parseFileFromBlob(blob, ext, indicatorKey);

      const cleaned = (parsed || []).filter((r) =>
        Object.values(r).some((v) => String(v ?? "").trim() !== "")
      );

      setRows(cleaned);
      setPreviewRows(cleaned.slice(0, PREVIEW_LIMIT));
      setStep("preview");

      setMsg("Arquivo enviado com sucesso ✅ Prévia gerada.");
    } catch (ex) {
      console.error(ex);
      setErr(ex.message || "Erro inesperado ao enviar arquivo.");
    } finally {
      setLoading(false);
    }
  }

  // ============================
  // Criar batch
  // ============================

  async function createImportBatch() {
    const batchPayload = {
      user_id: user.id,
      project_id: projectId,
      indicator: indicatorKey,
      storage_path: storagePath,
      rows_count: rows.length,
      created_at: new Date().toISOString(),
      notes: null,
    };

    const { data: batchData, error: batchErr } = await supabase
      .from("import_batches")
      .insert(batchPayload)
      .select("id")
      .single();

    if (batchErr) throw batchErr;

    const batchId = batchData.id;
    setImportBatchId(batchId);
    return batchId;
  }

  // ============================
  // Upserts (Faturamento / Contas a Pagar)
  // ============================

  async function handleUpsert() {
    resetMessages();

    if (!user) return setErr("Você precisa estar logado.");
    if (!projectId) return setErr("Selecione um projeto.");
    if (!rows.length) return setErr("Sem linhas para inserir.");

    const enabled = ["faturamento", "contas_pagar"].includes(indicatorKey);
    if (!enabled) return setErr("Inserção automática ainda não está habilitada para este indicador.");

    setLoading(true);

    try {
      // 1) batch
      const batchId = await createImportBatch();

      // 2) payload
      let payloadRaw = [];
      let onConflict = "";
      let tableName = "";

      if (indicatorKey === "faturamento") {
        tableName = "faturamento";
        onConflict = FATURAMENTO_ON_CONFLICT;
        payloadRaw = rows.map((r) => mapRowToFaturamento(r, projectId, batchId));
      } else if (indicatorKey === "contas_pagar") {
        tableName = "contas_pagar";
        onConflict = CONTAS_PAGAR_ON_CONFLICT;
        payloadRaw = rows.map((r) => mapRowToContasPagar(r, projectId, batchId));
      }

      // 3) dedup dentro do payload
      const dedupMap = new Map();
      for (const item of payloadRaw) dedupMap.set(item.import_hash, item);
      const payload = Array.from(dedupMap.values());

      const removed = payloadRaw.length - payload.length;
      setDuplicatesRemoved(removed);

      // 4) upsert em lotes
      for (let i = 0; i < payload.length; i += UPSERT_BATCH_SIZE) {
        const chunk = payload.slice(i, i + UPSERT_BATCH_SIZE);

        const { error } = await supabase
          .from(tableName)
          .upsert(chunk, { onConflict });

        if (error) throw error;

        setRowsProcessed(Math.min(i + chunk.length, payload.length));
      }

      setMsg(`Upsert concluído ✅ Processadas: ${payload.length} linhas (duplicadas removidas do arquivo: ${removed}).`);
      setStep("done");

      // limpar input
      setFile(null);
      const input = document.getElementById("upload-file-input");
      if (input) input.value = "";
    } catch (ex) {
      console.error(ex);
      setErr(ex.message || "Erro ao inserir/upsert na tabela.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <h1 style={title}>Uploads</h1>
          <p style={subtitle}>
            Envie os arquivos por indicador e por projeto.
          </p>
        </div>
      </header>

      <div style={grid}>
        <section style={card}>
          <div style={cardHeader}>
            <div>
              <div style={kicker}>CONFIGURAÇÃO</div>
              <h2 style={cardTitle}>Selecionar projeto e indicador</h2>
            </div>
          </div>

          <form onSubmit={handleUpload} style={form}>
            <div style={field}>
              <label style={label}>Projeto</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={input}>
                {projects.length === 0 ? (
                  <option value="">Nenhum projeto encontrado</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={field}>
              <label style={label}>Indicador</label>
              <select value={indicatorKey} onChange={(e) => setIndicatorKey(e.target.value)} style={input}>
                {INDICATORS.map((i) => (
                  <option key={i.key} value={i.key} disabled={i.disabled}>
                    {i.label}
                  </option>
                ))}
              </select>
              <div style={hint}>
                Formatos aceitos: <span style={hintStrong}>{indicator.accept}</span>
                {indicator.disabled ? <span style={pillDisabled}>Futuro</span> : <span style={pillEnabled}>Ativo</span>}
              </div>
              {indicatorKey === "contas_pagar" ? (
                <div style={hint}>
                  XLSX: vamos ler preferencialmente a aba <b>BD</b>.
                </div>
              ) : null}
            </div>

            <div style={field}>
              <label style={label}>Arquivo</label>
              <input
                id="upload-file-input"
                type="file"
                accept={indicator.accept}
                onChange={onChangeFile}
                style={fileInput}
              />
              {file ? (
                <div style={fileMeta}>
                  <div style={fileName}>{file.name}</div>
                  <div style={fileSub}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              ) : (
                <div style={fileMetaEmpty}>Nenhum arquivo selecionado.</div>
              )}
            </div>

            {err ? <div style={errorBox}>{err}</div> : null}
            {msg ? <div style={successBox}>{msg}</div> : null}

            {step === "preview" ? (
              <div style={{ ...fileMeta, marginTop: "0.25rem" }}>
                <div style={{ fontWeight: 750, marginBottom: "0.35rem" }}>
                  Pré-visualização (primeiras {PREVIEW_LIMIT} linhas)
                </div>

                <pre style={{ maxHeight: 280, overflow: "auto", fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(previewRows, null, 2)}
                </pre>

                <button
                  type="button"
                  disabled={loading || !["faturamento", "contas_pagar"].includes(indicatorKey)}
                  onClick={handleUpsert}
                  style={{
                    ...button,
                    marginTop: "0.6rem",
                    ...(loading || !["faturamento", "contas_pagar"].includes(indicatorKey) ? buttonDisabled : {}),
                  }}
                >
                  {loading ? "Inserindo..." : "Inserir / Atualizar (sem duplicar)"}
                </button>

                {rowsProcessed ? (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.82rem", color: "#9ca3af" }}>
                    Progresso: <b>{rowsProcessed}</b> / <b>{Math.max(rows.length - duplicatesRemoved, 0)}</b>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === "done" ? (
              <div style={{ ...successBox, marginTop: "0.25rem" }}>
                ✅ Importação finalizada (sem duplicar).
                <div style={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "#d1fae5" }}>
                  Processadas: <b>{Math.max(rows.length - duplicatesRemoved, 0)}</b> | Duplicadas removidas do arquivo:{" "}
                  <b>{duplicatesRemoved}</b>
                </div>
                <div style={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "#d1fae5" }}>
                  Storage path: <b>{storagePath}</b>
                </div>
                {importBatchId ? (
                  <div style={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "#d1fae5" }}>
                    import_batch_id: <b>{importBatchId}</b>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || indicator.disabled || !projectId}
              style={{
                ...button,
                ...(loading || indicator.disabled || !projectId ? buttonDisabled : {}),
              }}
            >
              {loading ? "Enviando..." : "Enviar arquivo"}
            </button>

            <div style={note}>
              <b>Obs:</b> o “Enviar arquivo” manda para o Storage e gera a prévia.  
              Para gravar na tabela, use o botão “Inserir / Atualizar (sem duplicar)” na prévia.
            </div>
          </form>
        </section>

        <aside style={card}>
          <div style={cardHeader}>
            <div>
              <div style={kicker}>CHECKLIST</div>
              <h2 style={cardTitle}>Boas práticas</h2>
            </div>
          </div>

          <ul style={list}>
            <li style={li}>Use sempre o projeto correto antes de enviar.</li>
            <li style={li}>Padronize nomes dos arquivos (ex.: 2025-12_contas_pagar.xlsx).</li>
            <li style={li}>Se o XLSX tiver várias abas, garantimos “BD” em Contas a Pagar.</li>
            <li style={li}>Os módulos marcados como “futuro” ficam bloqueados.</li>
          </ul>

          <div style={divider} />

          <div style={smallCard}>
            <div style={smallTitle}>Storage</div>
            <div style={smallText}>
              Este upload envia para o bucket <b>uploads</b> no Supabase Storage.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* =======================
   VISUAL (PRETO + PRATA)
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
  fontSize: "1.5rem",
  fontWeight: 700,
  letterSpacing: "0.02em",
};

const subtitle = {
  margin: "0.25rem 0 0",
  fontSize: "0.92rem",
  color: "#9ca3af",
  maxWidth: "780px",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
  gap: "1rem",
};

const card = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "1rem",
  padding: "1rem",
  boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: "0.8rem",
};

const kicker = {
  fontSize: "0.72rem",
  color: "#9ca3af",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const cardTitle = {
  margin: "0.2rem 0 0",
  fontSize: "1.05rem",
  fontWeight: 650,
};

const form = {
  display: "flex",
  flexDirection: "column",
  gap: "0.85rem",
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const label = {
  fontSize: "0.78rem",
  color: "#cbd5e1",
};

const input = {
  width: "100%",
  padding: "0.65rem 0.75rem",
  borderRadius: "0.75rem",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "#0b0b0b",
  color: "#f9fafb",
  fontSize: "0.9rem",
  outline: "none",
};

const fileInput = {
  width: "100%",
  padding: "0.65rem 0.75rem",
  borderRadius: "0.75rem",
  border: "1px dashed rgba(255,255,255,0.18)",
  backgroundColor: "#0b0b0b",
  color: "#f9fafb",
  fontSize: "0.9rem",
};

const hint = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
  fontSize: "0.78rem",
  color: "#9ca3af",
};

const hintStrong = { color: "#e5e7eb" };

const pillEnabled = {
  marginLeft: "0.25rem",
  fontSize: "0.7rem",
  padding: "0.16rem 0.45rem",
  borderRadius: "999px",
  border: "1px solid rgba(209,213,219,0.35)",
  backgroundColor: "rgba(209,213,219,0.10)",
  color: "#e5e7eb",
};

const pillDisabled = {
  ...pillEnabled,
  border: "1px solid rgba(148,163,184,0.25)",
  backgroundColor: "rgba(148,163,184,0.08)",
  color: "#9ca3af",
};

const fileMeta = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "0.8rem",
  padding: "0.6rem 0.75rem",
  backgroundColor: "rgba(0,0,0,0.35)",
};

const fileMetaEmpty = {
  fontSize: "0.82rem",
  color: "#9ca3af",
  marginTop: "0.1rem",
};

const fileName = { fontWeight: 650, fontSize: "0.9rem" };
const fileSub = { color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.15rem" };

const button = {
  marginTop: "0.1rem",
  padding: "0.78rem 0.9rem",
  borderRadius: "0.95rem",
  border: "1px solid rgba(209,213,219,0.45)",
  background: "linear-gradient(180deg, #f3f4f6, #d1d5db)",
  color: "#0b0b0b",
  fontWeight: 750,
  cursor: "pointer",
  boxShadow: "0 12px 28px rgba(209,213,219,0.22)",
};

const buttonDisabled = {
  opacity: 0.55,
  cursor: "not-allowed",
};

const errorBox = {
  fontSize: "0.85rem",
  color: "#fecaca",
  backgroundColor: "rgba(127,29,29,0.25)",
  border: "1px solid rgba(239,68,68,0.35)",
  padding: "0.6rem 0.75rem",
  borderRadius: "0.8rem",
};

const successBox = {
  fontSize: "0.85rem",
  color: "#bbf7d0",
  backgroundColor: "rgba(20,83,45,0.25)",
  border: "1px solid rgba(34,197,94,0.35)",
  padding: "0.6rem 0.75rem",
  borderRadius: "0.8rem",
};

const note = {
  marginTop: "0.35rem",
  fontSize: "0.82rem",
  color: "#9ca3af",
  lineHeight: 1.35,
};

const list = { margin: "0.2rem 0 0", paddingLeft: "1.1rem", color: "#cbd5e1" };
const li = { marginBottom: "0.55rem", fontSize: "0.9rem", lineHeight: 1.4 };

const divider = {
  height: "1px",
  backgroundColor: "rgba(255,255,255,0.08)",
  margin: "1rem 0",
};

const smallCard = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "0.9rem",
  padding: "0.75rem",
  backgroundColor: "rgba(0,0,0,0.30)",
};

const smallTitle = { fontWeight: 700, marginBottom: "0.25rem" };
const smallText = { color: "#9ca3af", fontSize: "0.86rem", lineHeight: 1.35 };

export default UploadPage;
