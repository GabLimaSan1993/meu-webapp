// src/pages/TasksPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import xchangeLogo from "../assets/xchange-logo.png";

function TasksPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  // Seção ativa no painel
  const [activeSection, setActiveSection] = useState("home"); // home | tasks | projects-analysis | projects-status | agenda | minutes
  const [projectsOpen, setProjectsOpen] = useState(true); // retrátil de projetos

  // Estado de tarefas
  const [myTasks, setMyTasks] = useState([]); // criadas por mim
  const [assignedTasks, setAssignedTasks] = useState([]); // atribuídas para mim
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  // Estado de projetos
  const [assignedProjects, setAssignedProjects] = useState([]); // consultant_to = eu
  const [managedProjects, setManagedProjects] = useState([]); // manager_id = eu
  const [loadingProjects, setLoadingProjects] = useState(true);

  // ==========================
  // 1) Verificar usuário logado
  // ==========================
  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        navigate("/login");
        return;
      }
      setUser(data.user);
    }
    loadUser();
  }, [navigate]);

  // ==========================
  // 2) Carregar tarefas e projetos
  // ==========================
  useEffect(() => {
    if (!user) return;
    loadTasks();
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadTasks() {
    if (!user) return;
    setLoadingTasks(true);

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .or(`user_id.eq.${user.id},assignee_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar tarefas:", error);
      setLoadingTasks(false);
      return;
    }

    const all = data || [];

    const mine = all.filter((t) => t.user_id === user.id);
    const assigned = all.filter(
      (t) => t.assignee_id === user.id && t.user_id !== user.id
    );

    setMyTasks(mine);
    setAssignedTasks(assigned);
    setLoadingTasks(false);
  }

  async function loadProjects() {
    if (!user) return;
    setLoadingProjects(true);

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .or(`manager_id.eq.${user.id},consultant_to.eq.${user.id}`)
      .order("deadline", { ascending: true });

    if (error) {
      console.error("Erro ao buscar projetos:", error);
      setLoadingProjects(false);
      return;
    }

    const all = data || [];

    const managed = all.filter((p) => p.manager_id === user.id);
    const assigned = all.filter(
      (p) => p.consultant_to === user.id && p.manager_id !== user.id
    );

    setManagedProjects(managed);
    setAssignedProjects(assigned);
    setLoadingProjects(false);
  }

  // ==========================
  // 3) Criar nova tarefa
  // ==========================
  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;

    setSavingTask(true);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: newTitle.trim(),
        is_complete: false,
        user_id: user.id,
        assignee_id: user.id,
        due_date: newDueDate || null,
      })
      .select()
      .single();

    setSavingTask(false);

    if (error) {
      console.error("Erro ao criar tarefa:", error);
      return;
    }

    setMyTasks((prev) => [data, ...prev]);
    setNewTitle("");
    setNewDueDate("");
  }

  // ==========================
  // 4) Alternar conclusão
  // ==========================
  async function toggleTaskComplete(task, listType) {
    const { data, error } = await supabase
      .from("tasks")
      .update({ is_complete: !task.is_complete })
      .eq("id", task.id)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar tarefa:", error);
      return;
    }

    if (listType === "mine") {
      setMyTasks((prev) => prev.map((t) => (t.id === task.id ? data : t)));
    } else {
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === task.id ? data : t))
      );
    }
  }

  // ==========================
  // 5) Excluir tarefa
  // ==========================
  async function deleteTask(taskId, listType) {
    const ok = window.confirm("Deseja realmente excluir esta tarefa?");
    if (!ok) return;

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      console.error("Erro ao excluir tarefa:", error);
      return;
    }

    if (listType === "mine") {
      setMyTasks((prev) => prev.filter((t) => t.id !== taskId));
    } else {
      setAssignedTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }

  // ==========================
  // 6) Logout
  // ==========================
  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  // ==========================
  // 7) Renderização das seções
  // ==========================
  function renderContent() {
    if (activeSection === "home") {
      return (
        <div style={contentWrapper}>
          <section style={card}>
            <h2 style={cardTitle}>Tela inicial</h2>
            <p style={cardSubtitle}>
              Visão geral das suas tarefas e projetos atribuídos.
            </p>

            {/* Cards de resumo */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              <DashboardStat
                label="Tarefas criadas por você"
                value={myTasks.length}
              />
              <DashboardStat
                label="Tarefas atribuídas a você"
                value={assignedTasks.length}
              />
              <DashboardStat
                label="Projetos atribuídos a você"
                value={assignedProjects.length}
              />
              <DashboardStat
                label="Projetos sob sua gestão"
                value={managedProjects.length}
              />
            </div>

            {/* Lista de projetos atribuídos */}
            <div style={{ marginTop: "1.75rem" }}>
              <h3 style={sectionSubtitle}>Projetos atribuídos a você</h3>

              {loadingProjects ? (
                <p style={mutedText}>Carregando projetos...</p>
              ) : assignedProjects.length === 0 ? (
                <p style={mutedText}>
                  Você ainda não tem projetos atribuídos.
                </p>
              ) : (
                <ul style={projectList}>
                  {assignedProjects.slice(0, 5).map((project) => (
                    <li key={project.id} style={projectItem}>
                      <div>
                        <p style={projectTitle}>{project.title}</p>
                        {project.cnpj && (
                          <p style={projectLine}>CNPJ: {project.cnpj}</p>
                        )}
                        {project.socio && (
                          <p style={projectLine}>Sócio: {project.socio}</p>
                        )}
                      </div>
                      <div style={projectRight}>
                        <span style={projectStatusBadge(project.status)}>
                          {project.status || "Sem status"}
                        </span>
                        <p style={projectDateLine}>
                          Prazo:{" "}
                          {project.deadline
                            ? new Date(project.deadline).toLocaleDateString(
                                "pt-BR"
                              )
                            : "Sem prazo"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {assignedProjects.length > 5 && (
                <p style={mutedTextSmall}>
                  Mostrando 5 projetos. Em breve teremos uma tela dedicada para
                  projetos.
                </p>
              )}
            </div>
          </section>
        </div>
      );
    }

    if (activeSection === "tasks") {
      return renderTasksSection();
    }

    if (activeSection === "projects-analysis") {
      return (
        <PlaceholderCard
          title="Análise de projetos"
          description="Aqui você verá a lista de projetos para análise, com status, responsáveis e próximos passos."
        />
      );
    }

    if (activeSection === "projects-status") {
      return (
        <PlaceholderCard
          title="Status de projetos"
          description="Visão geral dos projetos em andamento, com indicadores de progresso e próximos marcos."
        />
      );
    }

    if (activeSection === "agenda") {
      return (
        <PlaceholderCard
          title="Agenda"
          description="Visão de agenda individual, visível para o próprio usuário e para o criador/dono."
        />
      );
    }

    if (activeSection === "minutes") {
      return (
        <PlaceholderCard
          title="Atas de reuniões"
          description="Espaço para registrar e consultar atas de reuniões dos projetos."
        />
      );
    }

    return null;
  }

  function renderTasksSection() {
    return (
      <div style={contentWrapper}>
        <section style={card}>
          <h2 style={cardTitle}>Tarefas</h2>
          <p style={cardSubtitle}>
            Visualize suas tarefas e as tarefas atribuídas a você por outros.
          </p>

          {/* Formulário nova tarefa */}
          <form onSubmit={handleAddTask} style={taskForm}>
            <input
              type="text"
              placeholder="Descreva a nova tarefa..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={taskInput}
            />
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              style={dateInput}
            />
            <button type="submit" style={taskAddButton} disabled={savingTask}>
              {savingTask ? "Salvando..." : "Adicionar"}
            </button>
          </form>

          {loadingTasks ? (
            <p style={{ color: "#9ca3af", marginTop: "1rem" }}>
              Carregando tarefas...
            </p>
          ) : (
            <div style={tasksColumns}>
              {/* Minhas tarefas */}
              <div style={tasksColumn}>
                <h3 style={tasksColumnTitle}>Criadas por mim</h3>
                {myTasks.length === 0 ? (
                  <p style={emptyText}>
                    Você ainda não criou nenhuma tarefa.
                  </p>
                ) : (
                  <ul style={tasksList}>
                    {myTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        listType="mine"
                        onToggleComplete={toggleTaskComplete}
                        onDelete={deleteTask}
                      />
                    ))}
                  </ul>
                )}
              </div>

              {/* Tarefas para mim */}
              <div style={tasksColumn}>
                <h3 style={tasksColumnTitle}>Atribuídas a mim</h3>
                {assignedTasks.length === 0 ? (
                  <p style={emptyText}>
                    Nenhuma tarefa atribuída a você por outro usuário ainda.
                  </p>
                ) : (
                  <ul style={tasksList}>
                    {assignedTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        listType="assigned"
                        onToggleComplete={toggleTaskComplete}
                        onDelete={deleteTask}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div style={pageWrapper}>
      {/* LATERAL ESQUERDA */}
      <aside style={sidebar}>
        {/* topo com logo sem círculo, maior */}
        <div style={sidebarHeader}>
          <img src={xchangeLogo} alt="XChange" style={sidebarLogo} />
        </div>

        <nav style={sidebarNav}>
          {/* Tela inicial */}
          <button
            style={{
              ...navButton,
              ...(activeSection === "home" ? navButtonActive : {}),
            }}
            onClick={() => setActiveSection("home")}
          >
            Tela inicial
          </button>

          {/* Tarefas */}
          <button
            style={{
              ...navButton,
              ...(activeSection === "tasks" ? navButtonActive : {}),
            }}
            onClick={() => setActiveSection("tasks")}
          >
            Tarefas
          </button>

          {/* Projetos - retrátil */}
          <div style={{ marginTop: "1.5rem" }}>
            <button
              style={{
                ...navButton,
                ...navGroupButton,
                ...(projectsOpen ? navGroupButtonOpen : {}),
              }}
              onClick={() => setProjectsOpen((prev) => !prev)}
            >
              <span>Projetos</span>
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                {projectsOpen ? "▾" : "▸"}
              </span>
            </button>

            {projectsOpen && (
              <div style={{ marginTop: "0.15rem" }}>
                <button
                  style={{
                    ...navSubButton,
                    ...(activeSection === "projects-analysis"
                      ? navSubButtonActive
                      : {}),
                  }}
                  onClick={() => setActiveSection("projects-analysis")}
                >
                  Análise de projetos
                </button>
                <button
                  style={{
                    ...navSubButton,
                    ...(activeSection === "projects-status"
                      ? navSubButtonActive
                      : {}),
                  }}
                  onClick={() => setActiveSection("projects-status")}
                >
                  Status de projetos
                </button>
              </div>
            )}
          </div>

          {/* Agenda e Atas */}
          <div style={{ marginTop: "1.5rem" }}>
            <button
              style={{
                ...navButton,
                ...(activeSection === "agenda" ? navButtonActive : {}),
              }}
              onClick={() => setActiveSection("agenda")}
            >
              Agenda
            </button>
            <button
              style={{
                ...navButton,
                ...(activeSection === "minutes" ? navButtonActive : {}),
              }}
              onClick={() => setActiveSection("minutes")}
            >
              Atas de reuniões
            </button>
          </div>
        </nav>

        <div style={sidebarFooter}>
          {user && (
            <p style={sidebarUser}>
              Logado como
              <br />
              <strong>{user.email}</strong>
            </p>
          )}
          <button style={logoutButtonSidebar} onClick={handleLogout}>
            Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO À DIREITA */}
      <main style={mainArea}>{renderContent()}</main>
    </div>
  );
}

/* ============ COMPONENTES AUXILIARES ============ */

function TaskRow({ task, listType, onToggleComplete, onDelete }) {
  const dueLabel = task.due_date
    ? new Date(task.due_date).toLocaleDateString("pt-BR")
    : "Sem prazo";

  const isLate =
    task.due_date &&
    !task.is_complete &&
    new Date(task.due_date) < new Date();

  return (
    <li style={taskItem}>
      <div style={taskLeft}>
        <input
          type="checkbox"
          checked={task.is_complete}
          onChange={() => onToggleComplete(task, listType)}
          style={checkbox}
        />
        <div>
          <p
            style={{
              ...taskTitle,
              textDecoration: task.is_complete ? "line-through" : "none",
              color: task.is_complete ? "#9ca3af" : "#f9fafb",
            }}
          >
            {task.title}
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              color: isLate ? "#f97373" : "#9ca3af",
            }}
          >
            Prazo: {dueLabel}
          </p>
        </div>
      </div>
      <button
        style={deleteButton}
        onClick={() => onDelete(task.id, listType)}
      >
        Excluir
      </button>
    </li>
  );
}

function PlaceholderCard({ title, description }) {
  return (
    <div style={contentWrapper}>
      <section style={card}>
        <h2 style={cardTitle}>{title}</h2>
        <p style={cardSubtitle}>{description}</p>
        <p style={{ color: "#9ca3af", marginTop: "1rem", fontSize: "0.85rem" }}>
          (Seção ainda em construção. Aqui vamos conectar com os dados
          específicos dessa funcionalidade.)
        </p>
      </section>
    </div>
  );
}

function DashboardStat({ label, value }) {
  return (
    <div
      style={{
        backgroundColor: "#020617",
        borderRadius: "0.9rem",
        padding: "0.9rem 1rem",
        border: "1px solid rgba(148,163,184,0.5)",
      }}
    >
      <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.3rem" }}>
        {label}
      </p>
      <p style={{ fontSize: "1.4rem", fontWeight: 600 }}>{value}</p>
    </div>
  );
}

function countLateTasks(tasks) {
  const today = new Date();
  return tasks.filter((t) => {
    if (!t.due_date || t.is_complete) return false;
    return new Date(t.due_date) < today;
  }).length;
}

/* ==================== ESTILOS ==================== */

const pageWrapper = {
  minHeight: "100vh",
  width: "100%",
  backgroundColor: "#000000",
  color: "#e5e7eb",
  display: "flex",
};

const sidebar = {
  width: "260px",
  backgroundColor: "#020202",
  borderRight: "1px solid rgba(148,163,184,0.35)",
  display: "flex",
  flexDirection: "column",
  padding: "1.25rem 1rem",
};

const sidebarHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "2rem",
  paddingTop: "0.5rem",
};

const sidebarLogo = {
  height: "55px",
  objectFit: "contain",
  filter: "drop-shadow(0px 0px 6px rgba(255,255,255,0.25))",
  marginBottom: "0.5rem",
};

const sidebarNav = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
  marginTop: "0.5rem",
};

const navButtonBase = {
  width: "100%",
  textAlign: "left",
  padding: "0.6rem 0.85rem",
  borderRadius: "0.8rem",
  border: "none",
  backgroundColor: "transparent",
  color: "#e5e7eb",
  fontSize: "0.86rem",
  cursor: "pointer",
};

const navButton = {
  ...navButtonBase,
};

const navButtonActive = {
  backgroundColor: "#111827",
  border: "1px solid rgba(148,163,184,0.8)",
};

const navGroupButton = {
  ...navButtonBase,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontWeight: 500,
};

const navGroupButtonOpen = {
  backgroundColor: "#050814",
  border: "1px solid rgba(148,163,184,0.7)",
};

const navSubButton = {
  ...navButtonBase,
  fontSize: "0.82rem",
  paddingLeft: "1.6rem",
};

const navSubButtonActive = {
  backgroundColor: "#111827",
  border: "1px solid rgba(148,163,184,0.8)",
};

const sidebarFooter = {
  marginTop: "1rem",
  borderTop: "1px solid rgba(55,65,81,0.8)",
  paddingTop: "0.75rem",
};

const sidebarUser = {
  fontSize: "0.78rem",
  color: "#9ca3af",
  marginBottom: "0.5rem",
};

const logoutButtonSidebar = {
  padding: "0.45rem 0.8rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.6)",
  backgroundColor: "transparent",
  color: "#e5e7eb",
  fontSize: "0.8rem",
  cursor: "pointer",
};

const mainArea = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
};

const contentWrapper = {
  flex: 1,
  display: "flex",
  justifyContent: "center",
  padding: "2rem 1.5rem",
};

const card = {
  width: "100%",
  maxWidth: "900px",
  backgroundColor: "#050505",
  borderRadius: "1.25rem",
  padding: "1.75rem 1.5rem",
  border: "1px solid rgba(148,163,184,0.35)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.85)",
};

const cardTitle = {
  fontSize: "1.3rem",
  fontWeight: 600,
};

const cardSubtitle = {
  fontSize: "0.85rem",
  color: "#9ca3af",
  marginTop: "0.25rem",
  marginBottom: "1.2rem",
};

const sectionSubtitle = {
  fontSize: "0.95rem",
  fontWeight: 600,
  marginBottom: "0.5rem",
};

const mutedText = {
  fontSize: "0.85rem",
  color: "#9ca3af",
};

const mutedTextSmall = {
  fontSize: "0.75rem",
  color: "#6b7280",
  marginTop: "0.4rem",
};

const taskForm = {
  display: "flex",
  gap: "0.6rem",
  marginBottom: "1.2rem",
};

const taskInput = {
  flex: 1,
  padding: "0.7rem 0.9rem",
  borderRadius: "0.75rem",
  border: "1px solid rgba(120,120,120,0.35)",
  backgroundColor: "#0a0a0a",
  color: "#f9fafb",
  fontSize: "0.9rem",
};

const dateInput = {
  width: "150px",
  padding: "0.7rem 0.6rem",
  borderRadius: "0.75rem",
  border: "1px solid rgba(120,120,120,0.35)",
  backgroundColor: "#0a0a0a",
  color: "#f9fafb",
  fontSize: "0.8rem",
};

const taskAddButton = {
  padding: "0.7rem 1rem",
  borderRadius: "0.75rem",
  border: "none",
  background: "linear-gradient(135deg, #f3f4f6, #d1d5db)",
  color: "#0f172a",
  fontWeight: 600,
  cursor: "pointer",
};

const tasksColumns = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1.5rem",
};

const tasksColumn = {
  backgroundColor: "#020202",
  borderRadius: "1rem",
  padding: "1rem",
  border: "1px solid rgba(55,65,81,0.9)",
};

const tasksColumnTitle = {
  fontSize: "0.95rem",
  fontWeight: 600,
  marginBottom: "0.5rem",
};

const emptyText = {
  fontSize: "0.8rem",
  color: "#9ca3af",
};

const tasksList = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const taskItem = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.6rem 0.7rem",
  borderRadius: "0.7rem",
  backgroundColor: "#020202",
  border: "1px solid rgba(55,65,81,0.7)",
};

const taskLeft = {
  display: "flex",
  alignItems: "center",
  gap: "0.55rem",
};

const checkbox = {
  width: "16px",
  height: "16px",
};

const taskTitle = {
  fontSize: "0.9rem",
};

const deleteButton = {
  border: "none",
  background: "transparent",
  color: "#f97373",
  fontSize: "0.8rem",
  cursor: "pointer",
};

/* Projetos na Home */
const projectList = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
};

const projectItem = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.75rem 0.9rem",
  borderRadius: "0.8rem",
  backgroundColor: "#020202",
  border: "1px solid rgba(55,65,81,0.8)",
};

const projectTitle = {
  fontSize: "0.92rem",
  fontWeight: 600,
};

const projectLine = {
  fontSize: "0.8rem",
  color: "#9ca3af",
};

const projectRight = {
  textAlign: "right",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  alignItems: "flex-end",
  justifyContent: "center",
};

const projectDateLine = {
  fontSize: "0.78rem",
  color: "#9ca3af",
};

const projectStatusBadge = (status) => ({
  fontSize: "0.75rem",
  padding: "0.25rem 0.55rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.8)",
  backgroundColor:
    status === "concluído" || status === "concluido"
      ? "#14532d"
      : status === "em andamento"
      ? "#1f2933"
      : "#111827",
  color: "#e5e7eb",
});

export default TasksPage;
