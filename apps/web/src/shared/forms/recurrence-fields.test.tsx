import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { z } from 'zod';
import { AppProviders } from '../../app/providers';
import {
  FormRecurrence,
  RecurrenceFields,
  defaultRecurrenceRule,
  summarizeRule,
  useRecurrenceLabels,
  type RecurrenceRule,
} from './recurrence-fields';

function Harness({
  initial,
  with_time,
  time_required,
  onChange,
}: {
  initial?: Partial<RecurrenceRule>;
  with_time?: boolean;
  time_required?: boolean;
  onChange?: (rule: RecurrenceRule) => void;
}) {
  const labels = useRecurrenceLabels();
  const [rule, setRule] = useState<RecurrenceRule>({
    ...defaultRecurrenceRule('America/Sao_Paulo', '2026-11-01'),
    ...initial,
  });
  return (
    <RecurrenceFields
      value={rule}
      onChange={(next) => {
        setRule(next);
        onChange?.(next);
      }}
      labels={labels}
      locale="pt-BR"
      {...(with_time === undefined ? {} : { with_time })}
      {...(time_required === undefined ? {} : { time_required })}
    />
  );
}

function renderFields(props: Parameters<typeof Harness>[0] = {}) {
  return render(
    <AppProviders>
      <Harness {...props} />
    </AppProviders>,
  );
}

async function pickFrequency(name: string) {
  await userEvent.click(screen.getByRole('button', { name: /Frequência/ }));
  await userEvent.click(screen.getByRole('option', { name }));
}

