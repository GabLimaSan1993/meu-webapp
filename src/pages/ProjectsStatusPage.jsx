// src/pages/ProjectsStatusPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import xchangeLogo from "../assets/xchange-logo.png";

// =========================
// Helpers de visual
// =========================
function getStatusConfig(status) {
  if (!status) {
    return {
      label: "Sem status",
      bg: "rgba(148,163,184,0.12)",
      border: "rgba(148,163,184,0.4)",
      color: "#e5e7eb",
    };
  }

  const normalized = String(status).toLowerCase();

  if (normalized.includes("andamento")) {
    return {
      label: status,
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.6)",
      color: "#bbf7d0",
    };
  }

  if (normalized.includes("análise") || normalized.includes("analise")) {
    return {
      label: status,
      bg: "rgba(129,140,248,0.12)",
      border: "rgba(129,140,248,0.6)",
      color: "#c7d2fe",
    };
  }

  if (normalized.includes("susp") || normalized.includes("hold")) {
    return {
      label: status,
      bg: "rgba(248,113,113,0.12)",
      border: "rgba(248,113,113,0.6)",
      color: "#fecaca",
    };
  }

  return {
    label: status,
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.4)",
    color: "#e5e7eb",
  };
}

function formatPhone(phone) {
  if (!phone) return "—";
  const digits = String(phone).replace(/\D/g, "");

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(
      3,
      7
    )}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // Se não bater 10/11 dígitos, devolve como veio
  return phone;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const cleaned = String(value).replace(/[^\d,-]/g, "").replace(",", ".");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return String(value);

  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// =========================
