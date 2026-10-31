import { expect, test as setup } from '@playwright/test';
import { USER_STATE } from '../../playwright.config';

// Sessão dos e2e de finance, tasks e journal, que supõem a pessoa já dentro do app.
setup('abre a sessão de uma pessoa comum', async ({ page }) => {
  await page.goto('/__test__/sign-in?role=user');
  // Até 720 px a sidebar é uma gaveta fechada: o sinal de sessão aberta é o título da tela.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.context().storageState({ path: USER_STATE });
});
