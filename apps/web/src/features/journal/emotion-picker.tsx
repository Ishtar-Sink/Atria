import { useId } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { EmotionIcon, resolveEmotionIcon } from './emotion-icons';
import { emotionLabel, type Emotion } from './use-emotions';
import styles from './emotion-picker.module.css';

/** Uma emoção marcada; sem `intensity` a emoção vai sem intensidade (RF-45). */
export interface PickedEmotion {
  emotion_id: string;
  intensity?: number | undefined;
}

export interface EmotionPickerProps {
  emotions: readonly Emotion[];
  value: readonly PickedEmotion[];
  onChange: (value: PickedEmotion[]) => void;
  disabled?: boolean;
}

const LEVELS = [1, 2, 3, 4, 5] as const;

/** Chips numa grade; marcar uma emoção libera a intensidade de 1 a 5, opcional (PD-62). */
export function EmotionPicker({ emotions, value, onChange, disabled = false }: EmotionPickerProps) {
  const t = useT();
  const base = useId();
  const hint_id = `${base}-hint`;

  function toggle(emotion_id: string, checked: boolean) {
    onChange(
      checked
        ? [...value, { emotion_id }]
        : value.filter((picked) => picked.emotion_id !== emotion_id),
    );
  }

  function setIntensity(emotion_id: string, intensity: number) {
    onChange(
      value.map((picked) =>
        picked.emotion_id === emotion_id ? { emotion_id, intensity } : picked,
      ),
    );
  }

  return (
    <fieldset className={styles.root} aria-describedby={hint_id} disabled={disabled}>
      <legend className={styles.legend}>{t('journal.form.emotions')}</legend>
      <p id={hint_id} className={styles.hint}>
        {t('journal.form.emotions_hint')}
      </p>
      {emotions.length === 0 ? (
        <p className={styles.hint}>{t('journal.form.emotions_empty')}</p>
      ) : (
        <ul className={styles.grid}>
          {emotions.map((emotion) => {
            const label = emotionLabel(emotion, t);
            const picked = value.find((item) => item.emotion_id === emotion.id);
            const on = picked !== undefined;
            const current = picked?.intensity;
            return (
              <li key={emotion.id} className={styles.emo} data-on={on ? 'true' : 'false'}>
                <button
                  type="button"
                  className={styles.toggle}
                  aria-pressed={on}
                  onClick={() => {
                    toggle(emotion.id, !on);
                  }}
                >
                  <EmotionIcon icon={resolveEmotionIcon(emotion)} />
                  <span className={styles.name}>{label}</span>
                </button>
                {on ? (
                  <div
                    className={styles.dots}
                    role="radiogroup"
                    aria-label={t('journal.form.intensity', { emotion: label })}
                  >
                    {LEVELS.map((level) => (
                      <label key={level} className={styles.dot}>
                        <input
                          type="radio"
                          name={`${base}-${emotion.id}`}
                          value={level}
                          checked={current === level}
                          aria-label={t('journal.form.intensity_option', { n: level })}
                          onChange={() => {
                            setIntensity(emotion.id, level);
                          }}
                        />
                        <span
                          className={styles.mark}
                          data-filled={current !== undefined && level <= current ? 'true' : 'false'}
                          aria-hidden="true"
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
