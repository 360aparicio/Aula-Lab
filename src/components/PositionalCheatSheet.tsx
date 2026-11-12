/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PositionalCheatSheet: Cheat Sheet y Manual Posicional Maestro (GTO & Explotativo) 6-Max.
 * Cobertura exhaustiva de las 6 posiciones: EP (UTG), MP (HJ), CO, BTN, SB y BB.
 * Incluye RFI %, combos (Premium, Especulativas, Faroles con blockers), desviaciones
 * explotativas (Calling Stations, Nits, LAGs), matriz de defensa ante 3-Bets,
 * C-Bet por familias de texturas, SPR, Pot Odds y MDF, con exportación/impresión PDF.
 */

import React, { useState } from 'react';
import { TablePosition, TABLE_POSITIONS, POSITION_INFO } from './HandAndPositionBar';
import {
  BookOpen,
  Printer,
  Shield,
  Zap,
  Fish,
  Flame,
  Layers,
  Percent,
  FileText,
  Sliders
} from 'lucide-react';

interface PositionData {
  rfiPct: number;
  rfiCombos: number;
  description: string;
  premiumHands: string[];
  speculativeHands: string[];
  bluffBlockers: string[];
  exploitativeNotes: {
    vsStation: string;
    vsNit: string;
    vsLag: string;
  };
  defenseVs3Bet: {
    foldPct: number;
    callPct: number;
    fourBetValuePct: number;
    fourBetBluffPct: number;
    foldHands: string[];
    callHands: string[];
    fourBetValueHands: string[];
    fourBetBluffHands: string[];
  };
  cbetStrategy: {
    dry: { sizing: string; freq: string; plan: string };
    wet: { sizing: string; freq: string; plan: string };
    monotone: { sizing: string; freq: string; plan: string };
    paired: { sizing: string; freq: string; plan: string };
  };
}

