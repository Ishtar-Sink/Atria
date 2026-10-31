import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../shared/test/render';
import '../nav';
import { CalmMessage } from './calm-message';
import { CompleteTaskButton } from './complete-task-button';
import { DashboardBlock } from './dashboard-block';
import { GreetingCard } from './greeting-card';

beforeEach(() => {
  window.scrollTo = vi.fn();
});

// 12:00, 20:00 e 08:00 em America/Sao_Paulo.
const AT_NOON = new Date('2026-11-05T15:00:00Z');
const AT_NIGHT = new Date('2026-11-05T23:00:00Z');
const AT_MORNING = new Date('2026-11-05T11:00:00Z');

describe('GreetingCard', () => {
  it('greets by the time of day with the first name and the long date', async () => {
    renderWithProviders(<GreetingCard name="Ana Maria Souza" now={AT_NOON} />);
    expect(await screen.findByText('Boa tarde, Ana')).toBeInTheDocument();
    expect(screen.getByText(/quinta-feira, 5 de novembro/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Saudação' })).toBeInTheDocument();
  });

  it('greets without a name and for morning and night', async () => {
    const { unmount } = renderWithProviders(<GreetingCard now={AT_MORNING} />);
    expect(await screen.findByText('Bom dia')).toBeInTheDocument();
    unmount();
    renderWithProviders(<GreetingCard name="Ana" now={AT_NIGHT} />);
    expect(await screen.findByText('Boa noite, Ana')).toBeInTheDocument();
  });

  it('opens a new journal entry from the greeting', async () => {
    const { router } = renderWithProviders(<GreetingCard name="Ana" now={AT_NOON} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Escrever no diário' }));
    expect(router.state.location.pathname).toBe('/journal/new');
    expect(screen.getByText('Como foi o seu dia?')).toBeInTheDocument();
  });
});

describe('CompleteTaskButton', () => {
  it('names the complete button with the action and the title', async () => {
    const { unmount } = renderWithProviders(
      <CompleteTaskButton title="Pagar o IPTU" recurring={false} onComplete={vi.fn()} />,
    );
    const single = await screen.findByRole('button', { name: 'Concluir: Pagar o IPTU' });
    expect(single).toHaveAttribute('title', 'Concluir: Pagar o IPTU');
    unmount();
    renderWithProviders(<CompleteTaskButton title="Beber água" recurring onComplete={vi.fn()} />);
    expect(
      await screen.findByRole('button', { name: 'Concluir hoje: Beber água' }),
    ).toBeInTheDocument();
  });

  it('uses the success variant with only the check icon', async () => {
    const onComplete = vi.fn();
    renderWithProviders(
      <CompleteTaskButton title="Tarefa" recurring={false} onComplete={onComplete} />,
    );
    const button = await screen.findByRole('button', { name: 'Concluir: Tarefa' });
    expect(button.className).toMatch(/success/);
    expect(button.textContent).toBe('');
    const icon = button.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(button);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

function Eye() {
  const [masked, setMasked] = useState(false);
  return (
    <DashboardBlock
      id="balance"
      title="Dinheiro"
      status="ready"
      sensitive
      masked={masked}
      onToggleMask={() => {
        setMasked((value) => !value);
      }}
    >
      <p>conteúdo</p>
    </DashboardBlock>
  );
}

describe('DashboardBlock', () => {
  it('toggles the eye of a sensitive block with aria-pressed', async () => {
    renderWithProviders(<Eye />);
    const hide = await screen.findByRole('button', { name: 'Esconder as informações de Dinheiro' });
    expect(hide).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(hide);
    const show = screen.getByRole('button', { name: 'Mostrar as informações de Dinheiro' });
    expect(show).toHaveAttribute('aria-pressed', 'true');
  });

  it('has no hide button on the blocks', async () => {
    renderWithProviders(
      <DashboardBlock id="today" title="Tarefas de hoje" status="ready">
        <p>conteúdo</p>
      </DashboardBlock>,
    );
    const block = await screen.findByRole('region', { name: 'Tarefas de hoje' });
    expect(within(block).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows state messages in italic muted text without background', async () => {
    renderWithProviders(<CalmMessage>Tudo feito por hoje.</CalmMessage>);
    const message = await screen.findByText('Tudo feito por hoje.');
    const style = getComputedStyle(message);
    expect(style.fontStyle).toBe('italic');
    expect(style.color).toBe('var(--text-muted)');
    expect(style.backgroundColor).toMatch(
      /^(|transparent|none|initial|rgb.{0,3}a?\(0, 0, 0, 0\))$/,
    );
    expect(style.backgroundImage === '' || style.backgroundImage === 'none').toBe(true);
  });
});
