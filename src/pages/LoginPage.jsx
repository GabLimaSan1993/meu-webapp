// src/pages/LoginPage.jsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, Link } from "react-router-dom";
import xchangeLogo from "../assets/xchange-logo.png";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || "Erro ao fazer login.");
      return;
    }

    navigate("/app");
  }

  const currentYear = new Date().getFullYear();

  return (
    <div style={pageWrapper}>
      <div style={backgroundGlow} />

      <div style={cardWrapper}>

        {/* LOGO NO TOPO — MANTIDO */}
        <div style={logoTopWrapper}>
          <img src={xchangeLogo} alt="XChange Logo" style={logoTopImage} />
        </div>

        {/* REMOVIDO: bloco com círculo dourado + X + título + subtítulo */}

        {/* FORMULÁRIO */}
        <form onSubmit={handleLogin} style={form}>
          <h2 style={formTitle}>Entrar na conta</h2>
          <p style={formSubtitle}>Use seu e-mail e senha para acessar.</p>

          <label style={label}>
            E-mail
            <input
              type="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              required
            />
          </label>

          <label style={label}>
            Senha
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              required
            />
          </label>

          {errorMsg && <p style={errorBox}>{errorMsg}</p>}

          <button type="submit" style={loginButton} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p style={registerText}>
            Ainda não tem acesso?{" "}
            <Link to="/signup" style={link}>
              Criar conta
            </Link>
          </p>
        </form>

        <p style={footerText}>
          © {currentYear} XChange. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

/* ======= ESTILOS (mantidos) ======= */

const pageWrapper = {
  minHeight: "100vh",
  width: "100%",
  backgroundColor: "#000000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  position: "relative",
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const backgroundGlow = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "600px",
  height: "600px",
  background: "radial-gradient(circle, rgba(250,204,21,0.18), transparent 70%)",
  borderRadius: "50%",
  pointerEvents: "none",
  filter: "blur(50px)",
  opacity: 0.6,
};

const cardWrapper = {
  position: "relative",
  width: "100%",
  maxWidth: "560px",
  backgroundColor: "#000000",
  borderRadius: "1.5rem",
  padding: "2.4rem 2rem 1.6rem",
  boxShadow: "0 24px 60px rgba(0,0,0,0.9)",
  border: "1px solid rgba(200,200,200,0.14)",
  color: "#e5e7eb",
};

const logoTopWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  marginBottom: "1rem",
};

const logoTopImage = {
  height: "52px",
  objectFit: "contain",
};

const form = {
  display: "flex",
  flexDirection: "column",
  gap: "0.95rem",
};

const formTitle = {
  fontSize: "1.15rem",
  fontWeight: 600,
};

const formSubtitle = {
  fontSize: "0.82rem",
  color: "#9ca3af",
  marginTop: "-0.3rem",
};

const label = {
  fontSize: "0.8rem",
  color: "#d1d5db",
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
};

const input = {
  padding: "0.7rem 0.85rem",
  borderRadius: "0.75rem",
  border: "1px solid rgba(120,120,120,0.35)",
  backgroundColor: "#0a0a0a",
  color: "#ffffff",
  fontSize: "0.9rem",
};

const errorBox = {
  fontSize: "0.8rem",
  color: "#fca5a5",
  backgroundColor: "rgba(127,29,29,0.25)",
  padding: "0.45rem 0.7rem",
  borderRadius: "0.5rem",
  border: "1px solid rgba(239,68,68,0.4)",
};

const loginButton = {
  marginTop: "0.4rem",
  padding: "0.75rem 0.9rem",
  borderRadius: "0.9rem",
  border: "1px solid #d1d5db",
  background: "linear-gradient(135deg, #f3f4f6, #d1d5db)",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: "0.9rem",
  cursor: "pointer",
};

const registerText = {
  marginTop: "0.8rem",
  fontSize: "0.78rem",
  textAlign: "center",
  color: "#d1d5db",
};

const link = {
  color: "#facc15",
  fontWeight: 600,
  textDecoration: "none",
};

const footerText = {
  marginTop: "1.4rem",
  fontSize: "0.72rem",
  color: "#9ca3af",
  textAlign: "center",
};

export default LoginPage;