const POSITIONAL_DATABASE: Record<TablePosition, PositionData> = {
  EP: {
    rfiPct: 15.2,
    rfiCombos: 202,
    description: 'Under The Gun (EP / Primera posición en actuar preflop). Mayor número de rivales por detrás, requiere máxima disciplina y rango sólido y concentrado.',
    premiumHands: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs'],
    speculativeHands: ['99', '88', '77', '66', 'KQs', 'QJs', 'JTs', 'T9s', 'AJs', 'ATs', 'AQo'],
    bluffBlockers: ['A5s', 'A4s', 'KJs'],
    exploitativeNotes: {
      vsStation: 'Abre 2.5–3 BB. Elimina A4s/A3s y suited connectors bajos (65s). Solo juega valor puro que conecte pares altos dominantes.',
      vsNit: 'Si un Nit 3-betea a tu apertura de UTG, su rango es casi exclusivamente QQ+, AK. Puedes foldear manos como JJ y AQo de inmediato sin remordimiento.',
      vsLag: 'Si tienes un LAG agresivo en el BTN que 3-betea amplio, prepara trampas con AA/KK pagando fuera de posición (flat call) para que siga faroleando postflop.'
    },
    defenseVs3Bet: {
      foldPct: 48,
      callPct: 36,
      fourBetValuePct: 11,
      fourBetBluffPct: 5,
      foldHands: ['77', '66', 'ATs', 'KJs', 'QJs', 'T9s', 'AQo (parcial)'],
      callHands: ['JJ', 'TT', '99', '88', 'AQs', 'AJs', 'KQs'],
      fourBetValueHands: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
      fourBetBluffHands: ['A5s', 'A4s']
    },
    cbetStrategy: {
      dry: { sizing: '33% Pot', freq: '75%', plan: 'C-Bet de alta frecuencia en boards K-high / A-high secos aprovechando la ventaja de rango.' },
      wet: { sizing: '66% - 75% Pot', freq: '42%', plan: 'Polariza con overpairs fuertes y proyectos con gutshot+overcard. Chequea manos marginales.' },
      monotone: { sizing: '25% - 33% Pot', freq: '30%', plan: 'Chequea en su mayoría a menos que tengas el As del palo (Nut Flush Draw).' },
      paired: { sizing: '33% Pot', freq: '70%', plan: 'Excelente textura para continuar con rango amplio, los rivales conectan muy poco.' }
    }
  },
  MP: {
    rfiPct: 19.8,
    rfiCombos: 262,
    description: 'Middle Position / Hijack (MP). Se libera un rival respecto a UTG; se incorporan más pares medios y broadways suited.',
    premiumHands: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AKo', 'AQs', 'AQo'],
    speculativeHands: ['88', '77', '66', '55', 'AJs', 'ATs', 'A9s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AJo', 'KQo'],
    bluffBlockers: ['A5s', 'A4s', 'A3s', 'K9s', 'Q9s'],
    exploitativeNotes: {
      vsStation: 'Sube a 2.5 BB con todo tu rango de valor. No gastes fichas en semi-faroles de 3-bet o 4-bet bluff si el pez está en las ciegas.',
      vsNit: 'Roba las ciegas con soltura si tanto el CO como el BTN y ciegas son tight/nits pasivos.',
      vsLag: 'Si el BTN es muy agresivo, reduce los opens marginales (Q9s, 55) y amplía tu 4-bet range con bloqueadores As/Rey.'
    },
    defenseVs3Bet: {
      foldPct: 50,
      callPct: 34,
      fourBetValuePct: 10,
      fourBetBluffPct: 6,
      foldHands: ['66', '55', 'KTs', 'QTs', '98s', 'AJo'],
      callHands: ['TT', '99', '88', '77', 'AQs', 'AJs', 'KQs', 'KJs', 'QJs', 'JTs'],
      fourBetValueHands: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
      fourBetBluffHands: ['A5s', 'A4s', 'KQs (mix)']
    },
    cbetStrategy: {
      dry: { sizing: '33% Pot', freq: '70%', plan: 'Apuesta pequeña consistente en flops secos inconexos.' },
      wet: { sizing: '66% Pot', freq: '45%', plan: 'Carga con manos fuertes y proyectos con equity viva; checkea segundas parejas.' },
      monotone: { sizing: '33% Pot', freq: '32%', plan: 'Control de bote con draws medios; bet solo con As o Rey de triunfo.' },
      paired: { sizing: '33% Pot', freq: '68%', plan: 'C-Bet barata que fuerza el fold de manos con dos overcards sin proyecto.' }
    }
  },
  CO: {
    rfiPct: 27.2,
    rfiCombos: 360,
    description: 'Cutoff (Posición de robo semi-tardía). Solo el Botón y las Ciegas tienen posición sobre ti. Rango significativamente más amplio.',
    premiumHands: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'KQs'],
    speculativeHands: ['77', '66', '55', '44', '33', '22', 'ATs-A2s', 'KTs-K8s', 'QJs-Q8s', 'JTs-J8s', 'T9s-T8s', '98s', '87s', '76s', 'AJo', 'ATo', 'KQo', 'KJo'],
    bluffBlockers: ['A5s', 'A4s', 'A3s', 'A2s', 'K7s', 'Q7s', 'J7s'],
    exploitativeNotes: {
      vsStation: 'Amplía las manos que conectan top pairs dominantes (KJo, QJo, ATo). Los calling stations pagarán tus 3 calles con third pair.',
      vsNit: 'Si el BTN foldea >85% ante robos y las ciegas son rocas, puedes abrir hasta un 38% del mazo rentable automáticamente.',
      vsLag: 'Si el BTN te hace 3-bet constantemente, tu 4-bet range debe incluir faroles como A5s, A4s y KTs.'
    },
    defenseVs3Bet: {
      foldPct: 52,
      callPct: 32,
      fourBetValuePct: 9,
      fourBetBluffPct: 7,
      foldHands: ['55-22', 'K8s', 'Q8s', 'J8s', '76s', 'ATo', 'KJo'],
      callHands: ['99', '88', '77', '66', 'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AQo'],
      fourBetValueHands: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'],
      fourBetBluffHands: ['A5s', 'A4s', 'A3s', 'KJs (mix)']
    },
    cbetStrategy: {
      dry: { sizing: '33% Pot', freq: '65%', plan: 'C-Bet rentable con 1/3 del bote en texturas con Broadway o carta alta desconectada.' },
      wet: { sizing: '75% Pot', freq: '48%', plan: 'Apuesta pesada para negar realización de equity y proteger overpairs.' },
      monotone: { sizing: '33% Pot', freq: '35%', plan: 'Apuesta defensiva o check behind para reevaluar turn gratis.' },
      paired: { sizing: '33% Pot', freq: '65%', plan: 'Excelente spot de C-Bet si las ciegas defendieron con rangos amplios.' }
    }
  },
  BTN: {
    rfiPct: 42.5,
    rfiCombos: 564,
    description: 'Dealer Button. La mejor posición de toda la mesa: actuarás de último en todas las calles postflop. Máximo rango de agresión y explotación.',
    premiumHands: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'KQs', 'KQo'],
    speculativeHands: ['66-22', 'A9s-A2s', 'KJs-K2s', 'QJs-Q4s', 'JTs-J6s', 'T9s-T6s', '98s-96s', '87s-85s', '76s-74s', '65s-64s', '54s', 'KJo-K8o', 'QJo-Q9o', 'JTo-J9o', 'T9o'],
    bluffBlockers: ['A5s-A2s', 'K6s-K2s', 'Q6s-Q2s', 'A8o', 'K9o'],
    exploitativeNotes: {
      vsStation: 'Si la BB es una ballena pasiva, no abras faroles especulativos débiles que no conectan pares altos. Carga con todo tipo de Ases y Reyes (Ax, Kx).',
      vsNit: 'Abre 2.0–2.2 BB con cualquier dos cartas decentes (>55% de frecuencia). Es dinero gratis preflop contra nits pasivos.',
      vsLag: 'Si las ciegas 3-betean muy agresivo, responde con 4-bet agresivo con bloqueadores de Ases y Reyes.'
    },
    defenseVs3Bet: {
      foldPct: 45,
      callPct: 38,
      fourBetValuePct: 9,
      fourBetBluffPct: 8,
      foldHands: ['K6s-K2s', 'Q6s-Q4s', 'J6s', '64s', '53s', 'K9o-K8o', 'Q9o', 'T8o'],
      callHands: ['88-55', 'ATs-A6s', 'KTs-K7s', 'QTs-Q8s', 'JTs-J8s', 'T9s-T7s', '98s-97s', '87s', '76s', '65s', 'AJo', 'KQo', 'KJo'],
      fourBetValueHands: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs'],
      fourBetBluffHands: ['A5s', 'A4s', 'A3s', 'A2s', 'K9s', 'Q9s', 'A8o (mix)']
    },
    cbetStrategy: {
      dry: { sizing: '33% Pot', freq: '80%', plan: 'Aprovecha la ventaja posicional absoluta. C-Bet minúscula y barre todas las ciegas.' },
      wet: { sizing: '66% - 75% Pot', freq: '55%', plan: 'Apuesta con manos hechas y draws; check-behind con showdown value marginal para bluff catch turn.' },
      monotone: { sizing: '25% - 33% Pot', freq: '40%', plan: 'Manejo estricto de bote en posición.' },
      paired: { sizing: '33% Pot', freq: '75%', plan: 'C-Bet automática con tamaño pequeño; las ciegas apenas conectaron un 15% de combos.' }
    }
  },
  SB: {
    rfiPct: 44.0,
    rfiCombos: 584,
    description: 'Small Blind (Juego Blind vs Blind). Estarás fuera de posición postflop si la BB paga, pero solo queda 1 jugador por batir. Juego agresivo de subida a 3 BB o limp polarizado.',
    premiumHands: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'KQs'],
    speculativeHands: ['77-22', 'ATs-A2s', 'KJs-K2s', 'QJs-Q4s', 'JTs-J6s', 'T9s-T6s', '98s-95s', '87s-85s', '76s-74s', '65s-64s', '54s', 'AJo-A7o', 'KQo-K8o', 'QJo-Q9o', 'JTo-J9o', 'T9o'],
    bluffBlockers: ['A5s-A2s', 'K5s-K2s', 'Q6s', 'J6s', 'A9o-A6o'],
    exploitativeNotes: {
      vsStation: 'Sube a 3.5 BB por valor. El pez en la BB pagará fuera de posición con basura conectada.',
      vsNit: 'Si la BB tiene fold to steal >68%, sube a 2.5 BB con un 65% de manos y gana la ciega automáticamente.',
      vsLag: 'Si la BB es un maníaco 3-beteador, implementa una estrategia de Limp-Reraise con AA, KK y faroles de bloqueo como A5s.'
    },
    defenseVs3Bet: {
      foldPct: 56,
      callPct: 26,
      fourBetValuePct: 10,
      fourBetBluffPct: 8,
      foldHands: ['44-22', 'K7s-K2s', 'Q7s-Q4s', 'J7s', '75s', 'A8o-A6o', 'K9o-K8o', 'Q9o'],
      callHands: ['99-66', 'ATs-A8s', 'KTs-K8s', 'QTs-Q9s', 'JTs-J9s', 'T9s-T8s', '98s', '87s', 'AJo', 'KQo', 'KJo'],
      fourBetValueHands: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs'],
      fourBetBluffHands: ['A5s', 'A4s', 'A3s', 'A2s', 'K7s', 'Q8s (mix)']
    },
    cbetStrategy: {
      dry: { sizing: '33% Pot', freq: '60%', plan: 'Fuera de posición se requiere más prudencia que en el BTN. Apuesta pequeña en texturas secas con As o Rey.' },
      wet: { sizing: '75% Pot', freq: '40%', plan: 'Apuestas grandes polarizadas; check con pares medios que no aguantan un raise.' },
      monotone: { sizing: '33% Pot', freq: '25%', plan: 'Check-heavy. El rival en BB tiene alta concentración de flushes bajos y medios.' },
      paired: { sizing: '33% Pot', freq: '60%', plan: 'Presión económica con 1/3 del bote.' }
    }
  },
  BB: {
    rfiPct: 0,
    rfiCombos: 0,
    description: 'Big Blind (Defensa Posicional y 3-Betting). Última posición preflop con 1 BB ya invertida; recibe excelentes pot odds pero juega OOP postflop.',
    premiumHands: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs', 'AQo'],
    speculativeHands: ['99-22', 'AJs-A2s', 'KQs-K2s', 'QJs-Q2s', 'JTs-J4s', 'T9s-T5s', '98s-95s', '87s-84s', '76s-74s', '65s-63s', '54s-53s', '43s', 'AJo-A2o', 'KQo-K6o', 'QJo-Q7o', 'JTo-J7o', 'T9o-T8o', '98o'],
    bluffBlockers: ['A5s-A2s', 'K9s', 'Q9s', 'J9s', 'A9o', 'KTo'],
    exploitativeNotes: {
      vsStation: 'No hagas 3-bet bluff con Ax bajos si el rival no foldea preflop. Haz 3-bet grande por valor lineal (TT+, AJs+, KQs, AK).',
      vsNit: 'Si un Nit abre desde UTG o MP, no defiendas manos marginales dominadas (KJo, QTo, A7o). Su rango es rocoso.',
      vsLag: '3-betea agresivamente contra robos de BTN y SB con manos de bloqueo (A5s-A2s, K9s, Q9s, KJo).'
    },
    defenseVs3Bet: {
      foldPct: 22,
      callPct: 62,
      fourBetValuePct: 9,
      fourBetBluffPct: 7,
      foldHands: ['Basura no conectada (72o, 83o, etc.)'],
      callHands: ['Amplio rango de defensa por pot odds (requiere solo 20-25% de equity ante opens a 2.5 BB)'],
      fourBetValueHands: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
      fourBetBluffHands: ['A5s', 'A4s', 'K9s (como 3-Bet / 4-Bet)']
    },
    cbetStrategy: {
      dry: { sizing: '33% Pot', freq: '35%', plan: 'Como BB caller, usualmente juegas Check a agresor inicial (Check to raiser) y lideras (donk bet) muy selectivamente en cartas medias conectadas.' },
      wet: { sizing: '66% Pot', freq: '25%', plan: 'Check-Raise agresivo en texturas húmedas cuando conectas dobles parejas, sets y proyectos con combo draws.' },
      monotone: { sizing: '33% Pot', freq: '18%', plan: 'Check-Call con proyectos a nut flush; check-fold con basura sin blocker.' },
      paired: { sizing: '33% Pot', freq: '28%', plan: 'Check-Call con pares medios y overcards con backdoor flush.' }
    }
  }
};

