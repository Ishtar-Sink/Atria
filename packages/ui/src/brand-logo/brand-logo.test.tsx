import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { BrandLogo } from './brand-logo';

const css = readFileSync(join(import.meta.dirname, 'brand-logo.module.css'), 'utf8');

describe('BrandLogo', () => {
  it('has no axe violations', async () => {
    const { container } = render(<BrandLogo name="Atria" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the prototype mark and the gradient name', () => {
    const { container } = render(<BrandLogo name="Atria" />);
    const paths = [...container.querySelectorAll('svg path')].map((p) => p.getAttribute('d'));
    expect(paths).toEqual(['M3 20L12 4l9 16', 'M8 20l4-7 4 7']);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(screen.getByText('Atria')).toBeInTheDocument();
    expect(css).toMatch(/\.mark\s*\{[^}]*width:\s*34px;[^}]*background:\s*var\(--brand-gradient\)/);
    expect(css).toMatch(/\.mark\s*\{[^}]*box-shadow:\s*var\(--shadow-md\)/);
    expect(css).toMatch(
      /\.name\s*\{[^}]*background:\s*var\(--brand-gradient\)[^}]*color:\s*transparent/,
    );
    expect(css).toMatch(/background-clip:\s*text/);
  });
});
