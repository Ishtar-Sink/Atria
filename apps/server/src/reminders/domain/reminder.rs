//! Lembrete pontual ou recorrente. Um lembrete só avisa: não tem conclusão (RN-19).

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use serde::Serialize;
use uuid::Uuid;

use crate::reminders::domain::error::{FieldIssue, RemindersError};
use crate::shared::recurrence::{RecurrenceError, RecurrenceRule};
use crate::shared::visibility::Visibility;

pub const TITLE_MAX_CHARS: usize = 200;
pub const NOTES_MAX_CHARS: usize = 10_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReminderKind {
    OneOff,
    Recurring,
}

/// Quando o lembrete dispara: um instante único em UTC ou uma regra com fuso.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Schedule {
    OneOff { remind_at: DateTime<Utc> },
    Recurring { rule: RecurrenceRule },
}

impl Schedule {
    pub fn kind(&self) -> ReminderKind {
        match self {
            Self::OneOff { .. } => ReminderKind::OneOff,
            Self::Recurring { .. } => ReminderKind::Recurring,
        }
    }

    pub fn remind_at(&self) -> Option<DateTime<Utc>> {
        match self {
            Self::OneOff { remind_at } => Some(*remind_at),
            Self::Recurring { .. } => None,
        }
    }

    pub fn rule(&self) -> Option<&RecurrenceRule> {
        match self {
            Self::OneOff { .. } => None,
            Self::Recurring { rule } => Some(rule),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Reminder {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub notes: Option<String>,
    pub timezone: String,
    pub schedule: Schedule,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Reminder {
    /// Rascunho com os dados atuais, base de uma edição.
    pub fn to_draft(&self) -> ReminderDraft {
        ReminderDraft {
            title: self.title.clone(),
            notes: self.notes.clone(),
            visibility: self.visibility,
            timezone: Some(self.timezone.clone()),
            remind_at: self.schedule.remind_at(),
            rule: self.schedule.rule().cloned(),
        }
    }
}

/// Dados de um lembrete ainda não validados.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReminderDraft {
    pub title: String,
    pub notes: Option<String>,
    pub visibility: Visibility,
    pub timezone: Option<String>,
    pub remind_at: Option<DateTime<Utc>>,
    pub rule: Option<RecurrenceRule>,
}

/// Dados de um lembrete já validados, prontos para gravar.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidReminder {
    pub title: String,
    pub notes: Option<String>,
    pub visibility: Visibility,
    pub timezone: String,
    pub schedule: Schedule,
}

impl ReminderDraft {
    pub fn validate(self) -> Result<ValidReminder, RemindersError> {
        let mut issues = Vec::new();
        let title = self.title.trim().to_owned();
        if title.is_empty() {
            issues.push(FieldIssue::new("title", "required"));
        } else if title.chars().count() > TITLE_MAX_CHARS {
            issues.push(FieldIssue::new("title", "too_long"));
        }
        let notes = self.notes.filter(|notes| !notes.trim().is_empty());
        if notes
            .as_ref()
            .is_some_and(|notes| notes.chars().count() > NOTES_MAX_CHARS)
        {
            issues.push(FieldIssue::new("notes", "too_long"));
        }
        let schedule = schedule(self.timezone, self.remind_at, self.rule, &mut issues);
        match schedule {
            Some((timezone, schedule)) if issues.is_empty() => Ok(ValidReminder {
                title,
                notes,
                visibility: self.visibility,
                timezone,
                schedule,
            }),
            _ => Err(RemindersError::Validation(issues)),
        }
    }
}

fn schedule(
    timezone: Option<String>,
    remind_at: Option<DateTime<Utc>>,
    rule: Option<RecurrenceRule>,
    issues: &mut Vec<FieldIssue>,
) -> Option<(String, Schedule)> {
    match (remind_at, rule) {
        (Some(_), Some(_)) => {
            issues.push(FieldIssue::new("schedule", "conflicting_schedule"));
            None
        }
        (None, None) => {
            issues.push(FieldIssue::new("schedule", "missing_schedule"));
            None
        }
        (Some(remind_at), None) => one_off(timezone, remind_at, issues),
        (None, Some(rule)) => recurring(timezone, rule, issues),
    }
}

fn one_off(
    timezone: Option<String>,
    remind_at: DateTime<Utc>,
    issues: &mut Vec<FieldIssue>,
) -> Option<(String, Schedule)> {
    let Some(timezone) = timezone else {
        issues.push(FieldIssue::new("timezone", "required"));
        return None;
    };
    if timezone.parse::<Tz>().is_err() {
        issues.push(FieldIssue::new("timezone", "invalid_timezone"));
        return None;
    }
    Some((timezone, Schedule::OneOff { remind_at }))
}

fn recurring(
    timezone: Option<String>,
    rule: RecurrenceRule,
    issues: &mut Vec<FieldIssue>,
) -> Option<(String, Schedule)> {
    if let Err(error) = rule.validate() {
        issues.push(FieldIssue::new("rule", rule_issue(error)));
        return None;
    }
    // O fuso do lembrete recorrente é o da regra; um fuso diferente seria ambíguo.
    if timezone.is_some_and(|timezone| timezone != rule.timezone) {
        issues.push(FieldIssue::new("timezone", "timezone_mismatch"));
        return None;
    }
    Some((rule.timezone.clone(), Schedule::Recurring { rule }))
}

fn rule_issue(error: RecurrenceError) -> &'static str {
    match error {
        RecurrenceError::InvalidInterval => "invalid_interval",
        RecurrenceError::InvalidTimezone => "invalid_timezone",
        RecurrenceError::InvalidMonthDay => "invalid_month_day",
        RecurrenceError::EndsBeforeStart => "ends_before_start",
    }
}

/// Resultado do envio por Web Push de uma ocorrência.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PushStatus {
    Sent,
    Skipped,
    Failed,
}

