import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Anfrage fehlgeschlagen.");
      setMessage(result.message || "Wenn ein Konto besteht, wurde ein Link zum Zurücksetzen gesendet.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Anfrage fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center"><CardTitle>Passwort zurücksetzen</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Gib deine Konto-E-Mail ein. Wenn ein Konto besteht, senden wir dir einen Link, der 30 Minuten gültig ist.</p>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-Mail</Label>
              <Input id="reset-email" type="email" autoComplete="email" maxLength={320} required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" size="lg" type="submit" disabled={busy}>{busy ? "Wird gesendet…" : "Reset-Link senden"}</Button>
          </form>
          <p className="mt-4 text-center text-sm"><Link className="text-muted-foreground underline underline-offset-4 hover:text-foreground" to="/login">Zur Anmeldung</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
