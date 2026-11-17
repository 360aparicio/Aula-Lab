/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PokerGlossaryTip: Glosario vivo en línea en español claro de Allin School
 * para explicar términos técnicos de póker al instante mediante hover o clic.
 */

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export interface GlossaryEntry {
  term: string;
  title: string;
  simple: string;
  example: string;
}

export const POKER_GLOSSARY: Record<string, GlossaryEntry> = {
  SRP: {
    term: 'SRP',
    title: 'Single Raised Pot (Bote Subido Una Sola Vez)',
    simple: 'Cuando alguien abre subiendo preflop y otro jugador solo paga (call), sin 3-Bet.',
    example: 'BTN sube a 2.5 BB y BB paga. Entran al flop en SRP con un bote cercano a 5.5 BB.'
  },
  OOP: {
    term: 'OOP',
    title: 'Out of Position (Sin Posición)',
    simple: 'Hablas primero en cada calle después del flop. Es más difícil porque el rival ve tu acción antes de decidir.',
    example: 'BB siempre juega OOP contra BTN en el flop, turn y river.'
  },
  IP: {
    term: 'IP',
    title: 'In Position (Con Posición)',
    simple: 'Actúas último después del flop. Tienes ventaja informativa para controlar el tamaño del bote o robarlo.',
    example: 'BTN siempre tiene posición absoluta IP frente a todos postflop.'
  },
  SPR: {
    term: 'SPR',
    title: 'Stack-to-Pot Ratio (Relación Stack / Bote)',
    simple: 'Cuántas veces cabe el bote actual dentro del stack efectivo restante. Define qué tan fácil es ir All-In.',
    example: 'Con SPR menor a 3 (ej. bote 3-Bet), Top Pair fuerte suele jugar por todo el stack.'
  },
  MDF: {
    term: 'MDF',
    title: 'Minimum Defense Frequency (Frecuencia Mínima de Defensa)',
    simple: 'Porcentaje mínimo de manos con el que debes pagar o subir para evitar que el rival gane dinero apostando cualquier basura.',
    example: 'Si el rival apuesta 100% del bote, tu MDF es 50%: debes defender al menos la mitad de tu rango.'
  },
  '3-Bet': {
    term: '3-Bet',
    title: 'Tercera Apuesta (Resubida Preflop)',
    simple: 'Después de las ciegas (1ª apuesta) y una subida inicial (2ª), volver a subir es hacer 3-Bet.',
    example: 'CO sube a 2.5 BB y BTN resube a 8 BB. Ese movimiento del BTN es un 3-Bet.'
  },
  'C-Bet': {
    term: 'C-Bet',
    title: 'Continuation Bet (Apuesta de Continuación)',
    simple: 'Apostar en el flop siendo quien tuvo la iniciativa subiendo preflop, aunque el board no siempre te haya ayudado.',
    example: 'Subes AK preflop, cae Q-7-2 arcoíris y apuestas 33% del bote para presionar al rival.'
  },
  WTSD: {
    term: 'WTSD',
    title: 'Went To Showdown (% de veces que llegas al Showdown)',
    simple: 'Mide cuántas veces tras ver el flop terminas enseñando tus cartas al final. Muy alto = pagas de más.',
    example: 'Un rango sano en 6-Max está entre 26% y 31%. Más de 35% indica perfil Calling Station.'
  },
  'W$SD': {
    term: 'W$SD',
    title: 'Won Money at Showdown (% ganado al mostrar cartas)',
    simple: 'De las veces que llegas al final, cuántas ganas el bote. Si llegas mucho y ganas poco, pagas con manos débiles.',
    example: 'El objetivo ganador suele rondar 51%–56%.'
  },
  ROL: {
    term: 'ROL',
    title: 'Raise Over Limpers (Subir sobre Limpers)',
    simple: 'Cuando un jugador recreativo solo paga la ciega mínima (limp) y tú subes para aislarlo con posición y mano fuerte.',
    example: 'MP hace limp (1 BB) y tú en CO subes a 4 BB para quedarte mano a mano.'
  },
  Squeeze: {
    term: 'Squeeze',
    title: 'Squeeze Play (Resubida contra Subidor + Pagador)',
    simple: 'Hacer 3-Bet cuando ya hubo un subidor y al menos un pagador en medio; el pagador rara vez tiene mano premium.',
    example: 'EP abre, BTN paga y tú en BB resubes grande (12 BB) para llevarte todo el dinero muerto.'
  },
  'Red Line': {
    term: 'Red Line',
    title: 'Non-Showdown Winnings (Ganancias Sin Showdown)',
    simple: 'Fichas ganadas o perdidas cuando la mano termina antes de enseñar cartas (por folds tuyos o del rival).',
    example: 'Si tu línea roja cae en picado, quizás foldeas demasiado ante C-Bets o nunca faroleas en river.'
  }
};

interface PokerGlossaryTipProps {
  term: keyof typeof POKER_GLOSSARY | string;
  label?: string;
  className?: string;
}

export const PokerGlossaryTip: React.FC<PokerGlossaryTipProps> = ({ term, label, className = '' }) => {
  const [open, setOpen] = useState(false);
  const entry = POKER_GLOSSARY[term];
  if (!entry) return <span className={className}>{label || term}</span>;

  return (
    <span
      className={`relative inline-flex items-center gap-1 group ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-label={`Explicación de ${entry.term}`}
        className="inline-flex items-center gap-1 underline decoration-dotted decoration-blue-400/70 underline-offset-4 hover:text-blue-300 cursor-pointer"
      >
        <span>{label || entry.term}</span>
        <HelpCircle className="w-3 h-3 text-blue-400 shrink-0" />
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-50 w-72 p-3 rounded-xl bg-neutral-950 border border-blue-500/40 shadow-2xl text-left text-xs space-y-1.5 pointer-events-none"
        >
          <span className="block font-bold text-blue-300">{entry.title}</span>
          <span className="block text-neutral-200 leading-relaxed">{entry.simple}</span>
          <span className="block text-[11px] text-emerald-300/90 border-t border-neutral-800 pt-1">
            Ej: {entry.example}
          </span>
        </span>
      )}
    </span>
  );
};