impl PushStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sent => "sent",
            Self::Skipped => "skipped",
            Self::Failed => "failed",
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::{NaiveDate, NaiveTime};

    use super::*;
    use crate::shared::recurrence::Frequency;

    fn instant(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    fn daily_rule() -> RecurrenceRule {
        RecurrenceRule {
            frequency: Frequency::Daily,
            interval: 1,
            weekdays: Vec::new(),
            month_day: None,
            time: NaiveTime::from_hms_opt(8, 0, 0).unwrap(),
            timezone: "America/Sao_Paulo".to_owned(),
            starts_on: NaiveDate::from_ymd_opt(2026, 11, 1).unwrap(),
            ends_on: None,
        }
    }

    fn draft() -> ReminderDraft {
        ReminderDraft {
            title: "Tomar remédio".to_owned(),
            notes: None,
            visibility: Visibility::Personal,
            timezone: Some("America/Sao_Paulo".to_owned()),
            remind_at: Some(instant("2026-11-05T12:00:00Z")),
            rule: None,
        }
    }

    fn issues(result: Result<ValidReminder, RemindersError>) -> Vec<FieldIssue> {
        match result {
            Err(RemindersError::Validation(issues)) => issues,
            other => panic!("esperava erro de validação, veio {other:?}"),
        }
    }

    #[test]
    fn reminder_has_no_completion() {
        let valid = draft().validate().unwrap();
        let reminder = Reminder {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            visibility: valid.visibility,
            title: valid.title,
            notes: valid.notes,
            timezone: valid.timezone,
            schedule: valid.schedule,
            created_at: instant("2026-11-01T12:00:00Z"),
            updated_at: instant("2026-11-01T12:00:00Z"),
        };

        let json = serde_json::to_value(&reminder).unwrap();
        let mut keys: Vec<&str> = json
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        keys.sort_unstable();

        assert_eq!(
            keys,
            [
                "created_at",
                "id",
                "notes",
                "owner_id",
                "schedule",
                "timezone",
                "title",
                "updated_at",
                "visibility"
            ]
        );
        for field in ["completed_at", "completed", "done", "status"] {
            assert!(json.get(field).is_none(), "lembrete não tem {field}");
        }
    }

    #[test]
    fn one_off_requires_remind_at_and_recurring_requires_rule() {
        let missing = ReminderDraft {
            remind_at: None,
            ..draft()
        };
        let both = ReminderDraft {
            rule: Some(daily_rule()),
            ..draft()
        };
        let recurring = ReminderDraft {
            timezone: None,
            remind_at: None,
            rule: Some(daily_rule()),
            ..draft()
        };
        let one_off_without_timezone = ReminderDraft {
            timezone: None,
            ..draft()
        };

        assert_eq!(
            issues(missing.validate()),
            [FieldIssue::new("schedule", "missing_schedule")]
        );
        assert_eq!(
            issues(both.validate()),
            [FieldIssue::new("schedule", "conflicting_schedule")]
        );
        assert_eq!(
            issues(one_off_without_timezone.validate()),
            [FieldIssue::new("timezone", "required")]
        );
        assert_eq!(
            draft().validate().unwrap().schedule,
            Schedule::OneOff {
                remind_at: instant("2026-11-05T12:00:00Z")
            }
        );
        let valid = recurring.validate().unwrap();
        assert_eq!(valid.schedule.kind(), ReminderKind::Recurring);
        assert_eq!(valid.timezone, "America/Sao_Paulo");
    }

    #[test]
    fn recurring_rejects_invalid_rule_and_timezone_mismatch() {
        let invalid = ReminderDraft {
            remind_at: None,
            rule: Some(RecurrenceRule {
                interval: 0,
                ..daily_rule()
            }),
            ..draft()
        };
        let mismatch = ReminderDraft {
            timezone: Some("UTC".to_owned()),
            remind_at: None,
            rule: Some(daily_rule()),
            ..draft()
        };

        assert_eq!(
            issues(invalid.validate()),
            [FieldIssue::new("rule", "invalid_interval")]
        );
        assert_eq!(
            issues(mismatch.validate()),
            [FieldIssue::new("timezone", "timezone_mismatch")]
        );
    }

    #[test]
    fn title_is_required_and_limited_to_200_chars() {
        let blank = ReminderDraft {
            title: "   ".to_owned(),
            ..draft()
        };
        let long = ReminderDraft {
            title: "é".repeat(201),
            ..draft()
        };
        let limit = ReminderDraft {
            title: "é".repeat(200),
            ..draft()
        };

        assert_eq!(
            issues(blank.validate()),
            [FieldIssue::new("title", "required")]
        );
        assert_eq!(
            issues(long.validate()),
            [FieldIssue::new("title", "too_long")]
        );
        assert_eq!(limit.validate().unwrap().title.chars().count(), 200);
    }
}
