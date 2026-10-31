//! Casos de uso dos lembretes e a listagem dos próximos disparos (RF-40, RF-41).

use chrono::{DateTime, Duration, SecondsFormat, Utc};
use uuid::Uuid;

use crate::reminders::application::ports::{
    ReminderFilter, ReminderRecord, ReminderRepository, ReminderWrite,
};
use crate::reminders::domain::error::RemindersError;
use crate::reminders::domain::firing::{next_fire_from, occurrences_between};
use crate::reminders::domain::reminder::ReminderDraft;
use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;
use crate::shared::pagination::Cursor;
use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;

/// Maior intervalo pedido de uma vez aos próximos disparos.
pub const UPCOMING_MAX_DAYS: i64 = 31;

pub struct ReminderService<'a> {
    pub repository: &'a dyn ReminderRepository,
    pub clock: &'a dyn Clock,
    pub ids: &'a dyn IdGenerator,
}

/// Campos alterados numa edição; `None` mantém o valor atual.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ReminderPatch {
    pub title: Option<String>,
    pub notes: Option<Option<String>>,
    pub visibility: Option<Visibility>,
    pub timezone: Option<String>,
    pub remind_at: Option<DateTime<Utc>>,
    pub rule: Option<RecurrenceRule>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpcomingFire {
    pub reminder_id: Uuid,
    pub title: String,
    pub fire_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReminderPage {
    pub items: Vec<ReminderRecord>,
    pub next_cursor: Option<String>,
}

impl ReminderService<'_> {
    pub async fn create(
        &self,
        owner_id: Uuid,
        draft: ReminderDraft,
    ) -> Result<ReminderRecord, RemindersError> {
        let data = draft.validate()?;
        let now = self.clock.now();
        let next_fire_at = next_fire_from(&data.schedule, now);
        let write = ReminderWrite {
            id: self.ids.new_id(),
            owner_id,
            data,
            now,
            next_fire_at,
        };
        self.repository.create(write).await
    }

    pub async fn get(&self, owner_id: Uuid, id: Uuid) -> Result<ReminderRecord, RemindersError> {
        self.repository.get(owner_id, id).await
    }

    /// Mudar a regra só recalcula o próximo disparo a partir de agora (RN-08): as
    /// entregas já feitas ficam como estão.
    pub async fn update(
        &self,
        owner_id: Uuid,
        id: Uuid,
        patch: ReminderPatch,
    ) -> Result<ReminderRecord, RemindersError> {
        let current = self.repository.get(owner_id, id).await?;
        let data = apply(current.reminder.to_draft(), patch).validate()?;
        let now = self.clock.now();
        let next_fire_at = next_fire_from(&data.schedule, now);
        let write = ReminderWrite {
            id,
            owner_id,
            data,
            now,
            next_fire_at,
        };
        self.repository.update(write).await
    }

    pub async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<(), RemindersError> {
        self.repository.delete(owner_id, id, self.clock.now()).await
    }

    pub async fn list(
        &self,
        owner_id: Uuid,
        filter: ReminderFilter,
    ) -> Result<ReminderPage, RemindersError> {
        let limit = filter.limit as usize;
        // Um item a mais diz se existe a próxima página.
        let filter = ReminderFilter {
            limit: filter.limit + 1,
            ..filter
        };
        let mut items = self.repository.list(owner_id, filter).await?;
        let next_cursor = if items.len() > limit {
            items.truncate(limit);
            items.last().map(|last| cursor_of(last).encode())
        } else {
            None
        };
        Ok(ReminderPage { items, next_cursor })
    }

    /// Ocorrências em `[from, to)` de todos os lembretes do dono, para a aba aberta
    /// notificar (RF-41).
    pub async fn upcoming(
        &self,
        owner_id: Uuid,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<UpcomingFire>, RemindersError> {
        if from >= to {
            return Err(RemindersError::invalid("to", "must_be_after_from"));
        }
        if to - from > Duration::days(UPCOMING_MAX_DAYS) {
            return Err(RemindersError::invalid("to", "range_too_long"));
        }
        let reminders = self.repository.all_live(owner_id).await?;
        let mut fires: Vec<UpcomingFire> = reminders
            .into_iter()
            .flat_map(|reminder| {
                occurrences_between(&reminder.schedule, from, to)
                    .into_iter()
                    .map(move |fire_at| UpcomingFire {
                        reminder_id: reminder.id,
                        title: reminder.title.clone(),
                        fire_at,
                    })
            })
            .collect();
        fires.sort_by_key(|fire| (fire.fire_at, fire.reminder_id));
        Ok(fires)
    }
}

/// Cursor da listagem: `created_at` e `id` do último item.
pub fn cursor_of(record: &ReminderRecord) -> Cursor {
    let created_at = record
        .reminder
        .created_at
        .to_rfc3339_opts(SecondsFormat::Micros, true);
    Cursor::new(created_at, record.reminder.id)
}

/// Instante gravado na chave do cursor.
pub fn cursor_instant(cursor: &Cursor) -> Result<DateTime<Utc>, RemindersError> {
    cursor
        .sort_key
        .parse()
        .map_err(|_| RemindersError::invalid("cursor", "invalid_cursor"))
}

fn apply(mut draft: ReminderDraft, patch: ReminderPatch) -> ReminderDraft {
    if let Some(title) = patch.title {
        draft.title = title;
    }
    if let Some(notes) = patch.notes {
        draft.notes = notes;
    }
    if let Some(visibility) = patch.visibility {
        draft.visibility = visibility;
    }
    if patch.remind_at.is_some() || patch.rule.is_some() {
        // Um agendamento novo substitui o anterior; os dois juntos são recusados
        // pela validação. O recorrente herda o fuso da regra nova.
        draft.remind_at = patch.remind_at;
        draft.rule = patch.rule;
        if draft.rule.is_some() {
            draft.timezone = None;
        }
    } else if let (Some(timezone), Some(rule)) = (&patch.timezone, draft.rule.as_mut()) {
        // Trocar só o fuso de um recorrente move a regra para o novo fuso.
        rule.timezone.clone_from(timezone);
    }
    if let Some(timezone) = patch.timezone {
        draft.timezone = Some(timezone);
    }
    draft
}

#[cfg(test)]
mod tests {
    use chrono::{NaiveDate, NaiveTime};

    use super::*;
    use crate::reminders::domain::reminder::{Reminder, Schedule};
    use crate::shared::recurrence::Frequency;

    fn utc(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    fn rule() -> RecurrenceRule {
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

    fn record(schedule: Schedule) -> ReminderRecord {
        ReminderRecord {
            reminder: Reminder {
                id: Uuid::from_u128(1),
                owner_id: Uuid::from_u128(2),
                visibility: Visibility::Personal,
                title: "Água".to_owned(),
                notes: None,
                timezone: "America/Sao_Paulo".to_owned(),
                schedule,
                created_at: utc("2026-11-01T12:00:00Z"),
                updated_at: utc("2026-11-01T12:00:00Z"),
            },
            next_fire_at: None,
        }
    }

    #[test]
    fn patch_with_rule_turns_one_off_into_recurring() {
        let current = record(Schedule::OneOff {
            remind_at: utc("2026-11-05T12:00:00Z"),
        });
        let patch = ReminderPatch {
            rule: Some(rule()),
            ..ReminderPatch::default()
        };

        let valid = apply(current.reminder.to_draft(), patch)
            .validate()
            .unwrap();

        assert_eq!(valid.schedule, Schedule::Recurring { rule: rule() });
    }

    #[test]
    fn patch_timezone_moves_recurring_rule() {
        let current = record(Schedule::Recurring { rule: rule() });
        let patch = ReminderPatch {
            timezone: Some("UTC".to_owned()),
            ..ReminderPatch::default()
        };

        let valid = apply(current.reminder.to_draft(), patch)
            .validate()
            .unwrap();

        assert_eq!(valid.timezone, "UTC");
        assert_eq!(valid.schedule.rule().unwrap().timezone, "UTC");
    }

    #[test]
    fn cursor_round_trips_created_at() {
        let record = record(Schedule::Recurring { rule: rule() });

        let cursor = cursor_of(&record);

        assert_eq!(cursor_instant(&cursor).unwrap(), record.reminder.created_at);
        assert_eq!(cursor.id, record.reminder.id);
    }
}
