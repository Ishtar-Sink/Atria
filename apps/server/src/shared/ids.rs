//! Geração de ids públicos em UUID v7 ([project/api-05]), injetável para testes
//! determinísticos ([project/testing-07]).

use std::sync::atomic::{AtomicU64, Ordering};

use uuid::Uuid;

pub trait IdGenerator: Send + Sync {
    fn new_id(&self) -> Uuid;
}

/// Gerador de produção, ordenado pelo tempo.
#[derive(Debug, Default, Clone, Copy)]
pub struct UuidV7Ids;

impl IdGenerator for UuidV7Ids {
    fn new_id(&self) -> Uuid {
        Uuid::now_v7()
    }
}

/// Gerador de testes: UUID v7 com timestamp fixo e contador crescente.
#[derive(Debug)]
pub struct SequentialIds {
    unix_millis: u64,
    counter: AtomicU64,
}

impl SequentialIds {
    pub fn new(unix_millis: u64) -> Self {
        Self {
            unix_millis,
            counter: AtomicU64::new(0),
        }
    }
}

impl Default for SequentialIds {
    fn default() -> Self {
        // 2026-11-01T12:00:00Z, o mesmo instante do relógio fixo dos testes.
        Self::new(1_793_534_400_000)
    }
}

impl IdGenerator for SequentialIds {
    fn new_id(&self) -> Uuid {
        let next = self.counter.fetch_add(1, Ordering::SeqCst) + 1;
        // Layout do v7: 48 bits de milissegundos, versão 7 e, no fim, o contador no
        // lugar dos bits aleatórios, com a variante RFC 4122.
        let mut bytes = [0u8; 16];
        bytes[..6].copy_from_slice(&self.unix_millis.to_be_bytes()[2..]);
        bytes[6] = 0x70;
        bytes[8..16].copy_from_slice(&next.to_be_bytes());
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        Uuid::from_bytes(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuid_v7_ids_are_time_ordered() {
        let ids = UuidV7Ids;
        let first = ids.new_id();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let second = ids.new_id();

        assert_eq!(first.get_version_num(), 7);
        assert!(first < second);
    }

    #[test]
    fn sequential_ids_are_deterministic() {
        let a = SequentialIds::default();
        let b = SequentialIds::default();
        let from_a: Vec<Uuid> = (0..3).map(|_| a.new_id()).collect();
        let from_b: Vec<Uuid> = (0..3).map(|_| b.new_id()).collect();

        assert_eq!(from_a, from_b);
        assert!(from_a[0] < from_a[1] && from_a[1] < from_a[2]);
        assert!(from_a.iter().all(|id| id.get_version_num() == 7));
    }
}
