//! Ocorrências de uma tarefa recorrente, identificadas pela data local no fuso da
//! regra; cada uma é concluída e reaberta separadamente (RN-09).
//!
//! A tarefa recorrente não guarda histórico: só existem ocorrências de hoje em
//! diante, e as conclusões de datas passadas são descartadas.

use std::collections::BTreeSet;

use chrono::NaiveDate;

use crate::tasks::domain::error::TasksError;
use crate::tasks::domain::schedule::Schedule;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Occurrence {
    pub occurrence_date: NaiveDate,
    pub completed: bool,
}

/// Datas concluídas de uma tarefa recorrente.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CompletionLog {
    dates: BTreeSet<NaiveDate>,
}

impl CompletionLog {
    pub fn new(dates: impl IntoIterator<Item = NaiveDate>) -> Self {
        Self {
            dates: dates.into_iter().collect(),
        }
    }

    pub fn is_completed(&self, date: NaiveDate) -> bool {
        self.dates.contains(&date)
    }

    /// Conclui a ocorrência; devolve `false` quando ela já estava concluída.
    pub fn complete(
        &mut self,
        schedule: &Schedule,
        date: NaiveDate,
        today: NaiveDate,
    ) -> Result<bool, TasksError> {
        ensure_not_past(date, today)?;
        if !schedule.generates(date) && !self.is_completed(date) {
            return Err(TasksError::OccurrenceNotFound);
        }
        Ok(self.dates.insert(date))
    }

    /// Reabre a ocorrência; devolve `false` quando ela não estava concluída. Uma data
    /// concluída que a regra nova não gera ainda pode ser reaberta.
    pub fn reopen(
        &mut self,
        schedule: &Schedule,
        date: NaiveDate,
        today: NaiveDate,
    ) -> Result<bool, TasksError> {
        ensure_not_past(date, today)?;
        if self.dates.remove(&date) {
            return Ok(true);
        }
        if schedule.generates(date) {
            return Ok(false);
        }
        Err(TasksError::OccurrenceNotFound)
    }

    /// Descarta as conclusões anteriores a hoje.
    #[cfg(test)]
    pub fn discard_before(&mut self, today: NaiveDate) {
        self.dates = self.dates.split_off(&today);
    }

    /// Ocorrências de `[from, to]`, começando no máximo em hoje: as datas geradas pela
    /// agenda unidas às já concluídas, mesmo que a regra nova não as gere (RN-08).
    pub fn occurrences(
        &self,
        schedule: &Schedule,
        from: NaiveDate,
        to: NaiveDate,
        today: NaiveDate,
    ) -> Vec<Occurrence> {
        let from = from.max(today);
        if from > to {
            return Vec::new();
        }
        let mut dates: BTreeSet<NaiveDate> = schedule.dates_between(from, to).into_iter().collect();
        dates.extend(self.dates.range(from..=to).copied());
        dates
            .into_iter()
            .map(|occurrence_date| Occurrence {
                occurrence_date,
                completed: self.is_completed(occurrence_date),
            })
            .collect()
    }
}

fn ensure_not_past(date: NaiveDate, today: NaiveDate) -> Result<(), TasksError> {
    if date < today {
        return Err(TasksError::OccurrenceInPast);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::recurrence::{Frequency, RecurrenceRule, TaskRecurrenceRule, Weekday};
    use chrono::NaiveTime;

    fn date(text: &str) -> NaiveDate {
        text.parse().unwrap()
    }

    fn rule(frequency: Frequency, weekdays: Vec<Weekday>) -> TaskRecurrenceRule {
        RecurrenceRule {
            frequency,
            interval: 1,
            weekdays,
            month_day: None,
            time: NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
            timezone: "America/Sao_Paulo".to_owned(),
            starts_on: date("2026-11-01"),
            ends_on: None,
        }
        .into()
    }

    fn daily() -> Schedule {
        Schedule::start(rule(Frequency::Daily, Vec::new()), date("2026-11-01")).unwrap()
    }

    fn occurrence(text: &str, completed: bool) -> Occurrence {
        Occurrence {
            occurrence_date: date(text),
            completed,
        }
    }

    #[test]
    fn each_occurrence_is_completed_separately() {
        let schedule = daily();
        let today = date("2026-11-01");
        let mut log = CompletionLog::default();

        assert!(log.complete(&schedule, date("2026-11-01"), today).unwrap());
        assert!(log.complete(&schedule, date("2026-11-03"), today).unwrap());
        assert!(!log.complete(&schedule, date("2026-11-03"), today).unwrap());
        assert!(log.reopen(&schedule, date("2026-11-03"), today).unwrap());

        assert_eq!(
            log.occurrences(&schedule, date("2026-11-01"), date("2026-11-03"), today),
            [
                occurrence("2026-11-01", true),
                occurrence("2026-11-02", false),
                occurrence("2026-11-03", false),
            ]
        );
    }

    #[test]
    fn completing_date_outside_rule_is_refused() {
        let mondays = rule(Frequency::Weekly, vec![Weekday::Mon]);
        let schedule = Schedule::start(mondays, date("2026-11-01")).unwrap();
        let mut log = CompletionLog::default();

        let result = log.complete(&schedule, date("2026-11-03"), date("2026-11-01"));

        assert!(matches!(result, Err(TasksError::OccurrenceNotFound)));
        assert!(matches!(
            log.reopen(&schedule, date("2026-11-03"), date("2026-11-01")),
            Err(TasksError::OccurrenceNotFound)
        ));
        assert!(
            log.complete(&schedule, date("2026-11-02"), date("2026-11-01"))
                .is_ok()
        );
    }

    #[test]
    fn completed_occurrence_outside_new_rule_is_kept() {
        let mut schedule = daily();
        let today = date("2026-11-01");
        let mut log = CompletionLog::default();
        log.complete(&schedule, date("2026-11-04"), today).unwrap();

        let mondays = rule(Frequency::Weekly, vec![Weekday::Mon]);
        schedule
            .change_rule(mondays, date("2026-11-02"), today)
            .unwrap();

        assert_eq!(
            log.occurrences(&schedule, date("2026-11-01"), date("2026-11-09"), today),
            [
                occurrence("2026-11-01", false),
                occurrence("2026-11-02", false),
                occurrence("2026-11-04", true),
                occurrence("2026-11-09", false),
            ]
        );
        assert!(log.reopen(&schedule, date("2026-11-04"), today).unwrap());
    }

    #[test]
    fn completing_past_occurrence_is_refused() {
        let schedule = daily();
        let mut log = CompletionLog::default();

        let result = log.complete(&schedule, date("2026-11-01"), date("2026-11-02"));

        assert!(matches!(result, Err(TasksError::OccurrenceInPast)));
        assert!(matches!(
            log.reopen(&schedule, date("2026-11-01"), date("2026-11-02")),
            Err(TasksError::OccurrenceInPast)
        ));
        assert!(!log.is_completed(date("2026-11-01")));
    }

    #[test]
    fn occurrences_before_today_are_not_listed() {
        let schedule = daily();
        let mut log = CompletionLog::new([date("2026-11-01"), date("2026-11-02")]);
        let today = date("2026-11-02");

        log.discard_before(today);

        assert!(!log.is_completed(date("2026-11-01")));
        assert_eq!(
            log.occurrences(&schedule, date("2026-10-26"), date("2026-11-03"), today),
            [
                occurrence("2026-11-02", true),
                occurrence("2026-11-03", false)
            ]
        );
        assert!(
            log.occurrences(&schedule, date("2026-10-26"), date("2026-11-01"), today)
                .is_empty()
        );
    }
}