describe('RecurrenceFields', () => {
  it('shows frequency, interval, start and end for a daily rule', () => {
    renderFields();
    expect(screen.getByRole('group', { name: 'Repetição' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Frequência/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Repetir a cada (dias)')).toHaveValue(1);
    expect(screen.getByRole('button', { name: /Início/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fim \(opcional\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Dias da semana' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dia do mês/ })).not.toBeInTheDocument();
  });

  it('shows the weekdays only for weekly', async () => {
    renderFields();
    await pickFrequency('Semanal');
    expect(screen.getByRole('group', { name: 'Dias da semana' })).toBeInTheDocument();
    expect(screen.getByLabelText('Repetir a cada (semanas)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dia do mês/ })).not.toBeInTheDocument();
  });

  it('shows the month day only for monthly, with the short month help', async () => {
    renderFields();
    await pickFrequency('Mensal');
    expect(screen.getByRole('button', { name: /Dia do mês/ })).toBeInTheDocument();
    expect(screen.getByText('Em meses mais curtos, cai no último dia')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Dias da semana' })).not.toBeInTheDocument();
  });

  it('shows neither weekdays nor month day for yearly', async () => {
    renderFields();
    await pickFrequency('Anual');
    expect(screen.queryByRole('group', { name: 'Dias da semana' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dia do mês/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Repetir a cada (anos)')).toBeInTheDocument();
  });

  it('toggles weekdays', async () => {
    const onChange = vi.fn();
    renderFields({ initial: { frequency: 'weekly' }, onChange });
    await userEvent.click(screen.getByRole('checkbox', { name: 'segunda-feira' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'quarta-feira' }));
    const last = onChange.mock.calls.at(-1)?.[0] as RecurrenceRule;
    expect(last.weekdays).toEqual(['mon', 'wed']);
    await userEvent.click(screen.getByRole('checkbox', { name: 'segunda-feira' }));
    expect((onChange.mock.calls.at(-1)?.[0] as RecurrenceRule).weekdays).toEqual(['wed']);
  });

  it('picks the month day', async () => {
    const onChange = vi.fn();
    renderFields({ initial: { frequency: 'monthly' }, onChange });
    await userEvent.click(screen.getByRole('button', { name: /Dia do mês/ }));
    await userEvent.click(screen.getByRole('option', { name: '31' }));
    expect((onChange.mock.calls.at(-1)?.[0] as RecurrenceRule).month_day).toBe(31);
  });

  it('clears the fields the new frequency does not use', async () => {
    const onChange = vi.fn();
    renderFields({
      initial: { frequency: 'weekly', weekdays: ['mon', 'wed'], month_day: 5 },
      onChange,
    });
    await pickFrequency('Mensal');
    const rule = onChange.mock.calls.at(-1)?.[0] as RecurrenceRule;
    expect(rule.frequency).toBe('monthly');
    expect(rule.weekdays).toEqual([]);
    expect(rule.month_day).toBe(5);
    await pickFrequency('Diária');
    const daily = onChange.mock.calls.at(-1)?.[0] as RecurrenceRule;
    expect(daily.month_day).toBeNull();
    expect(daily.weekdays).toEqual([]);
  });

  it('edits the interval as a number', async () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    const input = screen.getByLabelText('Repetir a cada (dias)');
    await userEvent.clear(input);
    await userEvent.type(input, '3');
    expect((onChange.mock.calls.at(-1)?.[0] as RecurrenceRule).interval).toBe(3);
  });

  it('shows an optional time by default and normalizes it to 24 hours', async () => {
    const onChange = vi.fn();
    renderFields({ onChange });
    const time = screen.getByLabelText('Horário (opcional)');
    await userEvent.type(time, '800');
    await userEvent.tab();
    expect((onChange.mock.calls.at(-1)?.[0] as RecurrenceRule).time).toBe('08:00');
    expect(screen.getByText('Fuso horário: America/Sao_Paulo')).toBeInTheDocument();
  });

  it('labels the time as required when time_required is set', () => {
    renderFields({ time_required: true });
    expect(screen.getByLabelText('Horário')).toBeInTheDocument();
    expect(screen.queryByLabelText('Horário (opcional)')).not.toBeInTheDocument();
  });

  it('hides the time when with_time is false', () => {
    renderFields({ with_time: false });
    expect(screen.queryByLabelText(/Horário/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fuso horário/)).not.toBeInTheDocument();
  });

  it('accepts a rule without time when the time is shown but optional', async () => {
    const onChange = vi.fn();
    renderFields({ initial: { frequency: 'weekly' }, onChange });
    await userEvent.click(screen.getByRole('checkbox', { name: 'segunda-feira' }));
    expect((onChange.mock.calls.at(-1)?.[0] as RecurrenceRule).time).toBeNull();
  });

  it('summarizes the rule while editing', () => {
    renderFields({ initial: { frequency: 'monthly', month_day: 31 } });
    expect(screen.getByText('Todo mês no dia 31')).toBeInTheDocument();
  });

  it('shows the error of each field', () => {
    render(
      <AppProviders>
        <ErrorHarness />
      </AppProviders>,
    );
    expect(screen.getByText('Informe um número')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderFields({ initial: { frequency: 'weekly' } });
    expect(await axe(container)).toHaveNoViolations();
  });
});

function ErrorHarness() {
  const labels = useRecurrenceLabels();
  return (
    <RecurrenceFields
      value={defaultRecurrenceRule('America/Sao_Paulo', '2026-11-01')}
      onChange={() => undefined}
      labels={labels}
      locale="pt-BR"
      errors={{ interval: 'Informe um número' }}
    />
  );
}

describe('summarizeRule', () => {
  const base = defaultRecurrenceRule('America/Sao_Paulo', '2026-11-01');

  it('summarizes a daily rule', () => {
    expect(summarizeRule(base, 'pt-BR')).toBe('Todo dia');
    expect(summarizeRule({ ...base, interval: 3 }, 'pt-BR')).toBe('A cada 3 dias');
  });

  it('summarizes a weekly rule with the weekdays and the time', () => {
    const rule: RecurrenceRule = {
      ...base,
      frequency: 'weekly',
      weekdays: ['wed', 'mon'],
      time: '08:00',
    };
    expect(summarizeRule(rule, 'pt-BR')).toBe('Toda segunda e quarta, 08:00');
  });

  it('uses the masculine form when only weekend days are chosen', () => {
    const rule: RecurrenceRule = { ...base, frequency: 'weekly', weekdays: ['sat', 'sun'] };
    expect(summarizeRule(rule, 'pt-BR')).toBe('Todo sábado e domingo');
  });

  it('summarizes a weekly rule without days or with an interval', () => {
    expect(summarizeRule({ ...base, frequency: 'weekly' }, 'pt-BR')).toBe('Toda semana');
    expect(
      summarizeRule({ ...base, frequency: 'weekly', interval: 2, weekdays: ['fri'] }, 'pt-BR'),
    ).toBe('A cada 2 semanas: sexta');
  });

  it('summarizes a monthly rule on day 31', () => {
    expect(summarizeRule({ ...base, frequency: 'monthly', month_day: 31 }, 'pt-BR')).toBe(
      'Todo mês no dia 31',
    );
    expect(summarizeRule({ ...base, frequency: 'monthly' }, 'pt-BR')).toBe('Todo mês');
    expect(
      summarizeRule({ ...base, frequency: 'monthly', interval: 2, month_day: 10 }, 'pt-BR'),
    ).toBe('A cada 2 meses, dia 10');
  });

  it('summarizes a yearly rule with the start date', () => {
    expect(summarizeRule({ ...base, frequency: 'yearly' }, 'pt-BR')).toBe(
      'Todo ano em 1 de novembro',
    );
    expect(summarizeRule({ ...base, frequency: 'yearly', starts_on: '' }, 'pt-BR')).toBe(
      'Todo ano',
    );
    expect(summarizeRule({ ...base, frequency: 'yearly', interval: 2 }, 'pt-BR')).toBe(
      'A cada 2 anos em 1 de novembro',
    );
  });

  it('ignores an empty time', () => {
    expect(summarizeRule({ ...base, time: '' }, 'pt-BR')).toBe('Todo dia');
  });
});

const form_schema = z.object({
  rule: z.object({
    frequency: z.string(),
    interval: z.number().min(1, 'common.field_required'),
    weekdays: z.array(z.string()),
    month_day: z.number().nullable(),
    time: z.string().nullable(),
    timezone: z.string(),
    starts_on: z.string(),
    ends_on: z.string().nullable(),
  }),
});
type FormValues = z.infer<typeof form_schema>;

function RuleForm({
  onSubmit,
  with_time = false,
}: {
  onSubmit: (values: FormValues) => void;
  with_time?: boolean;
}) {
  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: { rule: defaultRecurrenceRule('UTC', '2026-11-01') },
  });
  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
    >
      <FormRecurrence control={control} name="rule" with_time={with_time} />
      <button type="submit">enviar</button>
    </form>
  );
}

describe('FormRecurrence', () => {
  it('writes the rule with the user time zone and submits it', async () => {
    const onSubmit = vi.fn();
    render(
      <AppProviders preferences={{ time_zone: 'America/Recife' }}>
        <RuleForm onSubmit={onSubmit} />
      </AppProviders>,
    );
    await pickFrequency('Mensal');
    await userEvent.click(screen.getByRole('button', { name: /Dia do mês/ }));
    await userEvent.click(screen.getByRole('option', { name: '31' }));
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    const values = onSubmit.mock.calls[0]?.[0] as FormValues;
    expect(values.rule).toMatchObject({
      frequency: 'monthly',
      interval: 1,
      month_day: 31,
      weekdays: [],
      timezone: 'America/Recife',
      starts_on: '2026-11-01',
      ends_on: null,
    });
  });

  it('submits a rule without time while the time field is shown', async () => {
    const onSubmit = vi.fn();
    render(
      <AppProviders>
        <RuleForm onSubmit={onSubmit} with_time />
      </AppProviders>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect((onSubmit.mock.calls[0]?.[0] as FormValues).rule.time).toBeNull();
  });

  it('shows the zod error of the interval as an alert', async () => {
    const onSubmit = vi.fn();
    render(
      <AppProviders>
        <RuleForm onSubmit={onSubmit} />
      </AppProviders>,
    );
    const input = screen.getByLabelText('Repetir a cada (dias)');
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Campo obrigatório');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
