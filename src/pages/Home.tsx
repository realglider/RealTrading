import { useMemo } from "react";
import { Activity, ArrowUpRight, Bot, CircleCheck, Clock3, Database, Octagon, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AuthLayout from "@/components/AuthLayout";
import { MarketPanel } from "@/components/MarketPanel";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const fmt = (value: number, digits = 2) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value);
const time = (value: string) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const money = (value: string | number | null) => value === null ? "—" : `${Number(value) >= 0 ? "+" : ""}${fmt(Number(value))} USDT`;

function ConsoleSkeleton() {
  return <div className="grid gap-4 p-4 lg:p-6"><Skeleton className="h-24 w-full" /><div className="grid gap-4 xl:grid-cols-[1fr_340px]"><div className="grid gap-4"><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /></div><Skeleton className="h-[500px] w-full" /></div></div>;
}

export default function Home() {
  const overview = trpc.bot.overview.useQuery(undefined, { refetchInterval: 15_000, retry: false });
  const utils = trpc.useUtils();
  const emergency = trpc.bot.emergencyStop.useMutation({
    onSuccess: async (result) => {
      toast.warning(`Not-Stopp aktiv; ${result.exitsInitiated} Exit-Vorgänge gestartet`);
      await utils.bot.overview.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const stats = useMemo(() => {
    const data = overview.data;
    const closed = data?.positions.filter((position) => position.status === "closed") ?? [];
    return {
      armed: data?.settings.filter((setting) => setting.liveEnabled).length ?? 0,
      open: data?.positions.filter((position) => ["pending", "open", "closing"].includes(position.status)).length ?? 0,
      eligible: data?.settings.filter((setting) => data.latestValidations.some((validation) =>
        validation.market === setting.market && validation.symbol === setting.symbol && validation.timeframe === setting.timeframe && validation.eligible,
      )).length ?? 0,
      pnl: closed.reduce((sum, position) => sum + Number(position.realizedPnl ?? 0), 0),
    };
  }, [overview.data]);

  return (
    <AuthLayout>
      {overview.isLoading ? <ConsoleSkeleton /> : overview.error || !overview.data ? (
        <div className="flex min-h-[70dvh] items-center justify-center p-6">
          <div className="max-w-lg border border-red-400/30 bg-red-400/5 p-6">
            <ShieldAlert className="mb-4 h-6 w-6 text-red-300" />
            <h1 className="font-display text-xl font-semibold">Bot-Konsole nicht verfügbar</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{overview.error?.message ?? "Die Übersicht konnte nicht geladen werden."}</p>
            <Button className="mt-4" variant="outline" onClick={() => void overview.refetch()}>Erneut versuchen</Button>
          </div>
        </div>
      ) : (
        <div className="min-h-full">
          <header className="border-b border-border bg-background/80">
            <div className="flex flex-col gap-5 px-4 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-cyan-300"><Bot className="h-3.5 w-3.5" />Autonomous execution / KuCoin</div>
                <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Risiko zuerst. Strategie danach.</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Walk-Forward-Auswahl auf ungesehenen Daten, getrennte Marktlimits und nachvollziehbare Orderausführung.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-2 flex items-center gap-2 text-xs text-muted-foreground"><span className={`status-dot ${overview.data.scheduler.running ? "status-dot--live" : ""}`} />Scheduler {overview.data.scheduler.running ? "aktiv" : "gestoppt"} · 60 s</div>
                <Button variant="outline" size="sm" asChild><a href="/analysis/index.html">Chartanalyse<ArrowUpRight /></a></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Octagon />Not-Stopp</Button></AlertDialogTrigger>
                  <AlertDialogContent className="border-red-400/40 bg-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display text-red-200">Globalen Not-Stopp auslösen?</AlertDialogTitle>
                      <AlertDialogDescription>Spot und Futures werden sofort deaktiviert. Für jede offene Bot-Position wird eine Market-Exit-Order eingeleitet. Bereits unklare oder fehlgeschlagene Exchange-Positionen müssen auf KuCoin geprüft werden.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction className="bg-red-400 text-[#1b0808] hover:bg-red-300" disabled={emergency.isPending} onClick={() => emergency.mutate()}>Alles stoppen & schließen</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <div className="grid grid-cols-2 border-t border-border md:grid-cols-4">
              {[{ label: "Märkte armiert", value: `${stats.armed} / 2`, warn: stats.armed > 0 }, { label: "Aktive Positionen", value: stats.open }, { label: "Freigaben aktuell", value: `${stats.eligible} / 2` }, { label: "Geschätzter PnL · Historie", value: money(stats.pnl) }].map((item) => <div key={item.label} className="border-r border-border px-4 py-3 last:border-r-0 md:px-6"><div className="terminal-label">{item.label}</div><div className={`mt-1 font-display text-lg font-semibold ${item.warn ? "text-amber-200" : ""}`}>{item.value}</div></div>)}
            </div>
          </header>

          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
            <div className="grid min-w-0 content-start gap-4">
              {overview.data.settings.map((settings) => <MarketPanel
                key={settings.market}
                settings={settings}
                validation={overview.data.latestValidations.find((validation) => validation.market === settings.market && validation.symbol === settings.symbol && validation.timeframe === settings.timeframe)}
                validations={overview.data.latestValidations.filter((validation) => validation.market === settings.market)}
                recommendation={overview.data.recommendations.find((recommendation) => recommendation.market === settings.market)}
                coinRankings={overview.data.coinRankings.filter((coin) => coin.market === settings.market)}
              />)}
            </div>

            <aside className="grid min-w-0 content-start gap-4">
              <section className="border border-border bg-card">
                <div className="border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">Ausführungsprotokoll</h2><p className="mt-1 text-xs text-muted-foreground">Serverseitige Sicherheitskette</p></div>
                <div className="grid gap-4 p-4">
                  {[{ icon: Database, title: "Credentials isoliert", text: "AES-256-GCM; keine Secrets im Browser oder Verlauf." }, { icon: CircleCheck, title: "OOS statt Wunschdenken", text: "Coin-Ranking, 3 rollierende Testfenster und mindestens 8 geschlossene OOS-Trades." }, { icon: ShieldCheck, title: "Kosten- & Regimefilter", text: "No-Trade-Zone, Extremvolatilitäts-Stopp und reduziertes Risiko bei hoher Volatilität." }, { icon: Clock3, title: "Kontrolliertes Einstiegsfenster", text: "Folgekerze, maximal 0,25R Preisabweichung; Stop oder Ziel dürfen nicht vorher berührt sein." }, { icon: ShieldCheck, title: "Ein Trade pro Markt", text: "Signal-Deduplizierung, Positions- und Tagesverlustgrenze." }].map((item) => <div key={item.title} className="flex gap-3"><item.icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><div><h3 className="text-xs font-semibold">{item.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p></div></div>)}
                </div>
                <div className="border-t border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100">Futures-Positionen erhalten nach bestätigtem Fill eine KuCoin-Stop-/TP-Schutzorder mit Mark-Preis-Trigger. Spot-Exits werden weiter serverseitig überwacht. Schutzorders garantieren wegen Slippage, Lücken oder Exchange-Ausfällen keinen exakten Ausstieg.</div>
              </section>

              <section className="border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">Ereignisse</h2><Activity className="h-4 w-4 text-muted-foreground" /></div>
                <div className="max-h-[420px] overflow-y-auto">
                  {overview.data.events.length ? overview.data.events.map((event) => <div key={event.id} className="border-b border-border px-4 py-3 last:border-b-0"><div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider"><span className={event.level === "error" ? "text-red-300" : event.level === "success" ? "text-mint" : event.level === "warn" ? "text-amber-200" : "text-cyan-300"}>{event.level} · {event.market}</span><time className="text-muted-foreground">{time(event.createdAt)}</time></div><p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{event.message}</p></div>) : <p className="p-4 text-sm text-muted-foreground">Noch keine Bot-Ereignisse.</p>}
                </div>
              </section>
            </aside>
          </div>

          <section className="mx-4 mb-6 border border-border bg-card lg:mx-6">
            <Tabs defaultValue="positions">
              <div className="border-b border-border px-4 py-2"><TabsList className="grid h-10 w-full grid-cols-3 bg-background"><TabsTrigger value="positions">Positionen</TabsTrigger><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="folds"><span className="sm:hidden">Folds</span><span className="hidden sm:inline">Walk-Forward-Folds</span></TabsTrigger></TabsList></div>
              <TabsContent value="positions" className="mt-0 overflow-x-auto">
                <table className="data-table"><thead><tr><th>Markt / Symbol</th><th>Seite</th><th>Strategie</th><th>Menge</th><th>Entry</th><th>Stop / Ziel</th><th>Schutz</th><th>Status</th><th>PnL geschätzt</th><th>Eröffnet</th></tr></thead><tbody>{overview.data.positions.length ? overview.data.positions.map((position) => <tr key={position.id}><td><strong>{position.market}</strong><span>{position.symbol}</span></td><td className={position.side === "buy" ? "text-mint" : "text-red-300"}>{position.side.toUpperCase()}</td><td>{position.strategyId}</td><td>{position.quantity}</td><td>{position.entryPrice}</td><td>{position.stopPrice}<span>{position.targetPrice}</span></td><td>{position.exchangeProtectionActive ? "KuCoin" : "Bot-Überwachung"}</td><td><Status value={position.status} /></td><td className={Number(position.realizedPnl ?? 0) >= 0 ? "text-mint" : "text-red-300"}>{money(position.realizedPnl)}</td><td>{time(position.openedAt)}</td></tr>) : <EmptyRow columns={10} text="Noch keine Positionen. Live-Orders entstehen erst nach Armierung und frischem, freigegebenem Signal." />}</tbody></table>
              </TabsContent>
              <TabsContent value="orders" className="mt-0 overflow-x-auto">
                <table className="data-table"><thead><tr><th>Zeit</th><th>Markt / Symbol</th><th>Zweck</th><th>Seite</th><th>Strategie</th><th>Status</th><th>Client-OID</th><th>Exchange-ID</th></tr></thead><tbody>{overview.data.orders.length ? overview.data.orders.map((order) => <tr key={order.id}><td>{time(order.createdAt)}</td><td><strong>{order.market}</strong><span>{order.symbol}</span></td><td>{order.purpose}</td><td>{order.side.toUpperCase()}</td><td>{order.strategyId}</td><td><Status value={order.status} /></td><td className="max-w-56 truncate" title={order.clientOid}>{order.clientOid}</td><td>{order.exchangeOrderId ?? "—"}</td></tr>) : <EmptyRow columns={8} text="Noch keine Orders vorhanden." />}</tbody></table>
              </TabsContent>
              <TabsContent value="folds" className="mt-0 overflow-x-auto">
                <table className="data-table"><thead><tr><th>Markt / TF</th><th>Fold</th><th>Training von</th><th>Training bis</th><th>Test bis</th><th>Auswahl nur aus Training</th><th>OOS-Trades</th><th>Netto-R</th><th>Trefferquote</th></tr></thead><tbody>{overview.data.latestValidations.flatMap((validation) => validation.folds.map((fold) => <tr key={`${validation.id}-${fold.fold}`}><td>{validation.market} / {validation.timeframe}</td><td>{fold.fold} / 3</td><td>{time(fold.trainFrom)}</td><td>{time(fold.trainTo)}</td><td>{time(fold.testTo)}</td><td>{fold.strategyName}</td><td>{fold.closedTrades}</td><td className={fold.netR >= 0 ? "text-mint" : "text-red-300"}>{fmt(fold.netR)}</td><td>{fmt(fold.winRate)} %</td></tr>))}{!overview.data.latestValidations.length && <EmptyRow columns={9} text="Noch keine Walk-Forward-Folds berechnet." />}</tbody></table>
              </TabsContent>
            </Tabs>
          </section>
          <footer className="mx-4 pb-8 text-xs leading-5 text-muted-foreground lg:mx-6">Keine Gewinn- oder Trefferquotengarantie. Backtests enthalten Modellannahmen; PnL und Tagesverlust sind interne Schätzungen und ersetzen nicht die KuCoin-Kontoabrechnung. Live-Ausführung erfordert eigene Zugangsdaten und eine erfolgreiche Exchange-Verifikation.</footer>
        </div>
      )}
    </AuthLayout>
  );
}

function Status({ value }: { value: string }) {
  return <span className={`status-badge status-badge--${value}`}>{value}</span>;
}

function EmptyRow({ columns, text }: { columns: number; text: string }) {
  return <tr><td colSpan={columns} className="h-24 text-center text-muted-foreground">{text}</td></tr>;
}
