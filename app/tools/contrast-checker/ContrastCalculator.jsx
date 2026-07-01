"use client";

import React, { useState, useMemo } from 'react';
import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";
import mixPlugin from "colord/plugins/mix";

extend([namesPlugin, mixPlugin]);

// --- Core WCAG 2.2 Engine ---
const getRgb = (hex) => colord(hex).toRgb();

const getLuminance = (r, g, b) => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const getContrastRatio = (hex1, hex2) => {
  const c1 = getRgb(hex1);
  const c2 = getRgb(hex2);
  const l1 = getLuminance(c1.r, c1.g, c1.b);
  const l2 = getLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const getContrastDescription = (r) => {
  if (r >= 7.0) return "Very high contrast";
  if (r >= 4.5) return "High contrast";
  if (r >= 3.0) return "Medium contrast";
  return "Very low contrast";
};

// --- Accessible Alternatives Generators ---
// --- Helper for Diverse Suggestions selection ---
const selectFourDiverseSuggestions = (candidates, originalHue, targetRatio) => {
  if (candidates.length === 0) return [];

  // Deduplicate candidates by hex first
  const seen = new Set();
  const uniqueCandidates = [];
  for (const c of candidates) {
    const hex = c.hex.toUpperCase();
    if (!seen.has(hex)) {
      seen.add(hex);
      uniqueCandidates.push({ hex, ratio: c.ratio });
    }
  }

  // Define hue sectors (sectors of 60 degrees: Red, Yellow, Green, Cyan, Blue, Magenta)
  // and a Neutral sector for low-saturation colors
  const sectors = {
    neutral: [],
    red: [],     // 330 to 30
    yellow: [],  // 30 to 90
    green: [],   // 90 to 150
    cyan: [],    // 150 to 210
    blue: [],    // 210 to 270
    magenta: []  // 270 to 330
  };

  uniqueCandidates.forEach(c => {
    const col = colord(c.hex);
    const hsl = col.toHsl();
    if (hsl.s < 12) {
      sectors.neutral.push(c);
    } else {
      const h = hsl.h;
      if (h >= 330 || h < 30) sectors.red.push(c);
      else if (h >= 30 && h < 90) sectors.yellow.push(c);
      else if (h >= 90 && h < 150) sectors.green.push(c);
      else if (h >= 150 && h < 210) sectors.cyan.push(c);
      else if (h >= 210 && h < 270) sectors.blue.push(c);
      else sectors.magenta.push(c);
    }
  });

  // Sort candidates in each sector by closeness to targetRatio
  Object.keys(sectors).forEach(key => {
    sectors[key].sort((a, b) => Math.abs(a.ratio - targetRatio) - Math.abs(b.ratio - targetRatio));
  });

  // Identify non-empty sectors
  const activeSectors = Object.keys(sectors).filter(key => sectors[key].length > 0);

  const selected = [];

  // Determine original hue sector
  const originalHsl = colord(colord(originalHue).isValid() ? originalHue : '#0A0A0A').toHsl();
  let originalSectorKey = 'neutral';
  if (originalHsl.s >= 12) {
    const h = originalHsl.h;
    if (h >= 330 || h < 30) originalSectorKey = 'red';
    else if (h >= 30 && h < 90) originalSectorKey = 'yellow';
    else if (h >= 90 && h < 150) originalSectorKey = 'green';
    else if (h >= 150 && h < 210) originalSectorKey = 'cyan';
    else if (h >= 210 && h < 270) originalSectorKey = 'blue';
    else originalSectorKey = 'magenta';
  }

  // Reorder activeSectors to prioritize the original sector key
  const orderedSectors = [];
  if (activeSectors.includes(originalSectorKey)) {
    orderedSectors.push(originalSectorKey);
  }
  activeSectors.forEach(s => {
    if (s !== originalSectorKey) orderedSectors.push(s);
  });

  // 1. Take the first item from each sector (hue diversity)
  orderedSectors.forEach(s => {
    if (selected.length < 4 && sectors[s].length > 0) {
      selected.push(sectors[s][0]);
    }
  });

  // 2. If we need more, take the next shades from active sectors round-robin
  let iteration = 1;
  while (selected.length < 4) {
    let addedInThisRound = false;
    for (const s of orderedSectors) {
      if (selected.length < 4 && sectors[s].length > iteration) {
        selected.push(sectors[s][iteration]);
        addedInThisRound = true;
      }
    }
    if (!addedInThisRound) break;
    iteration++;
  }

  // 3. Fallback to any remaining unique candidates
  for (const c of uniqueCandidates) {
    if (selected.length < 4 && !selected.some(s => s.hex === c.hex)) {
      selected.push(c);
    }
  }

  return selected.sort((a, b) => Math.abs(a.ratio - targetRatio) - Math.abs(b.ratio - targetRatio));
};

// --- Accessible Alternatives Generators ---
const getBackgroundAlternatives = (fgHex, bgHex, filterMin, targetRatio) => {
  if (!colord(fgHex).isValid() || !colord(bgHex).isValid()) return [];
  const fgHsl = colord(fgHex).toHsl();
  const bgHsl = colord(bgHex).toHsl();
  const candidates = [];

  const hues = [
    bgHsl.h,
    (bgHsl.h + 30) % 360,
    (bgHsl.h - 30 + 360) % 360,
    (bgHsl.h + 120) % 360,
    (bgHsl.h + 180) % 360,
    (bgHsl.h + 240) % 360
  ];

  hues.forEach(h => {
    [bgHsl.s, Math.max(10, bgHsl.s - 25), 8].forEach(s => {
      for (let l = 5; l <= 95; l += 5) {
        const hex = colord({ h, s, l }).toHex().toUpperCase();
        const r = getContrastRatio(fgHex, hex);
        if (r >= filterMin) {
          candidates.push({ hex, ratio: r });
        }
      }
    });
  });

  ['#FFFFFF', '#F9FAFB', '#F3F4F6', '#E5E7EB', '#1F2937', '#111827', '#090D16'].forEach(hex => {
    const r = getContrastRatio(fgHex, hex);
    if (r >= filterMin) {
      candidates.push({ hex, ratio: r });
    }
  });

  return selectFourDiverseSuggestions(candidates, bgHex, targetRatio);
};

const getForegroundAlternatives = (fgHex, bgHex, filterMin, targetRatio) => {
  if (!colord(fgHex).isValid() || !colord(bgHex).isValid()) return [];
  const fgHsl = colord(fgHex).toHsl();
  const bgHsl = colord(bgHex).toHsl();
  const candidates = [];

  const hues = [
    fgHsl.h,
    (fgHsl.h + 30) % 360,
    (fgHsl.h - 30 + 360) % 360,
    (fgHsl.h + 120) % 360,
    (fgHsl.h + 180) % 360,
    (fgHsl.h + 240) % 360
  ];

  hues.forEach(h => {
    [fgHsl.s, Math.max(10, fgHsl.s - 25), 8].forEach(s => {
      for (let l = 5; l <= 95; l += 5) {
        const hex = colord({ h, s, l }).toHex().toUpperCase();
        const r = getContrastRatio(hex, bgHex);
        if (r >= filterMin) {
          candidates.push({ hex, ratio: r });
        }
      }
    });
  });

  ['#000000', '#111827', '#1F2937', '#FFFFFF', '#F9FAFB', '#F3F4F6'].forEach(hex => {
    const r = getContrastRatio(hex, bgHex);
    if (r >= filterMin) {
      candidates.push({ hex, ratio: r });
    }
  });

  return selectFourDiverseSuggestions(candidates, fgHex, targetRatio);
};

const getCombinationAlternatives = (fgHex, bgHex, filterMin, targetRatio) => {
  if (!colord(fgHex).isValid() || !colord(bgHex).isValid()) return [];
  const fgHsl = colord(fgHex).toHsl();
  const bgHsl = colord(bgHex).toHsl();
  const combinations = [];

  const bgHues = [bgHsl.h, (bgHsl.h + 180) % 360, (bgHsl.h + 120) % 360, 220, 0];
  const fgHues = [fgHsl.h, (fgHsl.h + 180) % 360, (fgHsl.h + 30) % 360, 40, 0];

  bgHues.forEach(bh => {
    fgHues.forEach(fh => {
      {
        const bgCand = colord({ h: bh, s: Math.max(5, bgHsl.s - 15), l: 96 }).toHex().toUpperCase();
        const fgCand = colord({ h: fh, s: Math.max(15, fgHsl.s), l: 15 }).toHex().toUpperCase();
        const r = getContrastRatio(fgCand, bgCand);
        if (r >= filterMin) {
          combinations.push({ fg: fgCand, bg: bgCand, ratio: r });
        }
      }
      {
        const bgCand = colord({ h: bh, s: Math.max(10, bgHsl.s), l: 12 }).toHex().toUpperCase();
        const fgCand = colord({ h: fh, s: Math.max(5, fgHsl.s - 15), l: 92 }).toHex().toUpperCase();
        const r = getContrastRatio(fgCand, bgCand);
        if (r >= filterMin) {
          combinations.push({ fg: fgCand, bg: bgCand, ratio: r });
        }
      }
    });
  });

  const presets = [
    { fg: '#0A0A0A', bg: '#FFFFFF' },
    { fg: '#FFFFFF', bg: '#0A0A0A' },
    { fg: '#1E3A8A', bg: '#F0F9FF' },
    { fg: '#065F46', bg: '#ECFDF5' },
    { fg: '#991B1B', bg: '#FEF2F2' },
    { fg: '#F59E0B', bg: '#1F2937' },
    { fg: '#10B981', bg: '#064E3B' },
  ];

  presets.forEach(p => {
    const r = getContrastRatio(p.fg, p.bg);
    if (r >= filterMin) {
      combinations.push({ fg: p.fg, bg: p.bg, ratio: r });
    }
  });

  const seen = new Set();
  const unique = [];
  combinations.sort((a, b) => Math.abs(a.ratio - targetRatio) - Math.abs(b.ratio - targetRatio));
  for (const c of combinations) {
    const key = `${c.fg}-${c.bg}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique.slice(0, 4); // Always exactly 4 combinations
};

const parseColorInput = (val) => {
  const trimmed = val.trim();

  // Remove degree symbol which is common in HSL displays
  const cleanVal = trimmed.replace(/°/g, '');

  // 1. Direct match with colord validity (e.g. rgb(255, 255, 255), hsl(0, 0%, 4%), #ffffff, red)
  if (colord(cleanVal).isValid()) {
    return colord(cleanVal).toHex().toUpperCase();
  }

  // 2. Comma-separated values check
  const commaMatch = cleanVal.match(/^(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?$/);
  if (commaMatch) {
    const v1 = commaMatch[1];
    const v2 = commaMatch[2];
    const v3 = commaMatch[3];

    // If it contains a percent symbol, it is HSL
    if (cleanVal.includes('%')) {
      const hslStr = `hsl(${v1}, ${v2}%, ${v3}%)`;
      if (colord(hslStr).isValid()) {
        return colord(hslStr).toHex().toUpperCase();
      }
    } else {
      // Treat as RGB by default
      const rgbStr = `rgb(${v1}, ${v2}, ${v3})`;
      if (colord(rgbStr).isValid()) {
        return colord(rgbStr).toHex().toUpperCase();
      }
    }
  }

  // 3. Hex without # (e.g. "ffffff" or "fff")
  if (/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(cleanVal)) {
    const hexStr = `#${cleanVal}`;
    if (colord(hexStr).isValid()) {
      return colord(hexStr).toHex().toUpperCase();
    }
  }

  return null;
};

const StatusBadge = ({ pass }) => (
  pass ? (
    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
      <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] text-emerald-800 font-extrabold">✓</span> Pass
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-600 font-bold text-[11px]">
      <span className="w-3.5 h-3.5 rounded-full bg-red-100 flex items-center justify-center text-[9px] text-red-800 font-extrabold">✗</span> Fail
    </span>
  )
);