// Página principal
// =========================
function ProjectsStatusPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState(null); // vindo de profiles.name

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  // Formulário de novo/edição de projeto
  const [empresa, setEmpresa] = useState("");
  const [status, setStatus] = useState("Em Andamento");
  const [responsavel, setResponsavel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [produto, setProduto] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [expectativa, setExpectativa] = useState("");
  const [salvandoProjeto, setSalvandoProjeto] = useState(false);

  // Controle do modal e edição
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null); // null = novo

  // ==========================
  // Carregar usuário + perfil
  // ==========================
  useEffect(() => {
    async function loadUserAndProfile() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        navigate("/login");
        return;
      }

      const currentUser = data.user;
      setUser(currentUser);

      // Busca nome na tabela profiles
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", currentUser.id)
          .single();

        if (profileError) {
          console.error("Erro ao carregar profile:", profileError);
        } else if (profile?.name) {
          setUserName(profile.name);
        }
      } catch (e) {
        console.error("Erro inesperado ao carregar profile:", e);
      }
    }

    loadUserAndProfile();
  }, [navigate]);

  // ==========================
  // Carregar projetos
  // ==========================
  useEffect(() => {
    if (!user) return;

    async function loadProjects() {
      setLoading(true);
      setErro("");

      try {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          // manager_id ou consultant_to iguais ao usuário logado
          .or(`manager_id.eq.${user.id},consultant_to.eq.${user.id}`);

        if (error) {
          console.error("Erro ao buscar projetos:", error);
          setErro("Erro ao carregar projetos. Veja o console.");
        } else {
          setProjects(data || []);
        }
      } catch (e) {
        console.error("Erro inesperado ao buscar projetos:", e);
        setErro("Erro inesperado ao carregar projetos.");
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [user]);

  // ==========================
  // Log de alterações
  // ==========================
  async function registerProjectLog(changeType, beforeData, afterData) {
    try {
      await supabase.from("project_logs").insert({
        project_id: afterData?.id || beforeData?.id || null,
        user_id: user?.id || null,
        change_type: changeType,
        before_data: beforeData || null,
        after_data: afterData || null,
      });
    } catch (logError) {
      // Não quebra a tela se o log falhar, só registra no console
      console.error("Erro ao registrar log de projeto:", logError);
    }
  }

  // ==========================
  // Abrir/fechar modal
  // ==========================
  function openNewProjectModal() {
    setEditingProject(null);
    setEmpresa("");
    setStatus("Em Andamento");
    setResponsavel("");
    setTelefone("");
    setProduto("");
    setObservacoes("");
    setExpectativa("");
    setShowModal(true);
  }

  function openEditProjectModal(project) {
    setEditingProject(project);
    setEmpresa(project.title || "");
    setStatus(project.status || "Em Andamento");
    setResponsavel(project.socio || "");
    setTelefone(project.telefone || "");
    setProduto(project.produto || project.description || "");
    setObservacoes(project.observacoes || "");
    setExpectativa(project.expectativa_investimento || "");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  // ==========================
  // Criar / atualizar projeto
  // ==========================
  async function handleSubmitProject(e) {
    e.preventDefault();
    if (!empresa.trim() || !user) return;

    setSalvandoProjeto(true);
    setErro("");

    const basePayload = {
      title: empresa.trim(),
      status: status || null,
      socio: responsavel.trim() || null,
      telefone: telefone.trim() || null,
      produto: produto.trim() || null,
      observacoes: observacoes.trim() || null,
      expectativa_investimento: expectativa.trim() || null,
    };

    try {
      if (editingProject) {
        // ===== UPDATE =====
        const payloadUpdate = {
          ...basePayload,
        };

        const beforeData = editingProject;

        const { data, error } = await supabase
          .from("projects")
          .update(payloadUpdate)
          .eq("id", editingProject.id)
          .select()
          .single();

        if (error) {
          console.error("Erro ao atualizar projeto:", error);
          setErro("Erro ao atualizar projeto. Veja o console.");
          setSalvandoProjeto(false);
          return;
        }

        // Atualiza lista em memória
        setProjects((prev) =>
          prev.map((p) => (p.id === data.id ? data : p))
        );

        // Log
        registerProjectLog("update", beforeData, data);
      } else {
        // ===== INSERT =====
        const payloadInsert = {
          ...basePayload,
          criado_por: userName || user.email,
          manager_id: user.id,
          consultant_to: user.id,
        };

        const { data, error } = await supabase
          .from("projects")
          .insert(payloadInsert)
          .select()
          .single();

        if (error) {
          console.error("Erro ao criar projeto:", error);
          setErro("Erro ao criar projeto. Veja o console.");
          setSalvandoProjeto(false);
          return;
        }

        // adiciona no topo
        setProjects((prev) => [data, ...prev]);

        // Log
        registerProjectLog("create", null, data);
      }

      // Limpa e fecha modal
      setEmpresa("");
      setResponsavel("");
      setTelefone("");
      setProduto("");
      setObservacoes("");
      setExpectativa("");
      setEditingProject(null);
      setShowModal(false);
    } catch (e2) {
      console.error("Erro inesperado ao salvar projeto:", e2);
      setErro("Erro inesperado ao salvar projeto.");
    } finally {
      setSalvandoProjeto(false);
    }
  }

  // ==========================
  // Filtro de busca e status
  // ==========================
  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const texto = (
        `${proj.title ?? ""} ${proj.socio ?? ""} ${
          proj.produto ?? proj.description ?? ""
        } ${proj.observacoes ?? ""}`
      ).toLowerCase();

      const buscaOk = texto.includes(search.toLowerCase());

      const statusOk =
        statusFilter === "todos" ||
        (proj.status ?? "").toLowerCase() === statusFilter.toLowerCase();

      return buscaOk && statusOk;
    });
  }, [projects, search, statusFilter]);

  // ==========================
  // Render
  // ==========================
  return (
    <div style={pageWrapper}>
      {/* TOPO */}
      <header style={header}>
        <div style={logoArea}>
          <img src={xchangeLogo} alt="XChange" style={logoImage} />
          <div>
            <h1 style={pageTitle}>Central de acompanhamento de projetos</h1>
            <p style={pageSubtitle}>
              Crie, edite e acompanhe seus projetos com visão estilo Notion.
            </p>
          </div>
        </div>

        <button style={backButton} onClick={() => navigate("/app")}>
          ⬅ Voltar para tarefas
        </button>
      </header>

      {/* TOPO: BOTÃO + FILTROS */}
      <section style={topRow}>
        <div style={projectsHeroBox}>
          <p style={heroLabel}>Projetos</p>
          <h2 style={heroTitle}>Pipeline de oportunidades & projetos</h2>
          <p style={heroText}>
            Cadastre novas empresas, acompanhe status, responsáveis e
            expectativas de investimento em um só lugar.
          </p>
          <button style={createButtonHero} onClick={openNewProjectModal}>
            + Criar projeto
          </button>
        </div>

        <div style={filtersBox}>
          <div style={{ marginBottom: "0.6rem" }}>
            <label style={label}>Buscar</label>
            <input
              type="text"
              placeholder="Empresa, responsável, produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label style={label}>Filtrar por status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={input}
            >
              <option value="todos">Todos</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Em Análise">Em Análise</option>
              <option value="Suspenso">Suspenso</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
        </div>
      </section>

      {/* TABELA */}
      <main style={cardWrapper}>
        {erro && <div style={errorBox}>{erro}</div>}

        {loading ? (
          <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
            Carregando projetos...
          </p>
        ) : filteredProjects.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
            Nenhum projeto encontrado com os filtros atuais.
          </p>
        ) : (
          <div style={tableWrapper}>
            {/* Cabeçalho */}
            <div style={tableHeaderRow}>
              <div style={{ ...thCell, flex: 1.3 }}>Empresa</div>
              <div style={{ ...thCell, flex: 0.9 }}>Status</div>
              <div style={{ ...thCell, flex: 1.1 }}>Responsável</div>
              <div style={{ ...thCell, flex: 0.9 }}>Telefone</div>
              <div style={{ ...thCell, flex: 1.2 }}>Produto</div>
              <div style={{ ...thCell, flex: 1.4 }}>Observações</div>
              <div style={{ ...thCell, flex: 1 }}>
                Expectativa de investimento
              </div>
              <div style={{ ...thCell, flex: 0.9 }}>Criado por</div>
              <div style={{ ...thCell, flex: 0.8 }}>Criado em</div>
            </div>

            {/* Linhas */}
            <div style={tableBody}>
              {filteredProjects.map((proj) => {
                const statusCfg = getStatusConfig(proj.status);
                const criadoEm =
                  proj.created_at &&
                  new Date(proj.created_at).toLocaleDateString("pt-BR");

                const produto = proj.produto || proj.description || "—";
                const observacoes = proj.observacoes || "—";
                const expectativa = formatCurrency(
                  proj.expectativa_investimento
                );
                const criadoPor = proj.criado_por || "—";
                const telefoneFmt = formatPhone(proj.telefone);

                return (
                  <div
                    key={proj.id}
                    style={tableRow}
                    onClick={() => openEditProjectModal(proj)}
                  >
                    {/* Empresa */}
                    <div style={{ ...tdCell, flex: 1.3 }}>
                      <div style={empresaName}>{proj.title || "—"}</div>
                    </div>

                    {/* Status */}
                    <div style={{ ...tdCell, flex: 0.9 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "999px",
                          backgroundColor: statusCfg.bg,
                          border: `1px solid ${statusCfg.border}`,
                          color: statusCfg.color,
                          fontSize: "0.75rem",
                          fontWeight: 500,
                        }}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Responsável */}
                    <div style={{ ...tdCell, flex: 1.1 }}>
                      <div style={empresaName}>{proj.socio || "—"}</div>
                    </div>

                    {/* Telefone */}
                    <div style={{ ...tdCell, flex: 0.9 }}>
                      <span style={empresaSub}>{telefoneFmt}</span>
                    </div>

                    {/* Produto */}
                    <div style={{ ...tdCell, flex: 1.2 }}>
                      <div style={descricaoText}>{produto}</div>
                    </div>

                    {/* Observações */}
                    <div style={{ ...tdCell, flex: 1.4 }}>
                      <div style={descricaoText}>{observacoes}</div>
                    </div>

                    {/* Expectativa de investimento */}
                    <div style={{ ...tdCell, flex: 1 }}>
                      <div style={descricaoText}>{expectativa}</div>
                    </div>

                    {/* Criado por */}
                    <div style={{ ...tdCell, flex: 0.9 }}>
                      <span style={empresaSub}>{criadoPor}</span>
                    </div>

                    {/* Criado em */}
                    <div style={{ ...tdCell, flex: 0.8 }}>
                      <span style={empresaSub}>{criadoEm || "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE NOVO / EDIÇÃO DE PROJETO */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>
                {editingProject ? "Editar projeto" : "Novo projeto"}
              </h3>
              <button onClick={closeModal} style={modalCloseButton}>
                ×
              </button>
            </div>

            <form style={modalForm} onSubmit={handleSubmitProject}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Empresa *</label>
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Nome da empresa"
                  style={input}
                  required
                />
              </div>

              <div>
                <label style={label}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={input}
                >
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Em Análise">Em Análise</option>
                  <option value="Suspenso">Suspenso</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              <div>
                <label style={label}>Responsável</label>
                <input
                  type="text"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="Nome do responsável"
                  style={input}
                />
              </div>

              <div>
                <label style={label}>Telefone</label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  style={input}
                />
              </div>

              <div>
                <label style={label}>Produto</label>
                <input
                  type="text"
                  value={produto}
                  onChange={(e) => setProduto(e.target.value)}
                  placeholder="Produto / escopo"
                  style={input}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Observações</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Comentários, pontos de atenção, etc."
                  style={textarea}
                  rows={2}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Expectativa de investimento</label>
                <input
                  type="text"
                  value={expectativa}
                  onChange={(e) => setExpectativa(e.target.value)}
                  placeholder="Ex: 2000000 ou R$ 2.000.000,00"
                  style={input}
                />
              </div>

              <div style={modalFooter}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={modalCancelButton}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={createButton}
                  disabled={salvandoProjeto || !empresa.trim()}
                >
                  {salvandoProjeto
                    ? "Salvando..."
                    : editingProject
                    ? "Salvar alterações"
                    : "Criar projeto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========= ESTILOS ========= */

const pageWrapper = {
  minHeight: "100vh",
  width: "100%",
  backgroundColor: "#000000",
  color: "#e5e7eb",
  padding: "1.5rem 2rem",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
};

const logoArea = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
};

const logoImage = {
  height: "40px",
  objectFit: "contain",
};

const pageTitle = {
  fontSize: "1.4rem",
  fontWeight: 600,
  margin: 0,
};

const pageSubtitle = {
  margin: 0,
  marginTop: "0.1rem",
  fontSize: "0.85rem",
  color: "#9ca3af",
};

const backButton = {
  padding: "0.45rem 0.9rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.4)",
  background: "transparent",
  color: "#e5e7eb",
  fontSize: "0.8rem",
  cursor: "pointer",
};

const topRow = {
  marginTop: "0.5rem",
  display: "grid",
  gridTemplateColumns: "minmax(0, 2.5fr) minmax(0, 1.2fr)",
  gap: "1rem",
  alignItems: "stretch",
};

const projectsHeroBox = {
  backgroundColor: "#050505",
  borderRadius: "1rem",
  padding: "1rem",
  border: "1px solid rgba(55,65,81,0.9)",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const heroLabel = {
  fontSize: "0.75rem",
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const heroTitle = {
  fontSize: "1.1rem",
  fontWeight: 600,
  margin: 0,
};

const heroText = {
  fontSize: "0.85rem",
  margin: 0,
  color: "#9ca3af",
};

const filtersBox = {
  backgroundColor: "#050505",
  borderRadius: "1rem",
  padding: "1rem",
  border: "1px solid rgba(55,65,81,0.9)",
};

const label = {
  display: "block",
  fontSize: "0.75rem",
  color: "#9ca3af",
  marginBottom: "0.2rem",
};

const input = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "0.7rem",
  border: "1px solid rgba(75,85,99,0.9)",
  backgroundColor: "#020617",
  color: "#f9fafb",
  fontSize: "0.85rem",
};

const textarea = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "0.7rem",
  border: "1px solid rgba(75,85,99,0.9)",
  backgroundColor: "#020617",
  color: "#f9fafb",
  fontSize: "0.85rem",
  resize: "vertical",
};

const createButton = {
  padding: "0.6rem 1rem",
  borderRadius: "0.9rem",
  border: "none",
  background: "linear-gradient(135deg, #facc15, #eab308)", // dourado
  color: "#111827",
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
};

const createButtonHero = {
  ...createButton,
  marginTop: "0.5rem",
  alignSelf: "flex-start",
};

const cardWrapper = {
  marginTop: "0.5rem",
  background:
    "radial-gradient(circle at top left, rgba(250,204,21,0.08), transparent 55%), #020617",
  borderRadius: "1rem",
  border: "1px solid rgba(31,41,55,0.9)",
  padding: "1rem 1.1rem",
  boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
};

const tableWrapper = {
  borderRadius: "0.75rem",
  border: "1px solid rgba(55,65,81,0.9)",
  overflow: "hidden",
};

const tableHeaderRow = {
  display: "flex",
  alignItems: "center",
  backgroundColor: "#020617",
  borderBottom: "1px solid rgba(55,65,81,0.9)",
};

const thCell = {
  padding: "0.55rem 0.75rem",
  fontSize: "0.75rem",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#9ca3af",
};

const tableBody = {
  maxHeight: "60vh",
  overflowY: "auto",
};

const tableRow = {
  display: "flex",
  alignItems: "flex-start",
  borderBottom: "1px solid rgba(31,41,55,0.8)",
  backgroundColor: "#020617",
  cursor: "pointer",
};

const tdCell = {
  padding: "0.6rem 0.75rem",
  fontSize: "0.85rem",
  borderRight: "1px solid rgba(31,41,55,0.7)",
};

const empresaName = {
  fontSize: "0.85rem",
  fontWeight: 500,
};

const empresaSub = {
  fontSize: "0.75rem",
  color: "#9ca3af",
};

const descricaoText = {
  fontSize: "0.8rem",
  color: "#d1d5db",
};

const errorBox = {
  backgroundColor: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(248,113,113,0.6)",
  color: "#fecaca",
  borderRadius: "0.75rem",
  padding: "0.6rem 0.8rem",
  fontSize: "0.8rem",
  marginBottom: "0.8rem",
};

/* ========= MODAL ========= */

const modalOverlay = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const modalContent = {
  backgroundColor: "#020617",
  borderRadius: "1rem",
  border: "1px solid rgba(55,65,81,0.9)",
  padding: "1rem",
  width: "100%",
  maxWidth: "720px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
};

const modalHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "0.5rem",
};

const modalTitle = {
  fontSize: "1rem",
  fontWeight: 600,
  margin: 0,
};

const modalCloseButton = {
  border: "none",
  background: "transparent",
  color: "#9ca3af",
  fontSize: "1.2rem",
  cursor: "pointer",
};

const modalForm = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.75rem 0.75rem",
  marginTop: "0.5rem",
};

const modalFooter = {
  gridColumn: "1 / -1",
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.5rem",
  marginTop: "0.4rem",
};

const modalCancelButton = {
  padding: "0.6rem 1rem",
  borderRadius: "0.9rem",
  border: "1px solid rgba(75,85,99,0.9)",
  backgroundColor: "transparent",
  color: "#e5e7eb",
  fontSize: "0.85rem",
  cursor: "pointer",
};

export default ProjectsStatusPage;
