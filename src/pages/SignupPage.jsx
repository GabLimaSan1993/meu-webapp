import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import xchangeLogo from "../assets/xchange-logo.png"; // ajuste conforme seu caminho real

function SignupPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    navigate("/login");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#000", // FUNDO PRETO
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "rgba(0,0,0,0.65)",
          borderRadius: "1rem",
          padding: "2.5rem 2rem",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 0 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Logo XChange */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <img
            src={xchangeLogo}
            alt="XChange Logo"
            style={{ width: "150px", marginBottom: "0.5rem" }}
          />
        </div>

        <h2 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem", color: "white" }}>
          Criar conta
        </h2>

        <p style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: "1.5rem" }}>
          Preencha os dados abaixo para criar seu acesso.
        </p>

        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              placeholder="voce@empresa.com"
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "0.6rem",
                border: "1px solid #1f2937",
                background: "#0a0a0a",
                color: "white",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              placeholder="Sua senha"
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "0.6rem",
                border: "1px solid #1f2937",
                background: "#0a0a0a",
                color: "white",
              }}
            />
          </div>

          {errorMsg && (
            <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.5rem",
              width: "100%",
              background:
                "linear-gradient(135deg, #d1d5db, #f3f4f6)", // BOTÃO PRATA
              color: "black",
              border: "none",
              padding: "0.75rem",
              borderRadius: "0.6rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {loading ? "Carregando..." : "Criar conta"}
          </button>
        </form>

        <p style={{ marginTop: "1.5rem", textAlign: "center", color: "#ccc" }}>
          Já tem conta?{" "}
          <Link to="/login" style={{ color: "#facc15", textDecoration: "none", fontWeight: "600" }}>
            Entrar
          </Link>
        </p>

        <p style={{ textAlign: "center", fontSize: "0.75rem", marginTop: "2rem", color: "#aaa" }}>
          © 2025 XChange. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