export default function ContrastCalculator() {
  const [fg, setFg] = useState('#0A0A0A');
  const [bg, setBg] = useState('#FFFFFF');

  const [fgText, setFgText] = useState('#0A0A0A');
  const [bgText, setBgText] = useState('#FFFFFF');

  const [copiedFg, setCopiedFg] = useState(false);
  const [copiedBg, setCopiedBg] = useState(false);

  const [filter, setFilter] = useState('AA');
  const [ratioBg, setRatioBg] = useState(4.5);
  const [ratioFg, setRatioFg] = useState(4.5);
  const [ratioBoth, setRatioBoth] = useState(4.5);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    const minR = newFilter === 'AAA' ? 7.0 : 4.5;
    if (ratioBg < minR) setRatioBg(minR);
    if (ratioFg < minR) setRatioFg(minR);
    if (ratioBoth < minR) setRatioBoth(minR);
  };

  const minRatio = filter === 'AAA' ? 7.0 : 4.5;

  // Adjust state during render when fg/bg changes externally
  const [prevFg, setPrevFg] = useState('#0A0A0A');
  const [prevBg, setPrevBg] = useState('#FFFFFF');

  if (fg !== prevFg) {
    setPrevFg(fg);
    setFgText(fg);
  }

  if (bg !== prevBg) {
    setPrevBg(bg);
    setBgText(bg);
  }

  // Calculate derived values during render
  const ratio = useMemo(() => {
    if (colord(fg).isValid() && colord(bg).isValid()) {
      return getContrastRatio(fg, bg);
    }
    return 1;
  }, [fg, bg]);

  const scores = useMemo(() => {
    return {
      nAA: ratio >= 4.5,
      nAAA: ratio >= 7.0,
      lAA: ratio >= 3.0,
      lAAA: ratio >= 4.5,
      ui: ratio >= 3.0
    };
  }, [ratio]);

  const fgHsl = useMemo(() => colord(fg).toHsl(), [fg]);
  const bgHsl = useMemo(() => colord(bg).toHsl(), [bg]);

  const fgLightness = fgHsl.l;
  const bgLightness = bgHsl.l;

  const updateFgLightness = (newL) => {
    const newHex = colord({ ...fgHsl, l: newL }).toHex();
    setFg(newHex.toUpperCase());
  };

  const updateBgLightness = (newL) => {
    const newHex = colord({ ...bgHsl, l: newL }).toHex();
    setBg(newHex.toUpperCase());
  };

  const handleFgLightnessChange = (e) => {
    updateFgLightness(parseFloat(e.target.value));
  };

  const handleBgLightnessChange = (e) => {
    updateBgLightness(parseFloat(e.target.value));
  };

  const handleLightnessKeyDown = (e, currentVal, updateFn) => {
    const step = 1;
    const largeStep = 10;
    let newVal = currentVal;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        newVal = Math.min(100, currentVal + step);
        e.preventDefault();
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        newVal = Math.max(0, currentVal - step);
        e.preventDefault();
        break;
      case 'PageUp':
        newVal = Math.min(100, currentVal + largeStep);
        e.preventDefault();
        break;
      case 'PageDown':
        newVal = Math.max(0, currentVal - largeStep);
        e.preventDefault();
        break;
      case 'Home':
        newVal = 0;
        e.preventDefault();
        break;
      case 'End':
        newVal = 100;
        e.preventDefault();
        break;
      default:
        return;
    }

    updateFn(newVal);
  };

  const handleSwap = () => {
    const temp = fg;
    setFg(bg);
    setBg(temp);
  };

  const handleReset = () => {
    setFg('#0A0A0A');
    setBg('#FFFFFF');
  };

  const copyToClipboard = (text, type) => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'fg') {
        setCopiedFg(true);
        setTimeout(() => setCopiedFg(false), 2000);
      } else {
        setCopiedBg(true);
        setTimeout(() => setCopiedBg(false), 2000);
      }
    }
  };

  const handleFgTextChange = (val) => {
    setFgText(val);
    const parsed = parseColorInput(val);
    if (parsed) {
      setFg(parsed);
    }
  };

  const handleBgTextChange = (val) => {
    setBgText(val);
    const parsed = parseColorInput(val);
    if (parsed) {
      setBg(parsed);
    }
  };

  const handleFgBlur = () => {
    setFgText(fg);
  };

  const handleBgBlur = () => {
    setBgText(bg);
  };

  const bgAlternatives = useMemo(() => getBackgroundAlternatives(fg, bg, minRatio, ratioBg), [fg, bg, minRatio, ratioBg]);
  const fgAlternatives = useMemo(() => getForegroundAlternatives(fg, bg, minRatio, ratioFg), [fg, bg, minRatio, ratioFg]);
  const comboAlternatives = useMemo(() => getCombinationAlternatives(fg, bg, minRatio, ratioBoth), [fg, bg, minRatio, ratioBoth]);

  return (
    <div className="max-w-[1280px] mx-auto px-6 w-full flex flex-col gap-6 pb-6">

      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <span className="text-xs font-semibold text-gray-500 block mb-1">WALLYAX</span>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight leading-none">Contrast Ratio Checker</h1>
          <span className="text-base font-semibold text-gray-500 block mt-1.5">{"Don't guess the contrast. Guarantee it."}</span>
        </div>
      </div>

      {/* Aria-Live Screen Reader region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Contrast ratio updated: {ratio.toFixed(2)} to 1. Results: Normal Text is {scores.nAA ? 'Pass' : 'Fail'} AA and {scores.nAAA ? 'Pass' : 'Fail'} AAA. Large Text is {scores.lAA ? 'Pass' : 'Fail'} AA and {scores.lAAA ? 'Pass' : 'Fail'} AAA. UI Components is {scores.ui ? 'Pass' : 'Fail'} AA.
      </div>

      {/* Main Grid: Controls, Live Preview, Contrast Ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_470px_1fr] gap-6">

        {/* Column 1: Color Inputs Controls (Consolidated single container) */}
        <section
          role="region"
          aria-label="Color Inputs"
          className="bg-white border border-gray-200 rounded-[4px] p-4 lg:p-5 shadow-sm flex flex-col justify-between gap-4 lg:gap-5 h-auto overflow-visible order-2 lg:order-1"
        >
          <div className="grid grid-cols-1 gap-4 lg:gap-5">

            {/* Card Section 1: Foreground Color */}
            <div className="space-y-2 lg:space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">Foreground Color</h3>

              <div className="flex items-center gap-2.5">
                {/* Swatch Color Picker */}
                <div className="relative shrink-0 focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2 rounded-[4px]">
                  <div className="w-10 h-10 rounded-[4px] border border-gray-200 shadow-inner overflow-hidden" style={{ backgroundColor: fg }}></div>
                  <div className="absolute -top-2 -left-2 bg-white border border-gray-200 rounded-[4px] p-1 text-gray-500 shadow-sm z-10 pointer-events-none">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </div>
                  <input
                    type="color"
                    value={fg}
                    onChange={(e) => {
                      setFg(e.target.value.toUpperCase());
                      setFgText(e.target.value.toUpperCase());
                    }}
                    className="absolute opacity-0 w-14 h-14 -top-2 -left-2 cursor-pointer z-20"
                    aria-label="Foreground Color Picker"
                  />
                </div>

                {/* Hex / RGB / HSL Text Field */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={fgText}
                    onChange={(e) => handleFgTextChange(e.target.value)}
                    onBlur={handleFgBlur}
                    placeholder="e.g. #0A0A0A"
                    aria-label="Foreground Color Hex Code"
                    className="w-full px-2.5 py-2 border border-gray-200 rounded-[4px] font-mono text-xs uppercase focus:ring-2 focus:ring-black focus:outline-none bg-gray-50/50 font-bold text-gray-900"
                  />
                </div>

                {/* Copy Button */}
                <button
                  onClick={() => copyToClipboard(fg, 'fg')}
                  className="relative p-2 bg-black hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 text-yellow-400 transition-colors shadow-sm shrink-0 w-9 h-9 flex items-center justify-center rounded-[4px] border-transparent"
                  title="Copy Hex"
                  aria-label="Copy Foreground Hex Code"
                >
                  {copiedFg && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                      Copied!
                    </div>
                  )}
                  {copiedFg ? (
                    <span className="text-emerald-500 font-bold text-sm">✓</span>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                    </svg>
                  )}
                </button>
              </div>

              {/* Lightness Slider */}
              <div className="pt-1 lg:pt-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-1">
                  <span>Lightness</span>
                </div>
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={fgLightness}
                    onChange={handleFgLightnessChange}
                    onKeyDown={(e) => handleLightnessKeyDown(e, fgLightness, updateFgLightness)}
                    className="flex-1 h-1 bg-gray-200 rounded-[4px] appearance-none cursor-pointer accent-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    aria-label="Foreground Lightness"
                  />
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                  <span className="text-[10px] font-mono font-bold w-9 text-right text-gray-600">{Math.round(fgLightness)}%</span>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Card Section 2: Background Color */}
            <div className="space-y-2 lg:space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">Background Color</h3>

              <div className="flex items-center gap-2.5">
                {/* Swatch Color Picker */}
                <div className="relative shrink-0 focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2 rounded-[4px]">
                  <div className="w-10 h-10 rounded-[4px] border border-gray-200 shadow-inner overflow-hidden" style={{ backgroundColor: bg }}></div>
                  <div className="absolute -top-2 -left-2 bg-white border border-gray-200 rounded-[4px] p-1 text-gray-500 shadow-sm z-10 pointer-events-none">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </div>
                  <input
                    type="color"
                    value={bg}
                    onChange={(e) => {
                      setBg(e.target.value.toUpperCase());
                      setBgText(e.target.value.toUpperCase());
                    }}
                    className="absolute opacity-0 w-14 h-14 -top-2 -left-2 cursor-pointer z-20"
                    aria-label="Background Color Picker"
                  />
                </div>

                {/* Hex / RGB / HSL Text Field */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={bgText}
                    onChange={(e) => handleBgTextChange(e.target.value)}
                    onBlur={handleBgBlur}
                    placeholder="e.g. #FFFFFF"
                    aria-label="Background Color Hex Code"
                    className="w-full px-2.5 py-2 border border-gray-200 rounded-[4px] font-mono text-xs uppercase focus:ring-2 focus:ring-black focus:outline-none bg-gray-50/50 font-bold text-gray-900"
                  />
                </div>

                {/* Copy Button */}
                <button
                  onClick={() => copyToClipboard(bg, 'bg')}
                  className="relative p-2 bg-black hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 text-yellow-400 transition-colors shadow-sm shrink-0 w-9 h-9 flex items-center justify-center rounded-[4px] border-transparent"
                  title="Copy Hex"
                  aria-label="Copy Background Hex Code"
                >
                  {copiedBg && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                      Copied!
                    </div>
                  )}
                  {copiedBg ? (
                    <span className="text-emerald-500 font-bold text-sm">✓</span>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                    </svg>
                  )}
                </button>
              </div>

              {/* Lightness Slider */}
              <div className="pt-1 lg:pt-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-1">
                  <span>Lightness</span>
                </div>
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={bgLightness}
                    onChange={handleBgLightnessChange}
                    onKeyDown={(e) => handleLightnessKeyDown(e, bgLightness, updateBgLightness)}
                    className="flex-1 h-1 bg-gray-200 rounded-[4px] appearance-none cursor-pointer accent-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    aria-label="Background Lightness"
                  />
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                  <span className="text-[10px] font-mono font-bold w-9 text-right text-gray-600">{Math.round(bgLightness)}%</span>
                </div>
              </div>
            </div>

          </div>

          {/* Swap & Reset Buttons Row */}
          <div className="flex gap-3 pt-3 lg:pt-4 border-t border-gray-100 shrink-0">
            <button
              onClick={handleSwap}
              className="flex-grow bg-black text-yellow-400 hover:bg-zinc-800 font-bold px-4 py-2.5 rounded-[4px] text-xs transition duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer border-transparent focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              Swap Colors
            </button>
            <button
              onClick={handleReset}
              className="flex-grow bg-black text-yellow-400 hover:bg-zinc-800 font-bold px-4 py-2.5 rounded-[4px] text-xs transition duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer border-transparent focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Reset
            </button>
          </div>
        </section>

        {/* Column 2 & 3: Live Preview (Center Column - Expanded) */}
        <section
          role="region"
          aria-label="Live Color Contrast Preview"
          className="rounded-[4px] p-4 lg:p-6 shadow-sm flex flex-col justify-between items-center text-center h-[220px] lg:h-auto lg:min-h-[300px] max-w-[470px] mx-auto w-full relative select-none border border-black/5 order-1 lg:order-2"
          style={{ backgroundColor: bg, color: fg }}
        >
          {/* Centered Heading */}
          <h2 className="text-xs font-bold uppercase tracking-wider opacity-70">Live Preview</h2>

          <div className="flex-1 flex flex-col justify-center items-center space-y-2 lg:space-y-4 max-w-lg px-4">
            <h3 className="text-2xl lg:text-4xl font-bold tracking-tight leading-tight">Tip of the Day</h3>
            <p className="text-xs lg:text-base font-normal leading-relaxed opacity-90">
              Color choices shape perception, emotions, and the way people connect with a design.
            </p>
            <div className="pt-2">
              <button
                className="px-5 py-2 rounded-[4px] font-extrabold text-xs uppercase tracking-wider transition-all duration-200 shadow-sm border focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  backgroundColor: fg,
                  color: bg,
                  borderColor: fg
                }}
                aria-label={`Contrast status: ${ratio >= minRatio ? "ok" : "not ok"}`}
              >
                {ratio >= minRatio ? "ok" : "not ok"}
              </button>
            </div>
          </div>
        </section>

        {/* Column 4: Contrast Ratio (Next to Live Preview) */}
        <section
          role="region"
          aria-label="Contrast Ratio and WCAG Compliance Matrix"
          className="bg-white border border-gray-200 rounded-[4px] p-4 lg:p-5 shadow-sm flex flex-col justify-between h-auto lg:h-auto gap-2 lg:gap-4 order-3 lg:order-3 overflow-visible"
        >
          <div className="space-y-2 lg:space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">Contrast Ratio</h2>
            <div className={`text-center py-4 border border-gray-100 rounded-[4px] transition-all duration-300 ${ratio >= minRatio
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
              : 'bg-red-600 text-white shadow-md shadow-red-600/10'
              }`}>
              <div className="text-3xl lg:text-5xl font-black font-mono text-white tracking-tight leading-none">
                {ratio.toFixed(2)} : 1
              </div>
              <div className={`text-[8px] lg:text-[9px] font-bold mt-0.5 lg:mt-1 uppercase tracking-wider leading-none ${ratio >= minRatio ? 'text-emerald-100' : 'text-red-100'
                }`}>
                {getContrastDescription(ratio)}
              </div>
            </div>
            <div className={`text-center text-xs font-bold ${ratio >= minRatio ? 'text-emerald-600' : 'text-red-600'}`}>
              {ratio >= minRatio ? "Great! we got a good combination" : "Oops! We missed it"}
            </div>
          </div>

          {/* Accessibility Evaluation Matrix */}
          <div className="border border-gray-100 rounded-[4px] overflow-hidden text-[10px] lg:text-xs">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[8px] lg:text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  <th className="px-2 lg:px-3 py-1.5 lg:py-2.5 font-bold text-left">Content Type</th>
                  <th className="px-2 lg:px-3 py-1.5 lg:py-2.5 font-bold text-center w-16 lg:w-20">AA</th>
                  <th className="px-2 lg:px-3 py-1.5 lg:py-2.5 font-bold text-center w-16 lg:w-20">AAA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50/40 transition-colors">
                  <td className="px-2 lg:px-3 py-1.5 lg:py-3.5 font-medium text-gray-700">Normal Text</td>
                  <td className="px-2 lg:px-3 py-1.5 lg:py-3.5 text-center"><StatusBadge pass={scores.nAA} /></td>
                  <td className="px-2 lg:px-3 py-1.5 lg:py-3.5 text-center"><StatusBadge pass={scores.nAAA} /></td>
                </tr>
                <tr className="bg-gray-50/20 hover:bg-gray-50/40 transition-colors">
                  <td className="px-2 lg:px-3 py-1.5 lg:py-3.5 font-medium text-gray-700">Large Text</td>
                  <td className="px-2 lg:px-3 py-1.5 lg:py-3.5 text-center"><StatusBadge pass={scores.lAA} /></td>
                  <td className="px-2 lg:px-3 py-1.5 lg:py-3.5 text-center"><StatusBadge pass={scores.lAAA} /></td>
                </tr>
                <tr className="hover:bg-gray-50/40 transition-colors">
                  <td className="px-2 lg:px-3 py-1.5 lg:py-3.5 font-medium text-gray-700">UI Components</td>
                  <td className="px-2 lg:px-3 py-1.5 lg:py-3.5 text-center"><StatusBadge pass={scores.ui} /></td>
                  <td className="px-2 lg:px-3 py-1.5 lg:py-3.5 text-center text-gray-300">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {/* Bottom Panel: Accessible Alternatives (suggestions) */}
      <section
        role="region"
        aria-label="Accessible Alternatives"
        className="bg-white border border-gray-200 rounded-[4px] shadow-sm p-4 flex-none"
      >
        <div className="flex justify-between items-center mb-2.5 flex-none gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">Accessible Alternatives</h2>
            </div>
            <div role="group" aria-label="WCAG compliance level filter" className="flex gap-1.5">
              <button
                onClick={() => handleFilterChange('AA')}
                aria-pressed={filter === 'AA'}
                className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 cursor-pointer ${filter === 'AA'
                  ? 'bg-black text-yellow-400 shadow-sm hover:bg-zinc-800 border border-transparent'
                  : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
              >
                AA
              </button>
              <button
                onClick={() => handleFilterChange('AAA')}
                aria-pressed={filter === 'AAA'}
                className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 cursor-pointer ${filter === 'AAA'
                  ? 'bg-black text-yellow-400 shadow-sm hover:bg-zinc-800 border border-transparent'
                  : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
              >
                AAA
              </button>
            </div>
          </div>

          {/* Top Right Info Tooltip */}
          <div className="relative group inline-block shrink-0">
            <button
              className="focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 rounded-full cursor-help"
              aria-label="Info: slide the ratio for more color combination"
            >
              <svg className="w-5 h-5 text-blue-900" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#DBEAFE" />
                <path d="M12 17v-6h-1m1-3h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col items-end z-50 pointer-events-none">
              <div className="bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded shadow-md whitespace-nowrap">
                Slide the ratio for more color combination
              </div>
              <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 -mt-[3px] mr-2"></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Column 1: Change background only */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline flex-none mb-2">
              <span className="font-bold text-xs text-gray-900 leading-none">Change background only</span>
            </div>
            <div className="grid grid-cols-4 gap-2 flex-none mb-2">
              {bgAlternatives.length > 0 ? (
                bgAlternatives.slice(0, 4).map((alt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setBg(alt.hex)}
                    aria-label={`Apply background color ${alt.hex} with contrast ratio ${alt.ratio.toFixed(2)} to 1`}
                    className="flex flex-col items-center gap-0.5 group focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 rounded-[4px]"
                  >
                    <div
                      className="w-full aspect-[2/1] rounded-[4px] border border-gray-200 flex flex-col items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                      style={{ backgroundColor: alt.hex, color: fg }}
                    >
                      <span className="font-bold text-sm">Aa</span>
                      <div className="h-0.5 w-4 rounded-[4px] mt-0.5 opacity-80" style={{ backgroundColor: fg }}></div>
                    </div>
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-tight leading-none">{alt.hex}</span>
                    <span className="text-[9px] font-bold text-gray-800 leading-none mt-0.5">{alt.ratio.toFixed(2)}:1</span>
                  </button>
                ))
              ) : (
                <div className="col-span-4 flex items-center justify-center text-[10px] font-bold text-gray-400 border border-dashed border-gray-200 rounded-[4px] p-4 text-center aspect-[4/1]">
                  No compliant colors
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-gray-500 uppercase">Ratio</span>
              <input type="range" min={minRatio} max={21} step="0.1" value={ratioBg} onChange={(e) => setRatioBg(parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-[4px] appearance-none cursor-pointer accent-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2" aria-label="Background alternatives ratio filter" />
              <span className="text-[9px] font-mono text-gray-600 w-5 text-right">{ratioBg.toFixed(1)}</span>
            </div>
          </div>

          {/* Column 2: change foreground only */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline flex-none mb-2">
              <span className="font-bold text-xs text-gray-900 leading-none">Change foreground only</span>
            </div>
            <div className="grid grid-cols-4 gap-2 flex-none mb-2">
              {fgAlternatives.length > 0 ? (
                fgAlternatives.slice(0, 4).map((alt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setFg(alt.hex)}
                    aria-label={`Apply foreground color ${alt.hex} with contrast ratio ${alt.ratio.toFixed(2)} to 1`}
                    className="flex flex-col items-center gap-0.5 group focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 rounded-[4px]"
                  >
                    <div
                      className="w-full aspect-[2/1] rounded-[4px] border border-gray-200 flex flex-col items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                      style={{ backgroundColor: bg, color: alt.hex }}
                    >
                      <span className="font-bold text-sm">Aa</span>
                      <div className="h-0.5 w-4 rounded-[4px] mt-0.5 opacity-80" style={{ backgroundColor: alt.hex }}></div>
                    </div>
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-tight leading-none">{alt.hex}</span>
                    <span className="text-[9px] font-bold text-gray-800 leading-none mt-0.5">{alt.ratio.toFixed(2)}:1</span>
                  </button>
                ))
              ) : (
                <div className="col-span-4 flex items-center justify-center text-[10px] font-bold text-gray-400 border border-dashed border-gray-200 rounded-[4px] p-4 text-center aspect-[4/1]">
                  No compliant colors
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-gray-500 uppercase">Ratio</span>
              <input type="range" min={minRatio} max={21} step="0.1" value={ratioFg} onChange={(e) => setRatioFg(parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-[4px] appearance-none cursor-pointer accent-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2" aria-label="Foreground alternatives ratio filter" />
              <span className="text-[9px] font-mono text-gray-600 w-5 text-right">{ratioFg.toFixed(1)}</span>
            </div>
          </div>

          {/* Column 3: Adjust Both */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline flex-none mb-2">
              <span className="font-bold text-xs text-gray-900 leading-none">Adjust Both</span>
            </div>
            <div className="grid grid-cols-4 gap-2 flex-none mb-2">
              {comboAlternatives.length > 0 ? (
                comboAlternatives.slice(0, 4).map((alt, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setFg(alt.fg); setBg(alt.bg); }}
                    aria-label={`Apply foreground color ${alt.fg} and background color ${alt.bg} with contrast ratio ${alt.ratio.toFixed(2)} to 1`}
                    className="flex flex-col items-center gap-0.5 group focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 rounded-[4px]"
                  >
                    <div
                      className="w-full aspect-[2/1] rounded-[4px] border border-gray-200 flex flex-col items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                      style={{ backgroundColor: alt.bg, color: alt.fg }}
                    >
                      <span className="font-bold text-sm">Aa</span>
                      <div className="h-0.5 w-4 rounded-[4px] mt-0.5 opacity-80" style={{ backgroundColor: alt.fg }}></div>
                    </div>
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-tight leading-none truncate max-w-full">
                      {alt.fg}
                    </span>
                    <span className="text-[9px] font-bold text-gray-800 leading-none mt-0.5">{alt.ratio.toFixed(2)}:1</span>
                  </button>
                ))
              ) : (
                <div className="col-span-4 flex items-center justify-center text-[10px] font-bold text-gray-400 border border-dashed border-gray-200 rounded-[4px] p-4 text-center aspect-[4/1]">
                  No compliant colors
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-gray-500 uppercase">Ratio</span>
              <input type="range" min={minRatio} max={21} step="0.1" value={ratioBoth} onChange={(e) => setRatioBoth(parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-[4px] appearance-none cursor-pointer accent-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2" aria-label="Combination alternatives ratio filter" />
              <span className="text-[9px] font-mono text-gray-600 w-5 text-right">{ratioBoth.toFixed(1)}</span>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}