const window = globalThis;
/**
 * AI Chart Analysis, 6 Pro Trading Strategies, Anti-Chase Location Filter,
 * Trade Setup Calculator & Multi-Strategy Backtesting Engine
 */

window.AIEngine = (function () {
  const STRATEGIES = {
    lsob_strategy: {
      id: 'lsob_strategy',
      name: '🧱 LSOB & Liquidity Sweep Strategie (Orderblock Wick-to-Wick)',
      shortName: 'LSOB + Liquidity Sweep',
      description:
        'Markiert die höchste/tiefste Kerze am Swing-Hoch/-Tief von Docht zu Docht (Wick-to-Wick) als LSOB-Box und handelt den Liquidity-Sweep-Retest dieser Zone mit engem Stop-Loss hinter dem Docht.',
      minScore: 46,
      minBarsBetweenSignals: 10,
      slAtrMult: 1.15,
      tp1R: 1.7,
      tp2R: 3.0,
      tp3R: 4.5
    },
    fib_882_lsob: {
      id: 'fib_882_lsob',
      name: '🎯 0.882 Fibonacci Sniper (Tiefer Discount/Premium Einstieg)',
      shortName: '0.882 Fibonacci Sniper',
      description:
        'Sucht den tiefen 0.882 Fibonacci-Retracement-Einstieg (zwischen 0.786 und 1.000 Swing-Ursprung) mit extrem engem Stop-Loss knapp hinter dem 1.000 Level (CRV 1:3.2+).',
      minScore: 46,
      minBarsBetweenSignals: 10,
      slAtrMult: 1.15,
      tp1R: 1.8,
      tp2R: 3.2,
      tp3R: 4.8
    },
    ensemble: {
      id: 'ensemble',
      name: '🧠 KI Smart-Ensemble (Anti-Chase + S/R)',
      shortName: 'KI Smart-Ensemble',
      description:
        'Erkennt automatisch Range vs. Trend, blockiert späte Shorts direkt am Support und kombiniert S/R-Zonen, SMC & Momentum.',
      minScore: 52,
      minBarsBetweenSignals: 11,
      slAtrMult: 1.55,
      tp1R: 1.5,
      tp2R: 2.5,
      tp3R: 3.8
    },
    smc_sweep: {
      id: 'smc_sweep',
      name: '💧 Smart Money & Liquidity Sweep (SMC)',
      shortName: 'SMC Liquidity Sweep',
      description:
        'Handelt gezielt Stop-Hunts (Wick-Sweeps unter Tiefs wie bei 98.60 / über Hochs), CHoCH/BOS Strukturbrüche & Orderblock-Supports.',
      minScore: 48,
      minBarsBetweenSignals: 10,
      slAtrMult: 1.45,
      tp1R: 1.6,
      tp2R: 2.8,
      tp3R: 4.2
    },
    mean_reversion: {
      id: 'mean_reversion',
      name: '🌊 Mean Reversion (Support & Bollinger Bounce)',
      shortName: 'Mean Reversion Bounce',
      description:
        'Kauft überverkaufte Abverkäufe am Support / unteren Bollinger-Band (RSI < 38) und verkauft Übertreibungen am Widerstand (RSI > 62).',
      minScore: 48,
      minBarsBetweenSignals: 9,
      slAtrMult: 1.4,
      tp1R: 1.4,
      tp2R: 2.3,
      tp3R: 3.5
    },
    trend_pullback: {
      id: 'trend_pullback',
      name: '🚀 EMA Golden Pullback (Institutionelle Trendfolge)',
      shortName: 'EMA Trend-Pullback',
      description:
        'Handelt nur in Richtung des Haupttrends (EMA 20/50/200), sobald ein Rücksetzer an den EMA 20 oder EMA 50 bullisch/bärisch abprallt.',
      minScore: 44,
      minBarsBetweenSignals: 10,
      slAtrMult: 1.6,
      tp1R: 1.5,
      tp2R: 2.6,
      tp3R: 4.0
    },
    divergence_sniper: {
      id: 'divergence_sniper',
      name: '⚡ RSI & MACD Divergenz-Sniper (Trendwende)',
      shortName: 'Divergenz-Sniper',
      description:
        'Sucht gezielt nach Bullischen & Bärischen RSI-/MACD-Divergenzen an wichtigen Preis-Extremen für frühe Trendwende-Einstiege.',
      minScore: 42,
      minBarsBetweenSignals: 10,
      slAtrMult: 1.5,
      tp1R: 1.6,
      tp2R: 2.8,
      tp3R: 4.2
    },
    squeeze_breakout: {
      id: 'squeeze_breakout',
      name: '💥 Volatility Squeeze Breakout (Volumen-Ausbruch)',
      shortName: 'Squeeze Breakout',
      description:
        'Wartet auf enge Konsolidierungsphasen und handelt explosive Ausbrüche über/unter die Bollinger-Bänder mit starkem Volumen-Spike.',
      minScore: 42,
      minBarsBetweenSignals: 10,
      slAtrMult: 1.5,
      tp1R: 1.5,
      tp2R: 2.6,
      tp3R: 4.0
    }
  };

  /**
   * Computes local range position (0 = lowest low of last N bars, 100 = highest high of last N bars)
   */
  function getRangePosition(candles, idx, lookback = 36) {
    const start = Math.max(0, idx - lookback + 1);
    let hi = -Infinity;
    let lo = Infinity;
    for (let k = start; k <= idx; k++) {
      if (candles[k].high > hi) hi = candles[k].high;
      if (candles[k].low < lo) lo = candles[k].low;
    }
    const span = Math.max(hi - lo, 1e-8);
    const pos = ((candles[idx].close - lo) / span) * 100;
    return { high: hi, low: lo, span, pos };
  }

  /**
   * Strategy-specific candle scorer at index i
   */
  function scoreCandleForStrategy(i, candles, ind, divMap, strategyId = 'ensemble') {
    const c = candles[i];
    const prev = candles[i - 1] || c;
    const prev2 = candles[i - 2] || prev;
    const e20 = ind.ema20[i];
    const e50 = ind.ema50[i];
    const e200 = ind.ema200[i];
    const rsi = ind.rsiData.rsi[i] ?? 50;
    const rsiPrev = ind.rsiData.rsi[i - 1] ?? 50;
    const rsiMA = ind.rsiData.rsiMA[i] ?? 50;
    const macd = ind.macdData.macdLine[i] ?? 0;
    const macdSig = ind.macdData.signalLine[i] ?? 0;
    const hist = ind.macdData.histogram[i] ?? 0;
    const histPrev = ind.macdData.histogram[i - 1] ?? 0;
    const bbUpper = ind.bb.upper[i];
    const bbLower = ind.bb.lower[i];
    const bbMid = ind.bb.middle[i];
    const bbWidth = ind.bb.bandwidth[i] ?? 2;
    const vwap = ind.vwap[i];
    const vol = c.volume || 0;
    const volAvg = ind.volSMA20[i] || vol || 1;
    const atr = ind.atr14[i] || Math.abs(c.high - c.low) || 1;

    const rangeInfo = getRangePosition(candles, i, 36);
    const isBullCandle = c.close > c.open;
    const isBearCandle = c.close < c.open;
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);

    const barPatterns = [
      ...(ind.patterns.get(i) || []),
      ...(ind.patterns.get(i - 1) || []).map((p) => ({ ...p, weight: p.weight * 0.6 }))
    ];
    const div = divMap.get(i) || divMap.get(i - 1) || divMap.get(i - 2);

    let bullPoints = 0;
    let bearPoints = 0;
    const bullReasons = [];
    const bearReasons = [];

    // =========================================================================
    // STRATEGY 0A: LSOB & LIQUIDITY SWEEP (Wick-to-Wick Orderblock Retest)
    // =========================================================================
    if (strategyId === 'lsob_strategy') {
      for (const pat of barPatterns) {
        if (pat.code === 'LSOB_BULL') {
          bullPoints += 52;
          bullReasons.push('🧱 Bullish LSOB Retest (Wick-to-Wick Orderblock)');
        } else if (pat.code === 'LSOB_BEAR') {
          bearPoints += 52;
          bearReasons.push('🧱 Bearish LSOB Retest (Wick-to-Wick Orderblock)');
        } else if (pat.code === 'LIQ_SWEEP_BULL') {
          bullPoints += 38;
          bullReasons.push('💧 Liquidity Sweep unter Swing-Tief (Stop-Hunt)');
        } else if (pat.code === 'LIQ_SWEEP_BEAR') {
          bearPoints += 38;
          bearReasons.push('💧 Liquidity Sweep über Swing-Hoch (Stop-Hunt)');
        } else if (pat.code === 'CHOCH_BULL' || pat.code === 'BOS_BULL') {
          bullPoints += 22;
          bullReasons.push(pat.name);
        } else if (pat.code === 'CHOCH_BEAR' || pat.code === 'BOS_BEAR') {
          bearPoints += 22;
          bearReasons.push(pat.name);
        } else if (pat.bias > 0 && rangeInfo.pos <= 30) {
          bullPoints += 16;
          bullReasons.push(`${pat.short} in Demand-LSOB`);
        } else if (pat.bias < 0 && rangeInfo.pos >= 70) {
          bearPoints += 16;
          bearReasons.push(`${pat.short} in Supply-LSOB`);
        }
      }

      if (rangeInfo.pos <= 26 && (isBullCandle || lowerWick > atr * 0.4)) {
        bullPoints += 24;
        bullReasons.push(`Wick-Rejection in unterer LSOB-Zone (${rangeInfo.pos.toFixed(0)}%)`);
      }
      if (rangeInfo.pos >= 74 && (isBearCandle || upperWick > atr * 0.4)) {
        bearPoints += 24;
        bearReasons.push(`Wick-Rejection in oberer LSOB-Zone (${rangeInfo.pos.toFixed(0)}%)`);
      }

      if (rangeInfo.pos > 42) bullPoints *= 0.25;
      if (rangeInfo.pos < 58) bearPoints *= 0.25;
    }

    // =========================================================================
    // STRATEGY 0B: 0.882 FIBONACCI SNIPER
    // =========================================================================
    else if (strategyId === 'fib_882_lsob') {
      for (const pat of barPatterns) {
        if (pat.code === 'FIB_882_LSOB_BULL') {
          bullPoints += 48;
          bullReasons.push('🎯 0.882 Fib + Bullish LSOB Retest');
        } else if (pat.code === 'FIB_882_LSOB_BEAR') {
          bearPoints += 48;
          bearReasons.push('🎯 0.882 Fib + Bearish LSOB Retest');
        } else if (pat.code === 'LIQ_SWEEP_BULL') {
          bullPoints += 30;
          bullReasons.push('💧 Liquidity Sweep am Orderblock');
        } else if (pat.code === 'LIQ_SWEEP_BEAR') {
          bearPoints += 30;
          bearReasons.push('💧 Liquidity Sweep am Orderblock');
        } else if (pat.code === 'CHOCH_BULL' || pat.code === 'BOS_BULL') {
          bullPoints += 20;
          bullReasons.push(pat.name);
        } else if (pat.code === 'CHOCH_BEAR' || pat.code === 'BOS_BEAR') {
          bearPoints += 20;
          bearReasons.push(pat.name);
        } else if (pat.bias > 0 && rangeInfo.pos <= 32) {
          bullPoints += 16;
          bullReasons.push(`${pat.short} in Discount-Zone`);
        } else if (pat.bias < 0 && rangeInfo.pos >= 68) {
          bearPoints += 16;
          bearReasons.push(`${pat.short} in Premium-Zone`);
        }
      }

      // Deep Fibonacci Discount Zone (0.786 - 0.882 equivalent in local 36-bar swing = bottom 11.8% - 21.4% of range)
      if (rangeInfo.pos >= 5 && rangeInfo.pos <= 24 && (isBullCandle || lowerWick > atr * 0.35)) {
        bullPoints += 28;
        bullReasons.push(`0.786–0.882 Fib Discount-Zone (${(100 - rangeInfo.pos).toFixed(1)}% Retracement)`);
      }
      // Deep Fibonacci Premium Zone (0.786 - 0.882 equivalent in local 36-bar swing = top 76% - 95% of range)
      if (rangeInfo.pos >= 76 && rangeInfo.pos <= 95 && (isBearCandle || upperWick > atr * 0.35)) {
        bearPoints += 28;
        bearReasons.push(`0.786–0.882 Fib Premium-Zone (${rangeInfo.pos.toFixed(1)}% Retracement)`);
      }

      if (div?.type === 'BULL_DIV') {
        bullPoints += 18;
        bullReasons.push('Bull. RSI-Divergenz am 0.882 Level');
      } else if (div?.type === 'BEAR_DIV') {
        bearPoints += 18;
        bearReasons.push('Bear. RSI-Divergenz am 0.882 Level');
      }

      // Block signals in the middle 50% equilibrium zone (0.882 Sniper only trades deep retracements!)
      if (rangeInfo.pos > 36) bullPoints *= 0.25;
      if (rangeInfo.pos < 64) bearPoints *= 0.25;
    }

    // =========================================================================
    // STRATEGY 1: SMC & LIQUIDITY SWEEP (Smart Money)
    // =========================================================================
    else if (strategyId === 'smc_sweep') {
      for (const pat of barPatterns) {
        if (pat.code === 'LIQ_SWEEP_BULL') {
          bullPoints += 38;
          bullReasons.push('💧 Liquidity Sweep unter Tief');
        } else if (pat.code === 'LIQ_SWEEP_BEAR') {
          bearPoints += 38;
          bearReasons.push('💧 Liquidity Sweep über Hoch');
        } else if (pat.code === 'CHOCH_BULL' || pat.code === 'BOS_BULL') {
          bullPoints += 26;
          bullReasons.push(pat.name);
        } else if (pat.code === 'CHOCH_BEAR' || pat.code === 'BOS_BEAR') {
          bearPoints += 26;
          bearReasons.push(pat.name);
        } else if (pat.bias > 0) {
          bullPoints += 16;
          bullReasons.push(pat.name);
        } else if (pat.bias < 0) {
          bearPoints += 16;
          bearReasons.push(pat.name);
        }
      }

      // Strong buying in lower 25% of range (Demand Zone)
      if (rangeInfo.pos <= 28 && (isBullCandle || lowerWick > atr * 0.45)) {
        bullPoints += 22;
        bullReasons.push(`Demand-Zone Bounce (Range ${rangeInfo.pos.toFixed(0)}%)`);
      }
      // Strong selling in upper 75% of range (Supply Zone)
      if (rangeInfo.pos >= 72 && (isBearCandle || upperWick > atr * 0.45)) {
        bearPoints += 22;
        bearReasons.push(`Supply-Zone Reject (Range ${rangeInfo.pos.toFixed(0)}%)`);
      }

      if (div?.type === 'BULL_DIV') {
        bullPoints += 20;
        bullReasons.push('Bull. RSI-Divergenz');
      } else if (div?.type === 'BEAR_DIV') {
        bearPoints += 20;
        bearReasons.push('Bear. RSI-Divergenz');
      }

      // Block buying at very top of range or shorting at very bottom of range
      if (rangeInfo.pos > 78) bullPoints *= 0.3;
      if (rangeInfo.pos < 22) bearPoints *= 0.3;
    }

    // =========================================================================
    // STRATEGY 2: MEAN REVERSION (Bollinger + RSI Support/Resistance Bounce)
    // =========================================================================
    else if (strategyId === 'mean_reversion') {
      if (bbLower !== null && (c.low <= bbLower * 1.002 || prev.low <= bbLower * 1.002) && isBullCandle) {
        bullPoints += 30;
        bullReasons.push('Bollinger Unterband-Rebound');
      }
      if (bbUpper !== null && (c.high >= bbUpper * 0.998 || prev.high >= bbUpper * 0.998) && isBearCandle) {
        bearPoints += 30;
        bearReasons.push('Bollinger Oberband-Abprall');
      }

      if ((rsi < 38 || rsiPrev < 36) && rsi > rsiPrev && isBullCandle) {
        bullPoints += 26;
        bullReasons.push(`RSI Überverkauft-Turn (${rsi.toFixed(0)})`);
      }
      if ((rsi > 62 || rsiPrev > 64) && rsi < rsiPrev && isBearCandle) {
        bearPoints += 26;
        bearReasons.push(`RSI Überkauft-Turn (${rsi.toFixed(0)})`);
      }

      if (rangeInfo.pos <= 25 && isBullCandle) {
        bullPoints += 18;
        bullReasons.push('Unteres Range-Extrem (Support)');
      }
      if (rangeInfo.pos >= 75 && isBearCandle) {
        bearPoints += 18;
        bearReasons.push('Oberes Range-Extrem (Widerstand)');
      }

      for (const pat of barPatterns) {
        if (pat.bias > 0) {
          bullPoints += 14;
          bullReasons.push(pat.short);
        } else if (pat.bias < 0) {
          bearPoints += 14;
          bearReasons.push(pat.short);
        }
      }
    }

    // =========================================================================
    // STRATEGY 3: EMA GOLDEN PULLBACK (Institutional Trend Following)
    // =========================================================================
    else if (strategyId === 'trend_pullback') {
      if (e20 !== null && e50 !== null) {
        const prevE50 = ind.ema50[Math.max(0, i - 5)] || e50;
        const macroUp = (e200 !== null ? c.close >= e200 * 0.992 : true) && e50 >= prevE50 * 0.998;
        const macroDown = (e200 !== null ? c.close <= e200 * 1.008 : true) && e50 <= prevE50 * 1.002;

        // Pullback touch to EMA20, EMA50, or VWAP followed by bullish reclaim
        const bullPullback =
          isBullCandle &&
          ((c.low <= e20 * 1.003 && c.close >= e20 * 0.998) ||
            (c.low <= e50 * 1.003 && c.close >= e50 * 0.998) ||
            (prev.close < (ind.ema20[i - 1] || e20) && c.close > e20));

        const bearPullback =
          isBearCandle &&
          ((c.high >= e20 * 0.997 && c.close <= e20 * 1.002) ||
            (c.high >= e50 * 0.997 && c.close <= e50 * 1.002) ||
            (prev.close > (ind.ema20[i - 1] || e20) && c.close < e20));

        if (macroUp && bullPullback) {
          bullPoints += 42;
          bullReasons.push('EMA20/50 Pullback-Reclaim im Aufwärtstrend ▲');
        } else if (bullPullback && e20 >= e50) {
          bullPoints += 38;
          bullReasons.push('EMA20 Trend-Pullback ▲');
        }

        if (macroDown && bearPullback) {
          bearPoints += 42;
          bearReasons.push('EMA20/50 Pullback-Abprall im Abwärtstrend ▼');
        } else if (bearPullback && e20 <= e50) {
          bearPoints += 38;
          bearReasons.push('EMA20 Trend-Abprall ▼');
        }

        if (hist > histPrev && isBullCandle) {
          bullPoints += 12;
          bullReasons.push('MACD Impuls dreht positiv');
        } else if (hist < histPrev && isBearCandle) {
          bearPoints += 12;
          bearReasons.push('MACD Impuls dreht negativ');
        }

        // Anti-chase: do not short if already deeply oversold at range bottom
        if (rangeInfo.pos < 22 || rsi < 35) bearPoints *= 0.25;
        if (rangeInfo.pos > 78 || rsi > 65) bullPoints *= 0.25;
      }
    }

    // =========================================================================
    // STRATEGY 4: RSI & MACD DIVERGENCE SNIPER
    // =========================================================================
    else if (strategyId === 'divergence_sniper') {
      if (div?.type === 'BULL_DIV') {
        bullPoints += 44;
        bullReasons.push('🎯 Bullische RSI-Divergenz bestätigt');
      }
      if (div?.type === 'BEAR_DIV') {
        bearPoints += 44;
        bearReasons.push('🎯 Bärische RSI-Divergenz bestätigt');
      }

      // MACD Histogram Reversal from extreme
      const histPrev2 = ind.macdData.histogram[i - 2] ?? 0;
      if (hist <= 0 && hist > histPrev && (rsi < 46 || rsiPrev < 44) && isBullCandle) {
        bullPoints += 26;
        bullReasons.push('MACD Histogramm-Wende ▲ + RSI tief');
      }
      if (hist >= 0 && hist < histPrev && (rsi > 54 || rsiPrev > 56) && isBearCandle) {
        bearPoints += 26;
        bearReasons.push('MACD Histogramm-Wende ▼ + RSI hoch');
      }

      for (const pat of barPatterns) {
        if (pat.bias > 0 && rangeInfo.pos < 42) {
          bullPoints += 22;
          bullReasons.push(`${pat.short} am Tief`);
        } else if (pat.bias < 0 && rangeInfo.pos > 58) {
          bearPoints += 22;
          bearReasons.push(`${pat.short} am Hoch`);
        }
      }
    }

    // =========================================================================
    // STRATEGY 5: VOLATILITY SQUEEZE BREAKOUT
    // =========================================================================
    else if (strategyId === 'squeeze_breakout') {
      const volRatio = vol / volAvg;
      const bodySize = Math.abs(c.close - c.open);

      if (
        isBullCandle &&
        bodySize > atr * 0.45 &&
        c.close > (e20 || c.open) &&
        prev.close <= (ind.ema20[i - 1] || prev.close) * 1.001
      ) {
        bullPoints += 30;
        bullReasons.push(`Impuls-Breakout über EMA20 ▲`);
      }

      if (
        isBearCandle &&
        bodySize > atr * 0.45 &&
        c.close < (e20 || c.open) &&
        prev.close >= (ind.ema20[i - 1] || prev.close) * 0.999
      ) {
        bearPoints += 30;
        bearReasons.push(`Impuls-Breakdown unter EMA20 ▼`);
      }

      if (volRatio >= 1.15) {
        if (isBullCandle) {
          bullPoints += 16;
          bullReasons.push(`Volumen-Spike (${volRatio.toFixed(1)}x)`);
        } else if (isBearCandle) {
          bearPoints += 16;
          bearReasons.push(`Volumen-Spike (${volRatio.toFixed(1)}x)`);
        }
      }

      if (bbUpper !== null && c.close >= bbUpper * 0.998 && isBullCandle) {
        bullPoints += 18;
        bullReasons.push('Bollinger Band-Ausbruch ▲');
      } else if (bbLower !== null && c.close <= bbLower * 1.002 && isBearCandle) {
        bearPoints += 18;
        bearReasons.push('Bollinger Band-Ausbruch ▼');
      }

      if (macd > macdSig && hist > histPrev) bullPoints += 10;
      if (macd < macdSig && hist < histPrev) bearPoints += 10;
    }

    // =========================================================================
    // STRATEGY 6 (DEFAULT): KI SMART-ENSEMBLE (Adaptive + Anti-Chase)
    // =========================================================================
    else {
      // 1. Check Support / Range Bounce vs Resistance Reject first!
      if (rangeInfo.pos <= 28 && isBullCandle) {
        bullPoints += 20;
        bullReasons.push(`Support-Zone Rebound (Range ${rangeInfo.pos.toFixed(0)}%)`);
      } else if (rangeInfo.pos >= 72 && isBearCandle) {
        bearPoints += 20;
        bearReasons.push(`Widerstands-Reject (Range ${rangeInfo.pos.toFixed(0)}%)`);
      }

      // 2. Patterns & Liquidity Sweeps
      for (const pat of barPatterns) {
        if (pat.bias > 0) {
          bullPoints += Math.abs(pat.weight);
          if (!bullReasons.includes(pat.name)) bullReasons.push(pat.name);
        } else if (pat.bias < 0) {
          bearPoints += Math.abs(pat.weight);
          if (!bearReasons.includes(pat.name)) bearReasons.push(pat.name);
        }
      }

      // 3. RSI Rebounds & Divergences
      if ((rsi < 38 || rsiPrev < 36) && rsi > rsiPrev && isBullCandle) {
        bullPoints += 22;
        bullReasons.push(`RSI Rebound (${rsi.toFixed(0)})`);
      } else if (rsi > rsiMA && rsiPrev <= rsiMA && isBullCandle && rsi < 62) {
        bullPoints += 14;
        bullReasons.push(`RSI > Signal (${rsi.toFixed(0)})`);
      }

      if ((rsi > 62 || rsiPrev > 64) && rsi < rsiPrev && isBearCandle) {
        bearPoints += 22;
        bearReasons.push(`RSI Turn-Down (${rsi.toFixed(0)})`);
      } else if (rsi < rsiMA && rsiPrev >= rsiMA && isBearCandle && rsi > 38) {
        bearPoints += 14;
        bearReasons.push(`RSI < Signal (${rsi.toFixed(0)})`);
      }

      if (div?.type === 'BULL_DIV') {
        bullPoints += 26;
        bullReasons.push('Bullische RSI-Divergenz');
      } else if (div?.type === 'BEAR_DIV') {
        bearPoints += 26;
        bearReasons.push('Bärische RSI-Divergenz');
      }

      // 4. EMA Pullback or Cross
      if (e20 !== null && e50 !== null) {
        if (e20 > e50 && c.low <= e20 * 1.002 && c.close > e20 && isBullCandle) {
          bullPoints += 18;
          bullReasons.push('EMA20 Trend-Bounce ▲');
        } else if (e20 < e50 && c.high >= e20 * 0.998 && c.close < e20 && isBearCandle) {
          bearPoints += 18;
          bearReasons.push('EMA20 Trend-Abprall ▼');
        }
      }

      // 5. Bollinger Extreme Bounce
      if (bbLower !== null && c.low <= bbLower * 1.002 && c.close > bbLower && isBullCandle) {
        bullPoints += 16;
        bullReasons.push('Bollinger Unterband-Bounce');
      } else if (bbUpper !== null && c.high >= bbUpper * 0.998 && c.close < bbUpper && isBearCandle) {
        bearPoints += 16;
        bearReasons.push('Bollinger Oberband-Reject');
      }

      // 6. STRICT ANTI-CHASE FILTER:
      // Never trigger a late SELL signal when price is already in the bottom 22% of the range or RSI < 36!
      if (rangeInfo.pos <= 22 || rsi < 36) {
        bearPoints *= 0.25;
      }
      // Never trigger a late BUY signal when price is already in the top 78% of the range or RSI > 65!
      if (rangeInfo.pos >= 78 || rsi > 65) {
        bullPoints *= 0.25;
      }
    }

    const netBull = isBullCandle ? bullPoints - bearPoints * 0.25 : bullPoints * 0.3;
    const netBear = isBearCandle ? bearPoints - bullPoints * 0.25 : bearPoints * 0.3;

    return {
      bullScore: Math.min(99, Math.max(0, Math.round(netBull))),
      bearScore: Math.min(99, Math.max(0, Math.round(netBear))),
      bullReasons,
      bearReasons,
      atr
    };
  }

  /**
   * Computes Entry, Stop-Loss, TP1, TP2, TP3 for a LONG or SHORT signal at index i
   */
  function buildTradeLevels(i, side, candles, atrValues, cfg, customEntry = null, customSL = null) {
    const c = candles[i];
    const entry = customEntry !== null ? customEntry : c.close;
    const atr = atrValues[i] || Math.abs(c.high - c.low) || entry * 0.01;

    let recentLow = c.low;
    let recentHigh = c.high;
    for (let j = Math.max(0, i - 7); j <= i; j++) {
      if (candles[j].low < recentLow) recentLow = candles[j].low;
      if (candles[j].high > recentHigh) recentHigh = candles[j].high;
    }

    if (side === 'BUY') {
      const structSL = Math.min(recentLow, entry) - atr * 0.35;
      const atrSL = entry - atr * cfg.slAtrMult;
      let sl =
        customSL !== null && customSL < entry
          ? customSL
          : Math.min(entry - atr * 0.55, Math.max(structSL, atrSL));
      const risk = Math.max(entry - sl, entry * 0.0022);
      sl = entry - risk;
      return {
        side: 'BUY',
        entry,
        sl,
        tp1: entry + risk * cfg.tp1R,
        tp2: entry + risk * cfg.tp2R,
        tp3: entry + risk * cfg.tp3R,
        riskAbs: risk,
        riskPct: (risk / entry) * 100,
        rr: cfg.tp2R
      };
    } else {
      const structSL = Math.max(recentHigh, entry) + atr * 0.35;
      const atrSL = entry + atr * cfg.slAtrMult;
      let sl =
        customSL !== null && customSL > entry
          ? customSL
          : Math.max(entry + atr * 0.55, Math.min(structSL, atrSL));
      const risk = Math.max(sl - entry, entry * 0.0022);
      sl = entry + risk;
      return {
        side: 'SELL',
        entry,
        sl,
        tp1: entry - risk * cfg.tp1R,
        tp2: entry - risk * cfg.tp2R,
        tp3: entry - risk * cfg.tp3R,
        riskAbs: risk,
        riskPct: (risk / entry) * 100,
        rr: cfg.tp2R
      };
    }
  }

  /**
   * Generates BUY/SELL signals across the chart for the chosen strategy and backtests them
   */
  function generateSignalsAndBacktest(candles, ind, strategyId = 'ensemble', options = {}) {
    const cfg = STRATEGIES[strategyId] || STRATEGIES.ensemble;
    const feePct = Math.min(2, Math.max(0, Number(options.feePct) || 0));
    const slippagePct = Math.min(2, Math.max(0, Number(options.slippagePct) || 0));
    const maxBarsInTrade = Math.max(2, Math.min(200, Math.round(Number(options.maxBarsInTrade) || 50)));
    const slippage = slippagePct / 100;
    const n = candles.length;
    const signals = [];

    const divMap = new Map();
    for (const d of ind.rsiData.divergences) divMap.set(d.index, d);

    let lastSignalIdx = -999;
    let lastSignalSide = null;

    // A signal is evaluated at close i, but filled only at the next candle's open.
    for (let i = 36; i < n - 1; i++) {
      const sc = scoreCandleForStrategy(i, candles, ind, divMap, strategyId);
      const barsSinceLast = i - lastSignalIdx;
      let chosenSide = null;
      let chosenScore = 0;
      let chosenReasons = [];

      if (sc.bullScore >= cfg.minScore && sc.bullScore > sc.bearScore + 10) {
        if (barsSinceLast >= cfg.minBarsBetweenSignals || lastSignalSide === 'SELL') {
          chosenSide = 'BUY';
          chosenScore = sc.bullScore;
          chosenReasons = sc.bullReasons;
        }
      } else if (sc.bearScore >= cfg.minScore && sc.bearScore > sc.bullScore + 10) {
        if (barsSinceLast >= cfg.minBarsBetweenSignals || lastSignalSide === 'BUY') {
          chosenSide = 'SELL';
          chosenScore = sc.bearScore;
          chosenReasons = sc.bearReasons;
        }
      }

      if (chosenSide) {
        const rawEntry = candles[i + 1].open;
        const entry = rawEntry * (chosenSide === 'BUY' ? 1 + slippage : 1 - slippage);
        const levels = buildTradeLevels(i, chosenSide, candles, ind.atr14, cfg, entry);
        const candidate = {
          id: `sig-${strategyId}-${i}-${candles[i].time}`,
          index: i,
          time: candles[i].time,
          entryIndex: i + 1,
          entryTime: candles[i + 1].time,
          rawEntry,
          side: chosenSide,
          score: chosenScore,
          reasons: chosenReasons.slice(0, 3),
          ...levels
        };
        // Server-side validation and live execution can share the same entry veto.
        // Rejected candidates do not occupy a position or suppress later signals.
        if (typeof options.entryFilter === 'function' && !options.entryFilter(candidate, strategyId)) continue;
        signals.push(candidate);
        lastSignalIdx = i;
        lastSignalSide = chosenSide;
      }
    }

    let wins = 0;
    let losses = 0;
    let openCount = 0;
    let skippedCount = 0;
    let grossProfitR = 0;
    let grossLossR = 0;
    let netR = 0;
    let lastExitIndex = -1;

    const exitWithSlippage = (price, side) => price * (side === 'BUY' ? 1 - slippage : 1 + slippage);
    const calculateResult = (sig, exitPrice) => {
      const direction = sig.side === 'BUY' ? 1 : -1;
      const grossR = ((exitPrice - sig.entry) * direction) / sig.riskAbs;
      const feeR = ((feePct * 2) / 100) * (sig.entry / sig.riskAbs);
      const rMultiple = grossR - feeR;
      return {
        rMultiple,
        pnlPct: (((exitPrice - sig.entry) * direction) / sig.entry) * 100 - feePct * 2
      };
    };

    for (const sig of signals) {
      if (sig.entryIndex <= lastExitIndex) {
        sig.status = 'SKIPPED';
        sig.outcomeLabel = 'Übersprungen · Position aktiv';
        skippedCount += 1;
        continue;
      }

      const plannedLastIndex = Math.min(n - 1, sig.entryIndex + maxBarsInTrade - 1);
      let hitTP1 = false;
      let exitIndex = null;
      let exitPrice = null;
      let exitReason = null;

      for (let j = sig.entryIndex; j <= plannedLastIndex; j++) {
        const bar = candles[j];
        const activeSL = hitTP1 ? sig.entry : sig.sl;
        const stopHit = sig.side === 'BUY' ? bar.low <= activeSL : bar.high >= activeSL;

        // Conservative intrabar assumption: if SL and TP occur in one candle, SL comes first.
        if (stopHit) {
          const gapAdjusted = sig.side === 'BUY'
            ? Math.min(activeSL, bar.open)
            : Math.max(activeSL, bar.open);
          exitPrice = exitWithSlippage(gapAdjusted, sig.side);
          exitIndex = j;
          exitReason = hitTP1 ? 'TP1 → Entry-Stop' : 'Stop-Loss';
          break;
        }

        const targets = [
          { price: sig.tp3, reason: 'TP3' },
          { price: sig.tp2, reason: 'TP2' }
        ];
        let targetHit = null;
        for (const target of targets) {
          const hit = sig.side === 'BUY' ? bar.high >= target.price : bar.low <= target.price;
          if (hit) {
            targetHit = target;
            break;
          }
        }
        if (targetHit) {
          const gapAdjusted = sig.side === 'BUY'
            ? Math.max(targetHit.price, bar.open)
            : Math.min(targetHit.price, bar.open);
          exitPrice = exitWithSlippage(gapAdjusted, sig.side);
          exitIndex = j;
          exitReason = targetHit.reason;
          break;
        }

        const tp1Hit = sig.side === 'BUY' ? bar.high >= sig.tp1 : bar.low <= sig.tp1;
        if (tp1Hit) hitTP1 = true;
      }

      if (exitIndex === null && plannedLastIndex < sig.entryIndex + maxBarsInTrade - 1) {
        const markPrice = exitWithSlippage(candles[n - 1].close, sig.side);
        const result = calculateResult(sig, markPrice);
        sig.status = 'OPEN';
        sig.rMultiple = result.rMultiple;
        sig.pnlPct = result.pnlPct;
        sig.outcomeLabel = `Offen · ${result.rMultiple >= 0 ? '+' : ''}${result.rMultiple.toFixed(2)}R`;
        openCount += 1;
        lastExitIndex = n - 1;
        continue;
      }

      if (exitIndex === null) {
        exitIndex = plannedLastIndex;
        exitPrice = exitWithSlippage(candles[plannedLastIndex].close, sig.side);
        exitReason = 'Zeitexit';
      }

      const result = calculateResult(sig, exitPrice);
      sig.exitIndex = exitIndex;
      sig.exitTime = candles[exitIndex].time;
      sig.exitPrice = exitPrice;
      sig.exitReason = exitReason;
      sig.rMultiple = result.rMultiple;
      sig.pnlPct = result.pnlPct;
      sig.status = result.rMultiple > 0 ? 'WIN' : 'LOSS';
      sig.outcomeLabel = `${exitReason} · ${result.rMultiple >= 0 ? '+' : ''}${result.rMultiple.toFixed(2)}R`;

      if (result.rMultiple > 0) {
        wins += 1;
        grossProfitR += result.rMultiple;
      } else {
        losses += 1;
        grossLossR += Math.abs(result.rMultiple);
      }
      netR += result.rMultiple;
      lastExitIndex = exitIndex;
    }

    const closedTrades = wins + losses;
    const testedTrades = closedTrades + openCount;
    const winRate = closedTrades > 0 ? (wins / closedTrades) * 100 : 0;
    const profitFactor = grossLossR > 0
      ? grossProfitR / grossLossR
      : grossProfitR > 0
      ? Infinity
      : null;

    return {
      strategy: cfg,
      signals,
      assumptions: { feePct, slippagePct, maxBarsInTrade },
      stats: {
        totalSignals: signals.length,
        testedTrades,
        skippedCount,
        closedTrades,
        wins,
        losses,
        openCount,
        winRate,
        profitFactor,
        netR,
        expectancyR: closedTrades > 0 ? netR / closedTrades : 0
      }
    };
  }

  /** Runs all strategies with identical costs and execution assumptions. */
  function compareAllStrategies(candles, ind, options = {}) {
    const results = [];
    for (const key of Object.keys(STRATEGIES)) {
      const res = generateSignalsAndBacktest(candles, ind, key, options);
      const stats = res.stats;
      const pf = stats.profitFactor === Infinity ? 6 : stats.profitFactor ?? 0;
      const shrunkWinRate = ((stats.wins + 2) / (stats.closedTrades + 4)) * 100;
      const rankScore = stats.closedTrades === 0
        ? -Infinity
        : shrunkWinRate * 0.45 + Math.min(pf, 6) * 6 + stats.netR * 1.5 + Math.min(stats.closedTrades, 30) * 0.4;
      results.push({
        id: key,
        name: STRATEGIES[key].name,
        shortName: STRATEGIES[key].shortName,
        description: STRATEGIES[key].description,
        stats,
        rankScore
      });
    }
    results.sort((a, b) => b.rankScore - a.rankScore);
    return results;
  }

  /**
   * Evaluates current market state with Smart Location & Anti-Chase Protection
   * Specifically prevents recommending a late Market Short right at Support (e.g. 98.60-100.30 on SOL)!
   */
  function evaluateCurrentMarket(
    symbol,
    timeframe,
    candles,
    ind,
    backtestResult,
    strategyId = 'ensemble'
  ) {
    const n = candles.length;
    if (n < 30) return null;

    const cfg = STRATEGIES[strategyId] || STRATEGIES.ensemble;
    const lastIdx = n - 1;
    const c = candles[lastIdx];
    const price = c.close;
    const e20 = ind.ema20[lastIdx] || price;
    const e50 = ind.ema50[lastIdx] || price;
    const e200 = ind.ema200[lastIdx] || price;
    const rsi = ind.rsiData.rsi[lastIdx] ?? 50;
    const macd = ind.macdData.macdLine[lastIdx] ?? 0;
    const macdSig = ind.macdData.signalLine[lastIdx] ?? 0;
    const hist = ind.macdData.histogram[lastIdx] ?? 0;
    const histPrev = ind.macdData.histogram[lastIdx - 1] ?? 0;
    const vwap = ind.vwap[lastIdx] || price;
    const atr = ind.atr14[lastIdx] || price * 0.01;
    const bbLower = ind.bb.lower[lastIdx] || price * 0.98;
    const bbUpper = ind.bb.upper[lastIdx] || price * 1.02;

    const rangeInfo = getRangePosition(candles, lastIdx, 45);
    const supports = ind.srData.supports || [];
    const resistances = ind.srData.resistances || [];
    const nearestSup = supports[0];
    const secondSup = supports[1];
    const nearestRes = resistances[0];

    const distToSupPct = nearestSup ? ((price - nearestSup.price) / price) * 100 : 2.5;
    const distToResPct = nearestRes ? ((nearestRes.price - price) / price) * 100 : 2.5;

    // Detect if price is sitting near Support / Demand Bottom (only in lower part of range!)
    const nearSupportZone =
      rangeInfo.pos <= 32 ||
      (rangeInfo.pos <= 44 && nearestSup && price - nearestSup.price <= atr * 0.75) ||
      rsi <= 38;

    // Detect if price is sitting near Resistance / Supply Top (in upper part of range!)
    const nearResistanceZone =
      !nearSupportZone &&
      (rangeInfo.pos >= 68 ||
        (rangeInfo.pos >= 56 && nearestRes && nearestRes.price - price <= atr * 0.85) ||
        rsi >= 62);

    let bullPoints = 0;
    let bearPoints = 0;
    const factors = [];

    // 1. Range Location & Support/Resistance Proximity (Weighted heavily to avoid buying tops / shorting bottoms!)
    if (nearSupportZone) {
      bullPoints += 32;
      const supRef = secondSup
        ? `${formatPrice(nearestSup.price)} / ${formatPrice(secondSup.price)}`
        : nearestSup
        ? formatPrice(nearestSup.price)
        : formatPrice(rangeInfo.low);
      factors.push({
        name: 'Preis-Position & Support-Zone',
        status: `AM SUPPORT (${supRef}) • KEIN SHORT!`,
        bias: 'bull'
      });
    } else if (nearResistanceZone) {
      bearPoints += 32;
      const resRef = nearestRes ? formatPrice(nearestRes.price) : formatPrice(rangeInfo.high);
      factors.push({
        name: 'Preis-Position & Widerstand',
        status: `AM WIDERSTAND (${resRef}) • KEIN LONG!`,
        bias: 'bear'
      });
    } else {
      factors.push({
        name: 'Preis-Position in Range (45K)',
        status: `MITTE (${rangeInfo.pos.toFixed(0)}% der Spanne)`,
        bias: 'neutral'
      });
    }

    // 2. EMA Trend Structure (with context: below EMA at support = oversold pullback, not late short!)
    if (price > e20 && e20 > e50) {
      bullPoints += 20;
      factors.push({
        name: 'EMA Trend-Struktur (20/50/200)',
        status: price > e200 ? 'STARKER AUFWÄRTSTREND' : 'KURZFR. AUFWÄRTSTREND',
        bias: 'bull'
      });
    } else if (price < e20 && e20 < e50) {
      if (nearSupportZone) {
        // Price is below EMAs, but already dumped into support -> Mean Reversion Long potential!
        bullPoints += 12;
        bearPoints += 8;
        factors.push({
          name: 'EMA-Abstand (Überdehnung)',
          status: `ÜBERDEHNT UNTER EMA20 (${formatPrice(e20)})`,
          bias: 'bull'
        });
      } else {
        bearPoints += 20;
        factors.push({
          name: 'EMA Trend-Struktur (20/50/200)',
          status: price < e200 ? 'ABWÄRTSTREND AKTIV' : 'UNTER EMA 20/50',
          bias: 'bear'
        });
      }
    } else {
      bullPoints += 10;
      bearPoints += 10;
      factors.push({
        name: 'EMA Trend-Struktur (20/50/200)',
        status: 'SEITWÄRTS / RANGE',
        bias: 'neutral'
      });
    }

    // 3. RSI Oscillator & Mean Reversion
    if (rsi <= 40) {
      bullPoints += 24;
      factors.push({
        name: `RSI (14) Oszillator (${rsi.toFixed(1)})`,
        status: 'TIEF / LONG-REBOUND ZONE',
        bias: 'bull'
      });
    } else if (rsi >= 62) {
      bearPoints += 24;
      factors.push({
        name: `RSI (14) Oszillator (${rsi.toFixed(1)})`,
        status: 'HOCH / SHORT-PULLBACK ZONE',
        bias: 'bear'
      });
    } else if (rsi >= 50) {
      bullPoints += 12;
      factors.push({
        name: `RSI (14) Oszillator (${rsi.toFixed(1)})`,
        status: 'LEICHT BULLISCH',
        bias: 'bull'
      });
    } else {
      bearPoints += 10;
      factors.push({
        name: `RSI (14) Oszillator (${rsi.toFixed(1)})`,
        status: 'ABKÜHLUNG (Nahe Boden)',
        bias: nearSupportZone ? 'bull' : 'bear'
      });
    }

    // 4. MACD Momentum
    if (hist > histPrev) {
      bullPoints += 15;
      factors.push({
        name: 'MACD (12, 26, 9) Histogramm',
        status: hist >= 0 ? 'BULLISCHER IMPULS ▲' : 'VERKAUFSDRUCK NÄSST NACH ▲',
        bias: 'bull'
      });
    } else {
      bearPoints += 12;
      factors.push({
        name: 'MACD (12, 26, 9) Histogramm',
        status: nearSupportZone ? 'SPÄTER ABVERKAUF (Erschöpfung)' : 'BÄRISCHER IMPULS ▼',
        bias: nearSupportZone ? 'neutral' : 'bear'
      });
    }

    // 5. Recent Candlestick / SMC Patterns (last 6 bars)
    const recentPatterns = [];
    for (let k = Math.max(0, lastIdx - 6); k <= lastIdx; k++) {
      const pats = ind.patterns.get(k) || [];
      for (const p of pats) {
        recentPatterns.push({ ...p, barsAgo: lastIdx - k });
      }
    }
    if (recentPatterns.length > 0) {
      const latestPat = recentPatterns[recentPatterns.length - 1];
      if (latestPat.bias > 0) {
        bullPoints += 18;
        factors.push({
          name: 'Preis-Aktion & SMC Muster',
          status: `${latestPat.short} (vor ${latestPat.barsAgo}K)`,
          bias: 'bull'
        });
      } else {
        bearPoints += 15;
        factors.push({
          name: 'Preis-Aktion & SMC Muster',
          status: `${latestPat.short} (vor ${latestPat.barsAgo}K)`,
          bias: 'bear'
        });
      }
    } else {
      factors.push({
        name: 'Preis-Aktion & SMC Muster',
        status: 'WARTE AUF TRIGGER-KERZE',
        bias: 'neutral'
      });
    }

    // 6. Risk/Reward Space between Support & Resistance
    const rewardToRes = nearestRes ? Math.max(nearestRes.price - price, atr) : atr * 2.5;
    const riskToSup = nearestSup ? Math.max(price - nearestSup.price, atr * 0.4) : atr;
    const spaceRR = rewardToRes / riskToSup;

    if (spaceRR >= 1.6) {
      bullPoints += 18;
      factors.push({
        name: 'Platz bis Widerstand vs. Support',
        status: `GÜNSTIG FÜR LONG (CRV ${spaceRR.toFixed(1)}:1)`,
        bias: 'bull'
      });
    } else if (spaceRR <= 0.65) {
      bearPoints += 18;
      factors.push({
        name: 'Platz bis Support vs. Widerstand',
        status: `GÜNSTIG FÜR SHORT (CRV ${(1 / spaceRR).toFixed(1)}:1)`,
        bias: 'bear'
      });
    } else {
      factors.push({
        name: 'Platz bis Widerstand vs. Support',
        status: `AUSGEGLICHEN (+${distToResPct.toFixed(2)}% / -${distToSupPct.toFixed(2)}%)`,
        bias: 'neutral'
      });
    }

    const totalPts = Math.max(bullPoints + bearPoints, 1);
    const bullPct = Math.round((bullPoints / totalPts) * 100);
    const bearPct = 100 - bullPct;

    let setupDirection = bullPct >= 50 ? 'BUY' : 'SELL';
    if (nearSupportZone && bullPct >= 46) setupDirection = 'BUY';
    if (nearResistanceZone && bearPct >= 46) setupDirection = 'SELL';

    const fibData = ind.fibData || null;
    const lsobData = ind.lsobData || null;

    if (lsobData) {
      const bullOB = lsobData.bullish;
      const bearOB = lsobData.bearish;
      const closerToBullOB = Math.abs(price - bullOB.entry) <= Math.abs(bearOB.entry - price);
      factors.unshift({
        name: '🧱 LSOB Zone (Wick-to-Wick Orderblock)',
        status: closerToBullOB
          ? `BULL LSOB: ${formatPrice(bullOB.obLow)} – ${formatPrice(bullOB.obHigh)} (Long)`
          : `BEAR LSOB: ${formatPrice(bearOB.obLow)} – ${formatPrice(bearOB.obHigh)} (Short)`,
        bias: closerToBullOB ? 'bull' : 'bear'
      });
    }

    if (fibData) {
      const bull882 = fibData.bullish.fib882;
      const bear882 = fibData.bearish.fib882;
      const closerToBull = Math.abs(price - bull882) <= Math.abs(bear882 - price);
      factors.unshift({
        name: '🎯 0.882 Fibonacci Sniper-Level',
        status: closerToBull
          ? `LONG-SNIPER @ ${formatPrice(bull882)} (1.0 SL: ${formatPrice(fibData.bullish.fib1000)})`
          : `SHORT-SNIPER @ ${formatPrice(bear882)} (1.0 SL: ${formatPrice(fibData.bearish.fib1000)})`,
        bias: closerToBull ? 'bull' : 'bear'
      });
    }

    // =========================================================================
    // COMPUTE FORWARD-LOOKING FUTURE LONG & FUTURE SHORT SETUPS PER STRATEGY
    // (Never show outdated past signals from 15 candles ago!)
    // =========================================================================
    const deepSupportPrice = secondSup
      ? secondSup.price
      : nearestSup
      ? nearestSup.price - atr * 0.9
      : rangeInfo.low;
    const firstSupportPrice = nearestSup ? nearestSup.price : price - atr * 0.9;
    const firstResistancePrice = nearestRes ? nearestRes.price : price + atr * 0.9;
    const secondResistancePrice = resistances[1]
      ? resistances[1].price
      : firstResistancePrice + atr * 1.1;

    // Recent local 8-bar swing high/low for breakout or sweep levels
    let localHigh8 = price;
    let localLow8 = price;
    for (let k = Math.max(0, lastIdx - 8); k <= lastIdx; k++) {
      if (candles[k].high > localHigh8) localHigh8 = candles[k].high;
      if (candles[k].low < localLow8) localLow8 = candles[k].low;
    }

    let futureLongEntry;
    let futureLongReason;
    let customLongSL = null;
    let futureShortEntry;
    let futureShortReason;
    let customShortSL = null;

    if (strategyId === 'lsob_strategy' && lsobData) {
      futureLongEntry = Math.min(lsobData.bullish.entry, price - atr * 0.3);
      customLongSL = Math.min(lsobData.bullish.stopLoss, futureLongEntry - atr * 0.4);
      futureLongReason = `🧱 Bullish LSOB Retest + Liquidity Sweep (Wick-to-Wick Box ${formatPrice(lsobData.bullish.obLow)} – ${formatPrice(lsobData.bullish.obHigh)})`;

      futureShortEntry = Math.max(lsobData.bearish.entry, price + atr * 0.3);
      customShortSL = Math.max(lsobData.bearish.stopLoss, futureShortEntry + atr * 0.4);
      futureShortReason = `🧱 Bearish LSOB Retest + Liquidity Sweep (Wick-to-Wick Box ${formatPrice(lsobData.bearish.obLow)} – ${formatPrice(lsobData.bearish.obHigh)})`;
    } else if (strategyId === 'fib_882_lsob' && fibData) {
      futureLongEntry = Math.min(fibData.bullish.fib882, price - atr * 0.3);
      customLongSL = Math.min(fibData.bullish.stopLoss, futureLongEntry - atr * 0.45);
      futureLongReason = `🎯 0.882 Fibonacci Sniper Retracement (@ ${formatPrice(futureLongEntry)} | 1.0 Swing-Tief @ ${formatPrice(fibData.bullish.fib1000)})`;

      futureShortEntry = Math.max(fibData.bearish.fib882, price + atr * 0.3);
      customShortSL = Math.max(fibData.bearish.stopLoss, futureShortEntry + atr * 0.45);
      futureShortReason = `🎯 0.882 Fibonacci Sniper Retracement (@ ${formatPrice(futureShortEntry)} | 1.0 Swing-Hoch @ ${formatPrice(fibData.bearish.fib1000)})`;
    } else if (strategyId === 'smc_sweep') {
      futureLongEntry = Math.min(firstSupportPrice, price - atr * 0.45);
      futureLongReason = `Smart-Money Demand / Liquidity-Sweep Zone (S1 @ ${formatPrice(futureLongEntry)})`;
      futureShortEntry = Math.max(firstResistancePrice, localHigh8, price + atr * 0.45);
      futureShortReason = `Smart-Money Supply / Orderblock am Widerstand (R1 @ ${formatPrice(futureShortEntry)})`;
    } else if (strategyId === 'mean_reversion') {
      futureLongEntry = Math.min(bbLower, firstSupportPrice, price - atr * 0.45);
      futureLongReason = `Unteres Bollinger-Band & Support-Rebound (@ ${formatPrice(futureLongEntry)})`;
      futureShortEntry = Math.max(bbUpper, firstResistancePrice, price + atr * 0.45);
      futureShortReason = `Oberes Bollinger-Band & Widerstands-Abprall (@ ${formatPrice(futureShortEntry)})`;
    } else if (strategyId === 'trend_pullback') {
      const emaPullbackLong = e20 < price ? e20 : e50 < price ? e50 : firstSupportPrice;
      futureLongEntry = Math.min(emaPullbackLong, firstSupportPrice, price - atr * 0.35);
      futureLongReason = `Trend-Pullback an EMA 20/50 & Support (@ ${formatPrice(futureLongEntry)})`;

      const emaPullbackShort = e20 > price ? e20 : e50 > price ? e50 : firstResistancePrice;
      futureShortEntry = Math.max(emaPullbackShort, firstResistancePrice, price + atr * 0.35);
      futureShortReason = `Trend-Retest an EMA 20/50 & Widerstand (@ ${formatPrice(futureShortEntry)})`;
    } else if (strategyId === 'squeeze_breakout') {
      // Buy on Pullback-Retest of the breakout level / EMA20 below current price (never buy the top!)
      const retestLong = e20 < price ? Math.max(e20, firstSupportPrice) : firstSupportPrice;
      futureLongEntry = Math.min(retestLong, price - atr * 0.4);
      futureLongReason = `Breakout-Retest / Rücksetzer auf Support & EMA20 (@ ${formatPrice(futureLongEntry)})`;

      const retestShort = e20 > price ? Math.min(e20, firstResistancePrice) : firstResistancePrice;
      futureShortEntry = Math.max(retestShort, localHigh8, price + atr * 0.4);
      futureShortReason = `Widerstands-Retest / Doppel-Top Ablehnung (@ ${formatPrice(futureShortEntry)})`;
    } else {
      const longCandidates = [
        firstSupportPrice,
        e50 < price ? e50 : null,
        vwap < price ? vwap : null
      ].filter((v) => v !== null && v <= price - atr * 0.25 && v >= price - atr * 3.0);

      futureLongEntry =
        longCandidates.length > 0 ? Math.max(...longCandidates) : price - atr * 0.65;
      futureLongReason = `Nächste Kauf-Zone (Support S1 / Pullback @ ${formatPrice(futureLongEntry)})`;

      const shortCandidates = [
        firstResistancePrice,
        localHigh8 > price ? localHigh8 : null,
        e50 > price ? e50 : null,
        vwap > price ? vwap : null
      ].filter((v) => v !== null && v >= price + atr * 0.25 && v <= price + atr * 3.0);

      futureShortEntry =
        shortCandidates.length > 0 ? Math.min(...shortCandidates) : price + atr * 0.65;
      futureShortReason = `Nächste Short-Zone (Widerstand R1 / Rally @ ${formatPrice(futureShortEntry)})`;
    }

    // Strict guarantee: Long Entry is ALWAYS below current price, Short Entry is ALWAYS above current price!
    futureLongEntry = Math.min(futureLongEntry, price - atr * 0.3);
    futureShortEntry = Math.max(futureShortEntry, price + atr * 0.3);

    const longDistPct = ((futureLongEntry - price) / price) * 100;
    const shortDistPct = ((futureShortEntry - price) / price) * 100;

    const futureLongSetup = {
      ...buildTradeLevels(lastIdx, 'BUY', candles, ind.atr14, cfg, futureLongEntry, customLongSL),
      isFromSignalCandle: false,
      entryMode: 'FUTURE_LONG',
      entryModeLabel:
        Math.abs(longDistPct) <= 0.25
          ? `⚡ JETZT IN LONG-ZONE (${longDistPct.toFixed(2)}%)`
          : `🟢 ZUKÜNFTIGER LONG (${longDistPct >= 0 ? '+' : ''}${longDistPct.toFixed(2)}%)`,
      reasonText: futureLongReason,
      distToEntryPct: longDistPct
    };

    const futureShortSetup = {
      ...buildTradeLevels(lastIdx, 'SELL', candles, ind.atr14, cfg, futureShortEntry, customShortSL),
      isFromSignalCandle: false,
      entryMode: 'FUTURE_SHORT',
      entryModeLabel:
        Math.abs(shortDistPct) <= 0.25
          ? `⚡ JETZT IN SHORT-ZONE (+${shortDistPct.toFixed(2)}%)`
          : `🔴 ZUKÜNFTIGER SHORT (${shortDistPct >= 0 ? '+' : ''}${shortDistPct.toFixed(2)}%)`,
      reasonText: futureShortReason,
      distToEntryPct: shortDistPct
    };

    const activeSetup = setupDirection === 'BUY' ? futureLongSetup : futureShortSetup;

    let verdict;
    let verdictClass;
    if (setupDirection === 'BUY') {
      verdictClass = 'bull';
      verdict =
        Math.abs(longDistPct) <= 0.3
          ? `🟢 LONG-ZONE ERREICHT @ ${formatPrice(futureLongSetup.entry)}`
          : `🟢 NÄCHSTER LONG GEPLANT @ ${formatPrice(futureLongSetup.entry)} (${longDistPct.toFixed(2)}%)`;
    } else {
      verdictClass = 'bear';
      verdict =
        Math.abs(shortDistPct) <= 0.3
          ? `🔴 SHORT-ZONE ERREICHT @ ${formatPrice(futureShortSetup.entry)}`
          : `🔴 NÄCHSTER SHORT GEPLANT @ ${formatPrice(futureShortSetup.entry)} (+${shortDistPct.toFixed(2)}%)`;
    }

    const limitZones = {
      longZoneLow: deepSupportPrice,
      longZoneHigh: futureLongSetup.entry,
      shortZonePrice: futureShortSetup.entry,
      secondResistancePrice
    };

    const confidence = Math.min(98, Math.max(bullPct, bearPct));
    const signals = backtestResult.signals;
    const latestSignal = signals.length > 0 ? signals[signals.length - 1] : null;
    const latestSigBarsAgo = latestSignal ? lastIdx - latestSignal.index : 999;

    const antiChaseNote = nearSupportZone
      ? `⚠️ KI-HINWEIS: Kurs notiert nahe Support (${rangeInfo.pos.toFixed(0)}% der Spanne). Fokus auf Long-Einstiege bei ${formatPrice(futureLongSetup.entry)} bzw. tiefem Support S2 (${formatPrice(deepSupportPrice)}).`
      : nearResistanceZone
      ? `⚠️ KI-HINWEIS: Kurs notiert am oberen Bereich der Spanne (${rangeInfo.pos.toFixed(0)}%) nahe Widerstand. Kein FOMO-Kauf am Hoch – Fokus auf Short bei ${formatPrice(futureShortSetup.entry)} oder Rücksetzer-Long erst bei ${formatPrice(futureLongSetup.entry)}!`
      : `ℹ️ Aktueller Kurs: ${formatPrice(price)} (${rangeInfo.pos.toFixed(0)}% der Spanne). Hier sind deine konkreten zukünftigen Einstiegs-Marken:`;

    const narrative = [
      `📊 Strategie: ${cfg.name}`,
      antiChaseNote,
      ``,
      `🟢 ZUKÜNFTIGER LONG-PLAN (${futureLongReason}):`,
      `• Kauflimit / Einstieg: ${formatPrice(futureLongSetup.entry)} (${longDistPct >= 0 ? '+' : ''}${longDistPct.toFixed(2)}% vom Kurs)`,
      `• Stop-Loss: ${formatPrice(futureLongSetup.sl)} (-${futureLongSetup.riskPct.toFixed(2)}%) | Ziele: TP1 = ${formatPrice(futureLongSetup.tp1)} • TP2 = ${formatPrice(futureLongSetup.tp2)}`,
      ``,
      `🔴 ZUKÜNFTIGER SHORT-PLAN (${futureShortReason}):`,
      `• Verkaufslimit / Einstieg: ${formatPrice(futureShortSetup.entry)} (${shortDistPct >= 0 ? '+' : ''}${shortDistPct.toFixed(2)}% vom Kurs)`,
      `• Stop-Loss: ${formatPrice(futureShortSetup.sl)} (-${futureShortSetup.riskPct.toFixed(2)}%) | Ziele: TP1 = ${formatPrice(futureShortSetup.tp1)} • TP2 = ${formatPrice(futureShortSetup.tp2)}`
    ].join('\n');

    return {
      symbol,
      timeframe,
      price,
      verdict,
      verdictClass,
      bullPct,
      bearPct,
      confidence,
      factors,
      recentPatterns,
      activeSetup,
      futureLongSetup,
      futureShortSetup,
      limitZones,
      latestSignal,
      latestSigBarsAgo,
      narrative,
      nearestSup,
      secondSup,
      nearestRes,
      fibData,
      lsobData,
      atr,
      rsi,
      rangePos: rangeInfo.pos
    };
  }

  function formatPrice(val) {
    if (val === null || val === undefined || Number.isNaN(val)) return '–';
    const abs = Math.abs(val);
    if (abs >= 1000) return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (abs >= 1) return val.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 4 });
    if (abs >= 0.01) return val.toFixed(5);
    return val.toFixed(7);
  }

  async function runDeepLLMAnalysis(evalState, candles, settings) {
    const prompt = `Du bist ein professioneller institutioneller Quant-Trader.
Analysiere das folgende Echtzeit-Chartbild für ${evalState.symbol} (${evalState.timeframe}) auf Deutsch:
- Aktueller Preis: ${evalState.price} (Position in der Range: ${evalState.rangePos.toFixed(0)}%)
- KI-Urteil: ${evalState.verdict} (${evalState.bullPct}% Bullen / ${evalState.bearPct}% Bären)
- RSI (14): ${evalState.rsi.toFixed(1)} | ATR: ${evalState.atr}
- Support S1: ${evalState.nearestSup ? evalState.nearestSup.price : 'n/a'} | Tiefer Support S2: ${evalState.secondSup ? evalState.secondSup.price : 'n/a'}
- Widerstand R1: ${evalState.nearestRes ? evalState.nearestRes.price : 'n/a'}
- Aktives Setup (${evalState.activeSetup.side}): Entry ${evalState.activeSetup.entry}, SL ${evalState.activeSetup.sl}, TP1 ${evalState.activeSetup.tp1}, TP2 ${evalState.activeSetup.tp2}

Erkläre kurz und präzise (max. 160 Wörter):
1. Warum man an Support-Zonen (wie S1/S2) auf Long-Rebounds / Sweeps achtet statt spät in den Boden zu shorten
2. Wo die beste Limit-Long-Order und die beste Pullback-Short-Order liegen
3. Konkretes Risiko-Management.`;

    const provider = settings?.provider || 'local';
    const apiKey = (settings?.apiKey || '').trim();

    if (provider === 'gemini' && apiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!res.ok) throw new Error(`Gemini API Fehler (${res.status})`);
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || evalState.narrative;
    }

    if (provider === 'openai' && apiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });
      if (!res.ok) throw new Error(`OpenAI API Fehler (${res.status})`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || evalState.narrative;
    }

    if (provider === 'ollama') {
      const model = settings?.ollamaModel || 'llama3';
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false })
      });
      if (!res.ok) throw new Error(`Lokales Ollama nicht erreichbar (${res.status})`);
      const data = await res.json();
      return data?.response || evalState.narrative;
    }

    return [
      `🧠 TIEFE INSTITUTIONELLE ANALYSE (${evalState.symbol} • ${evalState.timeframe}):`,
      `1. Smart-Money-Kontext: Der Preis steht aktuell bei ${evalState.rangePos.toFixed(0)}% der jüngsten Handelsspanne. An starken Support-Clustern (${formatPrice(evalState.limitZones.longZoneHigh)} bis ${formatPrice(evalState.limitZones.longZoneLow)}) sammeln institutionelle Marktteilnehmer Long-Liquidität ein (Stop-Hunts unter alte Tiefs).`,
      `2. Zwei konkrete Handelspläne:`,
      `   • Plan A (Direkter Support-Rebound / Limit-Long): Einstieg im Bereich ${formatPrice(evalState.limitZones.longZoneHigh)} – ${formatPrice(evalState.limitZones.longZoneLow)}, Stop-Loss knapp unter ${formatPrice(evalState.activeSetup.sl)}, Kursziele bei ${formatPrice(evalState.activeSetup.tp1)} und ${formatPrice(evalState.activeSetup.tp2)}.`,
      `   • Plan B (Trend-Short erst nach Erholung): Falls der Kurs erst bis zum Widerstand R1 (${formatPrice(evalState.limitZones.shortZonePrice)}) hochläuft und dort schwächelt, bietet sich dort oben der Short-Einstieg mit bestem CRV an.`
    ].join('\n\n');
  }

  return {
    STRATEGIES,
    generateSignalsAndBacktest,
    compareAllStrategies,
    evaluateCurrentMarket,
    runDeepLLMAnalysis,
    formatPrice
  };
})();

export const AIEngine = window.AIEngine;
