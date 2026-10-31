//! Bloqueio progressivo por tentativas ([project/security-07]): depois de 5 falhas
//! seguidas, 1 minuto, dobrando a cada nova falha até 1 hora.

use chrono::{DateTime, Duration, Utc};

pub const FREE_FAILURES: u32 = 5;
const BASE_LOCK_SECONDS: i64 = 60;
const MAX_LOCK_SECONDS: i64 = 3600;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Throttle {
    pub failures: u32,
    pub locked_until: Option<DateTime<Utc>>,
}

impl Throttle {
    /// Segundos que faltam para o fim do bloqueio, se houver um em vigor.
    pub fn locked_for(&self, now: DateTime<Utc>) -> Option<i64> {
        let until = self.locked_until?;
        let remaining = (until - now).num_seconds();
        (until > now).then_some(remaining.max(1))
    }

    pub fn register_failure(&mut self, now: DateTime<Utc>) {
        self.failures = self.failures.saturating_add(1);
        self.locked_until = lock_duration(self.failures).map(|lock| now + lock);
    }

    pub fn register_success(&mut self) {
        self.failures = 0;
        self.locked_until = None;
    }
}

fn lock_duration(failures: u32) -> Option<Duration> {
    let over = failures.checked_sub(FREE_FAILURES)?;
    let factor = 1i64.checked_shl(over.min(20)).unwrap_or(i64::MAX);
    let seconds = BASE_LOCK_SECONDS
        .saturating_mul(factor)
        .min(MAX_LOCK_SECONDS);
    Some(Duration::seconds(seconds))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        "2026-11-01T12:00:00Z".parse().unwrap()
    }

    #[test]
    fn lock_grows_progressively_after_five_failures() {
        let mut throttle = Throttle::default();
        for _ in 0..4 {
            throttle.register_failure(now());
        }
        assert_eq!(throttle.locked_for(now()), None);

        throttle.register_failure(now());
        assert_eq!(throttle.locked_for(now()), Some(60));

        throttle.register_failure(now());
        assert_eq!(throttle.locked_for(now()), Some(120));

        throttle.register_failure(now());
        assert_eq!(throttle.locked_for(now()), Some(240));
        assert_eq!(throttle.locked_for(now() + Duration::seconds(240)), None);
    }

    #[test]
    fn lock_is_capped_at_one_hour() {
        let mut throttle = Throttle::default();
        for _ in 0..40 {
            throttle.register_failure(now());
        }

        assert_eq!(throttle.locked_for(now()), Some(3600));
    }

    #[test]
    fn success_resets_failures() {
        let mut throttle = Throttle::default();
        for _ in 0..6 {
            throttle.register_failure(now());
        }
        throttle.register_success();

        assert_eq!(throttle, Throttle::default());
        assert_eq!(throttle.locked_for(now()), None);
    }
}
