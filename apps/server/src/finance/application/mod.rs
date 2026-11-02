//! Casos de uso do Financeiro e as portas que a infraestrutura implementa.

pub mod accounts;
pub mod categories;
pub mod payroll_loans;
pub mod ports;
pub mod recurring_transactions;
pub mod summaries;
pub mod transactions;
pub mod transfers;

use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;

/// Relógio e gerador de ids injetáveis ([project/testing-07]).
#[derive(Clone, Copy)]
pub struct Env<'a> {
    pub clock: &'a dyn Clock,
    pub ids: &'a dyn IdGenerator,
}

/// Tamanho da página usado quando um caso de uso precisa ler tudo do dono.
pub const SCAN_PAGE: u32 = 100;
