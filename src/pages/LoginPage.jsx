import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert('Erro ao fazer login: ' + error.message);
      return;
    }

    navigate('/app');
  }

  return (
    <div style={container}>
      <h1 style={title}>Login</h1>

      <form onSubmit={handleLogin} style={form}>
        <input
          type="email"
          placeholder="Seu e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />
        <input
          type="password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
        />

        <button type="submit" style={button}>
          Entrar
        </button>
      </form>

      <p style={{ marginTop: '10px', color: '#bbb' }}>
        Não tem conta? <Link to="/signup">Cadastre-se</Link>
      </p>
    </div>
  );
}

// estilos simples
const container = {
  minHeight: '100vh',
  background: '#0f172a',
  color: 'white',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};
const title = { fontSize: '2rem', marginBottom: '1rem' };
const form = { display: 'flex', flexDirection: 'column', gap: '10px', width: '260px' };
const input = {
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #475569',
  outline: 'none',
};
const button = {
  padding: '10px',
  borderRadius: '8px',
  background: '#4ade80',
  border: 'none',
  fontWeight: 'bold',
  cursor: 'pointer',
};

export default LoginPage;
