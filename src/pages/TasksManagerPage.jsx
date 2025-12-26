// src/pages/TasksManagePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

// ================================
//  Página de Gestão de Tarefas
// ================================
function TasksManagePage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);

  // FORM
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [attachment, setAttachment] = useState(null);

  // LISTAS
  const [myTasks, setMyTasks] = useState([]);
  const [assignedToMe, setAssignedToMe] = useState([]);

  const [loading, setLoading] = useState(false);

  // ================================
  //  Carregar usuário autenticado
  // ================================
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
  }, []);

  // ================================
  //  Carregar perfis p/ dropdown
  // ================================
  useEffect(() => {
    if (!user) return;

    async function loadProfiles() {
      const { data, error } = await supabase.from("profiles").select("id, nome, user_id");
      if (!error && data) setProfiles(data);
    }
    loadProfiles();
  }, [user]);

  // ================================
  //  Carregar tarefas
  // ================================
  useEffect(() => {
    if (!user) return;
    loadTasks();
  }, [user]);

  async function loadTasks() {
    setLoading(true);

    // Tarefas criadas por mim
    const { data: mine } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Tarefas atribuídas a mim
    const { data: toMe } = await supabase
      .from("tasks")
      .select("*")
      .eq("assignee_id", user.id)
      .order("created_at", { ascending: false });

    setMyTasks(mine || []);
    setAssignedToMe(toMe || []);
    setLoading(false);
  }

  // ================================
  // Criar tarefa
  // ================================
  async function handleCreateTask(e) {
    e.preventDefault();
    if (!title.trim()) return;

    let attachmentUrl = null;

    if (attachment) {
      const fileName = `${user.id}-${Date.now()}-${attachment.name}`;
      const { data: upload, error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(fileName, attachment);

      if (!uploadError) {
        attachmentUrl = upload.path;
      }
    }

    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      user_id: user.id,
      assignee_id: assignee || null,
      due_date: dueDate || null,
      attachment_url: attachmentUrl,
      is_complete: false
    });

    if (!error) {
      setTitle("");
      setAssignee("");
      setDueDate("");
      setAttachment(null);
      loadTasks();
    }
  }

  // ================================
  //  Atualizar status
  // ================================
  async function toggleComplete(task) {
    await supabase
      .from("tasks")
      .update({ is_complete: !task.is_complete })
      .eq("id", task.id);

    loadTasks();
  }

  // ================================
  //  Render
  // ================================
  return (
    <div style={wrapper}>
      <h1 style={titlePage}>Gestão de Tarefas</h1>
      <p style={subtitle}>Crie tarefas, atribua a outros usuários e acompanhe tudo em um só lugar.</p>

      {/* FORMULÁRIO */}
      <form style={form} onSubmit={handleCreateTask}>
        <h2 style={formTitle}>Criar nova tarefa</h2>

        <label style={label}>Título *</label>
        <input
          style={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Descreva a tarefa"
          required
        />

        <label style={label}>Atribuir para</label>
        <select style={input} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">— Ninguém —</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.user_id}>
              {p.nome}
            </option>
          ))}
        </select>

        <label style={label}>Data de entrega</label>
        <input type="date" style={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        <label style={label}>Anexo</label>
        <input type="file" onChange={(e) => setAttachment(e.target.files[0])} style={input} />

        <button style={createBtn} type="submit">
          Criar tarefa
        </button>
      </form>

      {/* LISTAS */}
      <div style={section}>
        <h2 style={sectionTitle}>Tarefas criadas por mim</h2>
        {myTasks.length === 0 ? (
          <p style={empty}>Nenhuma tarefa criada ainda.</p>
        ) : (
          myTasks.map((t) => (
            <div key={t.id} style={taskCard}>
              <input type="checkbox" checked={t.is_complete} onChange={() => toggleComplete(t)} />
              <span style={{ marginLeft: "0.8rem" }}>{t.title}</span>
            </div>
          ))
        )}
      </div>

      <div style={section}>
        <h2 style={sectionTitle}>Tarefas atribuídas a mim</h2>
        {assignedToMe.length === 0 ? (
          <p style={empty}>Nenhuma tarefa atribuída a você.</p>
        ) : (
          assignedToMe.map((t) => (
            <div key={t.id} style={taskCard}>
              <input type="checkbox" checked={t.is_complete} onChange={() => toggleComplete(t)} />
              <span style={{ marginLeft: "0.8rem" }}>{t.title}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ================================
   ESTILOS
================================ */
const wrapper = {
  padding: "2rem",
  color: "white",
  fontFamily: "system-ui",
};

const titlePage = {
  fontSize: "1.8rem",
  fontWeight: 700,
};

const subtitle = {
  marginTop: "-0.5rem",
  marginBottom: "1.5rem",
  color: "#cccccc",
};

const form = {
  background: "#0b0b0d",
  padding: "1.2rem",
  borderRadius: "1rem",
  border: "1px solid #333",
  marginBottom: "2rem",
};

const formTitle = {
  fontSize: "1.1rem",
  fontWeight: 600,
  marginBottom: "1rem",
};

const label = { fontSize: "0.8rem", marginTop: "0.7rem" };
const input = {
  width: "100%",
  padding: "0.7rem",
  borderRadius: "0.5rem",
  border: "1px solid #333",
  background: "#111",
  color: "white",
};

const createBtn = {
  marginTop: "1rem",
  padding: "0.8rem",
  borderRadius: "0.8rem",
  border: "none",
  background: "linear-gradient(135deg, #facc15, #eab308)",
  color: "#111",
  fontWeight: 700,
  cursor: "pointer",
};

const section = { marginTop: "2rem" };
const sectionTitle = { fontSize: "1.2rem", fontWeight: 600 };
const empty = { color: "#888", marginTop: "0.5rem" };

const taskCard = {
  background: "#111",
  padding: "0.8rem",
  borderRadius: "0.6rem",
  marginTop: "0.5rem",
  border: "1px solid #333",
  display: "flex",
  alignItems: "center",
};

export default TasksManagePage;
