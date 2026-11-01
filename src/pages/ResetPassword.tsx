import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Passwort konnte nicht geändert werden.");
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Passwort konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center"><CardTitle>Neues Passwort festlegen</CardTitle></CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4 text-center">
              <p role="status" className="text-sm text-muted-foreground">Dein Passwort wurde geändert. Melde dich mit dem neuen Passwort an.</p>
              <Button asChild className="w-full" size="lg"><Link to="/login">Zur Anmeldung</Link></Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              {!token && <p role="alert" className="text-sm text-destructive">Der Reset-Link ist ungültig oder abgelaufen.</p>}
              <div className="space-y-2">
                <Label htmlFor="new-password">Neues Passwort</Label>
                <Input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={password} onChange={(event) => setPassword(event.target.value)} />
                <p className="text-xs text-muted-foreground">Mindestens 12 Zeichen.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Passwort wiederholen</Label>
                <Input id="confirm-new-password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" size="lg" type="submit" disabled={busy || !token}>{busy ? "Wird gespeichert…" : "Passwort ändern"}</Button>
            </form>
          )}
          {!done && <p className="mt-4 text-center text-sm"><Link className="text-muted-foreground underline underline-offset-4 hover:text-foreground" to="/login">Zur Anmeldung</Link></p>}
        </CardContent>
      </Card>
    </div>
  );
}
