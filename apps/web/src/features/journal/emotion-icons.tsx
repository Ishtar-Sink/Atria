import type { Schemas } from '@atria/contracts';
import { useId, type ReactNode } from 'react';
import { useT } from '../../shared/i18n/i18n';
import styles from './emotion-icons.module.css';

/** As chaves aceitas pelo servidor (mesmo conjunto de `EmotionIconKey` do contrato). */
export const EMOTION_ICON_KEYS = [
  'sun',
  'rain',
  'flame',
  'bolt',
  'wind',
  'leaf',
  'heart',
  'star',
  'moon',
  'cloud',
  'sparkles',
  'smile',
] as const satisfies readonly Schemas['EmotionIconKey'][];

export type EmotionIconKey = (typeof EMOTION_ICON_KEYS)[number];

/** O ícone neutro só existe na tela: o servidor guarda `null` (CB-09). */
export type EmotionIconChoice = EmotionIconKey | 'neutral';

type SystemKey = NonNullable<Schemas['EmotionResponse']['system_key']>;

const SYSTEM_ICONS: Record<SystemKey, EmotionIconKey> = {
  joy: 'sun',
  sadness: 'rain',
  anger: 'flame',
  fear: 'bolt',
  anxiety: 'wind',
  calm: 'leaf',
  gratitude: 'heart',
};

function isIconKey(value: unknown): value is EmotionIconKey {
  return EMOTION_ICON_KEYS.some((key) => key === value);
}

/** Ícone escolhido; senão o da chave do sistema; senão o neutro. Chave desconhecida cai no neutro. */
export function resolveEmotionIcon(emotion: {
  icon?: string | null | undefined;
  system_key?: SystemKey | null | undefined;
}): EmotionIconChoice {
  if (isIconKey(emotion.icon)) return emotion.icon;
  if (emotion.system_key != null) return SYSTEM_ICONS[emotion.system_key];
  return 'neutral';
}

const DRAWINGS: Record<EmotionIconChoice, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15a4 4 0 0 1-.5-7.9A5.5 5.5 0 0 1 17 8a3.5 3.5 0 0 1 0 7" />
      <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
    </>
  ),
  flame: <path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 1.5 1 2 2 2-1-3 0-6 1-8z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" />,
  leaf: <path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l8-8" />,
  heart: (
    <path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z" />
  ),
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" />,
  cloud: <path d="M7 18a4.5 4.5 0 0 1-.6-8.9A6 6 0 0 1 18 10a4 4 0 0 1-.5 8z" />,
  sparkles: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16v4M17 18h4" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
    </>
  ),
  neutral: <circle cx="12" cy="12" r="8" />,
};

export function EmotionIcon({ icon }: { icon: EmotionIconChoice }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={icon}
    >
      {DRAWINGS[icon]}
    </svg>
  );
}

export interface EmotionIconFieldProps {
  label: string;
  value: EmotionIconChoice;
  onChange: (icon: EmotionIconChoice) => void;
}

const CHOICES: readonly EmotionIconChoice[] = ['neutral', ...EMOTION_ICON_KEYS];

/** Escolha de um ícone: um rádio escondido por chave, as setas trocam pelo grupo nativo. */
export function EmotionIconField({ label, value, onChange }: EmotionIconFieldProps) {
  const t = useT();
  const group = useId();
  return (
    <fieldset className={styles.field}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.choices}>
        {CHOICES.map((key) => (
          <label key={key} className={styles.choice}>
            <input
              type="radio"
              name={group}
              value={key}
              checked={value === key}
              aria-label={t(`journal.emotions.icon.${key}`)}
              onChange={() => {
                onChange(key);
              }}
            />
            <span className={styles.face}>
              <EmotionIcon icon={key} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
