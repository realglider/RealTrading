import { useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, Mail, Save } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";

export default function EmailSettings() {
  const { user } = useAuth();
  const settings = trpc.auth.gmailSettings.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const save = trpc.auth.saveGmailSettings.useMutation({
    onSuccess: async () => {
      setAppPassword("");
      toast.success("Google-Mailversand ist eingerichtet.");
      await utils.auth.gmailSettings.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({ user: email, appPassword });
  }

  return (
    <AuthLayout>
      <div className="mx-auto grid max-w-3xl gap-6 p-4 lg:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Kontoeinrichtung</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Passwort-Reset per E-Mail</h1>
          <p className="mt-2 text-sm text-muted-foreground">Richte den Versand einmalig ein. Danach können Nutzer den Reset-Link selbst anfordern.</p>
        </div>

        {user?.role !== "admin" ? (
          <Card><CardContent className="pt-6"><p role="alert">Diese Einstellung ist nur für Administratoren verfügbar.</p></CardContent></Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-cyan-300" />Google Mail</CardTitle>
              <CardDescription>Dein normales Google-Passwort wird hier nicht verwendet. Erstelle ein separates App-Passwort.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {settings.data?.configured ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />Mailversand eingerichtet für {settings.data.user}
                </div>
              ) : settings.isLoading ? <p className="text-sm text-muted-foreground">Einstellungen werden geladen…</p> : null}

              <p className="text-sm leading-6 text-muted-foreground">
                In deinem Google-Konto unter „Sicherheit → App-Passwörter“ ein App-Passwort für RealTrading erstellen.
                <a className="ml-1 underline underline-offset-4" href="https://support.google.com/accounts/answer/185833?hl=de" target="_blank" rel="noreferrer">Google-Anleitung öffnen</a>.
                Das App-Passwort kann jederzeit widerrufen werden.
              </p>

              <form className="grid gap-4" onSubmit={submit}>
                <div className="grid gap-2">
                  <Label htmlFor="smtp-email">Google-E-Mail-Adresse</Label>
                  <Input id="smtp-email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={settings.data?.user || "name@gmail.com"} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtp-app-password">Google-App-Passwort</Label>
                  <Input id="smtp-app-password" type="password" autoComplete="new-password" required minLength={16} maxLength={64} value={appPassword} onChange={(event) => setAppPassword(event.target.value)} placeholder="16-stelliges App-Passwort" />
                </div>
                <p className="text-xs text-muted-foreground"><KeyRound className="mr-1 inline h-3.5 w-3.5" />Das Passwort wird vor dem Speichern verschlüsselt. Es wird nie wieder angezeigt.</p>
                <Button type="submit" disabled={save.isPending}>
                  <Save className="h-4 w-4" />{save.isPending ? "Verbindung wird geprüft…" : "Verbindung prüfen & speichern"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthLayout>
  );
}

