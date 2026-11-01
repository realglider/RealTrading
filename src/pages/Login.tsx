import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, type FormEvent } from "react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register" && password !== confirmPassword) {
        throw new Error("Die Passwörter stimmen nicht überein.");
      }
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || (mode === "register" ? "Registrierung fehlgeschlagen." : "Anmeldung fehlgeschlagen."));
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
  }

  const registering = mode === "register";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{registering ? "RealTrading Konto erstellen" : "RealTrading Anmeldung"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            {registering && (
              <div className="space-y-2">
                <Label htmlFor="register-name">Name</Label>
                <Input id="register-name" autoComplete="name" minLength={2} maxLength={255} required value={name} onChange={(event) => setName(event.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="login-email">E-Mail</Label>
              <Input id="login-email" type="email" autoComplete="email" maxLength={320} required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Passwort</Label>
              <Input id="login-password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 12 : undefined} maxLength={1024} required value={password} onChange={(event) => setPassword(event.target.value)} />
              {registering && <p className="text-xs text-muted-foreground">Mindestens 12 Zeichen.</p>}
            </div>
            {registering && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Passwort wiederholen</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" size="lg" type="submit" disabled={busy}>
              {busy ? (registering ? "Konto wird erstellt…" : "Anmeldung läuft…") : (registering ? "Registrieren" : "Anmelden")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {registering ? "Schon ein Konto? " : "Noch kein Konto? "}
            <button className="font-medium text-foreground underline underline-offset-4" type="button" onClick={() => switchMode(registering ? "login" : "register")}>
              {registering ? "Anmelden" : "Registrieren"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
