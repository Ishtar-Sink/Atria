//! Núcleo comum aos contextos: erros, ids, relógio, dinheiro, recorrência,
//! visibilidade, paginação, criptografia de campo e acesso ao banco.

pub mod clock;
pub mod crypto;
pub mod db;
pub mod error;
pub mod ids;
pub mod money;
pub mod pagination;
pub mod recurrence;
#[cfg(test)]
pub mod test_support;
pub mod visibility;
