//! Consignado descontado em folha (SPEC-006): ligado a uma entrada avulsa ou recorrente, com
//! parcela fixa e prazo por total de parcelas ou por data final. As parcelas seguem as datas da
//! entrada (RN-07) e são numeradas a partir de `starts_on`, a data da parcela atual; o status é
//! calculado (RF-03, RF-04, RF-10).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::finance::domain::recurring_transaction::{
    RecurringTransaction, next_date_after, occurrence_dates,
};
use crate::finance::domain::transaction::{Transaction, TransactionKind};
use crate::finance::domain::{FinanceError, optional_text, required_name};
use crate::shared::money::Currency;
use crate::shared::visibility::Visibility;

pub const NAME_MAX_CHARS: usize = 60;
pub const CONTRACT_NUMBER_MAX_CHARS: usize = 40;
pub const MAX_INSTALLMENTS: i16 = 999;

/// A entrada de origem: avulsa ou recorrente, exatamente uma (RF-02).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IncomeLink {
    Transaction(Uuid),
    Recurrence(Uuid),
}

/// Prazo: total de parcelas com o número da parcela atual, ou a data da última (RF-04, RN-05).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoanTerm {
    Installments { total: i16, current: i16 },
    EndsOn(NaiveDate),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PayrollLoanStatus {
    Active,
    Ended,
}

/// Uma parcela: a data da entrada e o número, nulo no prazo por data.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Installment {
    pub date: NaiveDate,
    pub number: Option<i16>,
}

/// Ligação da parcela liquidada: o consignado, a entrada liquidada (avulsa ou cópia da
/// recorrente) e o número, nulo no prazo por data (RF-13).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PayrollInstallment {
    pub loan_id: Uuid,
    pub income_transaction_id: Uuid,
    pub number: Option<i16>,
}

/// A entrada de origem já lida, com as datas sobre as quais o prazo é calculado.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IncomeSource {
    OneOff(Transaction),
    Recurring(RecurringTransaction),
}

impl IncomeSource {
    /// A data da entrada ainda aberta: a avulsa enquanto não liquidada, a ocorrência aberta
    /// da recorrente.
    pub fn open_date(&self) -> Option<NaiveDate> {
        match self {
            Self::OneOff(item) => (!item.is_settled()).then_some(item.expected_date),
            Self::Recurring(rule) => rule.open_occurrence(),
        }
    }
}

/// As datas da entrada a partir de `starts_on`, até onde o prazo pode chegar. Saem da regra
/// atual da entrada, então mudar a periodicidade muda as parcelas sem regravar o consignado
/// (RN-07).
pub fn income_dates(loan: &PayrollLoan, source: &IncomeSource) -> Vec<NaiveDate> {
    let rule = match source {
        IncomeSource::OneOff(item) => return vec![item.expected_date],
        IncomeSource::Recurring(recurring) => &recurring.rule,
    };
    match loan.term {
        LoanTerm::EndsOn(ends_on) => occurrence_dates(rule, loan.starts_on, ends_on),
        LoanTerm::Installments { total, current } => {
            let count = usize::try_from(total - current + 1)
                .unwrap_or(0)
                .min(usize::try_from(MAX_INSTALLMENTS).unwrap_or(0));
            let mut dates = Vec::with_capacity(count);
            let mut next = next_date_after(rule, loan.starts_on.pred_opt());
            while let Some(date) = next.filter(|_| dates.len() < count) {
                dates.push(date);
                next = next_date_after(rule, Some(date));
            }
            dates
        }
    }
}

/// O líquido da entrada na liquidação. Sem parcelas no período, vale o `settled_amount` de
/// sempre; com parcelas, vem só `account_amount`, o que caiu na conta, e o líquido é ele mais
/// a soma das parcelas (RN-02, RF-08, decisão 12 da spec).
pub fn income_settled_amount(
    settled_amount: Option<i64>,
    account_amount: Option<i64>,
    installments_total: i64,
) -> Result<i64, FinanceError> {
    if installments_total == 0 {
        if account_amount.is_some() {
            return Err(FinanceError::invalid("account_amount", "fields_mismatch"));
        }
        return settled_amount.ok_or_else(|| FinanceError::invalid("settled_amount", "required"));
    }
    if settled_amount.is_some() {
        return Err(FinanceError::invalid("account_amount", "fields_mismatch"));
    }
    let account_amount =
        account_amount.ok_or_else(|| FinanceError::invalid("account_amount", "required"))?;
    if account_amount < 0 {
        return Err(FinanceError::invalid(
            "account_amount",
            "must_not_be_negative",
        ));
    }
    // Um valor abaixo da soma das parcelas é aceito (CB-04, decisão 13 da spec): a pessoa
    // decidiu que só a tela avisa antes de confirmar, e o líquido continua não negativo.
    account_amount
        .checked_add(installments_total)
        .ok_or_else(|| FinanceError::invalid("account_amount", "too_large"))
}

