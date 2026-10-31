import { z } from 'zod';

// As mensagens são chaves de tradução; os campos as traduzem na hora de mostrar.
const MIN_PASSWORD_LENGTH = 12;
const TOTP_LENGTH = 6;

const email = z.string().trim().pipe(z.email('auth.errors.email_invalid'));
const new_password = z.string().min(MIN_PASSWORD_LENGTH, 'auth.errors.password_short');
const confirmation = z.string().min(1, 'auth.errors.confirmation_mismatch');

const SAME_PASSWORD = {
  path: ['confirmation'],
  message: 'auth.errors.confirmation_mismatch',
};

function samePassword(value: { password: string; confirmation: string }): boolean {
  return value.password === value.confirmation;
}

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${String(TOTP_LENGTH)}}$`), 'auth.errors.totp_code_invalid');

export const setupSchema = z
  .object({ email, password: new_password, confirmation })
  .refine(samePassword, SAME_PASSWORD);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'auth.errors.password_required'),
  totp_code: z.string().optional(),
});

export const signUpSchema = z
  .object({
    email,
    password: new_password,
    confirmation,
    invite_token: z.string().optional(),
  })
  .refine(samePassword, SAME_PASSWORD);

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: new_password, confirmation })
  .refine(samePassword, SAME_PASSWORD);

export const twoFactorSchema = z.object({ code: totpCodeSchema });

export type SetupValues = z.infer<typeof setupSchema>;
export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type TwoFactorValues = z.infer<typeof twoFactorSchema>;
