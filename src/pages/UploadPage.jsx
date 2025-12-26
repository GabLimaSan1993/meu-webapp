// src/pages/UploadPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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
  }

  function normalizeFilename(name) {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]+/g, "_");
  }

  async function handleUpload(e) {
    e.preventDefault();
    resetMessages();

    if (!user) {
      setErr("Você precisa estar logado.");
      return;
    }
    if (!projectId) {
      setErr("Selecione um projeto.");
      return;
    }
    if (!file) {
      setErr("Selecione um arquivo.");
      return;
    }
    if (indicator.disabled) {
      setErr("Este indicador está marcado como futuro (ainda não habilitado).");
      return;
    }

    setLoading(true);

    try {
      // Bucket sugerido (você pode criar no Supabase Storage): "uploads"
      // Caminho: <projectId>/<indicatorKey>/<timestamp>_<arquivo>
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

      // Opcional: registrar em uma tabela de logs (se existir).
      // Se não existir, a gente ignora o erro e segue.
      try {
        await supabase.from("indicator_uploads").insert({
          user_id: user.id,
          project_id: projectId,
          indicator: indicatorKey,
          file_name: file.name,
          storage_path: path,
          created_at: new Date().toISOString(),
        });
      } catch (logErr) {
        // não bloqueia o fluxo
        console.warn("Tabela indicator_uploads não existe ou insert falhou (ok por enquanto).", logErr);
      }

      setMsg("Arquivo enviado com sucesso ✅");
      setFile(null);
      // limpa o input file visualmente
      const input = document.getElementById("upload-file-input");
      if (input) input.value = "";
    } catch (ex) {
      console.error(ex);
      setErr("Erro inesperado ao enviar arquivo.");
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
            Envie os arquivos por indicador e por projeto. (Depois entraremos na etapa de prévia + mapeamento)
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
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={input}
              >
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
              <select
                value={indicatorKey}
                onChange={(e) => setIndicatorKey(e.target.value)}
                style={input}
              >
                {INDICATORS.map((i) => (
                  <option key={i.key} value={i.key} disabled={i.disabled}>
                    {i.label}
                  </option>
                ))}
              </select>
              <div style={hint}>
                Formatos aceitos: <span style={hintStrong}>{indicator.accept}</span>
                {indicator.disabled ? (
                  <span style={pillDisabled}>Futuro</span>
                ) : (
                  <span style={pillEnabled}>Ativo</span>
                )}
              </div>
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
                  <div style={fileSub}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              ) : (
                <div style={fileMetaEmpty}>Nenhum arquivo selecionado.</div>
              )}
            </div>

            {err ? <div style={errorBox}>{err}</div> : null}
            {msg ? <div style={successBox}>{msg}</div> : null}

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
              <b>Próximos passos:</b> pré-visualização, seleção de linhas a ignorar e mapeamento de colunas (como você já definiu no fluxo).
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
            <li style={li}>Padronize nomes dos arquivos (ex.: 2025-12_faturamento.csv).</li>
            <li style={li}>No Fluxo de Caixa Realizado, você pode enviar .OFX também.</li>
            <li style={li}>Os módulos marcados como “futuro” ficarão bloqueados por enquanto.</li>
          </ul>

          <div style={divider} />

          <div style={smallCard}>
            <div style={smallTitle}>Storage</div>
            <div style={smallText}>
              Este upload envia para o bucket <b>uploads</b> no Supabase Storage.
              Se ele não existir, crie no painel do Supabase.
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
