// src/pages/TasksPage.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

function TasksPage() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(false);

  // Verificar se o usuário está logado
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Erro ao pegar sessão:', error);
        navigate('/');
        return;
      }

      if (!data.session) {
        // ninguém logado → manda pro login
        navigate('/');
        return;
      }

      setSession(data.session);
    };

    checkSession();
  }, [navigate]);

  // Carregar tarefas do usuário logado
  const loadTasks = async (userId) => {
    setLoading(true);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar tarefas:', error);
      alert('Erro ao buscar tarefas. Veja o console.');
    } else {
      setTasks(data);
    }

    setLoading(false);
  };

  // Quando já temos sessão, carrega as tarefas
  useEffect(() => {
    if (session?.user?.id) {
      loadTasks(session.user.id);
    }
  }, [session]);

  // Criar nova tarefa
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !session?.user?.id) return;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: newTitle,
        is_complete: false,
        user_id: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar tarefa:', error);
      alert('Erro ao adicionar tarefa. Veja o console.');
      return;
    }

    setTasks((prev) => [data, ...prev]);
    setNewTitle('');
  };

  // Logout
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert('Erro ao sair: ' + error.message);
      return;
    }

    setSession(null);
    navigate('/');
  };

  if (!session) {
    // Enquanto verifica a sessão / redireciona
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#020617',
          color: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <p>Verificando sessão...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#020617',
        color: '#e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#0f172a',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>
              Meu WebApp + Supabase
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              Logado como: <strong>{session.user.email}</strong>
            </p>
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: '0.4rem 0.7rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '1rem' }}>
          Lista de tarefas simples, salvando direto no banco (por usuário).
        </p>

        <form
          onSubmit={handleAddTask}
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <input
            type="text"
            placeholder="Digite uma nova tarefa..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #1f2937',
              backgroundColor: '#020617',
              color: '#e5e7eb',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Adicionar
          </button>
        </form>

        {loading ? (
          <p>Carregando tarefas...</p>
        ) : tasks.length === 0 ? (
          <p style={{ color: '#6b7280' }}>
            Nenhuma tarefa ainda. Comece adicionando uma.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              maxHeight: '320px',
              overflowY: 'auto',
            }}
          >
            {tasks.map((task) => (
              <li
                key={task.id}
                style={{
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#020617',
                  border: '1px solid #1f2937',
                }}
              >
                <span>{task.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TasksPage;
