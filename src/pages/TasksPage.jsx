import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import xchangeLogo from "../assets/xchange-logo.png";

function TasksPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1) Buscar usuário logado
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

  // 2) Buscar tarefas quando já tiver usuário
  useEffect(() => {
    if (!user) return;
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar tarefas:", error);
      setLoading(false);
      return;
    }

    setTasks(data || []);
    setLoading(false);
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: newTitle.trim(),
        is_complete: false,
        user_id: user.id,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("Erro ao criar tarefa:", error);
      return;
    }

    setTasks((prev) => [data, ...prev]);
    setNewTitle("");
  }

  async function toggleTaskComplete(task) {
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

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? data : t))
    );
  }

  async function deleteTask(taskId) {
    const ok = window.confirm("Deseja realmente excluir esta tarefa?");
    if (!ok) return;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      console.error("Erro ao excluir tarefa:", error);
      return;
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div style={pageWrapper}>
      {/* HEADER */}
      <header style={header}>
        <div style={headerLeft}>
          <img
            src={xchangeLogo}
            alt="XChange"
            style={headerLogo}
          />
          <span style={headerTitle}>Painel de tarefas</span>
        </div>
        <div style={headerRight}>
          {user && (
            <span style={headerUser}>
              {user.email}
            </span>
          )}
          <button style={logoutButton} onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main style={contentWrapper}>
        <section style={card}>
          <h2 style={cardTitle}>Minhas tarefas</h2>
          <p style={cardSubtitle}>
            Controle simples de tarefas, salvo direto no Supabase.
          </p>

          {/* FORM NOVA TAREFA */}
          <form onSubmit={handleAddTask} style={taskForm}>
            <input
              type="text"
              placeholder="Digite uma nova tarefa..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={taskInput}
            />
            <button type="submit" style={taskAddButton} disabled={saving}>
              {saving ? "Salvando..." : "Adicionar"}
            </button>
          </form>

          {/* LISTA DE TAREFAS */}
          {loading ? (
            <p style={{ color: "#9ca3af", marginTop: "1rem" }}>
              Carregando tarefas...
            </p>
          ) : tasks.length === 0 ? (
            <p style={{ color: "#6b7280", marginTop: "1rem" }}>
              Nenhuma tarefa ainda. Comece adicionando uma.
            </p>
          ) : (
            <ul style={tasksList}>
              {tasks.map((task) => (
                <li key={task.id} style={taskItem}>
                  <div style={taskLeft}>
                    <input
                      type="checkbox"
                      checked={task.is_complete}
                      onChange={() => toggleTaskComplete(task)}
                      style={checkbox}
                    />
                    <span
                      style={{
                        ...taskTitle,
                        textDecoration: task.is_complete
                          ? "line-through"
                          : "none",
                        color: task.is_complete ? "#9ca3af" : "#f9fafb",
                      }}
                    >
                      {task.title}
                    </span>
                  </div>
                  <button
                    style={deleteButton}
                    onClick={() => deleteTask(task.id)}
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

/* ========= ESTILOS ========= */

const pageWrapper = {
  minHeight: "100vh",
  width: "100%",
  backgroundColor: "#000000",
  color: "#e5e7eb",
  display: "flex",
  flexDirection: "column",
};

const header = {
  height: "64px",
  padding: "0 1.5rem",
  borderBottom: "1px solid rgba(148,163,184,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#020202",
  boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
};

const headerLeft = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const headerLogo = {
  height: "26px",
  objectFit: "contain",
};

const headerTitle = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#f9fafb",
};

const headerRight = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const headerUser = {
  fontSize: "0.8rem",
  color: "#9ca3af",
};

const logoutButton = {
  padding: "0.35rem 0.8rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.6)",
  backgroundColor: "transparent",
  color: "#e5e7eb",
  fontSize: "0.8rem",
  cursor: "pointer",
};

const contentWrapper = {
  flex: 1,
  display: "flex",
  justifyContent: "center",
  padding: "2rem 1rem",
};

const card = {
  width: "100%",
  maxWidth: "720px",
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

const taskAddButton = {
  padding: "0.7rem 1rem",
  borderRadius: "0.75rem",
  border: "none",
  background: "linear-gradient(135deg, #f3f4f6, #d1d5db)", // prata
  color: "#0f172a",
  fontWeight: 600,
  cursor: "pointer",
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

export default TasksPage;
