//! Movimentação recorrente com uma única ocorrência aberta (PD-51, DEC-003): a regra
//! de `shared`, com o fuso de origem, o modelo da movimentação e `last_closed_on`, a
//! data da última ocorrência liquidada ou pulada. A aberta é a primeira data da regra
//! depois dela e não é gravada como linha. Liquidar a aberta devolve uma cópia
//! liquidada, sem recorrência; pular só avança. Mudar a recorrente vale para a aberta
//! e as seguintes, e as cópias já liquidadas não mudam (RN-08, RN-09).

use chrono::{DateTime, Duration, NaiveDate, NaiveTime, Utc};
use chrono_tz::Tz;
use uuid::Uuid;

use crate::finance::domain::FinanceError;
use crate::finance::domain::transaction::{ItemStatus, Transaction, TransactionKind};
use crate::shared::money::Currency;
use crate::shared::recurrence::{Frequency, RecurrenceError, RecurrenceRule};
use crate::shared::visibility::Visibility;

/// Limite da busca pela data vizinha da regra, para um intervalo absurdo não varrer
/// séculos de datas.
const MAX_SEARCH_DAYS: i64 = 366 * 100;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecurringTransaction {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub kind: TransactionKind,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub expected_amount: i64,
    pub currency: Currency,
    pub rule: RecurrenceRule,
    pub description: Option<String>,
    /// Data da última ocorrência liquidada ou pulada; nula antes da primeira.
    pub last_closed_on: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Pedido de liquidação da ocorrência aberta.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OccurrenceSettlement {
    pub occurrence_date: NaiveDate,
    pub settled_amount: i64,
    pub settled_at: NaiveDate,
}

pub fn validate_rule(rule: &RecurrenceRule) -> Result<(), FinanceError> {
    rule.validate().map_err(|error| {
        let code = match error {
            RecurrenceError::InvalidInterval => "invalid_interval",
            RecurrenceError::InvalidTimezone => "invalid_timezone",
            RecurrenceError::InvalidMonthDay => "invalid_month_day",
            RecurrenceError::EndsBeforeStart => "ends_before_start",
        };
        FinanceError::invalid("rule", code)
    })
}

/// Datas locais (no fuso da regra) das ocorrências em `[from, to]`.
pub fn occurrence_dates(rule: &RecurrenceRule, from: NaiveDate, to: NaiveDate) -> Vec<NaiveDate> {
    let Ok(tz) = rule.timezone.parse::<Tz>() else {
        return Vec::new();
    };
    if from > to {
        return Vec::new();
    }
    // Folga de dois dias nas pontas: o instante em UTC pode cair no dia vizinho.
    let start = (from - Duration::days(2))
        .and_time(NaiveTime::MIN)
        .and_utc();
    let end = (to + Duration::days(2)).and_time(NaiveTime::MIN).and_utc();
    rule.occurrences_between(start, end)
        .into_iter()
        .map(|instant| instant.with_timezone(&tz).date_naive())
        .filter(|date| (from..=to).contains(date))
        .collect()
}

/// Maior distância possível entre duas datas seguidas da regra, com folga.
fn max_gap_days(rule: &RecurrenceRule) -> i64 {
    let period: i64 = match rule.frequency {
        Frequency::Daily => 1,
        Frequency::Weekly => 7,
        Frequency::Monthly => 31,
        Frequency::Yearly => 366,
    };
    let interval = i64::from(rule.interval.max(1));
    period
        .saturating_mul(interval)
        .saturating_add(period)
        .min(MAX_SEARCH_DAYS)
        + 2
}

/// Primeira data da regra depois de `after` (ou a primeira a partir do início, sem
/// `after`), sem passar do fim da regra.
pub fn next_date_after(rule: &RecurrenceRule, after: Option<NaiveDate>) -> Option<NaiveDate> {
    let start = match after {
        Some(date) => date.succ_opt()?.max(rule.starts_on),
        None => rule.starts_on,
    };
    let mut end = start.checked_add_signed(Duration::days(max_gap_days(rule)))?;
    if let Some(ends_on) = rule.ends_on {
        end = end.min(ends_on);
    }
    occurrence_dates(rule, start, end).into_iter().next()
}

/// Última data da regra antes de `before`, desde o início da regra.
pub fn previous_date_before(rule: &RecurrenceRule, before: NaiveDate) -> Option<NaiveDate> {
    let end = before.pred_opt()?;
    if end < rule.starts_on {
        return None;
    }
    let start = end
        .checked_sub_signed(Duration::days(max_gap_days(rule)))
        .map_or(rule.starts_on, |date| date.max(rule.starts_on));
    occurrence_dates(rule, start, end).into_iter().last()
}

impl RecurringTransaction {
    /// A ocorrência aberta: a primeira data da regra depois de `last_closed_on`. Sem
    /// data, a recorrente terminou.
    pub fn open_occurrence(&self) -> Option<NaiveDate> {
        next_date_after(&self.rule, self.last_closed_on)
    }

    /// Hoje no fuso da regra ([project/code-style-06]).
    pub fn today(&self, now: DateTime<Utc>) -> NaiveDate {
        self.rule
            .timezone
            .parse::<Tz>()
            .map_or(now.date_naive(), |tz| now.with_timezone(&tz).date_naive())
    }

    /// A aberta e o status dela: atrasada depois da data, até ser liquidada ou pulada.
    pub fn open_status(&self, now: DateTime<Utc>) -> Option<(NaiveDate, ItemStatus)> {
        let open = self.open_occurrence()?;
        Some((open, ItemStatus::pending(open, self.today(now))))
    }

    fn ensure_open(&self, occurrence_date: NaiveDate) -> Result<(), FinanceError> {
        match self.open_occurrence() {
            None => Err(FinanceError::RecurrenceEnded),
            Some(open) if open == occurrence_date => Ok(()),
            Some(_) => Err(FinanceError::OccurrenceNotOpen),
        }
    }

    /// Liquida a aberta: devolve a cópia liquidada, com o modelo e o valor atuais, e a
    /// variação do saldo; a recorrente passa para a ocorrência seguinte.
    pub fn settle_open(
        &mut self,
        copy_id: Uuid,
        request: OccurrenceSettlement,
        now: DateTime<Utc>,
    ) -> Result<(Transaction, i64), FinanceError> {
        self.ensure_open(request.occurrence_date)?;
        let mut copy = Transaction {
            id: copy_id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            kind: self.kind,
            account_id: self.account_id,
            category_id: self.category_id,
            description: self.description.clone(),
            expected_amount: self.expected_amount,
            expected_date: request.occurrence_date,
            currency: self.currency,
            settlement: None,
            generated_from: Some(self.id),
            occurrence_date: Some(request.occurrence_date),
            created_at: now,
            updated_at: now,
        };
        let delta = copy.settle(request.settled_amount, request.settled_at, now)?;
        self.close(request.occurrence_date, now);
        Ok((copy, delta))
    }

    /// Pula a aberta, sem cópia.
    pub fn skip_open(
        &mut self,
        occurrence_date: NaiveDate,
        now: DateTime<Utc>,
    ) -> Result<(), FinanceError> {
        self.ensure_open(occurrence_date)?;
        self.close(occurrence_date, now);
        Ok(())
    }

    /// Excluir a cópia do último fechamento reabre aquela ocorrência: `last_closed_on`
    /// volta para a data anterior da regra atual (DEC-004). Devolve se mudou.
    pub fn reopen_after_copy_deleted(
        &mut self,
        occurrence_date: NaiveDate,
        now: DateTime<Utc>,
    ) -> bool {
        if self.last_closed_on != Some(occurrence_date) {
            return false;
        }
        self.last_closed_on = previous_date_before(&self.rule, occurrence_date);
        self.updated_at = now;
        true
    }

    fn close(&mut self, occurrence_date: NaiveDate, now: DateTime<Utc>) {
        self.last_closed_on = Some(occurrence_date);
        self.updated_at = now;
    }
}

#[cfg(test)]
pub(crate) mod fixtures {
    use super::*;
    use crate::finance::domain::transaction::fixtures::{date, instant};

    pub fn rule(frequency: Frequency, starts_on: &str, month_day: Option<u32>) -> RecurrenceRule {
        RecurrenceRule {
            frequency,
            interval: 1,
            weekdays: Vec::new(),
            month_day,
            time: NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
            timezone: "America/Sao_Paulo".to_owned(),
            starts_on: date(starts_on),
            ends_on: None,
        }
    }

    /// Aluguel mensal no dia 31 a partir de 31/01/2027.
    pub fn rent() -> RecurringTransaction {
        RecurringTransaction {
            id: Uuid::from_u128(50),
            owner_id: Uuid::from_u128(1),
            visibility: Visibility::Personal,
            kind: TransactionKind::Expense,
            account_id: Uuid::from_u128(2),
            category_id: None,
            expected_amount: 200_000,
            currency: Currency::default(),
            rule: rule(Frequency::Monthly, "2027-01-31", Some(31)),
            description: Some("Aluguel".to_owned()),
            last_closed_on: None,
            created_at: instant(),
            updated_at: instant(),
        }
    }

    pub fn settlement(day: &str, amount: i64) -> OccurrenceSettlement {
        OccurrenceSettlement {
            occurrence_date: date(day),
            settled_amount: amount,
            settled_at: date(day),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::fixtures::{rent, rule, settlement};
    use super::*;
    use crate::finance::domain::forecast::project;
    use crate::finance::domain::transaction::fixtures::{date, instant};

    #[test]
    fn monthly_on_31_falls_on_last_day_of_short_months() {
        let rule = rule(Frequency::Monthly, "2027-01-31", Some(31));

        let dates = occurrence_dates(&rule, date("2027-01-01"), date("2027-04-30"));

        assert_eq!(
            dates,
            [
                date("2027-01-31"),
                date("2027-02-28"),
                date("2027-03-31"),
                date("2027-04-30")
            ]
        );
    }

    #[test]
    fn yearly_on_feb_29_falls_on_feb_28_in_common_year() {
        let rule = rule(Frequency::Yearly, "2028-02-29", None);

        let dates = occurrence_dates(&rule, date("2028-01-01"), date("2030-12-31"));

        assert_eq!(
            dates,
            [date("2028-02-29"), date("2029-02-28"), date("2030-02-28")]
        );
    }

    #[test]
    fn open_occurrence_is_first_rule_date_after_last_closed() {
        let mut rent = rent();
        assert_eq!(rent.open_occurrence(), Some(date("2027-01-31")));

        rent.last_closed_on = Some(date("2027-01-31"));
        assert_eq!(rent.open_occurrence(), Some(date("2027-02-28")));

        rent.last_closed_on = Some(date("2027-02-28"));
        assert_eq!(rent.open_occurrence(), Some(date("2027-03-31")));
    }

    #[test]
    fn settling_open_occurrence_returns_settled_copy_without_recurrence() {
        let mut rent = rent();

        let (copy, delta) = rent
            .settle_open(
                Uuid::from_u128(100),
                OccurrenceSettlement {
                    occurrence_date: date("2027-01-31"),
                    settled_amount: 190_000,
                    settled_at: date("2027-01-30"),
                },
                instant(),
            )
            .unwrap();

        assert_eq!(copy.id, Uuid::from_u128(100));
        assert_eq!(copy.generated_from, Some(rent.id));
        assert_eq!(copy.occurrence_date, Some(date("2027-01-31")));
        assert_eq!(copy.expected_date, date("2027-01-31"));
        assert_eq!(copy.expected_amount, 200_000);
        assert_eq!(copy.description.as_deref(), Some("Aluguel"));
        assert_eq!(copy.effective_date(), date("2027-01-30"));
        assert!(copy.is_settled());
        assert_eq!(delta, -190_000);
        assert_eq!(rent.last_closed_on, Some(date("2027-01-31")));
        assert_eq!(rent.open_occurrence(), Some(date("2027-02-28")));
    }

    #[test]
    fn skipping_open_occurrence_advances_without_copy() {
        let mut rent = rent();

        rent.skip_open(date("2027-01-31"), instant()).unwrap();

        assert_eq!(rent.last_closed_on, Some(date("2027-01-31")));
        assert_eq!(rent.open_occurrence(), Some(date("2027-02-28")));
        assert!(matches!(
            rent.skip_open(date("2027-01-31"), instant()),
            Err(FinanceError::OccurrenceNotOpen)
        ));
    }

    #[test]
    fn unsettled_open_occurrence_is_overdue_and_does_not_advance() {
        let rent = rent();
        let before = "2027-01-31T11:00:00Z".parse().unwrap();
        // 01/02 às 01h em UTC ainda é 31/01 em São Paulo.
        let same_local_day = "2027-02-01T01:00:00Z".parse().unwrap();
        let months_later = "2027-04-15T12:00:00Z".parse().unwrap();

        assert_eq!(
            rent.open_status(before),
            Some((date("2027-01-31"), ItemStatus::Open))
        );
        assert_eq!(
            rent.open_status(same_local_day),
            Some((date("2027-01-31"), ItemStatus::Open))
        );
        assert_eq!(
            rent.open_status(months_later),
            Some((date("2027-01-31"), ItemStatus::Overdue))
        );
    }

    #[test]
    fn recurrence_without_dates_after_ends_on_has_no_open_occurrence() {
        let mut rent = rent();
        rent.rule.ends_on = Some(date("2027-02-15"));

        rent.settle_open(
            Uuid::from_u128(100),
            settlement("2027-01-31", 200_000),
            instant(),
        )
        .unwrap();

        assert_eq!(rent.open_occurrence(), None);
        assert!(matches!(
            rent.skip_open(date("2027-02-28"), instant()),
            Err(FinanceError::RecurrenceEnded)
        ));
    }

    #[test]
    fn rule_or_amount_change_affects_open_and_following_occurrences_only() {
        let mut rent = rent();
        let (january, _) = rent
            .settle_open(
                Uuid::from_u128(100),
                settlement("2027-01-31", 200_000),
                instant(),
            )
            .unwrap();

        rent.expected_amount = 210_000;
        let forecast = project(&rent, None, Some(date("2027-03-31")), instant(), usize::MAX);
        assert_eq!(
            forecast
                .iter()
                .map(|item| (item.occurrence_date, item.expected_amount))
                .collect::<Vec<_>>(),
            [(date("2027-02-28"), 210_000), (date("2027-03-31"), 210_000)]
        );

        rent.rule = rule(Frequency::Monthly, "2027-01-15", Some(15));
        assert_eq!(rent.open_occurrence(), Some(date("2027-02-15")));
        assert_eq!(january.expected_amount, 200_000);
        assert_eq!(january.occurrence_date, Some(date("2027-01-31")));
    }

    #[test]
    fn each_occurrence_is_settled_separately() {
        let mut rent = rent();

        let (january, _) = rent
            .settle_open(
                Uuid::from_u128(100),
                settlement("2027-01-31", 200_000),
                instant(),
            )
            .unwrap();
        let again = rent.settle_open(
            Uuid::from_u128(101),
            settlement("2027-01-31", 200_000),
            instant(),
        );
        let (february, _) = rent
            .settle_open(
                Uuid::from_u128(102),
                settlement("2027-02-28", 205_000),
                instant(),
            )
            .unwrap();

        assert!(matches!(again, Err(FinanceError::OccurrenceNotOpen)));
        assert_eq!(january.occurrence_date, Some(date("2027-01-31")));
        assert_eq!(february.occurrence_date, Some(date("2027-02-28")));
        assert_eq!(february.settlement.unwrap().settled_amount, 205_000);
        assert_eq!(rent.open_occurrence(), Some(date("2027-03-31")));
    }

    #[test]
    fn deleting_copy_of_last_closing_reopens_that_occurrence() {
        let mut rent = rent();
        rent.last_closed_on = Some(date("2027-02-28"));

        assert!(!rent.reopen_after_copy_deleted(date("2027-01-31"), instant()));
        assert_eq!(rent.open_occurrence(), Some(date("2027-03-31")));
        assert!(rent.reopen_after_copy_deleted(date("2027-02-28"), instant()));
        assert_eq!(rent.last_closed_on, Some(date("2027-01-31")));
        assert_eq!(rent.open_occurrence(), Some(date("2027-02-28")));
        assert!(rent.reopen_after_copy_deleted(date("2027-01-31"), instant()));
        assert_eq!(rent.last_closed_on, None);
        assert_eq!(rent.open_occurrence(), Some(date("2027-01-31")));
    }
}
