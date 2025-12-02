// src/pages/SignupPage.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import xchangeLogo from "../assets/xchange-logo.png";

function SignupPage() {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function handleSignup(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (!nome || !email || !senha || !confirmarSenha) {
      setErro("Preencha pelo menos Nome, E-mail e Senha.");
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("A confirmação de senha não confere.");
      return;
    }

    setLoading(true);

    try {
      // 1) Cria o usuário no Auth (Supabase)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
      });

      if (signUpError) {
        console.error("Erro no signUp:", signUpError);
        setErro(signUpError.message || "Erro ao criar usuário.");
        setLoading(false);
        return;
      }

      const user = data?.user;
      if (!user) {
        setErro(
          "Usuário criado, mas não foi possível obter o ID. Verifique seu e-mail para confirmação."
        );
        setLoading(false);
        return;
      }

      // 2) Insere os dados complementares na tabela profiles
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: user.id,
        nome,
        cpf,
        cargo,
        empresa,
        email,
      });

      if (profileError) {
        console.error("Erro ao criar perfil:", profileError);
        setErro(
          "Usuário criado, mas houve erro ao salvar o perfil. Contate o suporte."
        );
        setLoading(false);
        return;
      }

      setSucesso("Cadastro realizado com sucesso! Você já pode fazer login.");

      // Redireciona para login em ~1,5s
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      console.error("Erro inesperado:", err);
      setErro("Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageWrapper}>
      <div style={cardWrapper}>
        <div style={logoHeader}>
          <img src={xchangeLogo} alt="XChange" style={logoImage} />
        </div>

        <h1 style={title}>Criar conta</h1>
        <p style={subtitle}>
          Preencha seus dados para acessar o painel de análises.
        </p>

        {erro && <div style={errorBox}>{erro}</div>}
        {sucesso && <div style={successBox}>{sucesso}</div>}

        <form onSubmit={handleSignup} style={form}>
          {/* Nome */}
          <div style={fullRow}>
            <label style={label}>
              Nome completo
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={input}
                placeholder="Seu nome"
              />
            </label>
          </div>

          {/* CPF + Cargo */}
          <div style={twoColumns}>
            <label style={label}>
              CPF
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                style={input}
                placeholder="000.000.000-00"
              />
            </label>

            <label style={label}>
              Cargo
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                style={input}
                placeholder="Ex.: Gerente de Projetos"
              />
            </label>
          </div>

          {/* Empresa */}
          <div style={fullRow}>
            <label style={label}>
              Empresa
              <input
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                style={input}
                placeholder="Nome da empresa"
              />
            </label>
          </div>

          {/* E-mail */}
          <div style={fullRow}>
            <label style={label}>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={input}
                placeholder="seuemail@empresa.com"
              />
            </label>
          </div>

          {/* Senha + Confirmar */}
          <div style={twoColumns}>
            <label style={label}>
              Senha
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                style={input}
                placeholder="••••••••"
              />
            </label>

            <label style={label}>
              Confirmar senha
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                style={input}
                placeholder="Repita a senha"
              />
            </label>
          </div>

          <button type="submit" style={submitButton} disabled={loading}>
            {loading ? "Criando conta..." : "Cadastrar"}
          </button>
        </form>

        <p style={footerText}>
          Já tem uma conta?{" "}
          <Link to="/login" style={link}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ==================== ESTILOS ==================== */

const pageWrapper = {
  minHeight: "100vh",
  width: "100%",
  backgroundColor: "#000000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  color: "#e5e7eb",
};

const cardWrapper = {
  width: "100%",
  maxWidth: "540px",
  backgroundColor: "#050505",
  borderRadius: "1.5rem",
  padding: "2rem 2rem 1.75rem",
  border: "1px solid rgba(148,163,184,0.35)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.9)",
};

const logoHeader = {
  display: "flex",
  justifyContent: "center",
  marginBottom: "1.5rem",
};

const logoImage = {
  height: "52px",
  objectFit: "contain",
  filter: "drop-shadow(0px 0px 6px rgba(255,255,255,0.25))",
};

const title = {
  fontSize: "1.4rem",
  fontWeight: 600,
  marginBottom: "0.25rem",
};

const subtitle = {
  fontSize: "0.9rem",
  color: "#9ca3af",
  marginBottom: "1.25rem",
};

const form = {
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
};

const fullRow = {
  width: "100%",
};

const twoColumns = {
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
};

const label = {
  fontSize: "0.8rem",
  color: "#9ca3af",
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
};

const input = {
  padding: "0.7rem 0.9rem",
  borderRadius: "0.75rem",
  border: "1px solid rgba(120,120,120,0.4)",
  backgroundColor: "#020617",
  color: "#f9fafb",
  fontSize: "0.9rem",
};

const submitButton = {
  marginTop: "0.8rem",
  padding: "0.8rem 1rem",
  borderRadius: "0.9rem",
  border: "none",
  background: "linear-gradient(135deg, #f3f4f6, #d1d5db)", // prata
  color: "#020617",
  fontWeight: 600,
  fontSize: "0.95rem",
  cursor: "pointer",
};

const footerText = {
  marginTop: "1.2rem",
  fontSize: "0.8rem",
  color: "#9ca3af",
  textAlign: "center",
};

const link = {
  color: "#facc15",
  textDecoration: "none",
  fontWeight: 500,
};

const errorBox = {
  backgroundColor: "rgba(239,68,68,0.1)",
  border: "1px solid rgba(248,113,113,0.6)",
  color: "#fecaca",
  borderRadius: "0.75rem",
  padding: "0.6rem 0.8rem",
  fontSize: "0.8rem",
  marginBottom: "0.6rem",
};

const successBox = {
  backgroundColor: "rgba(22,163,74,0.1)",
  border: "1px solid rgba(34,197,94,0.6)",
  color: "#bbf7d0",
  borderRadius: "0.75rem",
  padding: "0.6rem 0.8rem",
  fontSize: "0.8rem",
  marginBottom: "0.6rem",
};

/* Responsividade simples para telas maiores */
if (typeof window !== "undefined") {
  const isWide = window.innerWidth >= 768;
  if (isWide) {
    twoColumns.display = "grid";
    twoColumns.gridTemplateColumns = "1fr 1fr";
    twoColumns.columnGap = "0.75rem";
  }
}

export default SignupPage;
