import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold">Sports Predictor</h1>
          <p className="text-sm text-muted-foreground mt-1">Entre na sua conta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Entrar
          </Button>
        </form>

        <Button variant="outline" onClick={handleGoogle} className="w-full">Entrar com Google</Button>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <Link to="/forgot-password" className="hover:underline block">Esqueceu a senha?</Link>
          <Link to="/register" className="hover:underline block">Criar conta</Link>
        </div>
      </div>
    </div>
  );
}