export const PositionalCheatSheet: React.FC = () => {
  const [activePos, setActivePos] = useState<TablePosition>('BTN');

  const currentData = POSITIONAL_DATABASE[activePos];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Print / Export PDF button */}
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/30 text-cyan-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Cheat Sheet y Manual Posicional Maestro 6-Max
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                GTO & Explotativo
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Matriz completa por posición: RFI %, combos, defensa vs 3-Bet, texturas de C-Bet y ajustes ante rivales.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl border border-neutral-600 transition-colors shadow-md text-xs font-semibold cursor-pointer shrink-0"
        >
          <Printer className="w-4 h-4 text-cyan-400" />
          <span>Exportar / Imprimir PDF</span>
        </button>
      </div>

      {/* Position Selector Bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {TABLE_POSITIONS.map(pos => {
          const isSelected = activePos === pos;
          const info = POSITION_INFO[pos];
          const db = POSITIONAL_DATABASE[pos];

          return (
            <button
              key={pos}
              type="button"
              onClick={() => setActivePos(pos)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-neutral-800 border-cyan-500 ring-2 ring-cyan-500/20 shadow-lg scale-[1.02]'
                  : 'bg-neutral-900/80 border-neutral-800 hover:bg-neutral-800/80 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold font-mono text-white">{pos}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {info.group}
                </span>
              </div>
              <div className="text-xs font-semibold text-neutral-300">
                {pos === 'BB' ? 'Defensa' : `${db.rfiPct}% Open`}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {pos === 'BB' ? '1 BB Invertida' : `${db.rfiCombos} combos`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Position Hero Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black font-mono text-cyan-400">{activePos}</span>
              <span className="text-sm font-medium text-neutral-300">({POSITION_INFO[activePos].full})</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              {currentData.description}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-neutral-950 px-4 py-2.5 rounded-xl border border-neutral-800 shrink-0">
            <div>
              <span className="text-[10px] text-neutral-400 uppercase tracking-wide block">Frecuencia RFI:</span>
              <strong className="text-base font-bold text-emerald-400 font-mono">
                {activePos === 'BB' ? 'N/A (Defensa)' : `${currentData.rfiPct}%`}
              </strong>
            </div>
            <div className="h-8 w-px bg-neutral-800" />
            <div>
              <span className="text-[10px] text-neutral-400 uppercase tracking-wide block">Combos Totales:</span>
              <strong className="text-base font-bold text-white font-mono">
                {activePos === 'BB' ? 'Amplio' : `${currentData.rfiCombos} / 1326`}
              </strong>
            </div>
          </div>
        </div>

        {/* 3 Categories: Premium, Especulativas, Faroles con Bloqueadores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Manos Premium */}
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4" />
              <span>Manos Premium (Valor Puro)</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Siempre se abren y pagan o suben ante 3-Bet. Base innegociable.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {currentData.premiumHands.map(h => (
                <span key={h} className="px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/60 font-mono text-xs font-bold">
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* 2. Manos Especulativas */}
          <div className="p-4 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Manos Especulativas (Implied Odds)</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Pares medios/bajos y suited connectors con gran jugabilidad postflop.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {currentData.speculativeHands.map(h => (
                <span key={h} className="px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/60 font-mono text-xs font-medium">
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* 3. Faroles con Bloqueadores */}
          <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Shield className="w-4 h-4" />
              <span>Faroles con Bloqueadores (Bluffs)</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Ases débiles suited y broadways que bloquean las combinaciones de valor rival.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {currentData.bluffBlockers.map(h => (
                <span key={h} className="px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/60 font-mono text-xs font-medium">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Explotative Notes Against Rival Profiles */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Desviaciones Explotativas por Perfil de Rival desde {activePos}:</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* vs Station */}
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <Fish className="w-4 h-4" />
                <span>Vs Calling Station (Pez):</span>
              </div>
              <p className="text-neutral-300 leading-relaxed text-[11px]">
                {currentData.exploitativeNotes.vsStation}
              </p>
            </div>

            {/* vs Nit */}
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <div className="flex items-center gap-2 text-neutral-300 font-bold">
                <Shield className="w-4 h-4 text-neutral-400" />
                <span>Vs Nit Pasivo (Roca):</span>
              </div>
              <p className="text-neutral-300 leading-relaxed text-[11px]">
                {currentData.exploitativeNotes.vsNit}
              </p>
            </div>

            {/* vs LAG */}
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <Flame className="w-4 h-4" />
                <span>Vs LAG Agresivo (Maniaco):</span>
              </div>
              <p className="text-neutral-300 leading-relaxed text-[11px]">
                {currentData.exploitativeNotes.vsLag}
              </p>
            </div>
          </div>
        </div>

        {/* Defense vs 3-Bet Grid */}
        <div className="p-5 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Matriz de Defensa ante 3-Bet desde {activePos}:</span>
            </h3>
            <span className="text-[11px] font-mono text-neutral-400">
              Total Defensa: {100 - currentData.defenseVs3Bet.foldPct}% (GTO Equilibrium)
            </span>
          </div>

          {/* Frequencies Bar */}
          <div className="space-y-1.5">
            <div className="h-5 w-full rounded-lg overflow-hidden flex font-mono text-[10px] font-bold text-neutral-950 text-center">
              <div style={{ width: `${currentData.defenseVs3Bet.foldPct}%` }} className="bg-red-500 flex items-center justify-center">
                Fold {currentData.defenseVs3Bet.foldPct}%
              </div>
              <div style={{ width: `${currentData.defenseVs3Bet.callPct}%` }} className="bg-blue-400 flex items-center justify-center">
                Call {currentData.defenseVs3Bet.callPct}%
              </div>
              <div style={{ width: `${currentData.defenseVs3Bet.fourBetValuePct}%` }} className="bg-emerald-400 flex items-center justify-center">
                4B Val {currentData.defenseVs3Bet.fourBetValuePct}%
              </div>
              <div style={{ width: `${currentData.defenseVs3Bet.fourBetBluffPct}%` }} className="bg-amber-400 flex items-center justify-center">
                4B Bluff {currentData.defenseVs3Bet.fourBetBluffPct}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
            <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800">
              <span className="text-[10px] text-red-400 font-bold uppercase block mb-1">Fold ante 3-Bet:</span>
              <div className="text-[11px] text-neutral-400">
                {currentData.defenseVs3Bet.foldHands.join(', ')}
              </div>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800">
              <span className="text-[10px] text-blue-400 font-bold uppercase block mb-1">Call ante 3-Bet:</span>
              <div className="text-[11px] text-neutral-400">
                {currentData.defenseVs3Bet.callHands.join(', ')}
              </div>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800">
              <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-1">4-Bet por Valor:</span>
              <div className="text-[11px] text-neutral-400">
                {currentData.defenseVs3Bet.fourBetValueHands.join(', ')}
              </div>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800">
              <span className="text-[10px] text-amber-400 font-bold uppercase block mb-1">4-Bet Farol (Bluff):</span>
              <div className="text-[11px] text-neutral-400">
                {currentData.defenseVs3Bet.fourBetBluffHands.join(', ')}
              </div>
            </div>
          </div>
        </div>

        {/* C-Bet Strategy by Flop Texture */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
            <Percent className="w-4 h-4 text-emerald-400" />
            <span>Estrategia de C-Bet por Familia de Textura desde {activePos}:</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Dry */}
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-white">Textura Seca (Dry)</span>
                <span className="text-emerald-400 font-mono">{currentData.cbetStrategy.dry.sizing}</span>
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">Frecuencia: {currentData.cbetStrategy.dry.freq}</div>
              <p className="text-[11px] text-neutral-400 leading-relaxed pt-1 border-t border-neutral-800/80">
                {currentData.cbetStrategy.dry.plan}
              </p>
            </div>

            {/* Wet */}
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-white">Coordinada (Wet)</span>
                <span className="text-amber-400 font-mono">{currentData.cbetStrategy.wet.sizing}</span>
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">Frecuencia: {currentData.cbetStrategy.wet.freq}</div>
              <p className="text-[11px] text-neutral-400 leading-relaxed pt-1 border-t border-neutral-800/80">
                {currentData.cbetStrategy.wet.plan}
              </p>
            </div>

            {/* Monotone */}
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-white">Monótona (1 Palo)</span>
                <span className="text-cyan-400 font-mono">{currentData.cbetStrategy.monotone.sizing}</span>
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">Frecuencia: {currentData.cbetStrategy.monotone.freq}</div>
              <p className="text-[11px] text-neutral-400 leading-relaxed pt-1 border-t border-neutral-800/80">
                {currentData.cbetStrategy.monotone.plan}
              </p>
            </div>

            {/* Paired */}
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-white">Emparejada (Pair)</span>
                <span className="text-emerald-400 font-mono">{currentData.cbetStrategy.paired.sizing}</span>
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">Frecuencia: {currentData.cbetStrategy.paired.freq}</div>
              <p className="text-[11px] text-neutral-400 leading-relaxed pt-1 border-t border-neutral-800/80">
                {currentData.cbetStrategy.paired.plan}
              </p>
            </div>
          </div>
        </div>

        {/* Global SPR, Pot Odds & MDF Master Cheat Matrix */}
        <div className="p-5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Matriz Universal de Pot Odds, MDF & SPR (Fórmulas para Dummies):</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-neutral-900 text-neutral-400 font-mono uppercase text-[10px] border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-3">Apuesta Rival</th>
                  <th className="py-2.5 px-3">Pot Odds (%)</th>
                  <th className="py-2.5 px-3">Odds Ratio</th>
                  <th className="py-2.5 px-3">Frecuencia Mínima de Defensa (MDF)</th>
                  <th className="py-2.5 px-3">Regla Práctica para Dummies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono">
                <tr className="hover:bg-neutral-900/50">
                  <td className="py-2.5 px-3 font-bold text-white">25% Pot</td>
                  <td className="py-2.5 px-3 text-emerald-400">16.7%</td>
                  <td className="py-2.5 px-3 text-neutral-300">5 : 1</td>
                  <td className="py-2.5 px-3 text-cyan-300">80.0%</td>
                  <td className="py-2.5 px-3 text-neutral-400 font-sans text-[11px]">Paga casi todo tu rango con cualquier pedazo de mesa.</td>
                </tr>
                <tr className="hover:bg-neutral-900/50">
                  <td className="py-2.5 px-3 font-bold text-white">33% Pot</td>
                  <td className="py-2.5 px-3 text-emerald-400">20.0%</td>
                  <td className="py-2.5 px-3 text-neutral-300">4 : 1</td>
                  <td className="py-2.5 px-3 text-cyan-300">75.0%</td>
                  <td className="py-2.5 px-3 text-neutral-400 font-sans text-[11px]">Necesitas ganar 1 de cada 5 veces; foldea solo aire total.</td>
                </tr>
                <tr className="hover:bg-neutral-900/50">
                  <td className="py-2.5 px-3 font-bold text-white">50% Pot</td>
                  <td className="py-2.5 px-3 text-emerald-400">25.0%</td>
                  <td className="py-2.5 px-3 text-neutral-300">3 : 1</td>
                  <td className="py-2.5 px-3 text-cyan-300">66.7%</td>
                  <td className="py-2.5 px-3 text-neutral-400 font-sans text-[11px]">Defiende 2/3 de tu rango; paga con parejas medias y proyectos.</td>
                </tr>
                <tr className="hover:bg-neutral-900/50">
                  <td className="py-2.5 px-3 font-bold text-white">75% Pot</td>
                  <td className="py-2.5 px-3 text-emerald-400">30.0%</td>
                  <td className="py-2.5 px-3 text-neutral-300">2.33 : 1</td>
                  <td className="py-2.5 px-3 text-cyan-300">57.1%</td>
                  <td className="py-2.5 px-3 text-neutral-400 font-sans text-[11px]">Foldea más del 40%; solo continúa con manos fuertes y draws vivos.</td>
                </tr>
                <tr className="hover:bg-neutral-900/50">
                  <td className="py-2.5 px-3 font-bold text-white">100% Pot</td>
                  <td className="py-2.5 px-3 text-emerald-400">33.3%</td>
                  <td className="py-2.5 px-3 text-neutral-300">2 : 1</td>
                  <td className="py-2.5 px-3 text-cyan-300">50.0%</td>
                  <td className="py-2.5 px-3 text-neutral-400 font-sans text-[11px]">El rival polariza; debes defender exactamente la mitad de tu rango.</td>
                </tr>
                <tr className="hover:bg-neutral-900/50">
                  <td className="py-2.5 px-3 font-bold text-white">150% Overbet</td>
                  <td className="py-2.5 px-3 text-emerald-400">37.5%</td>
                  <td className="py-2.5 px-3 text-neutral-300">1.66 : 1</td>
                  <td className="py-2.5 px-3 text-cyan-300">40.0%</td>
                  <td className="py-2.5 px-3 text-neutral-400 font-sans text-[11px]">Extrema polarización; paga solo con blockers y la cima de tu rango.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
