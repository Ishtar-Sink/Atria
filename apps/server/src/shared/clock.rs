//! Relógio injetável: nada depende da data atual nos testes ([project/testing-07]).

use std::sync::Mutex;

use chrono::{DateTime, Duration, Utc};

pub trait Clock: Send + Sync {
    fn now(&self) -> DateTime<Utc>;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

/// Relógio de testes, parado num instante que o teste controla.
#[derive(Debug)]
pub struct FixedClock {
    instant: Mutex<DateTime<Utc>>,
}

impl FixedClock {
    pub fn new(instant: DateTime<Utc>) -> Self {
        Self {
            instant: Mutex::new(instant),
        }
    }

    pub fn set(&self, instant: DateTime<Utc>) {
        if let Ok(mut current) = self.instant.lock() {
            *current = instant;
        }
    }

    pub fn advance(&self, by: Duration) {
        if let Ok(mut current) = self.instant.lock() {
            *current += by;
        }
    }
}

impl Clock for FixedClock {
    fn now(&self) -> DateTime<Utc> {
        match self.instant.lock() {
            Ok(current) => *current,
            Err(poisoned) => *poisoned.into_inner(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn instant(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    #[test]
    fn fixed_clock_returns_set_instant() {
        let clock = FixedClock::new(instant("2026-11-01T12:00:00Z"));
        assert_eq!(clock.now(), instant("2026-11-01T12:00:00Z"));

        clock.set(instant("2027-01-01T00:00:00Z"));
        assert_eq!(clock.now(), instant("2027-01-01T00:00:00Z"));
    }

    #[test]
    fn fixed_clock_can_advance() {
        let clock = FixedClock::new(instant("2026-11-01T12:00:00Z"));
        clock.advance(Duration::minutes(90));

        assert_eq!(clock.now(), instant("2026-11-01T13:30:00Z"));
    }
}
