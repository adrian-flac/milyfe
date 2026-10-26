"use client";

import { FormEvent, Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "sign-in" | "register";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestedPath = searchParams.get("callbackUrl");
  const callbackUrl = requestedPath?.startsWith("/") ? requestedPath : "/";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (mode === "register") {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name, bootstrapToken }),
        });
        const body = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) throw new Error(body?.error ?? "No se pudo crear la cuenta.");
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) throw new Error("Correo o contraseña incorrectos.");
      router.replace(callbackUrl);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span>◒</span><p>Milyfe</p></div><h1>{mode === "sign-in" ? "Bienvenido de nuevo" : "Configura tu espacio"}</h1><p className="auth-intro">{mode === "sign-in" ? "Tus decisiones, hábitos y notas están protegidos." : "Crea una cuenta para que tu información quede asociada solo a ti."}</p><form onSubmit={submit} className="auth-form"><label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>{mode === "register" && <label>Nombre <span>(opcional)</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} /></label>}<label>Contraseña{mode === "register" && <span> (12 caracteres o más)</span>}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : undefined} maxLength={128} required /></label>{mode === "register" && <label>Código de activación <span>(solo para reclamar tu espacio actual)</span><input type="password" value={bootstrapToken} onChange={(event) => setBootstrapToken(event.target.value)} autoComplete="off" /></label>}{error && <p className="auth-error" role="alert">{error}</p>}<button disabled={isSubmitting}>{isSubmitting ? "Un momento…" : mode === "sign-in" ? "Iniciar sesión" : "Crear cuenta"}</button></form><button type="button" className="auth-switch" onClick={() => { setMode(mode === "sign-in" ? "register" : "sign-in"); setError(""); }}>{mode === "sign-in" ? "¿Es tu primera vez? Configura tu cuenta" : "Ya tengo cuenta"}</button></section></main>;
}

export default function SignInPage() {
  return <Suspense fallback={<main className="auth-page"><section className="auth-card">Cargando…</section></main>}><SignInForm /></Suspense>;
}
