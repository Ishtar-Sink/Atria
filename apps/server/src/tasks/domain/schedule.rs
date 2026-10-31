//! Agenda de uma tarefa recorrente: segmentos de regra com vigência (RN-08). O
//! cálculo das datas é o da regra de recorrência de `shared`; aqui só se recorta a
//! vigência de cada segmento e se converte para a data local no fuso da regra.

use chrono::{DateTime, Days, NaiveDate, NaiveTime, Utc};
use chrono_tz::Tz;

use crate::shared::recurrence::{RecurrenceError, RecurrenceRule};
use crate::tasks::domain::error::TasksError;

/// Uma regra vale de `effective_from` até `effective_until` (inclusive; aberto se nulo).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Segment {
    pub rule: RecurrenceRule,
    pub effective_from: NaiveDate,
    pub effective_until: Option<NaiveDate>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Schedule {
    segments: Vec<Segment>,
}

impl Schedule {
    /// Agenda nova, com a regra valendo a partir de `effective_from`.
    pub fn start(rule: RecurrenceRule, effective_from: NaiveDate) -> Result<Self, TasksError> {
        validate_rule(&rule)?;
        Ok(Self {
            segments: vec![Segment {
                rule,
                effective_from,
                effective_until: None,
            }],
        })
    }

    pub fn from_segments(mut segments: Vec<Segment>) -> Self {
        segments.sort_by_key(|segment| segment.effective_from);
        Self { segments }
    }

    pub fn segments(&self) -> &[Segment] {
        &self.segments
    }

    /// A regra vigente: a do último segmento.
    pub fn current_rule(&self) -> Option<&RecurrenceRule> {
        self.segments.last().map(|segment| &segment.rule)
    }

    /// Fuso da regra vigente; "hoje" de uma tarefa recorrente é a data local nele.
    pub fn timezone(&self) -> Tz {
        self.current_rule()
            .and_then(|rule| rule.timezone.parse::<Tz>().ok())
            .unwrap_or(Tz::UTC)
    }

    pub fn today(&self, now: DateTime<Utc>) -> NaiveDate {
        now.with_timezone(&self.timezone()).date_naive()
    }

    /// Datas locais geradas no intervalo `[from, to]`, em ordem e sem repetição.
    pub fn dates_between(&self, from: NaiveDate, to: NaiveDate) -> Vec<NaiveDate> {
        let mut dates: Vec<NaiveDate> = self
            .segments
            .iter()
            .flat_map(|segment| segment_dates(segment, from, to))
            .collect();
        dates.sort_unstable();
        dates.dedup();
        dates
    }

    pub fn generates(&self, date: NaiveDate) -> bool {
        !self.dates_between(date, date).is_empty()
    }

    /// Troca a regra a partir de `effective_from`: o segmento vigente fecha na véspera
    /// e o novo abre na data; segmentos que começariam depois dela são descartados.
    /// As datas anteriores continuam com a regra antiga (RN-08).
    pub fn change_rule(
        &mut self,
        rule: RecurrenceRule,
        effective_from: NaiveDate,
        today: NaiveDate,
    ) -> Result<(), TasksError> {
        validate_rule(&rule)?;
        if effective_from < today {
            return Err(TasksError::invalid("effective_from", "in_past"));
        }
        self.segments
            .retain(|segment| segment.effective_from < effective_from);
        if let (Some(last), Some(eve)) = (self.segments.last_mut(), effective_from.pred_opt()) {
            last.effective_until = Some(last.effective_until.map_or(eve, |until| until.min(eve)));
        }
        self.segments.push(Segment {
            rule,
            effective_from,
            effective_until: None,
        });
        Ok(())
    }
}

pub fn validate_rule(rule: &RecurrenceRule) -> Result<(), TasksError> {
    rule.validate().map_err(|error| {
        let code = match error {
            RecurrenceError::InvalidInterval => "invalid_interval",
            RecurrenceError::InvalidTimezone => "invalid_timezone",
            RecurrenceError::InvalidMonthDay => "invalid_month_day",
            RecurrenceError::EndsBeforeStart => "ends_before_start",
        };
        TasksError::invalid("recurrence", code)
    })
}

