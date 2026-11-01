import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppProviders } from '../../app/providers';
import {
  FormColor,
  FormDate,
  FormDateTime,
  FormPeriod,
  FormSegmented,
  FormSelect,
  FormTags,
  FormTime,
} from './form-fields';

function must<T>(value: T | null): T {
  if (value === null) throw new Error('elemento não encontrado');
  return value;
}

const schema = z.object({
  kind: z.string().min(1, 'common.field_required'),
  direction: z.string(),
  due: z.string().min(1, 'common.field_required'),
  at: z.string(),
  start: z.string(),
  tags: z.array(z.string()),
  color: z.string(),
  period: z.looseObject({ preset: z.string() }),
});
type Values = z.infer<typeof schema>;

function Form({ onSubmit }: { onSubmit: (values: Values) => void }) {
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: '',
      direction: 'out',
      due: '',
      at: '',
      start: '',
      tags: [],
      color: '#7C3AED',
      period: { preset: 'this_month' },
    },
  });
  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
    >
      <FormSelect
        control={control}
        name="kind"
        label="Tipo"
        options={[
          { value: 'a', label: 'Alfa' },
          { value: 'b', label: 'Beta' },
        ]}
      />
      <FormSegmented
        control={control}
        name="direction"
        label="Sentido"
        options={[
          { value: 'out', label: 'Saída' },
          { value: 'in', label: 'Entrada' },
        ]}
      />
      <FormDate control={control} name="due" label="Vencimento" />
      <FormTime control={control} name="at" label="Hora" />
      <FormDateTime control={control} name="start" label="Início" />
      <FormTags control={control} name="tags" label="Etiquetas" />
      <FormColor control={control} name="color" label="Cor" />
      <FormPeriod control={control} name="period" label="Período" placement="form" />
      <button type="submit">enviar</button>
    </form>
  );
}

function renderForm(onSubmit: (values: Values) => void) {
  return render(
    <AppProviders>
      <Form onSubmit={onSubmit} />
    </AppProviders>,
  );
}

describe('form fields', () => {
  it('binds select, segmented, date, time, date-time and tags fields to react-hook-form', async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);

    await userEvent.click(screen.getByLabelText('Tipo'));
    await userEvent.click(screen.getByRole('option', { name: 'Beta' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Entrada' }));

    await userEvent.click(screen.getByRole('button', { name: /Vencimento/ }));
    const day = must(document.querySelector<HTMLElement>('[data-day$="-15"]'));
    const iso = day.dataset.day;
    await userEvent.click(day);

    await userEvent.type(screen.getByLabelText('Hora'), '930');
    await userEvent.tab();

    await userEvent.click(screen.getByRole('button', { name: /Início: data/ }));
    await userEvent.click(must(document.querySelector<HTMLElement>('[data-day$="-16"]')));
    await userEvent.type(screen.getByLabelText('Início: hora (24 horas)'), '1005');
    await userEvent.tab();

    await userEvent.type(screen.getByLabelText('Etiquetas'), 'casa{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    const values = onSubmit.mock.calls[0]?.[0] as Values;
    expect(values.kind).toBe('b');
    expect(values.direction).toBe('in');
    expect(values.due).toBe(iso);
    expect(values.at).toBe('09:30');
    expect(values.start).toMatch(/^\d{4}-\d{2}-16T10:05$/);
    expect(values.tags).toEqual(['casa']);
    expect(values.color).toBe('#7C3AED');
    expect(values.period).toMatchObject({ preset: 'this_month' });
  });

  it('shows the zod error on the field with role alert', async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    await userEvent.click(screen.getByRole('button', { name: 'enviar' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Campo obrigatório',
      'Campo obrigatório',
    ]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers an empty option first and explains when there are no options', async () => {
    function Empty({
      options,
      empty_help,
    }: {
      options: { value: string; label: string }[];
      empty_help?: string;
    }) {
      const { control } = useForm<{ category: string }>({ defaultValues: { category: '' } });
      return (
        <FormSelect
          control={control}
          name="category"
          label="Categoria"
          options={options}
          empty_option="Sem categoria"
          {...(empty_help ? { empty_help } : {})}
        />
      );
    }
    const first = render(
      <AppProviders>
        <Empty options={[{ value: 'a', label: 'Casa' }]} />
      </AppProviders>,
    );
    const field = screen.getByLabelText('Categoria');
    expect(field).toHaveTextContent('Sem categoria');
    await userEvent.click(field);
    const names = screen.getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(['Sem categoria', 'Casa']);
    first.unmount();

    render(
      <AppProviders>
        <Empty options={[]} empty_help="Nenhuma categoria ainda." />
      </AppProviders>,
    );
    expect(screen.getByText('Nenhuma categoria ainda.')).toBeInTheDocument();
  });
});