/// A saída já liquidada de uma parcela, na data, na conta e na liquidação da entrada, com o
/// valor fixo da parcela (RF-07, RN-03). Não usa `generated_from`: a ligação é `payroll`.
pub fn settled_installment(
    loan: &PayrollLoan,
    income: &Transaction,
    number: Option<i16>,
    id: Uuid,
    now: DateTime<Utc>,
) -> Result<Transaction, FinanceError> {
    let settled_at = income
        .settlement
        .map(|done| done.settled_at)
        .ok_or(FinanceError::TransactionNotSettled)?;
    let mut item = Transaction {
        id,
        owner_id: income.owner_id,
        visibility: income.visibility,
        kind: TransactionKind::Expense,
        account_id: income.account_id,
        category_id: Some(loan.category_id),
        description: Some(loan.name.clone()),
        expected_amount: loan.installment_amount,
        gross_amount: loan.installment_amount,
        adjustments: Vec::new(),
        expected_date: income.occurrence_date.unwrap_or(income.expected_date),
        currency: income.currency,
        settlement: None,
        settled_adjustments: Vec::new(),
        generated_from: None,
        occurrence_date: None,
        payroll: Some(PayrollInstallment {
            loan_id: loan.id,
            income_transaction_id: income.id,
            number,
        }),
        created_at: now,
        updated_at: now,
    };
    item.settle_with(loan.installment_amount, settled_at, None, now)?;
    Ok(item)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoanFields {
    pub name: String,
    pub contract_number: Option<String>,
    pub installment_amount: i64,
}

pub fn validate_fields(
    name: &str,
    contract_number: Option<String>,
    installment_amount: i64,
) -> Result<LoanFields, FinanceError> {
    let name = required_name(name, "name", NAME_MAX_CHARS)?;
    let contract_number = optional_text(
        contract_number,
        "contract_number",
        CONTRACT_NUMBER_MAX_CHARS,
    )?;
    if installment_amount <= 0 {
        return Err(FinanceError::invalid(
            "installment_amount",
            "must_be_positive",
        ));
    }
    Ok(LoanFields {
        name,
        contract_number,
        installment_amount,
    })
}

/// Exatamente um modo de prazo; a data final não pode ficar antes da próxima parcela (CB-03).
pub fn validate_term(
    total_installments: Option<i16>,
    current_installment: Option<i16>,
    ends_on: Option<NaiveDate>,
    next_income_date: NaiveDate,
) -> Result<LoanTerm, FinanceError> {
    match (total_installments, current_installment, ends_on) {
        (Some(total), Some(current), None) => {
            if !(1..=MAX_INSTALLMENTS).contains(&total) {
                return Err(FinanceError::invalid("total_installments", "out_of_range"));
            }
            if !(1..=total).contains(&current) {
                return Err(FinanceError::invalid("current_installment", "out_of_range"));
            }
            Ok(LoanTerm::Installments { total, current })
        }
        (None, None, Some(ends_on)) => {
            if ends_on < next_income_date {
                return Err(FinanceError::invalid("ends_on", "before_next_installment"));
            }
            Ok(LoanTerm::EndsOn(ends_on))
        }
        _ => Err(FinanceError::invalid("ends_on", "fields_mismatch")),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PayrollLoan {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub income: IncomeLink,
    pub category_id: Uuid,
    pub name: String,
    pub contract_number: Option<String>,
    pub installment_amount: i64,
    pub currency: Currency,
    pub term: LoanTerm,
    /// Data da parcela de número `current_installment`; regravada quando a pessoa edita a
    /// parcela atual.
    pub starts_on: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl PayrollLoan {
    /// As parcelas sobre as datas da entrada, em ordem. A lista vem da regra da entrada, então
    /// mudar a periodicidade muda as parcelas sem regravar o consignado (RN-07).
    pub fn installments(&self, income_dates: &[NaiveDate]) -> Vec<Installment> {
        let dates = income_dates
            .iter()
            .copied()
            .filter(|date| *date >= self.starts_on);
        match self.term {
            LoanTerm::Installments { total, current } => dates
                .enumerate()
                .map_while(|(offset, date)| {
                    let number = i16::try_from(offset).ok()?.checked_add(current)?;
                    (number <= total).then_some(Installment {
                        date,
                        number: Some(number),
                    })
                })
                .collect(),
            LoanTerm::EndsOn(ends_on) => dates
                .take_while(|date| *date <= ends_on)
                .map(|date| Installment { date, number: None })
                .collect(),
        }
    }

    pub fn installment_on(
        &self,
        income_dates: &[NaiveDate],
        date: NaiveDate,
    ) -> Option<Installment> {
        self.installments(income_dates)
            .into_iter()
            .find(|item| item.date == date)
    }

    /// Ativo enquanto a data aberta da entrada tem parcela; sem ela, encerrado (RF-10, CB-01).
    pub fn status_at(
        &self,
        income_dates: &[NaiveDate],
        open_income_date: Option<NaiveDate>,
    ) -> PayrollLoanStatus {
        match open_income_date {
            Some(date) if self.installment_on(income_dates, date).is_some() => {
                PayrollLoanStatus::Active
            }
            _ => PayrollLoanStatus::Ended,
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::Months;

    use super::*;
    use crate::finance::domain::transaction::fixtures;

    fn date(text: &str) -> NaiveDate {
        fixtures::date(text)
    }

    fn monthly(first: &str, count: u32) -> Vec<NaiveDate> {
        let start = date(first);
        (0..count)
            .map(|i| start.checked_add_months(Months::new(i)).unwrap())
            .collect()
    }

    fn loan(term: LoanTerm, starts_on: &str) -> PayrollLoan {
        PayrollLoan {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            visibility: Visibility::Personal,
            income: IncomeLink::Recurrence(Uuid::from_u128(4)),
            category_id: Uuid::from_u128(3),
            name: "Empréstimo 178176138".to_owned(),
            contract_number: Some("178176138".to_owned()),
            installment_amount: 293_723,
            currency: Currency::default(),
            term,
            starts_on: date(starts_on),
            created_at: fixtures::instant(),
            updated_at: fixtures::instant(),
        }
    }

    fn issue(result: Result<impl std::fmt::Debug, FinanceError>) -> (&'static str, &'static str) {
        match result {
            Err(FinanceError::Validation(issues)) => {
                let first = issues.first().copied().unwrap();
                (first.field, first.code)
            }
            other => panic!("esperava erro de validação, veio {other:?}"),
        }
    }

    fn numbered(date_text: &str, number: i16) -> Installment {
        Installment {
            date: date(date_text),
            number: Some(number),
        }
    }

    #[test]
    fn pl_rf03_fields_are_validated() {
        let fields = validate_fields(
            "  Empréstimo 178176138  ",
            Some(" 178176138 ".into()),
            293_723,
        )
        .unwrap();
        assert_eq!(
            fields,
            LoanFields {
                name: "Empréstimo 178176138".to_owned(),
                contract_number: Some("178176138".to_owned()),
                installment_amount: 293_723,
            }
        );
        assert_eq!(issue(validate_fields("  ", None, 1)), ("name", "required"));
        assert_eq!(
            issue(validate_fields(&"x".repeat(61), None, 1)),
            ("name", "too_long")
        );
        assert!(validate_fields(&"x".repeat(60), None, 1).is_ok());
        assert_eq!(
            issue(validate_fields("A", Some("9".repeat(41)), 1)),
            ("contract_number", "too_long")
        );
        assert_eq!(
            validate_fields("A", Some(String::new()), 1)
                .unwrap()
                .contract_number,
            None
        );
        for amount in [0, -1] {
            assert_eq!(
                issue(validate_fields("A", None, amount)),
                ("installment_amount", "must_be_positive")
            );
        }
    }

    #[test]
    fn pl_cb02_current_installment_outside_total_is_refused() {
        let next = date("2026-11-05");
        assert_eq!(
            issue(validate_term(Some(48), Some(49), None, next)),
            ("current_installment", "out_of_range")
        );
        assert_eq!(
            issue(validate_term(Some(48), Some(0), None, next)),
            ("current_installment", "out_of_range")
        );
        assert_eq!(
            issue(validate_term(Some(0), Some(1), None, next)),
            ("total_installments", "out_of_range")
        );
        assert_eq!(
            issue(validate_term(Some(1000), Some(1), None, next)),
            ("total_installments", "out_of_range")
        );
        assert_eq!(
            validate_term(Some(48), Some(48), None, next).unwrap(),
            LoanTerm::Installments {
                total: 48,
                current: 48
            }
        );
    }

    #[test]
    fn pl_cb03_end_date_before_next_installment_is_refused() {
        assert_eq!(
            issue(validate_term(
                None,
                None,
                Some(date("2026-11-04")),
                date("2026-11-05")
            )),
            ("ends_on", "before_next_installment")
        );
        assert_eq!(
            validate_term(None, None, Some(date("2026-11-05")), date("2026-11-05")).unwrap(),
            LoanTerm::EndsOn(date("2026-11-05"))
        );
    }

    #[test]
    fn pl_rf04_term_needs_exactly_one_mode() {
        let next = date("2026-11-05");
        for (total, current, ends_on) in [
            (Some(48), Some(12), Some(date("2027-03-20"))),
            (None, None, None),
            (Some(48), None, None),
            (None, Some(12), None),
        ] {
            assert_eq!(
                issue(validate_term(total, current, ends_on, next)),
                ("ends_on", "fields_mismatch")
            );
        }
    }

    #[test]
    fn pl_ct02_end_date_sets_last_installment() {
        let installments = loan(LoanTerm::EndsOn(date("2027-03-20")), "2026-11-05")
            .installments(&monthly("2026-11-05", 8));
        let expected: Vec<Installment> = [
            "2026-11-05",
            "2026-12-05",
            "2027-01-05",
            "2027-02-05",
            "2027-03-05",
        ]
        .into_iter()
        .map(|text| Installment {
            date: date(text),
            number: None,
        })
        .collect();
        assert_eq!(installments, expected);
    }

    #[test]
    fn pl_ct07_installments_stop_at_total() {
        let loan = loan(
            LoanTerm::Installments {
                total: 48,
                current: 12,
            },
            "2026-11-05",
        );
        let dates = monthly("2026-11-05", 40);
        let installments = loan.installments(&dates);
        assert_eq!(installments.len(), 37);
        assert_eq!(installments.first(), Some(&numbered("2026-11-05", 12)));
        assert_eq!(installments.last(), Some(&numbered("2029-11-05", 48)));
        assert_eq!(loan.installment_on(&dates, date("2029-12-05")), None);
    }

    #[test]
    fn pl_rf10_status_ends_after_last_installment() {
        let by_total = loan(
            LoanTerm::Installments {
                total: 48,
                current: 12,
            },
            "2026-11-05",
        );
        let dates = monthly("2026-11-05", 40);
        assert_eq!(
            by_total.status_at(&dates, Some(date("2029-11-05"))),
            PayrollLoanStatus::Active
        );
        assert_eq!(
            by_total.status_at(&dates, Some(date("2029-12-05"))),
            PayrollLoanStatus::Ended
        );
        assert_eq!(by_total.status_at(&dates, None), PayrollLoanStatus::Ended);
        let by_date = loan(LoanTerm::EndsOn(date("2027-03-20")), "2026-11-05");
        assert_eq!(
            by_date.status_at(&monthly("2026-11-05", 8), Some(date("2027-04-05"))),
            PayrollLoanStatus::Ended
        );
    }

    #[test]
    fn pl_numbering_counts_dates_after_starts_on() {
        let loan = loan(
            LoanTerm::Installments {
                total: 48,
                current: 12,
            },
            "2026-11-05",
        );
        let dates = monthly("2026-10-05", 6);
        assert_eq!(
            loan.installment_on(&dates, date("2027-01-05")),
            Some(numbered("2027-01-05", 14))
        );
        assert_eq!(loan.installment_on(&dates, date("2026-10-05")), None);
    }

    #[test]
    fn pl_ct04_account_amount_adds_installments() {
        assert_eq!(
            income_settled_amount(None, Some(692_318), 374_670).unwrap(),
            1_066_988
        );
        assert_eq!(
            income_settled_amount(None, Some(700_000), 374_670).unwrap(),
            1_074_670
        );
        assert_eq!(
            income_settled_amount(None, Some(374_670), 374_670).unwrap(),
            749_340
        );
    }

    #[test]
    fn pl_cb04_account_amount_below_installments_is_accepted() {
        assert_eq!(
            income_settled_amount(None, Some(374_669), 374_670).unwrap(),
            749_339
        );
        assert_eq!(
            income_settled_amount(None, Some(0), 374_670).unwrap(),
            374_670
        );
        assert_eq!(
            issue(income_settled_amount(None, Some(-1), 374_670)),
            ("account_amount", "must_not_be_negative")
        );
    }

    #[test]
    fn pl_settlement_value_fields_are_exclusive() {
        for (settled, account, total) in [
            (Some(1_000), None, 374_670),
            (None, Some(1_000), 0),
            (Some(1_000), Some(1_000), 0),
        ] {
            assert_eq!(
                issue(income_settled_amount(settled, account, total)),
                ("account_amount", "fields_mismatch")
            );
        }
        assert_eq!(
            issue(income_settled_amount(None, None, 374_670)),
            ("account_amount", "required")
        );
        assert_eq!(
            issue(income_settled_amount(None, None, 0)),
            ("settled_amount", "required")
        );
        assert_eq!(income_settled_amount(Some(1_000), None, 0).unwrap(), 1_000);
    }

    #[test]
    fn pl_settled_installment_copies_income_date_and_account() {
        use crate::finance::domain::transaction::TransactionKind;

        let loan = loan(
            LoanTerm::Installments {
                total: 48,
                current: 12,
            },
            "2026-11-05",
        );
        let mut income = fixtures::transaction(TransactionKind::Income, 1_066_988);
        income
            .settle(1_066_988, date("2026-11-05"), fixtures::instant())
            .unwrap();

        let item = settled_installment(
            &loan,
            &income,
            Some(12),
            Uuid::from_u128(99),
            fixtures::instant(),
        )
        .unwrap();

        assert_eq!(item.id, Uuid::from_u128(99));
        assert_eq!(item.kind, TransactionKind::Expense);
        assert_eq!(item.expected_amount, 293_723);
        assert_eq!(item.gross_amount, 293_723);
        assert!(item.adjustments.is_empty());
        assert_eq!(item.account_id, income.account_id);
        assert_eq!(item.currency, income.currency);
        assert_eq!(item.category_id, Some(loan.category_id));
        assert_eq!(item.description.as_deref(), Some(loan.name.as_str()));
        assert_eq!(item.expected_date, date("2026-11-05"));
        let done = item.settlement.unwrap();
        assert_eq!(done.settled_amount, 293_723);
        assert_eq!(done.settled_at, date("2026-11-05"));
        assert_eq!(done.difference_amount, 0);
        assert_eq!(item.generated_from, None);
        assert_eq!(
            item.payroll,
            Some(PayrollInstallment {
                loan_id: loan.id,
                income_transaction_id: income.id,
                number: Some(12),
            })
        );
        let open = fixtures::transaction(TransactionKind::Income, 1_066_988);
        assert!(matches!(
            settled_installment(
                &loan,
                &open,
                Some(12),
                Uuid::from_u128(99),
                fixtures::instant()
            ),
            Err(FinanceError::TransactionNotSettled)
        ));
    }

    #[test]
    fn pl_fa04_one_off_income_has_single_installment() {
        let loan = loan(
            LoanTerm::Installments {
                total: 48,
                current: 12,
            },
            "2026-11-20",
        );
        let dates = [date("2026-11-20")];
        assert_eq!(loan.installments(&dates), vec![numbered("2026-11-20", 12)]);
        assert_eq!(loan.status_at(&dates, None), PayrollLoanStatus::Ended);
    }
}
