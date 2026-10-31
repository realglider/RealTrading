/**
 * Main Application Controller for RealTrading Strategie
 * Integrates TradingView Lightweight Charts, Binance Live REST/WebSocket,
 * Indicators, AI Signal Overlays, Backtester & Interactive UI.
 */

(function () {
  const WATCHLIST_SYMBOLS = [
    { symbol: 'BTCUSDT', name: 'Bitcoin / USDT', base: 'BTC' },
    { symbol: 'ETHUSDT', name: 'Ethereum / USDT', base: 'ETH' },
    { symbol: 'SOLUSDT', name: 'Solana / USDT', base: 'SOL' },
    { symbol: 'ONDOUSDT', name: 'Ondo Finance / USDT', base: 'ONDO' },
    { symbol: 'ZECUSDT', name: 'Zcash / USDT', base: 'ZEC' },
    { symbol: 'ZETAUSDT', name: 'ZetaChain (ZETA/ZEX) / USDT', base: 'ZETA' },
    { symbol: 'ZROUSDT', name: 'LayerZero / USDT', base: 'ZRO' },
    { symbol: 'ZKUSDT', name: 'zkSync / USDT', base: 'ZK' },
    { symbol: 'XRPUSDT', name: 'Ripple / USDT', base: 'XRP' },
    { symbol: 'BNBUSDT', name: 'BNB / USDT', base: 'BNB' },
    { symbol: 'SUIUSDT', name: 'Sui / USDT', base: 'SUI' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin / USDT', base: 'DOGE' },
    { symbol: 'LINKUSDT', name: 'Chainlink / USDT', base: 'LINK' },
    { symbol: 'AVAXUSDT', name: 'Avalanche / USDT', base: 'AVAX' },
    { symbol: 'TAOUSDT', name: 'Bittensor / USDT', base: 'TAO' },
    { symbol: 'RENDERUSDT', name: 'Render / USDT', base: 'RENDER' },
    { symbol: 'FETUSDT', name: 'Artificial Superintelligence / USDT', base: 'FET' },
    { symbol: 'KASUSDT', name: 'Kaspa / USDT', base: 'KAS' },
    { symbol: 'ADAUSDT', name: 'Cardano / USDT', base: 'ADA' },
    { symbol: 'TRXUSDT', name: 'TRON / USDT', base: 'TRX' },
    { symbol: 'TONUSDT', name: 'Toncoin / USDT', base: 'TON' },
    { symbol: 'NEARUSDT', name: 'NEAR Protocol / USDT', base: 'NEAR' },
    { symbol: 'PEPEUSDT', name: 'Pepe / USDT', base: 'PEPE' },
    { symbol: 'AAVEUSDT', name: 'Aave / USDT', base: 'AAVE' },
    { symbol: 'PENDLEUSDT', name: 'Pendle / USDT', base: 'PENDLE' },
    { symbol: 'ENAUSDT', name: 'Ethena / USDT', base: 'ENA' },
    { symbol: 'INJUSDT', name: 'Injective / USDT', base: 'INJ' },
    { symbol: 'WIFUSDT', name: 'dogwifhat / USDT', base: 'WIF' },
    { symbol: 'BONKUSDT', name: 'Bonk / USDT', base: 'BONK' },
    { symbol: 'DOTUSDT', name: 'Polkadot / USDT', base: 'DOT' },
    { symbol: 'LTCUSDT', name: 'Litecoin / USDT', base: 'LTC' },
    { symbol: 'BCHUSDT', name: 'Bitcoin Cash / USDT', base: 'BCH' },
    { symbol: 'UNIUSDT', name: 'Uniswap / USDT', base: 'UNI' },
    { symbol: 'APTUSDT', name: 'Aptos / USDT', base: 'APT' },
    { symbol: 'ICPUSDT', name: 'Internet Computer / USDT', base: 'ICP' },
    { symbol: 'HBARUSDT', name: 'Hedera / USDT', base: 'HBAR' },
    { symbol: 'ARBUSDT', name: 'Arbitrum / USDT', base: 'ARB' },
    { symbol: 'OPUSDT', name: 'Optimism / USDT', base: 'OP' },
    { symbol: 'TIAUSDT', name: 'Celestia / USDT', base: 'TIA' },
    { symbol: 'SEIUSDT', name: 'Sei / USDT', base: 'SEI' },
    { symbol: 'STXUSDT', name: 'Stacks / USDT', base: 'STX' },
    { symbol: 'FILUSDT', name: 'Filecoin / USDT', base: 'FIL' },
    { symbol: 'IMXUSDT', name: 'Immutable / USDT', base: 'IMX' },
    { symbol: 'ATOMUSDT', name: 'Cosmos / USDT', base: 'ATOM' },
    { symbol: 'JUPUSDT', name: 'Jupiter / USDT', base: 'JUP' },
    { symbol: 'PYTHUSDT', name: 'Pyth Network / USDT', base: 'PYTH' },
    { symbol: 'RAYUSDT', name: 'Raydium / USDT', base: 'RAY' },
    { symbol: 'ORDIUSDT', name: 'ORDI / USDT', base: 'ORDI' },
    { symbol: 'GALAUSDT', name: 'Gala / USDT', base: 'GALA' },
    { symbol: 'LDOUSDT', name: 'Lido DAO / USDT', base: 'LDO' },
    { symbol: 'RUNEUSDT', name: 'THORChain / USDT', base: 'RUNE' },
    { symbol: 'CRVUSDT', name: 'Curve DAO / USDT', base: 'CRV' },
    { symbol: 'MKRUSDT', name: 'Maker / USDT', base: 'MKR' },
    { symbol: 'ALGOUSDT', name: 'Algorand / USDT', base: 'ALGO' },
    { symbol: 'VETUSDT', name: 'VeChain / USDT', base: 'VET' },
    { symbol: 'POLUSDT', name: 'Polygon / USDT', base: 'POL' },
    { symbol: 'SHIBUSDT', name: 'Shiba Inu / USDT', base: 'SHIB' },
    { symbol: 'FLOKIUSDT', name: 'Floki / USDT', base: 'FLOKI' },
    { symbol: 'NOTUSDT', name: 'Notcoin / USDT', base: 'NOT' },
    { symbol: 'EIGENUSDT', name: 'EigenLayer / USDT', base: 'EIGEN' }
  ];

  const BINANCE_ENDPOINTS = [
    'https://data-api.binance.vision',
    'https://api.binance.com',
    'https://api1.binance.com'
  ];

  const state = {
    symbol: 'SOLUSDT',
    timeframe: '15m',
    chartType: 'candles', // 'candles' | 'heikin' | 'area'
    strategyMode: 'lsob_strategy', // 'lsob_strategy' | 'fib_882_lsob' | 'ensemble' | 'smc_sweep' | 'mean_reversion' | 'trend_pullback' | 'divergence_sniper' | 'squeeze_breakout'
    subchartMode: 'rsi', // 'rsi' | 'macd'
    candles: [],
    indicators: null,
    backtest: null,
    aiEval: null,
    selectedSignal: null, // If user clicked a specific historical signal or limit zone preview
    ws: null,
    watchlistPrices: {},
    overlays: {
      ema: true,
      bb: false,
      vwap: true,
      srZones: true,
      trendlines: true,
      signals: true,
      patterns: true,
      tpSlLines: true,
      lsobBox: true,
      fib882: true
    },
    aiSettings: {
      provider: localStorage.getItem('tv_ai_provider') || 'local',
      apiKey: localStorage.getItem('tv_ai_key') || '',
      ollamaModel: localStorage.getItem('tv_ai_ollama') || 'llama3'
    }
  };

  // Chart references
  let mainChart = null;
  let subChart = null;
  let mainSeries = null;
  let volumeSeries = null;
  let ema20Series = null;
  let ema50Series = null;
  let ema200Series = null;
  let vwapSeries = null;
  let bbUpperSeries = null;
  let bbMiddleSeries = null;
  let bbLowerSeries = null;
  let upperTrendSeries = null;
  let lowerTrendSeries = null;
  let bullLsobTopSeries = null;
  let bullLsobBottomSeries = null;
  let bearLsobTopSeries = null;
  let bearLsobBottomSeries = null;

  // Subchart series
  let rsiSeries = null;
  let rsiMaSeries = null;
  let macdHistSeries = null;
  let macdLineSeries = null;
  let macdSigSeries = null;

  // Active price lines (S/R + Trade Setup Entry/SL/TP)
  let activePriceLines = [];

  const fmt = window.AIEngine.formatPrice;

  function getPriceFormatMove(price) {
    if (!price || price >= 100) return { precision: 2, minMove: 0.01 };
    if (price >= 1) return { precision: 4, minMove: 0.0001 };
    if (price >= 0.01) return { precision: 5, minMove: 0.00001 };
    return { precision: 7, minMove: 0.0000001 };
  }

  /**
   * Initialize TradingView Lightweight Charts (Main Chart + Synchronized Subchart)
   */
  function initCharts() {
    const mainEl = document.getElementById('main-chart');
    const subEl = document.getElementById('sub-chart');

    const commonOptions = {
      layout: {
        background: { type: 'solid', color: '#131722' },
        textColor: '#868993',
        fontSize: 11,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif"
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.55)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.55)' }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: {
          color: '#758696',
          width: 1,
          style: LightweightCharts.LineStyle.Dashed,
          labelBackgroundColor: '#2962ff'
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: LightweightCharts.LineStyle.Dashed,
          labelBackgroundColor: '#2962ff'
        }
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.08, bottom: 0.2 }
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 9
      }
    };

    mainChart = LightweightCharts.createChart(mainEl, commonOptions);
    subChart = LightweightCharts.createChart(subEl, {
      ...commonOptions,
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.12, bottom: 0.12 }
      },
      timeScale: {
        ...commonOptions.timeScale,
        visible: true
      }
    });

    // Synchronize visible logical range between Main Chart and Sub-Chart
    let isSyncingLeft = false;
    let isSyncingRight = false;

    mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (isSyncingRight || !range) return;
      isSyncingLeft = true;
      subChart.timeScale().setVisibleLogicalRange(range);
      isSyncingLeft = false;
    });

    subChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (isSyncingLeft || !range) return;
      isSyncingRight = true;
      mainChart.timeScale().setVisibleLogicalRange(range);
      isSyncingRight = false;
    });

    createMainSeries();
    createSubSeries();

    // Crosshair hover legend update
    mainChart.subscribeCrosshairMove((param) => {
      updateLegendOnCrosshair(param);
    });

    // ResizeObserver for crisp layout resizing
    const ro = new ResizeObserver(() => {
      if (mainChart && mainEl) {
        mainChart.applyOptions({ width: mainEl.clientWidth, height: mainEl.clientHeight });
      }
      if (subChart && subEl) {
        subChart.applyOptions({ width: subEl.clientWidth, height: subEl.clientHeight });
      }
    });
    ro.observe(mainEl);
    ro.observe(subEl);
  }

  function createMainSeries() {
    if (mainSeries) {
      try {
        mainChart.removeSeries(mainSeries);
      } catch (_) {}
    }

    if (state.chartType === 'area') {
      mainSeries = mainChart.addAreaSeries({
        topColor: 'rgba(41, 98, 255, 0.35)',
        bottomColor: 'rgba(41, 98, 255, 0.02)',
        lineColor: '#2962ff',
        lineWidth: 2
      });
    } else {
      mainSeries = mainChart.addCandlestickSeries({
        upColor: '#089981',
        downColor: '#f23645',
        borderUpColor: '#089981',
        borderDownColor: '#f23645',
        wickUpColor: '#089981',
        wickDownColor: '#f23645'
      });
    }

    if (!volumeSeries) {
      volumeSeries = mainChart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol_scale'
      });
      mainChart.priceScale('vol_scale').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 }
      });
    }

    if (!ema20Series) {
      ema20Series = mainChart.addLineSeries({
        color: '#06b6d4',
        lineWidth: 1.5,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      ema50Series = mainChart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1.5,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      ema200Series = mainChart.addLineSeries({
        color: '#a855f7',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      vwapSeries = mainChart.addLineSeries({
        color: '#ec4899',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      bbUpperSeries = mainChart.addLineSeries({
        color: 'rgba(96, 165, 250, 0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      bbMiddleSeries = mainChart.addLineSeries({
        color: 'rgba(96, 165, 250, 0.35)',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      bbLowerSeries = mainChart.addLineSeries({
        color: 'rgba(96, 165, 250, 0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      upperTrendSeries = mainChart.addLineSeries({
        color: 'rgba(242, 54, 69, 0.85)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      lowerTrendSeries = mainChart.addLineSeries({
        color: 'rgba(8, 153, 129, 0.85)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      bullLsobTopSeries = mainChart.addLineSeries({
        color: 'rgba(16, 185, 129, 0.9)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      bullLsobBottomSeries = mainChart.addLineSeries({
        color: 'rgba(16, 185, 129, 0.9)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      bearLsobTopSeries = mainChart.addLineSeries({
        color: 'rgba(244, 63, 94, 0.9)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      bearLsobBottomSeries = mainChart.addLineSeries({
        color: 'rgba(244, 63, 94, 0.9)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
    }
  }

  function createSubSeries() {
    rsiSeries = subChart.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
      priceLineVisible: false
    });
    rsiMaSeries = subChart.addLineSeries({
      color: '#eab308',
      lineWidth: 1.2,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      priceLineVisible: false
    });

    // RSI 70 / 50 / 30 reference lines
    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(242, 54, 69, 0.5)',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'OB 70'
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(8, 153, 129, 0.5)',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'OS 30'
    });

    macdHistSeries = subChart.addHistogramSeries({
      priceLineVisible: false,
      lastValueVisible: false
    });
    macdLineSeries = subChart.addLineSeries({
      color: '#2962ff',
      lineWidth: 1.5,
      priceLineVisible: false
    });
    macdSigSeries = subChart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 1.5,
      priceLineVisible: false
    });
  }

  /**
   * Fetch historical klines from Binance Spot OR Binance Futures API (for ONDO, KAS, ZETA, etc.)
   */
  async function fetchKlines(symbol, interval, limit = 400) {
    const querySym = symbol === 'ZEXUSDT' ? 'ZETAUSDT' : symbol;

    // 1. Try Binance Spot endpoints
    for (const base of BINANCE_ENDPOINTS) {
      try {
        const url = `${base}/api/v3/klines?symbol=${encodeURIComponent(querySym)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length > 0) {
          state.isFuturesSymbol = false;
          return raw.map((k) => ({
            time: Math.floor(k[0] / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
          }));
        }
      } catch (_) {}
    }

    // 2. Try Binance Futures (Perpetuals) endpoint for Futures-listed coins (KAS, ZETA, ONDO, etc.)
    try {
      const futUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(querySym)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
      const res = await fetch(futUrl);
      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length > 0) {
          state.isFuturesSymbol = true;
          return raw.map((k) => ({
            time: Math.floor(k[0] / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
          }));
        }
      }
    } catch (_) {}

    throw new Error(`Keine echten Marktdaten für ${symbol} verfügbar. Binance Spot und Futures konnten nicht erreicht werden. Bitte Verbindung/Symbol prüfen und erneut laden.`);
  }

  /**
   * Connect live Binance WebSocket for real-time kline updates
   */
  function connectWebSocket(symbol, interval) {
    if (state.ws) {
      try {
        state.ws.close();
      } catch (_) {}
      state.ws = null;
    }

    const querySym = symbol === 'ZEXUSDT' ? 'ZETAUSDT' : symbol;
    const streamName = `${querySym.toLowerCase()}@kline_${interval}`;
    const wsUrl = state.isFuturesSymbol
      ? `wss://fstream.binance.com/ws/${streamName}`
      : `wss://stream.binance.com:9443/ws/${streamName}`;

    try {
      const ws = new WebSocket(wsUrl);
      state.ws = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (!msg.k) return;
          const k = msg.k;
          const liveCandle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v)
          };

          const n = state.candles.length;
          if (n === 0) return;

          const last = state.candles[n - 1];
          let isNewBar = false;
          if (liveCandle.time === last.time) {
            state.candles[n - 1] = liveCandle;
          } else if (liveCandle.time > last.time) {
            state.candles.push(liveCandle);
            if (state.candles.length > 500) state.candles.shift();
            isNewBar = true;
          }

          // Update live price in header and watchlist immediately
          updateHeaderPrice(liveCandle.close);
          updateSingleBarOnChart(liveCandle, isNewBar);
        } catch (_) {}
      };
    } catch (_) {}
  }

  function updateSingleBarOnChart(liveCandle, isNewBar) {
    if (!mainSeries) return;
    if (state.chartType === 'area') {
      mainSeries.update({ time: liveCandle.time, value: liveCandle.close });
    } else if (state.chartType === 'heikin') {
      const ha = window.Indicators.toHeikinAshi(state.candles);
      mainSeries.update(ha[ha.length - 1]);
    } else {
      mainSeries.update(liveCandle);
    }

    volumeSeries.update({
      time: liveCandle.time,
      value: liveCandle.volume,
      color:
        liveCandle.close >= liveCandle.open
          ? 'rgba(8, 153, 129, 0.42)'
          : 'rgba(242, 54, 69, 0.42)'
    });

    // Recompute full AI & indicators when a candle closes or every few ticks
    if (isNewBar) {
      recomputeAndRenderAll(false);
    }
  }

  /**
   * Master pipeline: computes all indicators, AI signals, backtest, and renders chart overlays & UI
   */
  function recomputeAndRenderAll(fitContent = false) {
    const candles = state.candles;
    if (!candles || candles.length < 30) return;

    const lastPrice = candles[candles.length - 1].close;
    const pf = getPriceFormatMove(lastPrice);
    mainSeries.applyOptions({
      priceFormat: { type: 'price', precision: pf.precision, minMove: pf.minMove }
    });

    // 1. Compute all technical indicators
    state.indicators = window.Indicators.computeAll(candles);

    // 2. Run AI Signal Generator & Forward Backtester
    state.backtest = window.AIEngine.generateSignalsAndBacktest(
      candles,
      state.indicators,
      state.strategyMode
    );

    // 3. Evaluate current market state for AI recommendation & live trade setup
    state.aiEval = window.AIEngine.evaluateCurrentMarket(
      state.symbol,
      state.timeframe,
      candles,
      state.indicators,
      state.backtest,
      state.strategyMode
    );

    // 4. Populate main series data
    if (state.chartType === 'area') {
      mainSeries.setData(candles.map((c) => ({ time: c.time, value: c.close })));
    } else if (state.chartType === 'heikin') {
      mainSeries.setData(window.Indicators.toHeikinAshi(candles));
    } else {
      mainSeries.setData(candles);
    }

    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color:
          c.close >= c.open ? 'rgba(8, 153, 129, 0.42)' : 'rgba(242, 54, 69, 0.42)'
      }))
    );

    // 5. Render Indicator Line Series
    renderIndicatorSeries();

    // 6. Render Chart Markers (BUY / SELL signals + Candlestick/SMC Patterns + RSI Divergences)
    renderChartMarkers();

    // 7. Render Support/Resistance Lines + Active Trade Setup Price Lines (Entry / SL / TP1 / TP2 / TP3)
    renderPriceLines();

    // 8. Render Subchart (RSI or MACD)
    renderSubchart();

    // 9. Update Right Sidebar AI Dashboard, Backtest Table & Header HUD
    renderAIDashboard();
    renderBacktestTable();
    updateLegendOnCrosshair(null);
    updateRiskCalculator();

    if (fitContent) {
      mainChart.timeScale().fitContent();
    }
  }

  function toLineData(candles, arr) {
    const out = [];
    for (let i = 0; i < candles.length; i++) {
      if (arr[i] !== null && arr[i] !== undefined && !Number.isNaN(arr[i])) {
        out.push({ time: candles[i].time, value: arr[i] });
      }
    }
    return out;
  }

  function renderIndicatorSeries() {
    const candles = state.candles;
    const ind = state.indicators;

    if (state.overlays.ema) {
      ema20Series.setData(toLineData(candles, ind.ema20));
      ema50Series.setData(toLineData(candles, ind.ema50));
      ema200Series.setData(toLineData(candles, ind.ema200));
    } else {
      ema20Series.setData([]);
      ema50Series.setData([]);
      ema200Series.setData([]);
    }

    if (state.overlays.vwap) {
      vwapSeries.setData(toLineData(candles, ind.vwap));
    } else {
      vwapSeries.setData([]);
    }

    if (state.overlays.bb) {
      bbUpperSeries.setData(toLineData(candles, ind.bb.upper));
      bbMiddleSeries.setData(toLineData(candles, ind.bb.middle));
      bbLowerSeries.setData(toLineData(candles, ind.bb.lower));
    } else {
      bbUpperSeries.setData([]);
      bbMiddleSeries.setData([]);
      bbLowerSeries.setData([]);
    }

    if (state.overlays.trendlines) {
      upperTrendSeries.setData(ind.srData.upperTrendline || []);
      lowerTrendSeries.setData(ind.srData.lowerTrendline || []);
    } else {
      upperTrendSeries.setData([]);
      lowerTrendSeries.setData([]);
    }

    if (state.overlays.lsobBox && ind.lsobData) {
      bullLsobTopSeries.setData(ind.lsobData.bullish.topLine || []);
      bullLsobBottomSeries.setData(ind.lsobData.bullish.bottomLine || []);
      bearLsobTopSeries.setData(ind.lsobData.bearish.topLine || []);
      bearLsobBottomSeries.setData(ind.lsobData.bearish.bottomLine || []);
    } else {
      bullLsobTopSeries.setData([]);
      bullLsobBottomSeries.setData([]);
      bearLsobTopSeries.setData([]);
      bearLsobBottomSeries.setData([]);
    }
  }

  /**
   * Renders BUY/SELL signal markers and Candlestick/SMC pattern annotations directly on the candles
   */
  function renderChartMarkers() {
    if (!mainSeries || state.chartType === 'area') {
      if (mainSeries) mainSeries.setMarkers([]);
      return;
    }

    const markers = [];
    const signalTimes = new Set();

    if (state.overlays.signals && state.backtest) {
      for (const sig of state.backtest.signals) {
        signalTimes.add(sig.time);
        if (sig.side === 'BUY') {
          markers.push({
            time: sig.time,
            position: 'belowBar',
            color: '#00e676',
            shape: 'arrowUp',
            text: `KAUFEN (${sig.score}%)`
          });
        } else {
          markers.push({
            time: sig.time,
            position: 'aboveBar',
            color: '#ff5252',
            shape: 'arrowDown',
            text: `VERKAUFEN (${sig.score}%)`
          });
        }
      }
    }

    if (state.overlays.patterns && state.indicators) {
      const candles = state.candles;
      const startIdx = Math.max(0, candles.length - 120);
      for (let i = startIdx; i < candles.length; i++) {
        const t = candles[i].time;
        if (signalTimes.has(t)) continue; // Avoid overlapping primary BUY/SELL marker on same candle
        const pats = state.indicators.patterns.get(i);
        if (pats && pats.length > 0) {
          const lsobPat = pats.find((p) => p.code === 'LSOB_BULL' || p.code === 'LSOB_BEAR');
          const fibPat = pats.find(
            (p) => p.code === 'FIB_882_LSOB_BULL' || p.code === 'FIB_882_LSOB_BEAR'
          );
          const topPat = lsobPat || fibPat || pats[0];
          const isSpecial = Boolean(lsobPat || fibPat);
          markers.push({
            time: t,
            position: topPat.bias > 0 ? 'belowBar' : 'aboveBar',
            color: lsobPat
              ? topPat.bias > 0
                ? '#10b981'
                : '#f43f5e'
              : fibPat
              ? '#eab308'
              : topPat.bias > 0
              ? '#38bdf8'
              : '#fb923c',
            shape: isSpecial ? (topPat.bias > 0 ? 'arrowUp' : 'arrowDown') : 'circle',
            text: topPat.short
          });
        }
      }
    }

    markers.sort((a, b) => a.time - b.time);
    mainSeries.setMarkers(markers);
  }

  /**
   * Draws Support/Resistance horizontal zones, LSOB Wick-to-Wick Boxes, 0.882 Fibonacci levels, and Active Trade Setup lines
   */
  function renderPriceLines() {
    if (!mainSeries) return;

    // Clear previous price lines
    for (const pl of activePriceLines) {
      try {
        mainSeries.removePriceLine(pl);
      } catch (_) {}
    }
    activePriceLines = [];

    // 1. Support & Resistance Zones
    if (state.overlays.srZones && state.indicators?.srData) {
      for (const sup of state.indicators.srData.supports.slice(0, 2)) {
        const line = mainSeries.createPriceLine({
          price: sup.price,
          color: 'rgba(8, 153, 129, 0.55)',
          lineWidth: 1,
          lineStyle: LightweightCharts.LineStyle.Dotted,
          axisLabelVisible: true,
          title: sup.label
        });
        activePriceLines.push(line);
      }
      for (const res of state.indicators.srData.resistances.slice(0, 2)) {
        const line = mainSeries.createPriceLine({
          price: res.price,
          color: 'rgba(242, 54, 69, 0.55)',
          lineWidth: 1,
          lineStyle: LightweightCharts.LineStyle.Dotted,
          axisLabelVisible: true,
          title: res.label
        });
        activePriceLines.push(line);
      }
    }

    // 1a. LSOB (Liquidity Sweep Order Block) Wick-to-Wick Zones Overlay
    if (state.overlays.lsobBox && state.indicators?.lsobData) {
      const bullOB = state.indicators.lsobData.bullish;
      const bearOB = state.indicators.lsobData.bearish;

      if (bullOB) {
        activePriceLines.push(
          mainSeries.createPriceLine({
            price: bullOB.obHigh,
            color: 'rgba(16, 185, 129, 0.8)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Solid,
            axisLabelVisible: true,
            title: '🧱 Bull LSOB Oberkante (Wick)'
          })
        );
        activePriceLines.push(
          mainSeries.createPriceLine({
            price: bullOB.obLow,
            color: 'rgba(16, 185, 129, 0.8)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Solid,
            axisLabelVisible: true,
            title: '🧱 Bull LSOB Unterkante (Wick)'
          })
        );
      }

      if (bearOB) {
        activePriceLines.push(
          mainSeries.createPriceLine({
            price: bearOB.obLow,
            color: 'rgba(244, 63, 94, 0.8)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Solid,
            axisLabelVisible: true,
            title: '🧱 Bear LSOB Unterkante (Wick)'
          })
        );
        activePriceLines.push(
          mainSeries.createPriceLine({
            price: bearOB.obHigh,
            color: 'rgba(244, 63, 94, 0.8)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Solid,
            axisLabelVisible: true,
            title: '🧱 Bear LSOB Oberkante (Wick)'
          })
        );
      }
    }

    // 1b. 0.882 Fibonacci Retracement Overlay
    if (state.overlays.fib882 && state.indicators?.fibData && state.aiEval) {
      const setup = state.selectedSignal || state.aiEval.activeSetup;
      const fib =
        setup?.side === 'SELL'
          ? state.indicators.fibData.bearish
          : state.indicators.fibData.bullish;

      if (fib) {
        const dirTag = fib.direction === 'BULL' ? 'Bull' : 'Bear';

        // 0.618 Golden Pocket
        activePriceLines.push(
          mainSeries.createPriceLine({
            price: fib.fib618,
            color: 'rgba(234, 179, 8, 0.5)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dotted,
            axisLabelVisible: true,
            title: `📐 Fib 0.618 (${dirTag} Golden Pocket)`
          })
        );

        // 0.786 Deep Retracement
        activePriceLines.push(
          mainSeries.createPriceLine({
            price: fib.fib786,
            color: 'rgba(249, 115, 22, 0.7)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            axisLabelVisible: true,
            title: `📐 Fib 0.786 (${dirTag} Discount)`
          })
        );

        // 0.882 Sniper Level (always visible even if user is testing another strategy)
        if (state.strategyMode !== 'fib_882_lsob') {
          activePriceLines.push(
            mainSeries.createPriceLine({
              price: fib.fib882,
              color: '#eab308',
              lineWidth: 2,
              lineStyle: LightweightCharts.LineStyle.Dashed,
              axisLabelVisible: true,
              title: `🎯 Fib 0.882 Sniper (${dirTag})`
            })
          );
        }

        // 1.000 Swing Origin / Invalidation Anchor
        activePriceLines.push(
          mainSeries.createPriceLine({
            price: fib.fib1000,
            color: 'rgba(168, 85, 247, 0.75)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dotted,
            axisLabelVisible: true,
            title: `📐 Fib 1.000 (${dirTag} Swing-Ursprung)`
          })
        );
      }
    }

    // 2. Future Trade Setup Lines (or user-selected historical signal)
    if (state.overlays.tpSlLines && state.aiEval) {
      const setup = state.selectedSignal || state.aiEval.activeSetup;
      if (!setup) return;

      const is882Mode = state.strategyMode === 'fib_882_lsob';
      const isLsobMode = state.strategyMode === 'lsob_strategy';
      const prefix = state.selectedSignal?.customLabel
        ? `[${state.selectedSignal.customLabel}] `
        : state.selectedSignal?.index
        ? `[Signal #${state.selectedSignal.index}] `
        : isLsobMode
        ? `[${setup.side === 'BUY' ? '🧱 LSOB + SWEEP LONG' : '🧱 LSOB + SWEEP SHORT'}] `
        : is882Mode
        ? `[${setup.side === 'BUY' ? '🎯 0.882 FIB LONG' : '🎯 0.882 FIB SHORT'}] `
        : `[${setup.side === 'BUY' ? '🟢 NÄCHSTER LONG' : '🔴 NÄCHSTER SHORT'}] `;

      // Primary Planned Entry Line
      activePriceLines.push(
        mainSeries.createPriceLine({
          price: setup.entry,
          color: '#3b82f6',
          lineWidth: 2,
          lineStyle: LightweightCharts.LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${prefix}ENTRY`
        })
      );

      // Also show the opposite direction's next future entry line so both Long & Short levels are visible!
      if (!state.selectedSignal && state.aiEval.futureLongSetup && state.aiEval.futureShortSetup) {
        const altSetup =
          setup.side === 'BUY' ? state.aiEval.futureShortSetup : state.aiEval.futureLongSetup;
        activePriceLines.push(
          mainSeries.createPriceLine({
            price: altSetup.entry,
            color: altSetup.side === 'BUY' ? '#0ea5e9' : '#f97316',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dotted,
            axisLabelVisible: true,
            title:
              altSetup.side === 'BUY'
                ? isLsobMode
                  ? '🟢 [ALTERNATIV] BULL LSOB LONG-ENTRY'
                  : is882Mode
                  ? '🟢 [ALTERNATIV] 0.882 FIB LONG-ENTRY'
                  : '🟢 [ALTERNATIV] NÄCHSTER LONG-ENTRY'
                : isLsobMode
                ? '🔴 [ALTERNATIV] BEAR LSOB SHORT-ENTRY'
                : is882Mode
                ? '🔴 [ALTERNATIV] 0.882 FIB SHORT-ENTRY'
                : '🔴 [ALTERNATIV] NÄCHSTER SHORT-ENTRY'
          })
        );
      }

      // Stop-Loss Line
      activePriceLines.push(
        mainSeries.createPriceLine({
          price: setup.sl,
          color: '#ff5252',
          lineWidth: 2,
          lineStyle: LightweightCharts.LineStyle.Solid,
          axisLabelVisible: true,
          title: `${prefix}STOP-LOSS (-${setup.riskPct.toFixed(2)}%)`
        })
      );

      // TP1 Line
      activePriceLines.push(
        mainSeries.createPriceLine({
          price: setup.tp1,
          color: '#34d399',
          lineWidth: 1,
          lineStyle: LightweightCharts.LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${prefix}TP1 (1.5R)`
        })
      );

      // TP2 Line
      activePriceLines.push(
        mainSeries.createPriceLine({
          price: setup.tp2,
          color: '#00e676',
          lineWidth: 2,
          lineStyle: LightweightCharts.LineStyle.Solid,
          axisLabelVisible: true,
          title: `${prefix}TP2 (${setup.rr}R Ziel)`
        })
      );

      // TP3 Line
      activePriceLines.push(
        mainSeries.createPriceLine({
          price: setup.tp3,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LightweightCharts.LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${prefix}TP3 (Max)`
        })
      );
    }
  }

  function renderSubchart() {
    const candles = state.candles;
    const ind = state.indicators;
    if (!ind) return;

    if (state.subchartMode === 'rsi') {
      macdHistSeries.setData([]);
      macdLineSeries.setData([]);
      macdSigSeries.setData([]);

      rsiSeries.setData(toLineData(candles, ind.rsiData.rsi));
      rsiMaSeries.setData(toLineData(candles, ind.rsiData.rsiMA));

      // Mark RSI Divergences on RSI subchart
      const divMarkers = ind.rsiData.divergences.map((d) => ({
        time: d.time,
        position: d.type === 'BULL_DIV' ? 'belowBar' : 'aboveBar',
        color: d.type === 'BULL_DIV' ? '#00e676' : '#ff5252',
        shape: d.type === 'BULL_DIV' ? 'arrowUp' : 'arrowDown',
        text: d.label
      }));
      rsiSeries.setMarkers(divMarkers);

      const lastRsi = ind.rsiData.rsi[candles.length - 1];
      document.getElementById('subchart-live-val').textContent =
        lastRsi !== null ? `RSI: ${lastRsi.toFixed(1)}` : '';
    } else {
      rsiSeries.setData([]);
      rsiMaSeries.setData([]);
      rsiSeries.setMarkers([]);

      const histData = [];
      for (let i = 0; i < candles.length; i++) {
        const h = ind.macdData.histogram[i];
        if (h !== null && h !== undefined) {
          const prev = ind.macdData.histogram[i - 1] ?? 0;
          let color = '#089981';
          if (h >= 0) {
            color = h >= prev ? '#00e676' : 'rgba(8, 153, 129, 0.55)';
          } else {
            color = h <= prev ? '#ff5252' : 'rgba(242, 54, 69, 0.55)';
          }
          histData.push({ time: candles[i].time, value: h, color });
        }
      }
      macdHistSeries.setData(histData);
      macdLineSeries.setData(toLineData(candles, ind.macdData.macdLine));
      macdSigSeries.setData(toLineData(candles, ind.macdData.signalLine));

      const lastMacd = ind.macdData.macdLine[candles.length - 1];
      document.getElementById('subchart-live-val').textContent =
        lastMacd !== null ? `MACD: ${lastMacd.toFixed(2)}` : '';
    }
  }

  /**
   * Updates the AI Sidebar Panel & Top-Right Chart HUD
   */
  function renderAIDashboard() {
    const ev = state.aiEval;
    if (!ev) return;

    const setup = state.selectedSignal || ev.activeSetup;

    // 1. Update Chart Top-Right HUD
    const hudBadge = document.getElementById('hud-verdict-badge');
    hudBadge.textContent = ev.verdict;
    hudBadge.className = `hud-badge ${ev.verdictClass}`;

    document.getElementById('hud-entry').textContent = fmt(setup.entry);
    document.getElementById('hud-sl').textContent = fmt(setup.sl);
    document.getElementById('hud-tp1').textContent = fmt(setup.tp1);
    document.getElementById('hud-tp2').textContent = fmt(setup.tp2);

    // 2. Update Sidebar AI Verdict Card
    const sigPill = document.getElementById('ai-verdict-pill');
    sigPill.textContent = ev.verdict;
    sigPill.className = `ai-signal-pill hud-badge ${ev.verdictClass}`;

    const scoreEl = document.getElementById('ai-confidence-num');
    scoreEl.textContent = `${ev.confidence}%`;
    scoreEl.className = `score-num ${ev.verdictClass === 'bull' ? 'text-bull' : ev.verdictClass === 'bear' ? 'text-bear' : 'text-warn'}`;

    document.getElementById('bull-pct-lbl').textContent = `Bullen ${ev.bullPct}%`;
    document.getElementById('bear-pct-lbl').textContent = `Bären ${ev.bearPct}%`;
    document.getElementById('pressure-bull-bar').style.width = `${ev.bullPct}%`;

    // 3. Update Setup Card in Sidebar
    const setupTitle = document.getElementById('setup-card-title');
    const customLabel = setup.customLabel || null;
    setupTitle.innerHTML = state.selectedSignal
      ? `📌 ${customLabel || `Historisches Signal #${setup.index || ''}`} (${setup.side === 'BUY' ? 'LONG 🟢' : 'SHORT 🔴'}) <button id="btn-reset-sig" style="margin-left:6px;background:#2a2e39;border:none;color:#fff;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">Auto-Favorit</button>`
      : `🎯 Nächstes Zukunfts-Setup (${setup.side === 'BUY' ? 'LONG 🟢' : 'SHORT 🔴'})`;

    const entryTypeEl = document.getElementById('setup-entry-type');
    if (entryTypeEl) {
      entryTypeEl.textContent = setup.entryModeLabel || (customLabel ? 'GEPLANTE ZONE' : 'ZUKUNFTS-ZONE');
    }

    const resetBtn = document.getElementById('btn-reset-sig');
    if (resetBtn) {
      resetBtn.onclick = () => {
        state.selectedSignal = null;
        renderPriceLines();
        renderAIDashboard();
      };
    }

    // Update Future Long / Future Short button labels with the strategy's exact upcoming prices
    const btnLive = document.getElementById('btn-zone-live');
    const btnDeepLong = document.getElementById('btn-zone-deep-long');
    const btnPullShort = document.getElementById('btn-zone-pullback-short');
    if (btnLive) {
      btnLive.textContent = '🏆 KI-Favorit';
    }
    if (btnDeepLong && ev.futureLongSetup) {
      btnDeepLong.textContent = `🟢 Long @ ${fmt(ev.futureLongSetup.entry)}`;
    }
    if (btnPullShort && ev.futureShortSetup) {
      btnPullShort.textContent = `🔴 Short @ ${fmt(ev.futureShortSetup.entry)}`;
    }

    document.getElementById('setup-entry-val').textContent = fmt(setup.entry);
    document.getElementById('setup-sl-val').textContent = `${fmt(setup.sl)} (-${setup.riskPct.toFixed(2)}%)`;
    document.getElementById('setup-tp1-val').textContent = fmt(setup.tp1);
    document.getElementById('setup-tp2-val').textContent = fmt(setup.tp2);
    document.getElementById('setup-tp3-val').textContent = fmt(setup.tp3);
    document.getElementById('setup-rr-val').textContent = `1 : ${setup.rr}`;

    // 4. Confluence Factors List
    const factorWrap = document.getElementById('ai-factors-list');
    factorWrap.innerHTML = ev.factors
      .map(
        (f) => `
      <div class="factor-item ${f.bias}">
        <span>${f.name}</span>
        <span class="factor-status ${f.bias === 'bull' ? 'text-bull' : f.bias === 'bear' ? 'text-bear' : 'text-warn'}">${f.status}</span>
      </div>`
      )
      .join('');

    // 5. Recent Patterns Tags
    const patWrap = document.getElementById('ai-patterns-wrap');
    if (ev.recentPatterns.length > 0) {
      patWrap.innerHTML = ev.recentPatterns
        .map(
          (p) =>
            `<span class="pattern-tag ${p.bias > 0 ? 'text-bull' : 'text-bear'}">${p.short} (${p.barsAgo === 0 ? 'aktuell' : `vor ${p.barsAgo}K`})</span>`
        )
        .join('');
    } else {
      patWrap.innerHTML = `<span class="pattern-tag" style="color:#868993;">Keine unmittelbaren Umkehrmuster in den letzten 5 Kerzen</span>`;
    }

    // 6. AI Narrative Text
    document.getElementById('ai-narrative-box').textContent = ev.narrative;
  }

  /**
   * Renders the Bottom Backtester KPIs & Interactive Signal Table
   */
  function renderBacktestTable() {
    if (!state.backtest) return;
    const { signals, stats } = state.backtest;

    document.getElementById('bt-total').textContent = stats.totalSignals;
    const wrEl = document.getElementById('bt-winrate');
    wrEl.textContent = `${stats.winRate.toFixed(1)}% (${stats.wins}W / ${stats.losses}L)`;
    wrEl.className = stats.winRate >= 50 ? 'text-bull' : 'text-bear';

    const pfEl = document.getElementById('bt-pf');
    pfEl.textContent = stats.profitFactor.toFixed(2);
    pfEl.className = stats.profitFactor >= 1.2 ? 'text-bull' : 'text-warn';

    const pnlEl = document.getElementById('bt-pnl');
    pnlEl.textContent = `${stats.totalPctGain >= 0 ? '+' : ''}${stats.totalPctGain.toFixed(2)}% (${stats.netR >= 0 ? '+' : ''}${stats.netR.toFixed(1)}R)`;
    pnlEl.className = stats.totalPctGain >= 0 ? 'text-bull' : 'text-bear';

    const tbody = document.getElementById('signals-tbody');
    const reversed = [...signals].reverse();

    tbody.innerHTML = reversed
      .map((s) => {
        const dt = new Date(s.time * 1000).toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        const badgeCls = s.side === 'BUY' ? 'buy' : 'sell';
        const sideLbl = s.side === 'BUY' ? '🟢 KAUFEN (LONG)' : '🔴 VERKAUFEN (SHORT)';
        const outCls =
          s.status === 'WIN'
            ? 'outcome-win'
            : s.status === 'LOSS'
            ? 'outcome-loss'
            : 'outcome-open';

        return `<tr data-sig-index="${s.index}">
          <td>${dt}</td>
          <td><span class="sig-badge ${badgeCls}">${sideLbl}</span></td>
          <td><b>${s.score}%</b></td>
          <td>${fmt(s.entry)}</td>
          <td class="text-bear">${fmt(s.sl)}</td>
          <td class="text-bull">${fmt(s.tp1)} / ${fmt(s.tp2)}</td>
          <td><span class="outcome-badge ${outCls}">${s.outcomeLabel}</span></td>
          <td style="color:#868993;font-family:var(--font-sans);">${s.reasons.join(' • ') || 'Multi-Confluence'}</td>
        </tr>`;
      })
      .join('');

    // Click row to focus chart on that signal candle and preview its Entry/SL/TP lines!
    tbody.querySelectorAll('tr').forEach((row) => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.getAttribute('data-sig-index'), 10);
        const found = signals.find((x) => x.index === idx);
        if (!found) return;

        state.selectedSignal = found;
        renderPriceLines();
        renderAIDashboard();

        const fromIdx = Math.max(0, idx - 35);
        const toIdx = Math.min(state.candles.length - 1, idx + 35);
        mainChart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
      });
    });
  }

  /**
   * Updates Top-Left Floating Legend on Crosshair Move
   */
  function updateLegendOnCrosshair(param) {
    const candles = state.candles;
    const ind = state.indicators;
    if (!candles || candles.length === 0 || !ind) return;

    let idx = candles.length - 1;
    if (param && param.time) {
      const foundIdx = candles.findIndex((c) => c.time === param.time);
      if (foundIdx !== -1) idx = foundIdx;
    }

    const c = candles[idx];
    const isBull = c.close >= c.open;
    const cls = isBull ? 'text-bull' : 'text-bear';

    document.getElementById('leg-symbol').textContent = `${state.symbol} • ${state.timeframe.toUpperCase()}`;
    document.getElementById('leg-ohlc').innerHTML = `
      <span><b>O</b><span class="${cls}">${fmt(c.open)}</span></span>
      <span><b>H</b><span class="${cls}">${fmt(c.high)}</span></span>
      <span><b>L</b><span class="${cls}">${fmt(c.low)}</span></span>
      <span><b>C</b><span class="${cls}">${fmt(c.close)}</span></span>
      <span><b>Vol</b><span>${(c.volume || 0).toFixed(1)}</span></span>
    `;

    const e20 = ind.ema20[idx];
    const e50 = ind.ema50[idx];
    const e200 = ind.ema200[idx];
    const vwap = ind.vwap[idx];

    document.getElementById('leg-indicators').innerHTML = `
      <span style="color:#06b6d4">EMA20: ${fmt(e20)}</span>
      <span style="color:#f59e0b">EMA50: ${fmt(e50)}</span>
      <span style="color:#a855f7">EMA200: ${fmt(e200)}</span>
      <span style="color:#ec4899">VWAP: ${fmt(vwap)}</span>
    `;
  }

  function updateHeaderPrice(price) {
    const priceEl = document.getElementById('hdr-price');
    const prev = parseFloat(priceEl.getAttribute('data-raw') || price);
    priceEl.setAttribute('data-raw', price);
    priceEl.textContent = fmt(price);
    if (price > prev) {
      priceEl.className = 'header-price text-bull';
    } else if (price < prev) {
      priceEl.className = 'header-price text-bear';
    }
  }

  /**
   * Fetch 24h Ticker stats for Header & Watchlist (Spot + Futures for all 60+ top coins)
   */
  async function refreshWatchlistAndTicker() {
    const wantedSet = new Set(WATCHLIST_SYMBOLS.map((s) => s.symbol));
    wantedSet.add(state.symbol);

    // 1. Fetch Spot 24hr tickers
    for (const base of BINANCE_ENDPOINTS) {
      try {
        const res = await fetch(`${base}/api/v3/ticker/24hr`);
        if (!res.ok) continue;
        const list = await res.json();
        for (const item of list) {
          if (wantedSet.has(item.symbol)) {
            state.watchlistPrices[item.symbol] = {
              lastPrice: parseFloat(item.lastPrice),
              priceChangePercent: parseFloat(item.priceChangePercent),
              highPrice: parseFloat(item.highPrice),
              lowPrice: parseFloat(item.lowPrice),
              quoteVolume: parseFloat(item.quoteVolume)
            };
          }
        }
        break;
      } catch (_) {}
    }

    // 2. Fetch Futures 24hr tickers for Futures-listed coins (e.g. ONDOUSDT, KASUSDT, ZETAUSDT)
    try {
      const fRes = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
      if (fRes.ok) {
        const fList = await fRes.json();
        for (const item of fList) {
          if (wantedSet.has(item.symbol) && !state.watchlistPrices[item.symbol]) {
            state.watchlistPrices[item.symbol] = {
              lastPrice: parseFloat(item.lastPrice),
              priceChangePercent: parseFloat(item.priceChangePercent),
              highPrice: parseFloat(item.highPrice),
              lowPrice: parseFloat(item.lowPrice),
              quoteVolume: parseFloat(item.quoteVolume)
            };
          }
        }
      }
    } catch (_) {}

    renderWatchlistUI();
    updateCurrentSymbolHeaderStats();
  }

  function updateCurrentSymbolHeaderStats() {
    const info = state.watchlistPrices[state.symbol];
    if (!info && state.candles.length > 0) {
      const last = state.candles[state.candles.length - 1];
      updateHeaderPrice(last.close);
      return;
    }
    if (!info) return;

    updateHeaderPrice(info.lastPrice);
    const chgEl = document.getElementById('hdr-change');
    const sign = info.priceChangePercent >= 0 ? '+' : '';
    chgEl.textContent = `${sign}${info.priceChangePercent.toFixed(2)}%`;
    chgEl.className = `header-change ${info.priceChangePercent >= 0 ? 'sig-badge buy' : 'sig-badge sell'}`;

    document.getElementById('hdr-high').textContent = fmt(info.highPrice);
    document.getElementById('hdr-low').textContent = fmt(info.lowPrice);
    const volM = (info.quoteVolume / 1e6).toFixed(1) + 'M USDT';
    document.getElementById('hdr-vol').textContent = volM;
  }

  function renderWatchlistUI() {
    const wrap = document.getElementById('watchlist-container');
    const filterEl = document.getElementById('watchlist-filter-input');
    const q = (filterEl?.value || '').trim().toUpperCase();

    const filtered = WATCHLIST_SYMBOLS.filter(
      (item) =>
        !q ||
        item.symbol.includes(q) ||
        item.base.includes(q) ||
        item.name.toUpperCase().includes(q)
    );

    wrap.innerHTML = filtered.map((item) => {
      const st = state.watchlistPrices[item.symbol];
      const price = st ? fmt(st.lastPrice) : '–';
      const chg = st ? st.priceChangePercent : 0;
      const sign = chg >= 0 ? '+' : '';
      const cls = chg >= 0 ? 'text-bull' : 'text-bear';
      const activeCls = item.symbol === state.symbol ? 'active' : '';

      return `<div class="wl-row ${activeCls}" data-sym="${item.symbol}">
        <div class="wl-sym">
          <span>${item.base}<span style="color:#868993;font-weight:400;">/USDT</span></span>
          <small>${item.name}</small>
        </div>
        <div class="wl-price">${price}</div>
        <div class="wl-chg ${cls}">${sign}${chg.toFixed(2)}%</div>
      </div>`;
    }).join('');

    wrap.querySelectorAll('.wl-row').forEach((row) => {
      row.addEventListener('click', () => {
        const sym = row.getAttribute('data-sym');
        if (sym) loadSymbolAndTimeframe(sym, state.timeframe);
      });
    });
  }

  /**
   * Position Size & Risk Calculator synced with active AI Trade Setup
   */
  function updateRiskCalculator() {
    const ev = state.aiEval;
    if (!ev) return;
    const setup = state.selectedSignal || ev.activeSetup;
    if (!setup) return;

    const capital = parseFloat(document.getElementById('calc-capital').value) || 1000;
    const riskPct = parseFloat(document.getElementById('calc-risk-pct').value) || 1.0;

    const riskAmountUsd = capital * (riskPct / 100);
    const stopDistancePct = Math.max(setup.riskPct / 100, 0.0005);
    const positionValueUsd = riskAmountUsd / stopDistancePct;
    const coinQty = positionValueUsd / setup.entry;
    const recommendedLeverage = Math.max(1, Math.min(20, Math.ceil(positionValueUsd / capital)));

    const tp2ProfitUsd = riskAmountUsd * setup.rr;

    document.getElementById('calc-res-risk-usd').textContent = `${riskAmountUsd.toFixed(2)} USDT`;
    document.getElementById('calc-res-pos-usd').textContent = `${positionValueUsd.toFixed(2)} USDT`;
    document.getElementById('calc-res-qty').textContent = `${coinQty.toFixed(4)} ${state.symbol.replace('USDT', '')}`;
    document.getElementById('calc-res-lev').textContent = `${recommendedLeverage}x`;
    document.getElementById('calc-res-profit').textContent = `+${tp2ProfitUsd.toFixed(2)} USDT (bei TP2)`;
  }

  /**
   * Load a symbol and timeframe
   */
  async function loadSymbolAndTimeframe(symbol, timeframe) {
    state.symbol = symbol.toUpperCase().trim();
    state.timeframe = timeframe;
    state.selectedSignal = null;

    document.getElementById('active-symbol-label').textContent = state.symbol;

    try {
      const candles = await fetchKlines(state.symbol, state.timeframe, 400);
      if (!Array.isArray(candles) || candles.length < 30) {
        throw new Error(`Zu wenige echte Kurskerzen für ${state.symbol}.`);
      }
      state.candles = candles;
      recomputeAndRenderAll(true);
      connectWebSocket(state.symbol, state.timeframe);
      refreshWatchlistAndTicker();
    } catch (error) {
      console.error('[Market data]', error);
      if (state.ws) { try { state.ws.close(); } catch (_) {} state.ws = null; }
      state.candles = [];
      state.backtest = null;
      document.getElementById('active-symbol-label').textContent = `${state.symbol} · DATENFEHLER`;
      window.alert(`${error.message}\n\nEs werden bewusst keine künstlichen Kursdaten angezeigt.`);
    }
  }

  /**
   * Bind all UI Controls, Tabs, Modals, and Buttons
   */
  function bindUIEvents() {
    // Timeframe buttons
    document.querySelectorAll('.tf-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tf-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tf = btn.getAttribute('data-tf');
        loadSymbolAndTimeframe(state.symbol, tf);
      });
    });

    // Chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-type-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.chartType = btn.getAttribute('data-type');
        createMainSeries();
        recomputeAndRenderAll(false);
      });
    });

    // Overlay Toggles
    document.querySelectorAll('.ind-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-overlay');
        if (!key) return;
        state.overlays[key] = !state.overlays[key];
        btn.classList.toggle('active', state.overlays[key]);
        recomputeAndRenderAll(false);
      });
    });

    // Strategy Sensitivity Select
    const stratSelect = document.getElementById('strategy-mode-select');
    stratSelect.addEventListener('change', () => {
      state.strategyMode = stratSelect.value;
      state.selectedSignal = null;
      recomputeAndRenderAll(false);
    });

    // Subchart Tabs (RSI vs MACD)
    document.querySelectorAll('.sub-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sub-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        state.subchartMode = tab.getAttribute('data-sub');
        renderSubchart();
      });
    });

    // Right Sidebar Tabs
    document.querySelectorAll('.sidebar-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.sidebar-pane').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-pane');
        document.getElementById(target).classList.add('active');
      });
    });

    // Left Toolbar Quick Actions
    document.getElementById('left-fit-btn').addEventListener('click', () => {
      if (mainChart) mainChart.timeScale().fitContent();
    });
    document.getElementById('left-sr-btn').addEventListener('click', (e) => {
      state.overlays.srZones = !state.overlays.srZones;
      e.currentTarget.classList.toggle('active', state.overlays.srZones);
      document.querySelector('[data-overlay="srZones"]')?.classList.toggle('active', state.overlays.srZones);
      renderPriceLines();
    });
    document.getElementById('left-trend-btn').addEventListener('click', (e) => {
      state.overlays.trendlines = !state.overlays.trendlines;
      e.currentTarget.classList.toggle('active', state.overlays.trendlines);
      document.querySelector('[data-overlay="trendlines"]')?.classList.toggle('active', state.overlays.trendlines);
      renderIndicatorSeries();
    });
    document.getElementById('left-tpsl-btn').addEventListener('click', (e) => {
      state.overlays.tpSlLines = !state.overlays.tpSlLines;
      e.currentTarget.classList.toggle('active', state.overlays.tpSlLines);
      document.querySelector('[data-overlay="tpSlLines"]')?.classList.toggle('active', state.overlays.tpSlLines);
      renderPriceLines();
    });

    // Deep AI Analysis Button
    const deepBtn = document.getElementById('btn-run-deep-ai');
    deepBtn.addEventListener('click', async () => {
      if (!state.aiEval) return;
      const box = document.getElementById('ai-narrative-box');
      const prevLabel = deepBtn.textContent;
      deepBtn.textContent = '⏳ KI analysiert Chart...';
      deepBtn.disabled = true;
      try {
        const report = await window.AIEngine.runDeepLLMAnalysis(
          state.aiEval,
          state.candles,
          state.aiSettings
        );
        box.textContent = `${state.aiEval.narrative}\n\n────────────────────────\n${report}`;
      } catch (err) {
        box.textContent = `${state.aiEval.narrative}\n\n⚠️ LLM-Hinweis: ${err.message}`;
      } finally {
        deepBtn.textContent = prevLabel;
        deepBtn.disabled = false;
      }
    });

    // Risk Calculator inputs
    document.getElementById('calc-capital').addEventListener('input', updateRiskCalculator);
    document.getElementById('calc-risk-pct').addEventListener('input', updateRiskCalculator);
    document.getElementById('watchlist-filter-input')?.addEventListener('input', renderWatchlistUI);

    // Future Long & Future Short Setup Preview Buttons
    document.getElementById('btn-zone-live')?.addEventListener('click', () => {
      state.selectedSignal = null;
      renderPriceLines();
      renderAIDashboard();
      updateRiskCalculator();
    });

    document.getElementById('btn-zone-deep-long')?.addEventListener('click', () => {
      if (!state.aiEval || !state.aiEval.futureLongSetup) return;
      state.selectedSignal = {
        ...state.aiEval.futureLongSetup,
        customLabel: '🟢 ZUKÜNFTIGER LONG'
      };
      renderPriceLines();
      renderAIDashboard();
      updateRiskCalculator();
    });

    document.getElementById('btn-zone-pullback-short')?.addEventListener('click', () => {
      if (!state.aiEval || !state.aiEval.futureShortSetup) return;
      state.selectedSignal = {
        ...state.aiEval.futureShortSetup,
        customLabel: '🔴 ZUKÜNFTIGER SHORT'
      };
      renderPriceLines();
      renderAIDashboard();
      updateRiskCalculator();
    });

    // Multi-Strategy Ranker & Comparison Modal
    const rankerModal = document.getElementById('strategy-ranker-modal');
    document.getElementById('open-strategy-ranker')?.addEventListener('click', () => {
      if (!state.candles || !state.indicators) return;
      const ranked = window.AIEngine.compareAllStrategies(state.candles, state.indicators);
      document.getElementById('ranker-modal-title').textContent =
        `🏆 Beste Strategien für ${state.symbol} (${state.timeframe.toUpperCase()})`;

      const listEl = document.getElementById('strategy-ranker-list');
      listEl.innerHTML = ranked
        .map((r, idx) => {
          const isCurrent = r.id === state.strategyMode;
          const medal = idx === 0 ? '🥇 #1 SIEGER' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;
          const pnlCls = r.stats.totalPctGain >= 0 ? 'text-bull' : 'text-bear';
          const wrCls = r.stats.winRate >= 52 ? 'text-bull' : 'text-warn';
          return `<div class="ai-card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;border-color:${idx === 0 ? '#00e676' : isCurrent ? '#2962ff' : '#2a2e39'};">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#fff;">
                <span class="sig-badge ${idx === 0 ? 'buy' : ''}" style="font-size:11px;">${medal}</span>
                <span>${r.name}</span>
                ${isCurrent ? '<span class="symbol-exchange-tag" style="color:#60a5fa;">AKTIV</span>' : ''}
              </div>
              <div style="font-size:11.5px;color:#868993;margin-top:3px;">${r.description}</div>
              <div style="display:flex;gap:14px;margin-top:7px;font-family:var(--font-mono);font-size:11.5px;">
                <span>Win-Rate: <b class="${wrCls}">${r.stats.winRate.toFixed(1)}%</b> (${r.stats.wins}W/${r.stats.losses}L)</span>
                <span>Profit-Faktor: <b>${r.stats.profitFactor.toFixed(2)}</b></span>
                <span>Gesamt-PnL: <b class="${pnlCls}">${r.stats.totalPctGain >= 0 ? '+' : ''}${r.stats.totalPctGain.toFixed(2)}%</b></span>
                <span>Signale: <b>${r.stats.totalSignals}</b></span>
              </div>
            </div>
            <button class="btn-ai-primary btn-apply-strat" data-strat="${r.id}" style="white-space:nowrap;">
              ${isCurrent ? '✅ Aktiv' : '⚡ Aktivieren'}
            </button>
          </div>`;
        })
        .join('');

      listEl.querySelectorAll('.btn-apply-strat').forEach((btn) => {
        btn.addEventListener('click', () => {
          const chosenStrat = btn.getAttribute('data-strat');
          state.strategyMode = chosenStrat;
          state.selectedSignal = null;
          document.getElementById('strategy-mode-select').value = chosenStrat;
          rankerModal.classList.remove('open');
          recomputeAndRenderAll(false);
        });
      });

      rankerModal.classList.add('open');
    });

    document.getElementById('close-strategy-ranker')?.addEventListener('click', () => {
      rankerModal.classList.remove('open');
    });

    // Symbol Search Modal
    const symModal = document.getElementById('symbol-modal');
    document.getElementById('open-symbol-modal').addEventListener('click', () => {
      symModal.classList.add('open');
      document.getElementById('symbol-search-input').focus();
    });
    document.getElementById('close-symbol-modal').addEventListener('click', () => {
      symModal.classList.remove('open');
    });

    const symGrid = document.getElementById('modal-symbol-grid');
    const renderModalSymbols = (filter = '') => {
      const q = filter.trim().toUpperCase();
      const filtered = WATCHLIST_SYMBOLS.filter(
        (s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q)
      );
      symGrid.innerHTML = filtered
        .map(
          (s) => `<div class="sym-option" data-sym="${s.symbol}">
            <div><b>${s.symbol}</b><div style="font-size:10px;color:#868993;">${s.name}</div></div>
            <span class="symbol-exchange-tag">BINANCE</span>
          </div>`
        )
        .join('');

      symGrid.querySelectorAll('.sym-option').forEach((el) => {
        el.addEventListener('click', () => {
          const chosen = el.getAttribute('data-sym');
          symModal.classList.remove('open');
          loadSymbolAndTimeframe(chosen, state.timeframe);
        });
      });
    };
    renderModalSymbols();

    const searchInp = document.getElementById('symbol-search-input');
    searchInp.addEventListener('input', () => renderModalSymbols(searchInp.value));
    searchInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInp.value.trim()) {
        let custom = searchInp.value.trim().toUpperCase();
        if (!custom.endsWith('USDT') && !custom.endsWith('BTC') && !custom.endsWith('EUR')) {
          custom += 'USDT';
        }
        symModal.classList.remove('open');
        loadSymbolAndTimeframe(custom, state.timeframe);
      }
    });

    // AI Settings Modal
    const aiModal = document.getElementById('ai-settings-modal');
    document.getElementById('open-ai-settings').addEventListener('click', () => {
      document.getElementById('ai-provider-select').value = state.aiSettings.provider;
      document.getElementById('ai-api-key-input').value = state.aiSettings.apiKey;
      document.getElementById('ai-ollama-model').value = state.aiSettings.ollamaModel;
      aiModal.classList.add('open');
    });
    document.getElementById('close-ai-settings').addEventListener('click', () => {
      aiModal.classList.remove('open');
    });
    document.getElementById('save-ai-settings').addEventListener('click', () => {
      state.aiSettings.provider = document.getElementById('ai-provider-select').value;
      state.aiSettings.apiKey = document.getElementById('ai-api-key-input').value.trim();
      state.aiSettings.ollamaModel = document.getElementById('ai-ollama-model').value.trim() || 'llama3';
      localStorage.setItem('tv_ai_provider', state.aiSettings.provider);
      localStorage.setItem('tv_ai_key', state.aiSettings.apiKey);
      localStorage.setItem('tv_ai_ollama', state.aiSettings.ollamaModel);
      aiModal.classList.remove('open');
    });
  }

  // Bootstrap Application on DOM Ready
  window.addEventListener('DOMContentLoaded', () => {
    initCharts();
    bindUIEvents();
    loadSymbolAndTimeframe(state.symbol, state.timeframe);
    setInterval(refreshWatchlistAndTicker, 10000);
  });
})();