fn segment_dates(segment: &Segment, from: NaiveDate, to: NaiveDate) -> Vec<NaiveDate> {
    let start = from.max(segment.effective_from);
    let end = segment.effective_until.map_or(to, |until| until.min(to));
    let Ok(tz) = segment.rule.timezone.parse::<Tz>() else {
        return Vec::new();
    };
    if start > end {
        return Vec::new();
    }
    // A folga de um dia antes e dois depois, em UTC, cobre qualquer deslocamento de fuso.
    let window_start = utc_midnight(start.checked_sub_days(Days::new(1)).unwrap_or(start));
    let window_end = utc_midnight(end.checked_add_days(Days::new(2)).unwrap_or(end));
    segment
        .rule
        .occurrences_between(window_start, window_end)
        .into_iter()
        .map(|instant| instant.with_timezone(&tz).date_naive())
        .filter(|date| (start..=end).contains(date))
        .collect()
}

fn utc_midnight(date: NaiveDate) -> DateTime<Utc> {
    date.and_time(NaiveTime::MIN).and_utc()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::recurrence::{Frequency, Weekday};

    fn date(text: &str) -> NaiveDate {
        text.parse().unwrap()
    }

    fn dates(texts: &[&str]) -> Vec<NaiveDate> {
        texts.iter().map(|text| date(text)).collect()
    }

    fn rule(frequency: Frequency, timezone: &str, starts_on: &str) -> RecurrenceRule {
        RecurrenceRule {
            frequency,
            interval: 1,
            weekdays: Vec::new(),
            month_day: None,
            time: NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
            timezone: timezone.to_owned(),
            starts_on: date(starts_on),
            ends_on: None,
        }
    }

    #[test]
    fn monthly_on_31_falls_on_last_day_of_short_months() {
        let monthly = RecurrenceRule {
            month_day: Some(31),
            ..rule(Frequency::Monthly, "America/Sao_Paulo", "2027-01-31")
        };
        let schedule = Schedule::start(monthly, date("2026-11-01")).unwrap();

        assert_eq!(
            schedule.dates_between(date("2027-01-01"), date("2027-05-31")),
            dates(&[
                "2027-01-31",
                "2027-02-28",
                "2027-03-31",
                "2027-04-30",
                "2027-05-31"
            ])
        );
    }

    #[test]
    fn yearly_on_feb_29_falls_on_feb_28_in_common_year() {
        let yearly = rule(Frequency::Yearly, "America/Sao_Paulo", "2028-02-29");
        let schedule = Schedule::start(yearly, date("2026-11-01")).unwrap();

        assert_eq!(
            schedule.dates_between(date("2028-01-01"), date("2030-12-31")),
            dates(&["2028-02-29", "2029-02-28", "2030-02-28"])
        );
    }

    #[test]
    fn rule_change_keeps_past_occurrences_of_old_rule() {
        let daily = rule(Frequency::Daily, "America/Sao_Paulo", "2026-11-01");
        let mut schedule = Schedule::start(daily, date("2026-11-01")).unwrap();
        let weekly = RecurrenceRule {
            weekdays: vec![Weekday::Mon],
            ..rule(Frequency::Weekly, "America/Sao_Paulo", "2026-11-01")
        };

        schedule
            .change_rule(weekly, date("2026-11-05"), date("2026-11-03"))
            .unwrap();

        assert_eq!(
            schedule.dates_between(date("2026-11-01"), date("2026-11-04")),
            dates(&["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"])
        );
        assert_eq!(
            schedule.segments()[0].effective_until,
            Some(date("2026-11-04"))
        );
    }

    #[test]
    fn rule_change_applies_new_rule_from_effective_date() {
        let daily = rule(Frequency::Daily, "America/Sao_Paulo", "2026-11-01");
        let mut schedule = Schedule::start(daily, date("2026-11-01")).unwrap();
        let weekly = RecurrenceRule {
            weekdays: vec![Weekday::Mon],
            ..rule(Frequency::Weekly, "America/Sao_Paulo", "2026-11-01")
        };

        schedule
            .change_rule(weekly.clone(), date("2026-11-05"), date("2026-11-03"))
            .unwrap();

        assert_eq!(
            schedule.dates_between(date("2026-11-05"), date("2026-11-20")),
            dates(&["2026-11-09", "2026-11-16"])
        );
        assert_eq!(schedule.current_rule(), Some(&weekly));
        assert!(matches!(
            schedule.change_rule(weekly, date("2026-11-02"), date("2026-11-03")),
            Err(TasksError::Validation(_))
        ));
    }

    #[test]
    fn rule_change_on_start_date_replaces_the_segment() {
        let daily = rule(Frequency::Daily, "UTC", "2026-11-01");
        let mut schedule = Schedule::start(daily, date("2026-11-01")).unwrap();
        let weekly = rule(Frequency::Weekly, "UTC", "2026-11-01");

        schedule
            .change_rule(weekly, date("2026-11-01"), date("2026-11-01"))
            .unwrap();

        assert_eq!(schedule.segments().len(), 1);
        assert_eq!(
            schedule.dates_between(date("2026-11-01"), date("2026-11-15")),
            dates(&["2026-11-01", "2026-11-08", "2026-11-15"])
        );
    }

    #[test]
    fn occurrence_date_uses_rule_timezone() {
        let daily = rule(Frequency::Daily, "America/Sao_Paulo", "2026-10-01");
        let schedule = Schedule::start(daily, date("2026-10-01")).unwrap();
        let now: DateTime<Utc> = "2026-11-01T01:00:00Z".parse().unwrap();

        assert_eq!(schedule.today(now), date("2026-10-31"));
        let utc_daily = rule(Frequency::Daily, "UTC", "2026-10-01");
        let utc_schedule = Schedule::start(utc_daily, date("2026-10-01")).unwrap();
        assert_eq!(utc_schedule.today(now), date("2026-11-01"));
    }

    #[test]
    fn weekly_rule_across_dst_change_keeps_local_date() {
        // O horário de verão de Nova York termina em 01/11/2026; 01:30 acontece duas vezes.
        let weekly = RecurrenceRule {
            weekdays: vec![Weekday::Sun],
            time: NaiveTime::from_hms_opt(1, 30, 0).unwrap(),
            ..rule(Frequency::Weekly, "America/New_York", "2026-10-25")
        };
        let schedule = Schedule::start(weekly, date("2026-10-25")).unwrap();

        assert_eq!(
            schedule.dates_between(date("2026-10-25"), date("2026-11-08")),
            dates(&["2026-10-25", "2026-11-01", "2026-11-08"])
        );
    }

    #[test]
    fn ends_on_stops_occurrences() {
        let daily = RecurrenceRule {
            ends_on: Some(date("2026-11-03")),
            ..rule(Frequency::Daily, "America/Sao_Paulo", "2026-11-01")
        };
        let schedule = Schedule::start(daily, date("2026-11-01")).unwrap();

        assert_eq!(
            schedule.dates_between(date("2026-11-01"), date("2026-11-10")),
            dates(&["2026-11-01", "2026-11-02", "2026-11-03"])
        );
        assert!(!schedule.generates(date("2026-11-04")));
    }

    #[test]
    fn invalid_rule_is_refused() {
        let broken = RecurrenceRule {
            interval: 0,
            ..rule(Frequency::Daily, "UTC", "2026-11-01")
        };

        assert!(matches!(
            Schedule::start(broken, date("2026-11-01")),
            Err(TasksError::Validation(issues)) if issues[0].code == "invalid_interval"
        ));
    }
}
