//! Instantes de disparo em UTC. A ocorrência recorrente é a data local da regra mais
//! a hora, convertida no fuso da regra: horário inexistente avança pelo tamanho do
//! salto e horário ambíguo usa o primeiro instante (CB-04), como na regra de `shared`.

use chrono::{DateTime, Duration, Utc};

use crate::reminders::domain::reminder::Schedule;
use crate::shared::recurrence::RecurrenceRule;

/// Janela de busca da próxima ocorrência; cobre a recorrência anual com folga.
const SEARCH_WINDOW_DAYS: i64 = 400;
/// Limite de janelas, para uma regra sem ocorrência futura nunca girar sem fim.
const MAX_SEARCH_WINDOWS: u32 = 30;

/// Ocorrências no intervalo `[from, to)`, em ordem.
pub fn occurrences_between(
    schedule: &Schedule,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Vec<DateTime<Utc>> {
    match schedule {
        Schedule::OneOff { remind_at } => {
            if *remind_at >= from && *remind_at < to {
                vec![*remind_at]
            } else {
                Vec::new()
            }
        }
        Schedule::Recurring { rule } => rule.occurrences_between(from, to),
    }
}

/// Primeira ocorrência em `from` ou depois.
pub fn next_fire_from(schedule: &Schedule, from: DateTime<Utc>) -> Option<DateTime<Utc>> {
    match schedule {
        Schedule::OneOff { remind_at } => (*remind_at >= from).then_some(*remind_at),
        Schedule::Recurring { rule } => next_recurring_from(rule, from),
    }
}

/// Primeira ocorrência estritamente depois de `after`.
pub fn next_fire_after(schedule: &Schedule, after: DateTime<Utc>) -> Option<DateTime<Utc>> {
    next_fire_from(schedule, after + Duration::microseconds(1))
}

fn next_recurring_from(rule: &RecurrenceRule, from: DateTime<Utc>) -> Option<DateTime<Utc>> {
    let mut start = from;
    for _ in 0..MAX_SEARCH_WINDOWS {
        let end = start + Duration::days(SEARCH_WINDOW_DAYS);
        if let Some(first) = rule.occurrences_between(start, end).into_iter().next() {
            return Some(first);
        }
        // Dois dias de folga cobrem a diferença entre a data local e a UTC.
        let past_end = rule
            .ends_on
            .is_some_and(|ends_on| ends_on < (end - Duration::days(2)).date_naive());
        if past_end {
            return None;
        }
        start = end;
    }
    None
}

#[cfg(test)]
mod tests {
    use chrono::{FixedOffset, NaiveDate, NaiveTime};
    use chrono_tz::Tz;

    use super::*;
    use crate::shared::recurrence::Frequency;

    fn utc(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    fn rule(frequency: Frequency, time: &str, timezone: &str, starts_on: &str) -> RecurrenceRule {
        RecurrenceRule {
            frequency,
            interval: 1,
            weekdays: Vec::new(),
            month_day: None,
            time: NaiveTime::parse_from_str(time, "%H:%M").unwrap(),
            timezone: timezone.to_owned(),
            starts_on: starts_on.parse::<NaiveDate>().unwrap(),
            ends_on: None,
        }
    }

    fn recurring(rule: RecurrenceRule) -> Schedule {
        Schedule::Recurring { rule }
    }

    fn local_time(instant: DateTime<Utc>, timezone: &str) -> NaiveTime {
        let tz: Tz = timezone.parse().unwrap();
        instant.with_timezone(&tz).time()
    }

    #[test]
    fn one_off_fires_at_local_time_in_its_timezone() {
        // 09:00 em São Paulo (UTC-3) é 12:00 UTC.
        let remind_at = "2026-11-05T09:00:00-03:00"
            .parse::<DateTime<FixedOffset>>()
            .unwrap()
            .with_timezone(&Utc);
        let schedule = Schedule::OneOff { remind_at };
        let now = utc("2026-11-01T12:00:00Z");

        let next = next_fire_from(&schedule, now).unwrap();

        assert_eq!(next, utc("2026-11-05T12:00:00Z"));
        assert_eq!(
            local_time(next, "America/Sao_Paulo"),
            NaiveTime::from_hms_opt(9, 0, 0).unwrap()
        );
        assert_eq!(next_fire_after(&schedule, next), None);
        assert_eq!(
            occurrences_between(&schedule, now, utc("2026-11-06T00:00:00Z")),
            [next]
        );
    }

    #[test]
    fn monthly_on_31_fires_on_last_day_of_short_months() {
        let schedule = recurring(RecurrenceRule {
            month_day: Some(31),
            ..rule(Frequency::Monthly, "08:00", "UTC", "2027-01-31")
        });

        let first = next_fire_from(&schedule, utc("2027-01-01T00:00:00Z")).unwrap();
        let second = next_fire_after(&schedule, first).unwrap();
        let third = next_fire_after(&schedule, second).unwrap();
        let fourth = next_fire_after(&schedule, third).unwrap();

        assert_eq!(
            [first, second, third, fourth],
            [
                utc("2027-01-31T08:00:00Z"),
                utc("2027-02-28T08:00:00Z"),
                utc("2027-03-31T08:00:00Z"),
                utc("2027-04-30T08:00:00Z"),
            ]
        );
    }

    #[test]
    fn yearly_on_feb_29_fires_on_feb_28_in_common_year() {
        let schedule = recurring(rule(Frequency::Yearly, "09:00", "UTC", "2028-02-29"));

        let leap = next_fire_from(&schedule, utc("2028-01-01T00:00:00Z")).unwrap();
        let common = next_fire_after(&schedule, leap).unwrap();

        assert_eq!(leap, utc("2028-02-29T09:00:00Z"));
        assert_eq!(common, utc("2029-02-28T09:00:00Z"));
    }

    #[test]
    fn nonexistent_local_time_in_spring_forward_fires_once_shifted_by_gap() {
        // Em 14/03/2027, America/New_York salta de 02:00 para 03:00.
        let schedule = recurring(rule(
            Frequency::Daily,
            "02:30",
            "America/New_York",
            "2027-03-14",
        ));

        let fires = occurrences_between(
            &schedule,
            utc("2027-03-14T00:00:00Z"),
            utc("2027-03-15T04:00:00Z"),
        );

        assert_eq!(fires, [utc("2027-03-14T07:30:00Z")]);
        assert_eq!(
            local_time(fires[0], "America/New_York"),
            NaiveTime::from_hms_opt(3, 30, 0).unwrap()
        );
        assert_eq!(
            next_fire_after(&schedule, fires[0]),
            Some(utc("2027-03-15T06:30:00Z"))
        );
    }

    #[test]
    fn ambiguous_local_time_in_fall_back_fires_once_at_first_instant() {
        // Em 01/11/2026, America/New_York volta de 02:00 para 01:00: 01:30 acontece duas vezes.
        let schedule = recurring(rule(
            Frequency::Daily,
            "01:30",
            "America/New_York",
            "2026-11-01",
        ));

        let fires = occurrences_between(
            &schedule,
            utc("2026-11-01T00:00:00Z"),
            utc("2026-11-02T00:00:00Z"),
        );

        // Primeiro instante, ainda em EDT (UTC-4).
        assert_eq!(fires, [utc("2026-11-01T05:30:00Z")]);
        assert_eq!(
            next_fire_after(&schedule, fires[0]),
            Some(utc("2026-11-02T06:30:00Z"))
        );
    }

    #[test]
    fn next_fire_after_returns_following_occurrence() {
        let schedule = recurring(RecurrenceRule {
            interval: 2,
            ..rule(Frequency::Daily, "08:00", "America/Sao_Paulo", "2026-11-01")
        });

        let first = next_fire_from(&schedule, utc("2026-11-01T11:00:00Z")).unwrap();
        let next = next_fire_after(&schedule, first).unwrap();

        assert_eq!(first, utc("2026-11-01T11:00:00Z"));
        assert_eq!(next, utc("2026-11-03T11:00:00Z"));
        assert_eq!(
            next_fire_after(&schedule, utc("2026-11-01T11:00:01Z")),
            Some(next)
        );
    }

    #[test]
    fn ends_on_stops_firing() {
        let schedule = recurring(RecurrenceRule {
            ends_on: Some("2026-11-03".parse().unwrap()),
            ..rule(Frequency::Daily, "08:00", "UTC", "2026-11-01")
        });

        let last = next_fire_from(&schedule, utc("2026-11-03T00:00:00Z")).unwrap();

        assert_eq!(last, utc("2026-11-03T08:00:00Z"));
        assert_eq!(next_fire_after(&schedule, last), None);
    }

    #[test]
    fn sparse_yearly_rule_is_found_beyond_first_window() {
        let schedule = recurring(RecurrenceRule {
            interval: 4,
            ..rule(Frequency::Yearly, "09:00", "UTC", "2028-02-29")
        });

        let after = next_fire_after(&schedule, utc("2028-02-29T09:00:00Z"));

        assert_eq!(after, Some(utc("2032-02-29T09:00:00Z")));
    }
}
