import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Checkbox label="Concluída" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('toggles with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Concluída" />);
    const box = screen.getByRole('checkbox', { name: 'Concluída' });
    await user.tab();
    expect(box).toHaveFocus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
  });
});
