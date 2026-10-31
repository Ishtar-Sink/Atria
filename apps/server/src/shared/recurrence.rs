//! Regra de recorrência do contrato (tarefas, lembretes e movimentações) e o cálculo
//! das ocorrências. A regra guarda o fuso de origem; as ocorrências saem em UTC
//! ([project/code-style-06]).

use chrono::{
    DateTime, Datelike, Duration, LocalResult, NaiveDate, NaiveDateTime, NaiveTime, Offset,
    TimeZone, Utc,
};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum RecurrenceError {
    #[error("o intervalo precisa ser maior que zero")]
    InvalidInterval,
    #[error("fuso horário desconhecido")]
    InvalidTimezone,
    #[error("dia do mês fora de 1 a 31")]
    InvalidMonthDay,
    #[error("o fim vem antes do início")]
    EndsBeforeStart,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Frequency {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Weekday {
    Mon,
    Tue,
    Wed,
    Thu,
    Fri,
    Sat,
    Sun,
}

impl From<chrono::Weekday> for Weekday {
    fn from(value: chrono::Weekday) -> Self {
        match value {
            chrono::Weekday::Mon => Self::Mon,
            chrono::Weekday::Tue => Self::Tue,
            chrono::Weekday::Wed => Self::Wed,
            chrono::Weekday::Thu => Self::Thu,
            chrono::Weekday::Fri => Self::Fri,
            chrono::Weekday::Sat => Self::Sat,
            chrono::Weekday::Sun => Self::Sun,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct RecurrenceRule {
    pub frequency: Frequency,
    pub interval: u32,
    #[serde(default)]
    pub weekdays: Vec<Weekday>,
    #[serde(default)]
    pub month_day: Option<u32>,
    #[serde(with = "hour_minute")]
    #[schema(value_type = String, example = "08:00")]
    pub time: NaiveTime,
    #[schema(example = "America/Sao_Paulo")]
    pub timezone: String,
    pub starts_on: NaiveDate,
    #[serde(default)]
    pub ends_on: Option<NaiveDate>,
}

impl RecurrenceRule {
    pub fn validate(&self) -> Result<(), RecurrenceError> {
        if self.interval == 0 {
            return Err(RecurrenceError::InvalidInterval);
        }
        self.tz()?;
        if self.month_day.is_some_and(|day| !(1..=31).contains(&day)) {
            return Err(RecurrenceError::InvalidMonthDay);
        }
        if self.ends_on.is_some_and(|end| end < self.starts_on) {
            return Err(RecurrenceError::EndsBeforeStart);
        }
        Ok(())
    }

    /// Ocorrências no intervalo `[from, to)`, em ordem e em UTC. Uma regra inválida
    /// não tem ocorrências.
    pub fn occurrences_between(
        &self,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Vec<DateTime<Utc>> {
        let Ok(tz) = self.tz() else {
            return Vec::new();
        };
        if self.validate().is_err() || from >= to {
            return Vec::new();
        }
        // Um dia de folga nas pontas cobre qualquer diferença de fuso.
        let first = self
            .starts_on
            .max(from.with_timezone(&tz).date_naive() - Duration::days(1));
        let mut last = to.with_timezone(&tz).date_naive() + Duration::days(1);
        if let Some(end) = self.ends_on {
            last = last.min(end);
        }
        first
            .iter_days()
            .take_while(|date| *date <= last)
            .filter(|date| self.falls_on(*date))
            .map(|date| to_utc(&tz, date.and_time(self.time)))
            .filter(|instant| *instant >= from && *instant < to)
            .collect()
    }

    fn tz(&self) -> Result<Tz, RecurrenceError> {
        self.timezone
            .parse::<Tz>()
            .map_err(|_| RecurrenceError::InvalidTimezone)
    }

    fn falls_on(&self, date: NaiveDate) -> bool {
        let interval = i64::from(self.interval);
        match self.frequency {
            Frequency::Daily => (date - self.starts_on).num_days() % interval == 0,
            Frequency::Weekly => self.falls_on_week(date, interval),
            Frequency::Monthly => {
                months_between(self.starts_on, date) % interval == 0
                    && date.day() == clamped_day(date, self.anchor_day())
            }
            Frequency::Yearly => {
                i64::from(date.year() - self.starts_on.year()) % interval == 0
                    && date.month() == self.starts_on.month()
                    && date.day() == clamped_day(date, self.anchor_day())
            }
        }
    }

    fn falls_on_week(&self, date: NaiveDate, interval: i64) -> bool {
        let weekday = Weekday::from(date.weekday());
        let wanted = if self.weekdays.is_empty() {
            weekday == Weekday::from(self.starts_on.weekday())
        } else {
            self.weekdays.contains(&weekday)
        };
        let weeks = (week_start(date) - week_start(self.starts_on)).num_days() / 7;
        wanted && weeks % interval == 0
    }

    fn anchor_day(&self) -> u32 {
        self.month_day.unwrap_or_else(|| self.starts_on.day())
    }
}

fn week_start(date: NaiveDate) -> NaiveDate {
    date - Duration::days(i64::from(date.weekday().num_days_from_monday()))
}

fn months_between(start: NaiveDate, date: NaiveDate) -> i64 {
    i64::from(date.year() - start.year()) * 12 + i64::from(date.month()) - i64::from(start.month())
}

/// Dia inexistente no mês (31 em abril, 29/02 em ano comum) cai no último dia.
fn clamped_day(date: NaiveDate, day: u32) -> u32 {
    day.min(last_day_of_month(date))
}

fn last_day_of_month(date: NaiveDate) -> u32 {
    let (year, month) = if date.month() == 12 {
        (date.year() + 1, 1)
    } else {
        (date.year(), date.month() + 1)
    };
    NaiveDate::from_ymd_opt(year, month, 1)
        .and_then(|next| next.pred_opt())
        .map_or(28, |last| last.day())
}

/// Horário ambíguo fica no primeiro instante; horário inexistente (salto do horário
/// de verão) avança pelo tamanho do salto, usando o deslocamento de antes dele.
fn to_utc(tz: &Tz, local: NaiveDateTime) -> DateTime<Utc> {
    match tz.from_local_datetime(&local) {
        LocalResult::Single(instant) => instant.with_timezone(&Utc),
        LocalResult::Ambiguous(first, _) => first.with_timezone(&Utc),
        LocalResult::None => {
            let before = local - Duration::days(1);
            let offset = tz.offset_from_utc_datetime(&before).fix().local_minus_utc();
            Utc.from_utc_datetime(&(local - Duration::seconds(i64::from(offset))))
        }
    }
}

mod hour_minute {
    use chrono::NaiveTime;
    use serde::{Deserialize, Deserializer, Serializer};

    const FORMAT: &str = "%H:%M";

    pub fn serialize<S: Serializer>(time: &NaiveTime, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&time.format(FORMAT).to_string())
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<NaiveTime, D::Error> {
        let text = String::deserialize(deserializer)?;
        NaiveTime::parse_from_str(&text, FORMAT).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    fn date(text: &str) -> NaiveDate {
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
            starts_on: date(starts_on),
            ends_on: None,
        }
    }

    #[test]
    fn monthly_day_31_falls_on_last_day_of_short_months() {
        let rule = RecurrenceRule {
            month_day: Some(31),
            ..rule(
                Frequency::Monthly,
                "08:00",
                "America/Sao_Paulo",
                "2027-01-31",
            )
        };

        let got =
            rule.occurrences_between(utc("2027-01-01T00:00:00Z"), utc("2027-05-01T00:00:00Z"));

        assert_eq!(
            got,
            [
                utc("2027-01-31T11:00:00Z"),
                utc("2027-02-28T11:00:00Z"),
                utc("2027-03-31T11:00:00Z"),
                utc("2027-04-30T11:00:00Z"),
            ]
        );
    }

    #[test]
    fn yearly_feb_29_falls_on_feb_28_in_common_years() {
        let rule = rule(Frequency::Yearly, "09:00", "UTC", "2028-02-29");

        let got =
            rule.occurrences_between(utc("2028-01-01T00:00:00Z"), utc("2033-01-01T00:00:00Z"));

        assert_eq!(
            got,
            [
                utc("2028-02-29T09:00:00Z"),
                utc("2029-02-28T09:00:00Z"),
                utc("2030-02-28T09:00:00Z"),
                utc("2031-02-28T09:00:00Z"),
                utc("2032-02-29T09:00:00Z"),
            ]
        );
    }

    #[test]
    fn time_in_dst_gap_fires_once_at_shifted_local_time() {
        let rule = rule(Frequency::Daily, "02:30", "America/New_York", "2027-03-13");

        let got =
            rule.occurrences_between(utc("2027-03-13T00:00:00Z"), utc("2027-03-16T00:00:00Z"));

        // 02:30 de 14/03 não existe: dispara às 03:30 locais (EDT), uma única vez.
        assert_eq!(
            got,
            [
                utc("2027-03-13T07:30:00Z"),
                utc("2027-03-14T07:30:00Z"),
                utc("2027-03-15T06:30:00Z"),
            ]
        );
        let tz: Tz = "America/New_York".parse().unwrap();
        assert_eq!(
            got[1].with_timezone(&tz).time(),
            NaiveTime::from_hms_opt(3, 30, 0).unwrap()
        );
    }

    #[test]
    fn time_in_dst_overlap_fires_once_at_first_instant() {
        let rule = rule(Frequency::Daily, "01:30", "America/New_York", "2027-11-06");

        let got =
            rule.occurrences_between(utc("2027-11-07T00:00:00Z"), utc("2027-11-08T00:00:00Z"));

        // 01:30 de 07/11 acontece duas vezes; vale a primeira, ainda em EDT.
        assert_eq!(got, [utc("2027-11-07T05:30:00Z")]);
    }

    #[test]
    fn weekly_rule_uses_weekdays_and_interval() {
        let rule = RecurrenceRule {
            interval: 2,
            weekdays: vec![Weekday::Mon, Weekday::Wed],
            ..rule(Frequency::Weekly, "10:00", "UTC", "2026-11-02")
        };

        let got =
            rule.occurrences_between(utc("2026-11-01T00:00:00Z"), utc("2026-11-30T00:00:00Z"));

        assert_eq!(
            got,
            [
                utc("2026-11-02T10:00:00Z"),
                utc("2026-11-04T10:00:00Z"),
                utc("2026-11-16T10:00:00Z"),
                utc("2026-11-18T10:00:00Z"),
            ]
        );
    }

    #[test]
    fn respects_starts_on_and_ends_on() {
        let rule = RecurrenceRule {
            ends_on: Some(date("2026-11-07")),
            ..rule(Frequency::Daily, "08:00", "UTC", "2026-11-05")
        };

        let got =
            rule.occurrences_between(utc("2026-11-01T00:00:00Z"), utc("2026-12-01T00:00:00Z"));

        assert_eq!(
            got,
            [
                utc("2026-11-05T08:00:00Z"),
                utc("2026-11-06T08:00:00Z"),
                utc("2026-11-07T08:00:00Z"),
            ]
        );
        let backwards = RecurrenceRule {
            ends_on: Some(date("2026-11-01")),
            ..rule.clone()
        };
        assert_eq!(backwards.validate(), Err(RecurrenceError::EndsBeforeStart));
    }

    #[test]
    fn rejects_invalid_timezone() {
        let rule = rule(Frequency::Daily, "08:00", "America/Atlantida", "2026-11-01");

        assert_eq!(rule.validate(), Err(RecurrenceError::InvalidTimezone));
        assert!(
            rule.occurrences_between(utc("2026-11-01T00:00:00Z"), utc("2026-11-10T00:00:00Z"))
                .is_empty()
        );
    }

    #[test]
    fn occurrences_are_returned_in_utc() {
        let json = serde_json::json!({
            "frequency": "daily",
            "interval": 1,
            "weekdays": [],
            "month_day": null,
            "time": "08:00",
            "timezone": "America/Sao_Paulo",
            "starts_on": "2026-11-01",
            "ends_on": null
        });
        let rule: RecurrenceRule = serde_json::from_value(json.clone()).unwrap();

        let got =
            rule.occurrences_between(utc("2026-11-01T00:00:00Z"), utc("2026-11-02T00:00:00Z"));

        assert_eq!(got, [utc("2026-11-01T11:00:00Z")]);
        assert_eq!(got[0].to_rfc3339(), "2026-11-01T11:00:00+00:00");
        assert_eq!(serde_json::to_value(&rule).unwrap(), json);
    }
}
