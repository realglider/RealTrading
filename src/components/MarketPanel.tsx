import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, KeyRound, Play, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BotSettingsDto, CoinRankingDto, RecommendationDto, Timeframe, ValidationDto } from "@contracts/trading";
import { COIN_OPTIONS, TIMEFRAMES } from "@contracts/trading";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const number = (value: number, digits = 2) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value);
const compact = (value: number) => new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Noch nie";

function CredentialsDialog({ settings }: { settings: BotSettingsDto }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: "", secret: "", passphrase: "", keyVersion: "3" as "2" | "3" });
  const save = trpc.bot.saveCredentials.useMutation({
    onSuccess: async () => {
      toast.success(`${settings.market === "spot" ? "Spot" : "Futures"}-Zugang geprüft und verschlüsselt gespeichert`);
      setForm({ key: "", secret: "", passphrase: "", keyVersion: "3" });
      setOpen(false);
      await utils.bot.overview.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.bot.removeCredentials.useMutation({
    onSuccess: async () => {
      toast.success("Zugangsdaten gelöscht");
      setOpen(false);
      await utils.bot.overview.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><KeyRound />{settings.hasCredentials ? "Zugang verwalten" : "API-Zugang"}</Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">KuCoin · {settings.market === "spot" ? "Spot" : "Futures"}</DialogTitle>
          <DialogDescription>
            Der Kontozugriff wird vor dem Speichern geprüft. Es wird keine Order gesendet. Schlüssel bleiben ausschließlich verschlüsselt auf dem Server.
          </DialogDescription>
        </DialogHeader>
        <div className="border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs leading-5 text-muted-foreground">
          Berechtigungen: General/Read{settings.market === "spot" ? " + Spot" : " + Futures"}. Niemals Withdrawal aktivieren. Nach Möglichkeit IP-Restriktion auf KuCoin setzen.
        </div>
        <form className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ market: settings.market, ...form });
        }}>
          <div className="grid gap-2">
            <Label htmlFor={`${settings.market}-key`}>API-Key</Label>
            <Input id={`${settings.market}-key`} type="password" autoComplete="off" required minLength={10} value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder={settings.keyHint ?? "KuCoin API-Key"} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${settings.market}-secret`}>API-Secret</Label>
            <Input id={`${settings.market}-secret`} type="password" autoComplete="new-password" required minLength={10} value={form.secret} onChange={(event) => setForm({ ...form, secret: event.target.value })} />
          </div>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="grid gap-2">
              <Label htmlFor={`${settings.market}-passphrase`}>Passphrase</Label>
              <Input id={`${settings.market}-passphrase`} type="password" autoComplete="new-password" required value={form.passphrase} onChange={(event) => setForm({ ...form, passphrase: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Key-Version</Label>
              <Select value={form.keyVersion} onValueChange={(keyVersion) => setForm({ ...form, keyVersion: keyVersion as "2" | "3" })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="3">3</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="items-center sm:justify-between">
            <Button type="button" variant="ghost" className="text-red-300" disabled={!settings.hasCredentials || remove.isPending} onClick={() => remove.mutate({ market: settings.market })}><Trash2 />Zugang löschen</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? <RefreshCw className="animate-spin" /> : <ShieldCheck />}Prüfen & speichern</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MarketPanel({ settings, validation, validations, recommendation, coinRankings }: {
  settings: BotSettingsDto;
  validation?: ValidationDto;
  validations: ValidationDto[];
  recommendation?: RecommendationDto;
  coinRankings: CoinRankingDto[];
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ symbol: settings.symbol, timeframe: settings.timeframe, riskPct: settings.riskPct, maxPositionUsd: settings.maxPositionUsd, maxDailyLossUsd: settings.maxDailyLossUsd, leverage: settings.leverage });
  useEffect(() => setForm({ symbol: settings.symbol, timeframe: settings.timeframe, riskPct: settings.riskPct, maxPositionUsd: settings.maxPositionUsd, maxDailyLossUsd: settings.maxDailyLossUsd, leverage: settings.leverage }), [settings]);
  const refresh = async () => { await utils.bot.overview.invalidate(); };
  const save = trpc.bot.saveSettings.useMutation({ onSuccess: async () => { toast.success("Konfiguration gespeichert; Live-Modus deaktiviert"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const validate = trpc.bot.validate.useMutation({ onSuccess: async (result) => { toast[result.eligible ? "success" : "warning"](result.reason); await refresh(); }, onError: (error) => toast.error(error.message) });
  const live = trpc.bot.setLive.useMutation({ onSuccess: async () => { toast.success("Live-Status aktualisiert"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const runNow = trpc.bot.runNow.useMutation({ onSuccess: async (message) => { toast.info(message); await refresh(); }, onError: (error) => toast.error(error.message) });
  const directory = trpc.bot.coinOptions.useQuery(
    { market: settings.market },
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: false },
  );
  const marketName = settings.market === "spot" ? "Spot" : "Futures";
  const coinOptions = directory.data?.coins.length
    ? directory.data.coins.map((coin) => ({ symbol: coin.symbol, label: coin.baseCurrency === "XBT" ? "BTC" : coin.baseCurrency }))
    : COIN_OPTIONS[settings.market];
  const availableCoins = coinOptions.some((coin) => coin.symbol === form.symbol)
    ? coinOptions
    : [...coinOptions, { symbol: form.symbol, label: `Aktuell: ${form.symbol}` }];
  const displaySymbol = recommendation?.symbol && recommendation.symbol !== "—" ? recommendation.symbol : settings.symbol;
  const displayValidations = validations.filter((entry) => entry.symbol === displaySymbol);

  return (
    <section className="min-w-0 border border-border bg-card" aria-label={`${marketName}-Bot`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`status-dot ${settings.liveEnabled ? "status-dot--live" : ""}`} aria-hidden="true" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold tracking-tight">{marketName}</h2>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{settings.symbol}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{settings.liveEnabled ? "ECHTER HANDEL ARMIERT" : "Nur Überwachung · keine neuen Entries"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CredentialsDialog settings={settings} />
          {settings.liveEnabled ? (
            <Button size="sm" variant="outline" className="border-amber-400/40 text-amber-200" disabled={live.isPending} onClick={() => live.mutate({ market: settings.market, enabled: false })}>Deaktivieren</Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="border-[rgba(52,211,153,0.4)] text-mint">Live armieren</Button></AlertDialogTrigger>
              <AlertDialogContent className="border-border bg-card">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display">Echten {marketName}-Handel armieren?</AlertDialogTitle>
                  <AlertDialogDescription>Der Bot kann anschließend reale KuCoin-Market-Orders senden. Vorausgesetzt werden gespeicherte Zugangsdaten und eine freigegebene Walk-Forward-Validierung. Verluste bis zum gesetzten Risiko- und Tageslimit sind möglich.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction className="bg-mint text-[#061510] hover:bg-[#6ee7b7]" onClick={() => live.mutate({ market: settings.market, enabled: true })}>Echten Handel armieren</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <form className="grid grid-cols-2 gap-x-3 gap-y-4 border-b border-border p-4 md:grid-cols-6" onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ market: settings.market, ...form });
      }}>
        <div className="col-span-2 grid gap-2 md:col-span-2">
          <Label htmlFor={`${settings.market}-symbol`}>Coin</Label>
          <Select value={form.symbol} onValueChange={(symbol) => setForm({ ...form, symbol })}>
            <SelectTrigger id={`${settings.market}-symbol`} className="w-full" aria-label={`${marketName}-Coin`}>
              <SelectValue placeholder="Coin auswählen" />
            </SelectTrigger>
            <SelectContent>
              {availableCoins.map((coin) => (
                <SelectItem key={coin.symbol} value={coin.symbol}>
                  {coin.label} · {coin.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className={`text-[10px] leading-4 ${directory.data?.warning || directory.error ? "text-amber-200" : "text-muted-foreground"}`}>
            {directory.isLoading
              ? "KuCoin Top 50 nach 24h-Umsatz werden geladen …"
              : directory.data?.warning ?? directory.error?.message ?? `KuCoin Top ${directory.data?.coins.length ?? COIN_OPTIONS[settings.market].length} nach 24h-Umsatz`}
          </p>
        </div>
        <div className="grid gap-2">
          <Label>Timeframe</Label>
          <Select value={form.timeframe} onValueChange={(timeframe) => setForm({ ...form, timeframe: timeframe as Timeframe })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{TIMEFRAMES.map((timeframe) => <SelectItem key={timeframe} value={timeframe}>{timeframe}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${settings.market}-risk`}>Risiko / Trade %</Label>
          <Input id={`${settings.market}-risk`} type="number" min="0.01" max="5" step="0.01" required value={form.riskPct} onChange={(event) => setForm({ ...form, riskPct: Number(event.target.value) })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${settings.market}-max`}>Max. Position USDT</Label>
          <Input id={`${settings.market}-max`} type="number" min="1" step="1" required value={form.maxPositionUsd} onChange={(event) => setForm({ ...form, maxPositionUsd: Number(event.target.value) })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${settings.market}-loss`}>Tagesverlust USDT</Label>
          <Input id={`${settings.market}-loss`} type="number" min="0.01" step="0.01" required value={form.maxDailyLossUsd} onChange={(event) => setForm({ ...form, maxDailyLossUsd: Number(event.target.value) })} />
        </div>
        {settings.market === "futures" && <div className="grid gap-2">
          <Label htmlFor="futures-leverage">Hebel</Label>
          <Input id="futures-leverage" type="number" min="1" max="20" step="1" required value={form.leverage} onChange={(event) => setForm({ ...form, leverage: Number(event.target.value) })} />
        </div>}
        <div className="col-span-2 flex flex-wrap items-end gap-2 md:col-span-6">
          <Button type="submit" size="sm" disabled={save.isPending}>Konfiguration speichern</Button>
          <Button type="button" size="sm" variant="outline" disabled={validate.isPending} onClick={() => validate.mutate({ market: settings.market })}>{validate.isPending ? <RefreshCw className="animate-spin" /> : <Activity />}{validate.isPending ? "Top 50 & Walk-Forward laufen …" : "Walk-Forward starten"}</Button>
          <Button type="button" size="sm" variant="ghost" disabled={runNow.isPending} onClick={() => runNow.mutate({ market: settings.market })}><Play />Bot-Lauf</Button>
        </div>
      </form>

      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="terminal-label">Coin-, Strategie- & Timeframe-Empfehlung</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold">
                {recommendation?.eligible ? `${displaySymbol} · ${recommendation.strategyName}` : "Keine Handelsempfehlung"}
              </h3>
              {recommendation?.eligible && recommendation.timeframe && <span className="status-badge status-badge--open">{recommendation.timeframe}</span>}
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              {recommendation?.reason ?? "Walk-Forward starten, um Strategie und Timeframe für diesen Coin auf ungesehenen Daten zu vergleichen."}
            </p>
            {recommendation && <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {recommendation.evaluatedTimeframes} / {TIMEFRAMES.length} Timeframes für {displaySymbol} bewertet
              {recommendation.evaluatedSymbols.length > 1 ? ` · Coin-Auswahl: ${recommendation.evaluatedSymbols.join(", ")}` : ""}
              {recommendation.createdAt ? ` · ${date(recommendation.createdAt)}` : ""}
              {recommendation.failedTimeframes.length ? ` · TF-Fehler: ${recommendation.failedTimeframes.join(", ")}` : ""}
              {recommendation.failedSymbols.length ? ` · Datenfehler: ${recommendation.failedSymbols.join(", ")}` : ""}
            </p>}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!recommendation?.eligible || !recommendation.timeframe || save.isPending}
            onClick={() => {
              if (!recommendation?.timeframe) return;
              save.mutate({ market: settings.market, ...form, symbol: recommendation.symbol, timeframe: recommendation.timeframe });
            }}
          >
            Empfehlung übernehmen
          </Button>
        </div>
        {coinRankings.length > 0 && <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="terminal-label">Relative-Strength-Ranking · 4h</span>
            <span className="text-[10px] text-muted-foreground">Momentum + Relative Stärke · Liquiditätspflicht</span>
          </div>
          <div className="mt-2 max-h-96 max-w-full overflow-auto border border-border">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead><tr className="border-b border-border bg-background text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2 font-medium">Rang / Coin</th><th className="px-3 py-2 font-medium">7 Tage</th><th className="px-3 py-2 font-medium">30 Tage</th><th className="px-3 py-2 font-medium">Rel. BTC · 7T</th><th className="px-3 py-2 font-medium">Vol. / Tag</th><th className="px-3 py-2 font-medium">Ø Volumen / 4h</th><th className="px-3 py-2 font-medium">Regime / Status</th></tr></thead>
              <tbody>{coinRankings.map((coin) => <tr key={coin.symbol} className={`border-b border-border last:border-b-0 ${coin.symbol === displaySymbol ? "bg-cyan-400/[0.055] text-cyan-100" : ""}`}>
                <td className="px-3 py-2.5 font-medium">#{coin.rank} · {coin.symbol}</td>
                <td className={`px-3 py-2.5 ${coin.momentum7dPct >= 0 ? "text-mint" : "text-red-300"}`}>{number(coin.momentum7dPct)} %</td>
                <td className={`px-3 py-2.5 ${coin.momentum30dPct >= 0 ? "text-mint" : "text-red-300"}`}>{number(coin.momentum30dPct)} %</td>
                <td className="px-3 py-2.5">{number(coin.relativeStrength7dPct)} pp</td>
                <td className="px-3 py-2.5">{number(coin.dailyVolatilityPct)} %</td>
                <td className="px-3 py-2.5">{compact(coin.averageDollarVolume)} USDT</td>
                <td className={`px-3 py-2.5 ${coin.liquid ? "text-mint" : "text-amber-200"}`} title={coin.reason}>{coin.regime} · {coin.liquid ? "Liquide" : "Ausgeschlossen"}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Nur die beiden bestplatzierten liquiden Coins gehen in den folgenden Walk-Forward-Vergleich. Das Ranking allein ist keine Handelsfreigabe.</p>
        </>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="terminal-label">Walk-Forward · {displaySymbol}</span>
          <span className="text-[10px] text-muted-foreground">Kosten- und Regimefilter aktiv</span>
        </div>
        <div className="mt-2 max-w-full overflow-x-auto border border-border">
          <table className="w-full min-w-[650px] border-collapse text-left text-xs">
            <thead><tr className="border-b border-border bg-background text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-3 py-2 font-medium">Timeframe</th><th className="px-3 py-2 font-medium">Strategie</th><th className="px-3 py-2 font-medium">OOS-Trades</th><th className="px-3 py-2 font-medium">Netto-R</th><th className="px-3 py-2 font-medium">Profit-Faktor</th><th className="px-3 py-2 font-medium">Freigabe</th></tr></thead>
            <tbody>{TIMEFRAMES.map((timeframe) => {
              const item = displayValidations.find((entry) => entry.timeframe === timeframe);
              const recommended = recommendation?.eligible && recommendation.timeframe === timeframe;
              return <tr key={timeframe} className={`border-b border-border last:border-b-0 ${recommended ? "bg-cyan-400/[0.055] text-cyan-100" : ""}`}>
                <td className="px-3 py-2.5 font-medium">{timeframe}{recommended ? " · Empfohlen" : ""}</td>
                <td className="px-3 py-2.5">{item?.strategyName ?? "—"}</td>
                <td className="px-3 py-2.5">{item?.closedTrades ?? "—"}</td>
                <td className={`px-3 py-2.5 ${item ? (item.netR >= 0 ? "text-mint" : "text-red-300") : ""}`}>{item ? number(item.netR) : "—"}</td>
                <td className="px-3 py-2.5">{item ? (item.profitFactor === null ? "∞ / n.v." : number(item.profitFactor)) : "—"}</td>
                <td className={`px-3 py-2.5 ${item?.eligible ? "text-mint" : "text-amber-200"}`}>{item ? (item.eligible ? "Freigegeben" : "Nicht freigegeben") : "Nicht geprüft"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Empfohlen wird nur eine freigegebene OOS-Kombination. Die Übernahme speichert Coin und Timeframe und deaktiviert den Live-Modus zur erneuten Sicherheitsprüfung.</p>
        <div className="mt-3 grid gap-px border border-border bg-border sm:grid-cols-3">
          <div className="bg-background p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">No-Trade-Zone</div><div className="mt-1 text-xs">TP2 nach geschätzten Kosten mindestens +0,50R</div></div>
          <div className="bg-background p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Regimefilter</div><div className="mt-1 text-xs">Extremvolatilität blockiert; Trend-Pullback nur passend zur EMA-Richtung</div></div>
          <div className="bg-background p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Volatilitätsskalierung</div><div className="mt-1 text-xs">Risiko bei hoher Volatilität auf 25–100 % des Konfigurationswerts</div></div>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="terminal-label">Walk-Forward-Freigabe</span>
            <span className={`text-xs ${validation?.eligible ? "text-mint" : "text-amber-200"}`}>{validation ? (validation.eligible ? "FREIGEGEBEN" : "NICHT FREIGEGEBEN") : "AUSSTEHEND"}</span>
          </div>
          {validation ? <>
            <p className="max-w-3xl text-sm font-medium">{validation.strategyName}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{validation.reason}</p>
            <div className="mt-3 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
              {[['OOS-Trades', validation.closedTrades], ['Netto-R', number(validation.netR)], ['Trefferquote', `${number(validation.winRate)} %`], ['Profit-Faktor', validation.profitFactor === null ? "∞ / n.v." : number(validation.profitFactor)]].map(([label, value]) => <div key={label} className="bg-background px-3 py-2"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 text-sm text-foreground">{value}</div></div>)}
            </div>
          </> : <p className="text-sm text-muted-foreground">Noch keine Validierung. Vor der Armierung sind mindestens 480 geschlossene KuCoin-Kerzen erforderlich.</p>}
        </div>
        <div className="flex flex-col justify-end text-xs text-muted-foreground lg:text-right">
          <span>Validiert: {date(settings.lastValidationAt)}</span>
          <span className="mt-1">Letzter Lauf: {date(settings.lastRunAt)}</span>
          <a href="/analysis/index.html" className="mt-3 inline-flex items-center gap-1 text-cyan-300 underline decoration-cyan-300/30 underline-offset-4 hover:decoration-cyan-300">Chartanalyse öffnen<ArrowUpRight className="h-3 w-3" /></a>
        </div>
      </div>
    </section>
  );
}
