//! Descontos e acréscimos nominais de uma movimentação: líquido a partir do bruto e bruto
//! equivalente a um líquido, em centavos e centésimos de ponto percentual inteiros, sem ponto
//! flutuante (RN-01 a RN-07, RNF-01).

use crate::finance::domain::{FinanceError, required_name};

pub const MAX_ADJUSTMENTS: usize = 20;
pub const NAME_MAX_CHARS: usize = 60;
pub const RATE_BP_MIN: i32 = 1;
pub const RATE_BP_MAX: i32 = 9_999;
const BP_SCALE: i128 = 10_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdjustmentDirection {
    Deduction,
    Addition,
}

impl AdjustmentDirection {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Deduction => "deduction",
            Self::Addition => "addition",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "deduction" => Some(Self::Deduction),
            "addition" => Some(Self::Addition),
            _ => None,
        }
    }

    fn sign(self) -> i128 {
        match self {
            Self::Deduction => -1,
            Self::Addition => 1,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdjustmentMode {
    Fixed,
    Percent,
}

impl AdjustmentMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Fixed => "fixed",
            Self::Percent => "percent",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "fixed" => Some(Self::Fixed),
            "percent" => Some(Self::Percent),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Adjustment {
    pub name: String,
    pub direction: AdjustmentDirection,
    pub mode: AdjustmentMode,
    pub amount: Option<i64>,
    pub rate_bp: Option<i32>,
    pub base_amount: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ComputedAdjustment {
    pub adjustment: Adjustment,
    pub computed_amount: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Breakdown {
    pub gross_amount: i64,
    pub net_amount: i64,
    pub items: Vec<ComputedAdjustment>,
}

/// Divisão com arredondamento meio para cima (RN-03). Quem chama garante `num >= 0` e
/// `den > 0`, então a conta inteira não precisa tratar sinal.
fn round_half_up(num: i128, den: i128) -> i128 {
    (2 * num + den) / (2 * den)
}

fn too_large() -> FinanceError {
    FinanceError::invalid("adjustments", "too_large")
}

fn no_gross_for_net() -> FinanceError {
    FinanceError::invalid("adjustments", "no_gross_for_net")
}

/// Confere a lista de itens; para no primeiro problema encontrado.
pub fn validate_adjustments(items: &[Adjustment]) -> Result<(), FinanceError> {
    if items.len() > MAX_ADJUSTMENTS {
        return Err(FinanceError::invalid("adjustments", "too_many"));
    }
    items.iter().try_for_each(validate_item)
}

fn validate_item(item: &Adjustment) -> Result<(), FinanceError> {
    required_name(&item.name, "adjustments.name", NAME_MAX_CHARS)?;
    match item.mode {
        AdjustmentMode::Fixed => validate_fixed(item),
        AdjustmentMode::Percent => validate_percent(item),
    }
}

fn validate_fixed(item: &Adjustment) -> Result<(), FinanceError> {
    if item.rate_bp.is_some() || item.base_amount.is_some() {
        return Err(FinanceError::invalid("adjustments.mode", "fields_mismatch"));
    }
    if !item.amount.is_some_and(|amount| amount > 0) {
        return Err(FinanceError::invalid(
            "adjustments.amount",
            "must_be_positive",
        ));
    }
    Ok(())
}

fn validate_percent(item: &Adjustment) -> Result<(), FinanceError> {
    if item.amount.is_some() {
        return Err(FinanceError::invalid("adjustments.mode", "fields_mismatch"));
    }
    if !item
        .rate_bp
        .is_some_and(|rate| (RATE_BP_MIN..=RATE_BP_MAX).contains(&rate))
    {
        return Err(FinanceError::invalid("adjustments.rate_bp", "out_of_range"));
    }
    if item.base_amount.is_some_and(|base| base <= 0) {
        return Err(FinanceError::invalid(
            "adjustments.base_amount",
            "must_be_positive",
        ));
    }
    Ok(())
}

fn item_amount(item: &Adjustment, gross: i64) -> i64 {
    match item.mode {
        AdjustmentMode::Fixed => item.amount.unwrap_or(0),
        AdjustmentMode::Percent => {
            let base = item.base_amount.unwrap_or(gross);
            let rate = item.rate_bp.unwrap_or(0);
            let value = round_half_up(i128::from(base) * i128::from(rate), BP_SCALE);
            // A taxa é menor que 100%, então o valor nunca passa da base, que cabe em `i64`.
            i64::try_from(value).unwrap_or(i64::MAX)
        }
    }
}

fn breakdown(gross: i64, items: &[Adjustment]) -> Result<Breakdown, FinanceError> {
    let items: Vec<ComputedAdjustment> = items
        .iter()
        .map(|item| ComputedAdjustment {
            adjustment: item.clone(),
            computed_amount: item_amount(item, gross),
        })
        .collect();
    let net = items.iter().fold(i128::from(gross), |total, item| {
        total + item.adjustment.direction.sign() * i128::from(item.computed_amount)
    });
    let net_amount = i64::try_from(net).map_err(|_| too_large())?;
    Ok(Breakdown {
        gross_amount: gross,
        net_amount,
        items,
    })
}

/// Líquido previsto a partir do bruto (RF-07, RN-01 a RN-05).
pub fn compute_net(gross: i64, items: &[Adjustment]) -> Result<Breakdown, FinanceError> {
    if gross <= 0 {
        return Err(FinanceError::invalid("gross_amount", "must_be_positive"));
    }
    validate_adjustments(items)?;
    let result = breakdown(gross, items)?;
    if result.net_amount <= 0 {
        return Err(FinanceError::invalid("adjustments", "net_not_positive"));
    }
    Ok(result)
}

/// Bruto equivalente ao líquido liquidado, com a base digitada escalada na proporção do
/// bruto e o centavo residual no último item percentual (RF-09, RN-06, RN-07, CB-01, CB-02,
/// CB-05).
///
/// A fórmula fechada, em vez de uma busca iterativa, garante o mesmo resultado na tela e
/// no servidor: as duas pontas fazem exatamente as mesmas contas inteiras.
pub fn gross_for_net(
    net: i64,
    items: &[Adjustment],
    expected_gross: i64,
) -> Result<Breakdown, FinanceError> {
    if net < 0 {
        return Err(FinanceError::invalid(
            "settled_amount",
            "must_not_be_negative",
        ));
    }
    if expected_gross <= 0 {
        return Err(FinanceError::invalid(
            "expected_gross_amount",
            "must_be_positive",
        ));
    }
    validate_adjustments(items)?;
    let gross = equivalent_gross(net, items, expected_gross)?;
    let scaled = scale_bases(items, gross, expected_gross)?;
    let mut result = breakdown(gross, &scaled)?;
    absorb_residual(&mut result, net)?;
    Ok(result)
}

fn equivalent_gross(
    net: i64,
    items: &[Adjustment],
    expected_gross: i64,
) -> Result<i64, FinanceError> {
    let expected = i128::from(expected_gross);
    let mut fixed: i128 = 0;
    let mut den = expected.checked_mul(BP_SCALE).ok_or_else(too_large)?;
    for item in items {
        let sign = item.direction.sign();
        match item.mode {
            AdjustmentMode::Fixed => {
                let amount = i128::from(item.amount.unwrap_or(0));
                fixed = fixed.checked_add(-sign * amount).ok_or_else(too_large)?;
            }
            AdjustmentMode::Percent => {
                let base = item.base_amount.map_or(expected, i128::from);
                let term = (sign * i128::from(item.rate_bp.unwrap_or(0)))
                    .checked_mul(base)
                    .ok_or_else(too_large)?;
                den = den.checked_add(term).ok_or_else(too_large)?;
            }
        }
    }
    let num = i128::from(net)
        .checked_add(fixed)
        .and_then(|value| value.checked_mul(expected))
        .and_then(|value| value.checked_mul(BP_SCALE))
        .ok_or_else(too_large)?;
    if den <= 0 || num < 0 {
        return Err(no_gross_for_net());
    }
    let doubled = num.checked_mul(2).ok_or_else(too_large)?;
    let gross = doubled.checked_add(den).ok_or_else(too_large)? / (2 * den);
    i64::try_from(gross).map_err(|_| too_large())
}

/// A base digitada acompanha o bruto na mesma proporção (RN-06).
fn scale_bases(
    items: &[Adjustment],
    gross: i64,
    expected_gross: i64,
) -> Result<Vec<Adjustment>, FinanceError> {
    items
        .iter()
        .map(|item| {
            let Some(base) = item.base_amount else {
                return Ok(item.clone());
            };
            let scaled = round_half_up(
                i128::from(base) * i128::from(gross),
                i128::from(expected_gross),
            );
            let scaled = i64::try_from(scaled).map_err(|_| too_large())?;
            if scaled == 0 {
                return Err(no_gross_for_net());
            }
            Ok(Adjustment {
                base_amount: Some(scaled),
                ..item.clone()
            })
        })
        .collect()
}

/// O arredondamento por item pode deixar o líquido um centavo longe do pedido; o último
/// percentual da lista absorve a diferença para a identidade fechar (RN-04, RN-07).
fn absorb_residual(result: &mut Breakdown, net: i64) -> Result<(), FinanceError> {
    let residual = net.checked_sub(result.net_amount).ok_or_else(too_large)?;
    if residual != 0 {
        let index = result
            .items
            .iter()
            .rposition(|item| item.adjustment.mode == AdjustmentMode::Percent)
            .ok_or_else(no_gross_for_net)?;
        let item = &mut result.items[index];
        let adjusted = match item.adjustment.direction {
            AdjustmentDirection::Deduction => item.computed_amount.checked_sub(residual),
            AdjustmentDirection::Addition => item.computed_amount.checked_add(residual),
        }
        .ok_or_else(too_large)?;
        if adjusted < 0 {
            return Err(no_gross_for_net());
        }
        item.computed_amount = adjusted;
    }
    result.net_amount = net;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::AdjustmentDirection::{Addition, Deduction};
    use super::*;

    fn percent(
        name: &str,
        direction: AdjustmentDirection,
        rate_bp: i32,
        base_amount: Option<i64>,
    ) -> Adjustment {
        Adjustment {
            name: name.to_owned(),
            direction,
            mode: AdjustmentMode::Percent,
            amount: None,
            rate_bp: Some(rate_bp),
            base_amount,
        }
    }

    fn fixed(name: &str, direction: AdjustmentDirection, amount: i64) -> Adjustment {
        Adjustment {
            name: name.to_owned(),
            direction,
            mode: AdjustmentMode::Fixed,
            amount: Some(amount),
            rate_bp: None,
            base_amount: None,
        }
    }

    fn inss() -> Adjustment {
        percent("INSS", Deduction, 1100, None)
    }

    fn irpf(rate_bp: i32) -> Adjustment {
        percent("IRPF", Deduction, rate_bp, Some(712_000))
    }

    fn sindical() -> Adjustment {
        fixed("Sindical", Deduction, 4_000)
    }

    fn amounts(breakdown: &Breakdown) -> Vec<i64> {
        breakdown
            .items
            .iter()
            .map(|item| item.computed_amount)
            .collect()
    }

    fn issue<T: std::fmt::Debug>(result: Result<T, FinanceError>) -> (&'static str, &'static str) {
        match result {
            Err(FinanceError::Validation(issues)) if !issues.is_empty() => {
                (issues[0].field, issues[0].code)
            }
            other => panic!("esperava erro de validação, veio {other:?}"),
        }
    }

    #[test]
    fn ct01_percent_on_gross_and_fixed_deduction() {
        let result = compute_net(800_000, &[inss(), sindical()]).unwrap();

        assert_eq!(result.gross_amount, 800_000);
        assert_eq!(amounts(&result), vec![88_000, 4_000]);
        assert_eq!(result.net_amount, 708_000);
    }

    #[test]
    fn ct02_typed_base_and_order_do_not_change_net() {
        let forward = compute_net(800_000, &[inss(), irpf(1500)]).unwrap();
        let backward = compute_net(800_000, &[irpf(1500), inss()]).unwrap();

        assert_eq!(amounts(&forward), vec![88_000, 106_800]);
        assert_eq!(forward.net_amount, 605_200);
        assert_eq!(amounts(&backward), vec![106_800, 88_000]);
        assert_eq!(backward.net_amount, 605_200);
    }

    #[test]
    fn ct03_percent_deduction_and_fixed_addition() {
        let result = compute_net(
            20_000,
            &[
                percent("Desconto", Deduction, 1000, None),
                fixed("Taxa", Addition, 500),
            ],
        )
        .unwrap();

        assert_eq!(amounts(&result), vec![2_000, 500]);
        assert_eq!(result.net_amount, 18_500);
    }

    #[test]
    fn rn03_percent_rounds_half_up_per_item() {
        let result = compute_net(33_333, &[percent("Desconto", Deduction, 1250, None)]).unwrap();

        assert_eq!(amounts(&result), vec![4_167]);
        assert_eq!(result.net_amount, 29_166);
    }

    #[test]
    fn rn09_without_items_net_equals_gross() {
        let result = compute_net(50_000, &[]).unwrap();

        assert_eq!(result.net_amount, 50_000);
        assert!(result.items.is_empty());
    }

    #[test]
    fn ct05_reverse_scales_typed_base_with_gross() {
        let result = gross_for_net(650_000, &[inss(), irpf(1500)], 800_000).unwrap();

        assert_eq!(result.gross_amount, 859_220);
        assert_eq!(result.net_amount, 650_000);
        assert_eq!(amounts(&result), vec![94_514, 114_706]);
        assert_eq!(result.items[0].adjustment.base_amount, None);
        assert_eq!(result.items[1].adjustment.base_amount, Some(764_706));
    }

    #[test]
    fn cb02_reverse_with_only_fixed_items() {
        let result = gross_for_net(100_000, &[sindical()], 104_000).unwrap();

        assert_eq!(result.gross_amount, 104_000);
        assert_eq!(amounts(&result), vec![4_000]);
        assert_eq!(result.net_amount, 100_000);
    }

    #[test]
    fn ct07_residual_cent_goes_to_last_percent() {
        let result = gross_for_net(650_000, &[inss(), irpf(2250)], 800_000).unwrap();

        assert_eq!(result.gross_amount, 942_370);
        assert_eq!(amounts(&result), vec![103_661, 188_709]);
        assert_eq!(result.items[1].adjustment.base_amount, Some(838_709));
        assert_eq!(result.net_amount, 650_000);
        assert_eq!(result.gross_amount - 103_661 - 188_709, 650_000);
    }

    #[test]
    fn ct07_residual_follows_list_order() {
        let a = percent("A", Deduction, 1250, None);
        let b = percent("B", Deduction, 3333, None);

        let ab = gross_for_net(10_000, &[a.clone(), b.clone()], 20_000).unwrap();
        let ba = gross_for_net(10_000, &[b, a], 20_000).unwrap();

        assert_eq!(ab.gross_amount, 18_460);
        assert_eq!(amounts(&ab), vec![2_308, 6_152]);
        assert_eq!(ab.net_amount, 10_000);
        assert_eq!(ba.gross_amount, 18_460);
        assert_eq!(amounts(&ba), vec![6_153, 2_307]);
        assert_eq!(ba.net_amount, 10_000);
    }

    #[test]
    fn cb01_reverse_with_zero_net() {
        let result = gross_for_net(0, &[inss(), sindical()], 800_000).unwrap();

        assert_eq!(result.gross_amount, 4_494);
        assert_eq!(amounts(&result), vec![494, 4_000]);
        assert_eq!(result.net_amount, 0);
    }

    #[test]
    fn cb01_reverse_without_possible_gross_is_refused() {
        let over_hundred = [
            percent("A", Deduction, 6000, None),
            percent("B", Deduction, 5000, None),
        ];

        assert_eq!(
            issue(gross_for_net(100, &over_hundred, 10_000)),
            ("adjustments", "no_gross_for_net")
        );
        assert_eq!(
            issue(gross_for_net(1_000, &[fixed("Bônus", Addition, 5_000)], 1)),
            ("adjustments", "no_gross_for_net")
        );
        assert_eq!(
            issue(gross_for_net(-1, &[], 1_000)),
            ("settled_amount", "must_not_be_negative")
        );
        assert_eq!(
            issue(gross_for_net(1_000, &[], 0)),
            ("expected_gross_amount", "must_be_positive")
        );
    }

    #[test]
    fn cb03_net_not_positive_is_refused() {
        assert_eq!(
            issue(compute_net(1_000, &[fixed("Tudo", Deduction, 1_000)])),
            ("adjustments", "net_not_positive")
        );
        assert_eq!(
            issue(compute_net(0, &[])),
            ("gross_amount", "must_be_positive")
        );
    }

    #[test]
    fn cb04_rate_outside_range_is_refused() {
        for rate_bp in [0, 10_000] {
            assert_eq!(
                issue(compute_net(
                    10_000,
                    &[percent("X", Deduction, rate_bp, None)]
                )),
                ("adjustments.rate_bp", "out_of_range")
            );
        }
        for rate_bp in [1, 9_999] {
            assert!(compute_net(10_000, &[percent("X", Deduction, rate_bp, None)]).is_ok());
        }
    }

    #[test]
    fn cb09_typed_base_must_be_positive() {
        for base_amount in [0, -1] {
            assert_eq!(
                issue(compute_net(
                    10_000,
                    &[percent("X", Deduction, 1000, Some(base_amount))]
                )),
                ("adjustments.base_amount", "must_be_positive")
            );
        }
    }

    #[test]
    fn ct13_invalid_items_are_refused() {
        let twenty = vec![fixed("Item", Deduction, 1); 20];
        let twenty_one = vec![fixed("Item", Deduction, 1); 21];
        assert!(validate_adjustments(&twenty).is_ok());
        assert!(compute_net(10_000, &twenty).is_ok());
        assert_eq!(
            issue(validate_adjustments(&twenty_one)),
            ("adjustments", "too_many")
        );
        assert_eq!(
            issue(compute_net(10_000, &twenty_one)),
            ("adjustments", "too_many")
        );

        let cases = [
            (fixed("   ", Deduction, 1), ("adjustments.name", "required")),
            (
                fixed(&"a".repeat(61), Deduction, 1),
                ("adjustments.name", "too_long"),
            ),
            (
                fixed("X", Deduction, 0),
                ("adjustments.amount", "must_be_positive"),
            ),
            (
                Adjustment {
                    amount: None,
                    ..fixed("X", Deduction, 1)
                },
                ("adjustments.amount", "must_be_positive"),
            ),
            (
                Adjustment {
                    rate_bp: Some(100),
                    ..fixed("X", Deduction, 1)
                },
                ("adjustments.mode", "fields_mismatch"),
            ),
            (
                Adjustment {
                    amount: Some(100),
                    ..percent("X", Deduction, 1000, None)
                },
                ("adjustments.mode", "fields_mismatch"),
            ),
            (
                Adjustment {
                    rate_bp: None,
                    ..percent("X", Deduction, 1000, None)
                },
                ("adjustments.rate_bp", "out_of_range"),
            ),
        ];
        for (item, expected) in cases {
            assert_eq!(issue(validate_adjustments(&[item])), expected);
        }
        assert!(validate_adjustments(&[fixed(&"a".repeat(60), Deduction, 1)]).is_ok());
    }

    #[test]
    fn overflow_is_refused_as_too_large() {
        assert_eq!(
            issue(compute_net(i64::MAX, &[fixed("X", Addition, 1)])),
            ("adjustments", "too_large")
        );
        assert_eq!(
            issue(gross_for_net(
                i64::MAX,
                &[fixed("X", Deduction, i64::MAX)],
                i64::MAX
            )),
            ("adjustments", "too_large")
        );
    }

    #[test]
    fn direction_and_mode_round_trip_text() {
        assert_eq!(AdjustmentDirection::parse("deduction"), Some(Deduction));
        assert_eq!(Deduction.as_str(), "deduction");
        assert_eq!(AdjustmentDirection::parse("addition"), Some(Addition));
        assert_eq!(Addition.as_str(), "addition");
        assert_eq!(AdjustmentMode::parse("fixed"), Some(AdjustmentMode::Fixed));
        assert_eq!(AdjustmentMode::Fixed.as_str(), "fixed");
        assert_eq!(
            AdjustmentMode::parse("percent"),
            Some(AdjustmentMode::Percent)
        );
        assert_eq!(AdjustmentMode::Percent.as_str(), "percent");
        assert_eq!(AdjustmentDirection::parse("other"), None);
        assert_eq!(AdjustmentMode::parse("other"), None);
    }
}
