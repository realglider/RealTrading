const window = globalThis;
/**
 * Quant & Technical Indicator Engine for RealTrading Strategie
 * Computes EMAs, Bollinger Bands, RSI + Divergences, MACD, ATR, VWAP,
 * Heikin-Ashi, Support/Resistance Zones, Auto-Trendlines & Candlestick/SMC Patterns.
 */

window.Indicators = (function () {
  function calcSMA(values, period) {
    const res = new Array(values.length).fill(null);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      sum += v;
      count++;
      if (i >= period && values[i - period] !== null && values[i - period] !== undefined) {
        sum -= values[i - period];
        count--;
      }
      if (i >= period - 1 && count === period) {
        res[i] = sum / period;
      }
    }
    return res;
  }

  function calcEMA(values, period) {
    const res = new Array(values.length).fill(null);
    const k = 2 / (period + 1);
    let ema = null;
    let validCount = 0;
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      validCount++;
      if (ema === null) {
        sum += v;
        if (validCount === period) {
          ema = sum / period;
          res[i] = ema;
        }
      } else {
        ema = v * k + ema * (1 - k);
        res[i] = ema;
      }
    }
    return res;
  }

  function calcATR(candles, period = 14) {
    const n = candles.length;
    const tr = new Array(n).fill(0);
    const atr = new Array(n).fill(null);
    if (n === 0) return atr;

    for (let i = 0; i < n; i++) {
      const c = candles[i];
      if (i === 0) {
        tr[i] = c.high - c.low;
      } else {
        const prevClose = candles[i - 1].close;
        tr[i] = Math.max(
          c.high - c.low,
          Math.abs(c.high - prevClose),
          Math.abs(c.low - prevClose)
        );
      }
    }

    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (i < period) {
        sum += tr[i];
        if (i === period - 1) {
          atr[i] = sum / period;
        }
      } else {
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
      }
    }
    // Fill early bars with first valid ATR so early calculations never fail
    const firstValid = atr.find((x) => x !== null) || (candles[0].high - candles[0].low) || 1;
    for (let i = 0; i < period - 1 && i < n; i++) {
      atr[i] = firstValid;
    }
    return atr;
  }

  function calcBollingerBands(candles, period = 20, mult = 2) {
    const closes = candles.map((c) => c.close);
    const mid = calcSMA(closes, period);
    const upper = new Array(candles.length).fill(null);
    const lower = new Array(candles.length).fill(null);
    const bandwidth = new Array(candles.length).fill(null);

    for (let i = period - 1; i < candles.length; i++) {
      const mean = mid[i];
      if (mean === null) continue;
      let sqSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = closes[j] - mean;
        sqSum += diff * diff;
      }
      const std = Math.sqrt(sqSum / period);
      upper[i] = mean + mult * std;
      lower[i] = mean - mult * std;
      bandwidth[i] = mean > 0 ? ((upper[i] - lower[i]) / mean) * 100 : 0;
    }
    return { upper, middle: mid, lower, bandwidth };
  }

  function calcRSI(candles, period = 14) {
    const n = candles.length;
    const rsi = new Array(n).fill(null);
    if (n <= period) return { rsi, rsiMA: rsi, divergences: [] };

    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i <= period; i++) {
      const chg = candles[i].close - candles[i - 1].close;
      if (chg > 0) avgGain += chg;
      else avgLoss += Math.abs(chg);
    }
    avgGain /= period;
    avgLoss /= period;

    rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < n; i++) {
      const chg = candles[i].close - candles[i - 1].close;
      const gain = chg > 0 ? chg : 0;
      const loss = chg < 0 ? Math.abs(chg) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    const rsiMA = calcSMA(rsi, 14);

    // Detect RSI Bullish & Bearish Divergences across Pivot Lows / Highs
    const divergences = [];
    const pivotLows = [];
    const pivotHighs = [];

    for (let i = period + 3; i < n - 2; i++) {
      if (rsi[i] === null) continue;
      const isLow =
        candles[i].low <= candles[i - 1].low &&
        candles[i].low <= candles[i - 2].low &&
        candles[i].low <= candles[i + 1].low &&
        candles[i].low <= candles[i + 2].low;
      const isHigh =
        candles[i].high >= candles[i - 1].high &&
        candles[i].high >= candles[i - 2].high &&
        candles[i].high >= candles[i + 1].high &&
        candles[i].high >= candles[i + 2].high;

      if (isLow) {
        if (pivotLows.length > 0) {
          const prev = pivotLows[pivotLows.length - 1];
          const barsBetween = i - prev.index;
          // Bullish Divergence: Lower Low in Price, Higher Low in RSI
          if (
            barsBetween >= 5 &&
            barsBetween <= 45 &&
            candles[i].low < prev.price &&
            rsi[i] > prev.rsi + 2.5 &&
            prev.rsi < 42
          ) {
            divergences.push({
              index: i + 2, // Signal erst nach Bestätigung der beiden rechten Pivot-Kerzen
              pivotIndex: i,
              time: candles[i + 2].time,
              type: 'BULL_DIV',
              label: 'Bull. RSI-Divergenz',
              rsi: rsi[i]
            });
          }
        }
        pivotLows.push({ index: i, price: candles[i].low, rsi: rsi[i] });
      }

      if (isHigh) {
        if (pivotHighs.length > 0) {
          const prev = pivotHighs[pivotHighs.length - 1];
          const barsBetween = i - prev.index;
          // Bearish Divergence: Higher High in Price, Lower High in RSI
          if (
            barsBetween >= 5 &&
            barsBetween <= 45 &&
            candles[i].high > prev.price &&
            rsi[i] < prev.rsi - 2.5 &&
            prev.rsi > 58
          ) {
            divergences.push({
              index: i + 2, // Signal erst nach Bestätigung der beiden rechten Pivot-Kerzen
              pivotIndex: i,
              time: candles[i + 2].time,
              type: 'BEAR_DIV',
              label: 'Bear. RSI-Divergenz',
              rsi: rsi[i]
            });
          }
        }
        pivotHighs.push({ index: i, price: candles[i].high, rsi: rsi[i] });
      }
    }

    return { rsi, rsiMA, divergences };
  }

  function calcMACD(candles, fast = 12, slow = 26, sigPeriod = 9) {
    const closes = candles.map((c) => c.close);
    const emaFast = calcEMA(closes, fast);
    const emaSlow = calcEMA(closes, slow);
    const macdLine = new Array(candles.length).fill(null);

    for (let i = 0; i < candles.length; i++) {
      if (emaFast[i] !== null && emaSlow[i] !== null) {
        macdLine[i] = emaFast[i] - emaSlow[i];
      }
    }

    const signalLine = calcEMA(macdLine, sigPeriod);
    const histogram = new Array(candles.length).fill(null);

    for (let i = 0; i < candles.length; i++) {
      if (macdLine[i] !== null && signalLine[i] !== null) {
        histogram[i] = macdLine[i] - signalLine[i];
      }
    }
    return { macdLine, signalLine, histogram };
  }

  function calcVWAP(candles, period = 50) {
    const vwap = new Array(candles.length).fill(null);
    for (let i = 0; i < candles.length; i++) {
      const start = Math.max(0, i - period + 1);
      let pvSum = 0;
      let vSum = 0;
      for (let j = start; j <= i; j++) {
        const typical = (candles[j].high + candles[j].low + candles[j].close) / 3;
        const vol = candles[j].volume || 1;
        pvSum += typical * vol;
        vSum += vol;
      }
      vwap[i] = vSum > 0 ? pvSum / vSum : candles[i].close;
    }
    return vwap;
  }

  function toHeikinAshi(candles) {
    const ha = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen =
        i === 0 ? (c.open + c.close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);
      ha.push({
        time: c.time,
        open: haOpen,
        high: haHigh,
        low: haLow,
        close: haClose,
        volume: c.volume
      });
    }
    return ha;
  }

  /**
   * Detects Pivot Highs/Lows, clusters Support/Resistance zones,
   * and builds upper & lower Auto-Trendlines for the chart.
   */
  function detectPivotsAndSRZones(candles, atrValues, leftBars = 4, rightBars = 4) {
    const n = candles.length;
    const swingHighs = [];
    const swingLows = [];

    for (let i = leftBars; i < n - rightBars; i++) {
      let isHigh = true;
      let isLow = true;
      const h = candles[i].high;
      const l = candles[i].low;

      for (let j = i - leftBars; j <= i + rightBars; j++) {
        if (j === i) continue;
        if (candles[j].high > h) isHigh = false;
        if (candles[j].low < l) isLow = false;
      }
      if (isHigh) {
        swingHighs.push({ index: i, time: candles[i].time, price: h });
      }
      if (isLow) {
        swingLows.push({ index: i, time: candles[i].time, price: l });
      }
    }

    // Cluster pivots into key Support / Resistance horizontal levels
    const currentPrice = candles[n - 1]?.close || 0;
    const currentAtr = atrValues[n - 1] || currentPrice * 0.01;
    const clusterTolerance = currentAtr * 0.75;

    const allPivots = [
      ...swingHighs.map((p) => ({ ...p, kind: 'HIGH' })),
      ...swingLows.map((p) => ({ ...p, kind: 'LOW' }))
    ];

    const clusters = [];
    for (const p of allPivots) {
      let found = null;
      for (const cl of clusters) {
        if (Math.abs(cl.price - p.price) <= clusterTolerance) {
          found = cl;
          break;
        }
      }
      if (found) {
        found.touches += 1;
        found.price = (found.price * (found.touches - 1) + p.price) / found.touches;
        found.lastIndex = Math.max(found.lastIndex, p.index);
      } else {
        clusters.push({
          price: p.price,
          touches: 1,
          lastIndex: p.index
        });
      }
    }

    // Rank clusters by touches and recency
    clusters.sort((a, b) => b.touches * 2 + b.lastIndex / n - (a.touches * 2 + a.lastIndex / n));

    const resistances = clusters
      .filter((c) => c.price > currentPrice * 1.0005)
      .slice(0, 3)
      .sort((a, b) => a.price - b.price)
      .map((c, idx) => ({
        ...c,
        type: 'RESISTANCE',
        label: `Widerstand R${idx + 1} (${c.touches}x)`
      }));

    const supports = clusters
      .filter((c) => c.price < currentPrice * 0.9995)
      .slice(0, 3)
      .sort((a, b) => b.price - a.price)
      .map((c, idx) => ({
        ...c,
        type: 'SUPPORT',
        label: `Support S${idx + 1} (${c.touches}x)`
      }));

    // Build Auto-Trendlines (Upper Resistance Line & Lower Support Line) over the last ~140 bars
    const lookbackStart = Math.max(0, n - 140);
    const recentHighs = swingHighs.filter((p) => p.index >= lookbackStart);
    const recentLows = swingLows.filter((p) => p.index >= lookbackStart);

    const buildTrendline = (pivots) => {
      if (pivots.length < 2) return [];
      const p1 = pivots[Math.max(0, pivots.length - 3)];
      const p2 = pivots[pivots.length - 1];
      if (p2.index <= p1.index) return [];
      const slope = (p2.price - p1.price) / (p2.index - p1.index);
      const linePoints = [];
      for (let i = p1.index; i < n; i++) {
        linePoints.push({
          time: candles[i].time,
          value: p1.price + slope * (i - p1.index)
        });
      }
      return linePoints;
    };

    return {
      swingHighs,
      swingLows,
      supports,
      resistances,
      upperTrendline: buildTrendline(recentHighs),
      lowerTrendline: buildTrendline(recentLows)
    };
  }

  /**
   * Detects classic Japanese Candlestick Patterns + Smart Money BOS / CHoCH
   */
  function detectCandlestickPatterns(candles, atrValues) {
    const patternsByIndex = new Map();
    const n = candles.length;
    if (n < 5) return patternsByIndex;

    const addPattern = (idx, pat) => {
      if (!patternsByIndex.has(idx)) patternsByIndex.set(idx, []);
      patternsByIndex.get(idx).push(pat);
    };

    let lastSwingHigh = null;
    let lastSwingLow = null;
    let marketBias = 0; // 1 = bullish, -1 = bearish

    for (let i = 3; i < n; i++) {
      const c = candles[i];
      const p1 = candles[i - 1];
      const p2 = candles[i - 2];
      const atr = atrValues[i] || Math.abs(c.high - c.low) || 1;

      const body = Math.abs(c.close - c.open);
      const range = Math.max(c.high - c.low, 1e-8);
      const upperWick = c.high - Math.max(c.open, c.close);
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const isBull = c.close > c.open;
      const isBear = c.close < c.open;

      const p1Body = Math.abs(p1.close - p1.open);
      const p1Bull = p1.close > p1.open;
      const p1Bear = p1.close < p1.open;

      // 1. Bullish Engulfing
      if (
        isBull &&
        p1Bear &&
        c.close >= p1.open &&
        c.open <= p1.close &&
        body > p1Body * 1.08 &&
        body > atr * 0.45
      ) {
        addPattern(i, {
          code: 'BULL_ENGULF',
          name: 'Bullish Engulfing',
          short: '⚡ Bull Engulf',
          bias: 1,
          weight: 18
        });
      }

      // 2. Bearish Engulfing
      if (
        isBear &&
        p1Bull &&
        c.close <= p1.open &&
        c.open >= p1.close &&
        body > p1Body * 1.08 &&
        body > atr * 0.45
      ) {
        addPattern(i, {
          code: 'BEAR_ENGULF',
          name: 'Bearish Engulfing',
          short: '⚡ Bear Engulf',
          bias: -1,
          weight: -18
        });
      }

      // 3. Hammer (Pinbar Bullish)
      if (
        lowerWick > body * 2.2 &&
        upperWick < body * 0.8 &&
        range > atr * 0.5 &&
        c.low < p1.low
      ) {
        addPattern(i, {
          code: 'HAMMER',
          name: 'Hammer (Bullish Pinbar)',
          short: '🔨 Hammer',
          bias: 1,
          weight: 14
        });
      }

      // 4. Shooting Star (Pinbar Bearish)
      if (
        upperWick > body * 2.2 &&
        lowerWick < body * 0.8 &&
        range > atr * 0.5 &&
        c.high > p1.high
      ) {
        addPattern(i, {
          code: 'SHOOTING_STAR',
          name: 'Shooting Star (Bearish Pinbar)',
          short: '☄️ ShootStar',
          bias: -1,
          weight: -14
        });
      }

      // 5. Morning Star (3-bar bullish reversal)
      const p2Bear = p2.close < p2.open;
      const p2Body = Math.abs(p2.close - p2.open);
      if (
        p2Bear &&
        p2Body > atr * 0.5 &&
        p1Body < p2Body * 0.45 &&
        isBull &&
        c.close > (p2.open + p2.close) / 2
      ) {
        addPattern(i, {
          code: 'MORNING_STAR',
          name: 'Morning Star',
          short: '✨ Morning Star',
          bias: 1,
          weight: 20
        });
      }

      // 6. Evening Star (3-bar bearish reversal)
      const p2Bull = p2.close > p2.open;
      if (
        p2Bull &&
        p2Body > atr * 0.5 &&
        p1Body < p2Body * 0.45 &&
        isBear &&
        c.close < (p2.open + p2.close) / 2
      ) {
        addPattern(i, {
          code: 'EVENING_STAR',
          name: 'Evening Star',
          short: '🌑 Evening Star',
          bias: -1,
          weight: -20
        });
      }

      // 7. Smart Money Liquidity Sweep (Stop-Hunt below recent swing low / above swing high)
      if (i >= 12) {
        let priorLow = Infinity;
        let priorHigh = -Infinity;
        for (let k = i - 12; k <= i - 2; k++) {
          if (candles[k].low < priorLow) priorLow = candles[k].low;
          if (candles[k].high > priorHigh) priorHigh = candles[k].high;
        }
        // Bullish Sweep: Wick pierces below prior 10-bar low, but candle closes back above priorLow!
        if (c.low < priorLow && c.close > priorLow && lowerWick > atr * 0.25) {
          addPattern(i, {
            code: 'LIQ_SWEEP_BULL',
            name: 'Liquidity Sweep Bull (Stop-Hunt Tief)',
            short: '💧 Sweep ▲',
            bias: 1,
            weight: 25
          });
        }
        // Bearish Sweep: Wick pierces above prior 10-bar high, but candle closes back below priorHigh!
        if (c.high > priorHigh && c.close < priorHigh && upperWick > atr * 0.25) {
          addPattern(i, {
            code: 'LIQ_SWEEP_BEAR',
            name: 'Liquidity Sweep Bear (Stop-Hunt Hoch)',
            short: '💧 Sweep ▼',
            bias: -1,
            weight: -25
          });
        }
      }

      // 8. 0.882 Fibonacci + LSOB (Liquidity Sweep Order Block) Sniper Setup
      if (i >= 24) {
        const lookbackStart = Math.max(2, i - 42);
        let sLow = Infinity;
        let sLowIdx = -1;
        let sHigh = -Infinity;
        let sHighIdx = -1;

        for (let k = lookbackStart; k <= i - 2; k++) {
          if (candles[k].low < sLow) {
            sLow = candles[k].low;
            sLowIdx = k;
          }
          if (candles[k].high > sHigh) {
            sHigh = candles[k].high;
            sHighIdx = k;
          }
        }

        const swingSpan = sHigh - sLow;
        if (swingSpan >= atr * 2.0) {
          // Case A: Upward impulse (Swing Low -> Swing High), now pulling back into 0.786 - 0.882 LSOB Discount Zone
          if (sLowIdx < sHighIdx && i > sHighIdx) {
            const fib786 = sHigh - swingSpan * 0.786;
            const fib882 = sHigh - swingSpan * 0.882;
            const fib950 = sHigh - swingSpan * 0.955;

            // Check if price wicked into the deep 0.786 - 0.882 zone, held above the 1.0 origin (sLow), and rejected upward
            const touchedDeepPocket = c.low <= fib786 && c.low >= sLow - atr * 0.15;
            const heldStructure = c.close > fib950 && c.close > sLow;
            const rejectedUp = (isBull && c.close >= fib882) || (lowerWick >= range * 0.32 && c.close >= fib882);

            if (touchedDeepPocket && heldStructure && rejectedUp) {
              // Check if the Swing Low origin swept prior liquidity (LSOB)
              let originSwept = false;
              for (let m = Math.max(0, sLowIdx - 8); m < sLowIdx; m++) {
                if (sLow < candles[m].low && candles[sLowIdx].close >= candles[m].low) {
                  originSwept = true;
                  break;
                }
              }
              addPattern(i, {
                code: 'FIB_882_LSOB_BULL',
                name: originSwept
                  ? '0.882 Fib + LSOB Bullish Sniper (mit Origin Liquidity Sweep)'
                  : '0.882 Fib + Orderblock Bullish Retracement',
                short: '🎯 882+LSOB ▲',
                bias: 1,
                weight: originSwept ? 32 : 27
              });
            }
          }

          // Case B: Downward impulse (Swing High -> Swing Low), now rallying into 0.786 - 0.882 LSOB Premium Zone
          if (sHighIdx < sLowIdx && i > sLowIdx) {
            const fib786 = sLow + swingSpan * 0.786;
            const fib882 = sLow + swingSpan * 0.882;
            const fib950 = sLow + swingSpan * 0.955;

            const touchedDeepPocket = c.high >= fib786 && c.high <= sHigh + atr * 0.15;
            const heldStructure = c.close < fib950 && c.close < sHigh;
            const rejectedDown = (isBear && c.close <= fib882) || (upperWick >= range * 0.32 && c.close <= fib882);

            if (touchedDeepPocket && heldStructure && rejectedDown) {
              let originSwept = false;
              for (let m = Math.max(0, sHighIdx - 8); m < sHighIdx; m++) {
                if (sHigh > candles[m].high && candles[sHighIdx].close <= candles[m].high) {
                  originSwept = true;
                  break;
                }
              }
              addPattern(i, {
                code: 'FIB_882_LSOB_BEAR',
                name: originSwept
                  ? '0.882 Fib + LSOB Bearish Sniper (mit Origin Liquidity Sweep)'
                  : '0.882 Fib + Orderblock Bearish Retracement',
                short: '🎯 882 Fib ▼',
                bias: -1,
                weight: originSwept ? -32 : -27
              });
            }
          }
        }
      }

      // 9. Standalone LSOB Strategy (Wick-to-Wick Orderblock of Swing High/Low Candle + Liquidity Sweep Retest)
      if (i >= 18) {
        const obStart = Math.max(3, i - 55);
        // A) Look for an intact Bullish LSOB (lowest candle of a swing low that caused an upward impulse)
        let bestBullIdx = -1;
        let lowestVal = Infinity;
        for (let k = obStart; k <= i - 5; k++) {
          const ck = candles[k];
          if (
            ck.low <= candles[k - 1].low &&
            ck.low <= candles[k - 2].low &&
            ck.low <= candles[k + 1].low &&
            ck.low <= candles[k + 2].low &&
            ck.low < lowestVal
          ) {
            // Check upward displacement after this swing low candle
            let maxAfter = ck.high;
            for (let m = k + 1; m <= Math.min(i - 2, k + 8); m++) {
              if (candles[m].high > maxAfter) maxAfter = candles[m].high;
            }
            if (maxAfter - ck.low >= atr * 1.5) {
              // Ensure no candle between k+2 and i-1 closed decisively below ck.low (unbroken LSOB)
              let broken = false;
              for (let m = k + 2; m <= i - 1; m++) {
                if (candles[m].close < ck.low - atr * 0.1) {
                  broken = true;
                  break;
                }
              }
              if (!broken) {
                lowestVal = ck.low;
                bestBullIdx = k;
              }
            }
          }
        }

        if (bestBullIdx !== -1) {
          const obCandle = candles[bestBullIdx];
          const obLow = obCandle.low;
          const obHigh = Math.min(obCandle.high, obLow + atr * 1.25);

          // Current candle i dips into the Wick-to-Wick Bullish LSOB (or sweeps just below its top/bottom) and rejects up
          const wickedIntoBullLSOB = c.low <= obHigh && c.low >= obLow - atr * 0.25;
          const bodyHeldAboveLow = c.close > obLow && Math.min(c.open, c.close) >= obLow - atr * 0.05;
          const bullRejection = (isBull && c.close >= (obLow + obHigh) / 2) || lowerWick >= range * 0.35;

          if (wickedIntoBullLSOB && bodyHeldAboveLow && bullRejection) {
            addPattern(i, {
              code: 'LSOB_BULL',
              name: 'Bullish LSOB Retest + Liquidity Sweep (Wick-to-Wick Orderblock)',
              short: '🧱 LSOB ▲',
              bias: 1,
              weight: 34,
              obLow,
              obHigh
            });
          }
        }

        // B) Look for an intact Bearish LSOB (highest candle of a swing high that caused a downward impulse)
        let bestBearIdx = -1;
        let highestVal = -Infinity;
        for (let k = obStart; k <= i - 5; k++) {
          const ck = candles[k];
          if (
            ck.high >= candles[k - 1].high &&
            ck.high >= candles[k - 2].high &&
            ck.high >= candles[k + 1].high &&
            ck.high >= candles[k + 2].high &&
            ck.high > highestVal
          ) {
            let minAfter = ck.low;
            for (let m = k + 1; m <= Math.min(i - 2, k + 8); m++) {
              if (candles[m].low < minAfter) minAfter = candles[m].low;
            }
            if (ck.high - minAfter >= atr * 1.5) {
              let broken = false;
              for (let m = k + 2; m <= i - 1; m++) {
                if (candles[m].close > ck.high + atr * 0.1) {
                  broken = true;
                  break;
                }
              }
              if (!broken) {
                highestVal = ck.high;
                bestBearIdx = k;
              }
            }
          }
        }

        if (bestBearIdx !== -1) {
          const obCandle = candles[bestBearIdx];
          const obHigh = obCandle.high;
          const obLow = Math.max(obCandle.low, obHigh - atr * 1.25);

          // Current candle i spikes into the Wick-to-Wick Bearish LSOB and rejects down
          const wickedIntoBearLSOB = c.high >= obLow && c.high <= obHigh + atr * 0.25;
          const bodyHeldBelowHigh = c.close < obHigh && Math.max(c.open, c.close) <= obHigh + atr * 0.05;
          const bearRejection = (isBear && c.close <= (obLow + obHigh) / 2) || upperWick >= range * 0.35;

          if (wickedIntoBearLSOB && bodyHeldBelowHigh && bearRejection) {
            addPattern(i, {
              code: 'LSOB_BEAR',
              name: 'Bearish LSOB Retest + Liquidity Sweep (Wick-to-Wick Orderblock)',
              short: '🧱 LSOB ▼',
              bias: -1,
              weight: -34,
              obLow,
              obHigh
            });
          }
        }
      }

      // Track local structure for BOS / CHoCH
      if (i >= 5) {
        const idxPivot = i - 2;
        const cp = candles[idxPivot];
        if (
          cp.high > candles[idxPivot - 1].high &&
          cp.high > candles[idxPivot - 2].high &&
          cp.high > candles[idxPivot + 1].high &&
          cp.high > candles[idxPivot + 2].high
        ) {
          lastSwingHigh = cp.high;
        }
        if (
          cp.low < candles[idxPivot - 1].low &&
          cp.low < candles[idxPivot - 2].low &&
          cp.low < candles[idxPivot + 1].low &&
          cp.low < candles[idxPivot + 2].low
        ) {
          lastSwingLow = cp.low;
        }

        if (lastSwingHigh && c.close > lastSwingHigh && p1.close <= lastSwingHigh) {
          const isChoch = marketBias === -1;
          addPattern(i, {
            code: isChoch ? 'CHOCH_BULL' : 'BOS_BULL',
            name: isChoch ? 'Bullish CHoCH (Trendwechsel)' : 'Bullish BOS (Strukturbruch)',
            short: isChoch ? 'CHoCH ▲' : 'BOS ▲',
            bias: 1,
            weight: isChoch ? 22 : 15
          });
          marketBias = 1;
          lastSwingHigh = null;
        } else if (lastSwingLow && c.close < lastSwingLow && p1.close >= lastSwingLow) {
          const isChoch = marketBias === 1;
          addPattern(i, {
            code: isChoch ? 'CHOCH_BEAR' : 'BOS_BEAR',
            name: isChoch ? 'Bearish CHoCH (Trendwechsel)' : 'Bearish BOS (Strukturbruch)',
            short: isChoch ? 'CHoCH ▼' : 'BOS ▼',
            bias: -1,
            weight: isChoch ? -22 : -15
          });
          marketBias = -1;
          lastSwingLow = null;
        }
      }
    }

    return patternsByIndex;
  }

  /**
   * 0.882 Fibonacci Retracement + LSOB (Liquidity Sweep Order Block) Calculator
   * Computes both Bullish (Long @ 0.882 Discount + Bull LSOB) and Bearish (Short @ 0.882 Premium + Bear LSOB)
   * setups for the current chart state.
   */
  function calcFibAndLSOB(candles, atrValues) {
    if (!candles || candles.length < 30) return null;
    const len = candles.length;
    const lastIdx = len - 1;
    const price = candles[lastIdx].close;
    const atr = atrValues[lastIdx] || price * 0.01;

    // Helper: Build Bullish Fib (1.0 = Swing Low below price, 0.0 = Swing High above/near price)
    function findBullishFib() {
      const windows = [60, 100, 160];
      for (const win of windows) {
        const start = Math.max(2, len - win);
        let sLow = Infinity;
        let sLowIdx = -1;
        for (let i = start; i <= lastIdx - 2; i++) {
          if (candles[i].low < sLow) {
            sLow = candles[i].low;
            sLowIdx = i;
          }
        }
        // Find highest high after sLowIdx (or overall in window if sLowIdx is very recent)
        let sHigh = -Infinity;
        let sHighIdx = -1;
        const highSearchStart = sLowIdx < lastIdx - 4 ? sLowIdx : start;
        for (let i = highSearchStart; i <= lastIdx; i++) {
          if (candles[i].high > sHigh) {
            sHigh = candles[i].high;
            sHighIdx = i;
          }
        }

        const span = sHigh - sLow;
        if (span < atr * 1.8) continue;

        const fib882 = sHigh - span * 0.882;
        // Ensure the 0.882 level is below current price (or within 0.15 ATR if actively testing right now)
        if (fib882 <= price - atr * 0.25 && sLow < price) {
          const originCandle = candles[sLowIdx] || candles[lastIdx];
          let sweptLiquidity = false;
          for (let m = Math.max(0, sLowIdx - 10); m < sLowIdx; m++) {
            if (sLow < candles[m].low && originCandle.close >= candles[m].low) {
              sweptLiquidity = true;
              break;
            }
          }
          const fib500 = sHigh - span * 0.5;
          const fib618 = sHigh - span * 0.618;
          const fib786 = sHigh - span * 0.786;
          const lsobHigh = Math.max(fib882, Math.min(fib786, Math.max(originCandle.open, originCandle.close)));
          const lsobLow = sLow;

          return {
            direction: 'BULL',
            swingLow: sLow,
            swingLowIdx: sLowIdx,
            swingHigh: sHigh,
            swingHighIdx: sHighIdx,
            span,
            fib0: sHigh,
            fib382: sHigh - span * 0.382,
            fib500,
            fib618,
            fib786,
            fib882,
            fib1000: sLow,
            lsobHigh,
            lsobLow,
            lsobEntry: fib882,
            stopLoss: sLow - atr * 0.28,
            sweptLiquidity,
            inZoneNow: price <= fib786 + atr * 0.25 && price >= sLow
          };
        }
      }

      // Fallback synthetic structural swing below current price if price is at all-time multi-bar lows
      const synthLow = price - atr * 2.4;
      let recentHigh = price + atr * 1.2;
      for (let i = Math.max(0, len - 35); i <= lastIdx; i++) {
        if (candles[i].high > recentHigh) recentHigh = candles[i].high;
      }
      const span = recentHigh - synthLow;
      const fib786 = recentHigh - span * 0.786;
      const fib882 = recentHigh - span * 0.882;
      return {
        direction: 'BULL',
        swingLow: synthLow,
        swingLowIdx: lastIdx - 15,
        swingHigh: recentHigh,
        swingHighIdx: lastIdx - 5,
        span,
        fib0: recentHigh,
        fib382: recentHigh - span * 0.382,
        fib500: recentHigh - span * 0.5,
        fib618: recentHigh - span * 0.618,
        fib786,
        fib882,
        fib1000: synthLow,
        lsobHigh: fib786,
        lsobLow: synthLow,
        lsobEntry: fib882,
        stopLoss: synthLow - atr * 0.28,
        sweptLiquidity: false,
        inZoneNow: false
      };
    }

    // Helper: Build Bearish Fib (1.0 = Swing High above price, 0.0 = Swing Low below/near price)
    function findBearishFib() {
      const windows = [60, 100, 160];
      for (const win of windows) {
        const start = Math.max(2, len - win);
        let sHigh = -Infinity;
        let sHighIdx = -1;
        for (let i = start; i <= lastIdx - 2; i++) {
          if (candles[i].high > sHigh) {
            sHigh = candles[i].high;
            sHighIdx = i;
          }
        }
        let sLow = Infinity;
        let sLowIdx = -1;
        const lowSearchStart = sHighIdx < lastIdx - 4 ? sHighIdx : start;
        for (let i = lowSearchStart; i <= lastIdx; i++) {
          if (candles[i].low < sLow) {
            sLow = candles[i].low;
            sLowIdx = i;
          }
        }

        const span = sHigh - sLow;
        if (span < atr * 1.8) continue;

        const fib882 = sLow + span * 0.882;
        if (fib882 >= price + atr * 0.25 && sHigh > price) {
          const originCandle = candles[sHighIdx] || candles[lastIdx];
          let sweptLiquidity = false;
          for (let m = Math.max(0, sHighIdx - 10); m < sHighIdx; m++) {
            if (sHigh > candles[m].high && originCandle.close <= candles[m].high) {
              sweptLiquidity = true;
              break;
            }
          }
          const fib500 = sLow + span * 0.5;
          const fib618 = sLow + span * 0.618;
          const fib786 = sLow + span * 0.786;
          const lsobLow = Math.min(fib882, Math.max(fib786, Math.min(originCandle.open, originCandle.close)));
          const lsobHigh = sHigh;

          return {
            direction: 'BEAR',
            swingHigh: sHigh,
            swingHighIdx: sHighIdx,
            swingLow: sLow,
            swingLowIdx: sLowIdx,
            span,
            fib0: sLow,
            fib382: sLow + span * 0.382,
            fib500,
            fib618,
            fib786,
            fib882,
            fib1000: sHigh,
            lsobLow,
            lsobHigh,
            lsobEntry: fib882,
            stopLoss: sHigh + atr * 0.28,
            sweptLiquidity,
            inZoneNow: price >= fib786 - atr * 0.25 && price <= sHigh
          };
        }
      }

      const synthHigh = price + atr * 2.4;
      let recentLow = price - atr * 1.2;
      for (let i = Math.max(0, len - 35); i <= lastIdx; i++) {
        if (candles[i].low < recentLow) recentLow = candles[i].low;
      }
      const span = synthHigh - recentLow;
      const fib786 = recentLow + span * 0.786;
      const fib882 = recentLow + span * 0.882;
      return {
        direction: 'BEAR',
        swingHigh: synthHigh,
        swingHighIdx: lastIdx - 15,
        swingLow: recentLow,
        swingLowIdx: lastIdx - 5,
        span,
        fib0: recentLow,
        fib382: recentLow + span * 0.382,
        fib500: recentLow + span * 0.5,
        fib618: recentLow + span * 0.618,
        fib786,
        fib882,
        fib1000: synthHigh,
        lsobLow: fib786,
        lsobHigh: synthHigh,
        lsobEntry: fib882,
        stopLoss: synthHigh + atr * 0.28,
        sweptLiquidity: false,
        inZoneNow: false
      };
    }

    const bullish = findBullishFib();
    const bearish = findBearishFib();

    // Determine which 0.882 Fib setup price is currently closer to testing
    const distToBull882 = Math.abs(price - bullish.fib882);
    const distToBear882 = Math.abs(bearish.fib882 - price);
    const primary = distToBull882 <= distToBear882 ? bullish : bearish;

    return {
      bullish,
      bearish,
      primary,
      distToBull882,
      distToBear882
    };
  }

  /**
   * Dedicated LSOB (Liquidity Sweep Order Block) Zone Calculator
   * Draws the Wick-to-Wick Orderblock of the highest candle at the Swing High (Bearish LSOB)
   * and the lowest candle at the Swing Low (Bullish LSOB), exactly as taught in the LSOB Bootcamp.
   */
  function calcLSOBZones(candles, atrValues) {
    if (!candles || candles.length < 30) return null;
    const len = candles.length;
    const lastIdx = len - 1;
    const price = candles[lastIdx].close;
    const atr = atrValues[lastIdx] || price * 0.01;

    function findBullishLSOB() {
      const windows = [75, 130, 200];
      for (const win of windows) {
        const start = Math.max(3, len - win);
        let bestIdx = -1;
        let bestDist = Infinity;

        for (let k = lastIdx - 3; k >= start; k--) {
          const ck = candles[k];
          const isSwingLow =
            ck.low <= candles[k - 1].low &&
            ck.low <= candles[k - 2].low &&
            ck.low <= candles[k + 1].low &&
            ck.low <= candles[k + 2].low;
          if (!isSwingLow) continue;

          const obLow = ck.low;
          const obHigh = Math.max(obLow + atr * 0.35, Math.min(ck.high, obLow + atr * 1.15));
          const obEntry = obLow + (obHigh - obLow) * 0.8;

          // Must lie below current price so it acts as a future Bullish LSOB retest zone
          if (obEntry > price - atr * 0.28 || obLow >= price) continue;

          // Check that an upward impulse followed this candle
          let maxAfter = ck.high;
          for (let m = k + 1; m <= Math.min(lastIdx, k + 10); m++) {
            if (candles[m].high > maxAfter) maxAfter = candles[m].high;
          }
          if (maxAfter - obLow < atr * 1.4) continue;

          // Check that the LSOB was not invalidated by a decisive close below obLow
          let broken = false;
          for (let m = k + 2; m <= lastIdx; m++) {
            if (candles[m].close < obLow - atr * 0.12) {
              broken = true;
              break;
            }
          }
          if (broken) continue;

          const dist = price - obEntry;
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = k;
          }
        }

        if (bestIdx !== -1) {
          const ck = candles[bestIdx];
          const obLow = ck.low;
          const obHigh = Math.max(obLow + atr * 0.35, Math.min(ck.high, obLow + atr * 1.15));
          const entry = obLow + (obHigh - obLow) * 0.8;
          return {
            direction: 'BULL',
            candleIndex: bestIdx,
            time: ck.time,
            obLow,
            obHigh,
            entry,
            stopLoss: obLow - atr * 0.25,
            topLine: [
              { time: ck.time, value: obHigh },
              { time: candles[lastIdx].time, value: obHigh }
            ],
            bottomLine: [
              { time: ck.time, value: obLow },
              { time: candles[lastIdx].time, value: obLow }
            ]
          };
        }
      }

      // Fallback structural Bullish LSOB below price
      const obHigh = price - atr * 0.85;
      const obLow = obHigh - atr * 0.75;
      const startT = candles[Math.max(0, lastIdx - 25)].time;
      return {
        direction: 'BULL',
        candleIndex: Math.max(0, lastIdx - 25),
        time: startT,
        obLow,
        obHigh,
        entry: obLow + (obHigh - obLow) * 0.8,
        stopLoss: obLow - atr * 0.25,
        topLine: [
          { time: startT, value: obHigh },
          { time: candles[lastIdx].time, value: obHigh }
        ],
        bottomLine: [
          { time: startT, value: obLow },
          { time: candles[lastIdx].time, value: obLow }
        ]
      };
    }

    function findBearishLSOB() {
      const windows = [75, 130, 200];
      for (const win of windows) {
        const start = Math.max(3, len - win);
        let bestIdx = -1;
        let bestDist = Infinity;

        for (let k = lastIdx - 3; k >= start; k--) {
          const ck = candles[k];
          const isSwingHigh =
            ck.high >= candles[k - 1].high &&
            ck.high >= candles[k - 2].high &&
            ck.high >= candles[k + 1].high &&
            ck.high >= candles[k + 2].high;
          if (!isSwingHigh) continue;

          const obHigh = ck.high;
          const obLow = Math.min(obHigh - atr * 0.35, Math.max(ck.low, obHigh - atr * 1.15));
          const obEntry = obHigh - (obHigh - obLow) * 0.8;

          // Must lie above current price so it acts as a future Bearish LSOB retest zone
          if (obEntry < price + atr * 0.28 || obHigh <= price) continue;

          let minAfter = ck.low;
          for (let m = k + 1; m <= Math.min(lastIdx, k + 10); m++) {
            if (candles[m].low < minAfter) minAfter = candles[m].low;
          }
          if (obHigh - minAfter < atr * 1.4) continue;

          let broken = false;
          for (let m = k + 2; m <= lastIdx; m++) {
            if (candles[m].close > obHigh + atr * 0.12) {
              broken = true;
              break;
            }
          }
          if (broken) continue;

          const dist = obEntry - price;
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = k;
          }
        }

        if (bestIdx !== -1) {
          const ck = candles[bestIdx];
          const obHigh = ck.high;
          const obLow = Math.min(obHigh - atr * 0.35, Math.max(ck.low, obHigh - atr * 1.15));
          const entry = obHigh - (obHigh - obLow) * 0.8;
          return {
            direction: 'BEAR',
            candleIndex: bestIdx,
            time: ck.time,
            obLow,
            obHigh,
            entry,
            stopLoss: obHigh + atr * 0.25,
            topLine: [
              { time: ck.time, value: obHigh },
              { time: candles[lastIdx].time, value: obHigh }
            ],
            bottomLine: [
              { time: ck.time, value: obLow },
              { time: candles[lastIdx].time, value: obLow }
            ]
          };
        }
      }

      const obLow = price + atr * 0.85;
      const obHigh = obLow + atr * 0.75;
      const startT = candles[Math.max(0, lastIdx - 25)].time;
      return {
        direction: 'BEAR',
        candleIndex: Math.max(0, lastIdx - 25),
        time: startT,
        obLow,
        obHigh,
        entry: obHigh - (obHigh - obLow) * 0.8,
        stopLoss: obHigh + atr * 0.25,
        topLine: [
          { time: startT, value: obHigh },
          { time: candles[lastIdx].time, value: obHigh }
        ],
        bottomLine: [
          { time: startT, value: obLow },
          { time: candles[lastIdx].time, value: obLow }
        ]
      };
    }

    const bullish = findBullishLSOB();
    const bearish = findBearishLSOB();

    return {
      bullish,
      bearish
    };
  }

  /**
   * Master calculation function returning all indicators for a candle array
   */
  function computeAll(candles) {
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume || 0);

    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, 200);
    const volSMA20 = calcSMA(volumes, 20);
    const atr14 = calcATR(candles, 14);
    const bb = calcBollingerBands(candles, 20, 2);
    const rsiData = calcRSI(candles, 14);
    const macdData = calcMACD(candles, 12, 26, 9);
    const vwap = calcVWAP(candles, 50);
    const srData = detectPivotsAndSRZones(candles, atr14, 4, 4);
    const patterns = detectCandlestickPatterns(candles, atr14);
    const fibData = calcFibAndLSOB(candles, atr14);
    const lsobData = calcLSOBZones(candles, atr14);

    return {
      ema20,
      ema50,
      ema200,
      volSMA20,
      atr14,
      bb,
      rsiData,
      macdData,
      vwap,
      srData,
      patterns,
      fibData,
      lsobData
    };
  }

  return {
    calcSMA,
    calcEMA,
    calcATR,
    calcBollingerBands,
    calcRSI,
    calcMACD,
    calcVWAP,
    toHeikinAshi,
    detectPivotsAndSRZones,
    detectCandlestickPatterns,
    calcFibAndLSOB,
    calcLSOBZones,
    computeAll
  };
})();

export const Indicators = window.Indicators;
