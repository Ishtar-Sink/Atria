//! Descontos e acréscimos nominais de uma movimentação: líquido a partir do bruto e bruto
//! equivalente a um líquido, em centavos e centésimos de ponto percentual inteiros, sem ponto
//! flutuante (RN-01 a RN-07, RNF-01). Base ligada a outros itens da mesma lista e parcela a
//! deduzir no percentual, calculadas na ordem das dependências (SPEC-005, RN-01 a RN-09).

use crate::finance::domain::{FinanceError, required_name};

pub const MAX_ADJUSTMENTS: usize = 20;
pub const NAME_MAX_CHARS: usize = 60;
pub const RATE_BP_MIN: i32 = 1;
pub const RATE_BP_MAX: i32 = 9_999;
const BP_SCALE: i128 = 10_000;
/// Níveis máximos de itens ligados em cadeia, para o cálculo exato caber em `i128`.
pub const MAX_LINK_DEPTH: usize = 3;

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
    /// Só no percentual: posições, a partir de 0, dos itens da mesma lista que formam a base ligada; vazia, a base é o bruto ou a digitada (RN-01, RN-02).
    pub base_items: Vec<usize>,
    /// Só no percentual: parcela a deduzir em centavos, maior que zero, fixa na liquidação (RN-05, RN-07).
    pub deduction_amount: Option<i64>,
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
    items.iter().try_for_each(validate_item)?;
    dependency_order(items).map(|_| ())
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
    if !item.base_items.is_empty() {
        return Err(FinanceError::invalid(
            "adjustments.base_items",
            "fields_mismatch",
        ));
    }
    if item.deduction_amount.is_some() {
        return Err(FinanceError::invalid(
            "adjustments.deduction_amount",
            "fields_mismatch",
        ));
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
    if !item.base_items.is_empty() && item.base_amount.is_some() {
        return Err(FinanceError::invalid(
            "adjustments.base_items",
            "fields_mismatch",
        ));
    }
    if item
        .deduction_amount
        .is_some_and(|deduction| deduction <= 0)
    {
        return Err(FinanceError::invalid(
            "adjustments.deduction_amount",
            "must_be_positive",
        ));
    }
    Ok(())
}

fn base_items_error(code: &'static str) -> FinanceError {
    FinanceError::invalid("adjustments.base_items", code)
}

/// Ordem de cálculo em que cada item vem depois dos itens da sua base ligada; confere
/// posições, autorreferência, repetição, ciclo e profundidade (RN-01, RN-02, CB-01, CB-02).
fn dependency_order(items: &[Adjustment]) -> Result<Vec<usize>, FinanceError> {
    for (index, item) in items.iter().enumerate() {
        for (at, &position) in item.base_items.iter().enumerate() {
            if position >= items.len() {
                return Err(base_items_error("out_of_range"));
            }
            if position == index {
                return Err(base_items_error("self_reference"));
            }
            if item.base_items[..at].contains(&position) {
                return Err(base_items_error("fields_mismatch"));
            }
        }
    }
    let mut state = vec![0_u8; items.len()];
    let mut depth = vec![0_usize; items.len()];
    let mut order = Vec::with_capacity(items.len());
    for index in 0..items.len() {
        visit(index, items, &mut state, &mut depth, &mut order)?;
    }
    Ok(order)
}

/// Busca em profundidade: `state` 0 não visitado, 1 em visita, 2 pronto. A lista tem no
/// máximo `MAX_ADJUSTMENTS` itens, então a recursão direta é limitada.
fn visit(
    index: usize,
    items: &[Adjustment],
    state: &mut [u8],
    depth: &mut [usize],
    order: &mut Vec<usize>,
) -> Result<(), FinanceError> {
    match state[index] {
        2 => return Ok(()),
        1 => return Err(base_items_error("cycle")),
        _ => {}
    }
    state[index] = 1;
    let mut deepest = 0;
    for &position in &items[index].base_items {
        visit(position, items, state, depth, order)?;
        deepest = deepest.max(depth[position] + 1);
    }
    if deepest > MAX_LINK_DEPTH {
        return Err(base_items_error("too_deep"));
    }
    depth[index] = deepest;
    state[index] = 2;
    order.push(index);
    Ok(())
}

/// Por que um cálculo parou, para cada ponta dar o erro certo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Shortfall {
    BaseNotPositive,
    DeductionExceeds,
    TooLarge,
}

fn forward_error(shortfall: Shortfall) -> FinanceError {
    match shortfall {
        Shortfall::BaseNotPositive => base_items_error("not_positive"),
        Shortfall::DeductionExceeds => {
            FinanceError::invalid("adjustments.deduction_amount", "exceeds_amount")
        }
        Shortfall::TooLarge => too_large(),
    }
}

/// No reverso, base ou item negativo quer dizer que não há bruto possível para o líquido
/// pedido, e não um erro de digitação (CB-08).
fn reverse_error(shortfall: Shortfall) -> FinanceError {
    match shortfall {
        Shortfall::BaseNotPositive | Shortfall::DeductionExceeds => no_gross_for_net(),
        Shortfall::TooLarge => too_large(),
    }
}

fn breakdown(gross: i64, items: &[Adjustment], order: &[usize]) -> Result<Breakdown, Shortfall> {
    let mut values = vec![0_i64; items.len()];
    for &index in order {
        let item = &items[index];
        values[index] = match item.mode {
            AdjustmentMode::Fixed => item.amount.unwrap_or(0),
            AdjustmentMode::Percent => {
                let base = if item.base_items.is_empty() {
                    i128::from(item.base_amount.unwrap_or(gross))
                } else {
                    let base = item.base_items.iter().fold(i128::from(gross), |sum, &at| {
                        sum + items[at].direction.sign() * i128::from(values[at])
                    });
                    if base <= 0 {
                        return Err(Shortfall::BaseNotPositive);
                    }
                    base
                };
                let rate = i128::from(item.rate_bp.unwrap_or(0));
                let value = round_half_up(base * rate, BP_SCALE)
                    - i128::from(item.deduction_amount.unwrap_or(0));
                if value < 0 {
                    return Err(Shortfall::DeductionExceeds);
                }
                i64::try_from(value).map_err(|_| Shortfall::TooLarge)?
            }
        };
    }
    let computed: Vec<ComputedAdjustment> = items
        .iter()
        .zip(&values)
        .map(|(item, &computed_amount)| ComputedAdjustment {
            adjustment: item.clone(),
            computed_amount,
        })
        .collect();
    let net = computed.iter().fold(i128::from(gross), |total, item| {
        total + item.adjustment.direction.sign() * i128::from(item.computed_amount)
    });
    let net_amount = i64::try_from(net).map_err(|_| Shortfall::TooLarge)?;
    Ok(Breakdown {
        gross_amount: gross,
        net_amount,
        items: computed,
    })
}

/// Líquido previsto a partir do bruto (RF-07, RN-01 a RN-05).
pub fn compute_net(gross: i64, items: &[Adjustment]) -> Result<Breakdown, FinanceError> {
    if gross <= 0 {
        return Err(FinanceError::invalid("gross_amount", "must_be_positive"));
    }
    validate_adjustments(items)?;
    let order = dependency_order(items)?;
    let result = breakdown(gross, items, &order).map_err(forward_error)?;
    if result.net_amount <= 0 {
        return Err(FinanceError::invalid("adjustments", "net_not_positive"));
    }
    Ok(result)
}

/// Bruto equivalente ao líquido liquidado, com a base digitada escalada na proporção do
/// bruto e o centavo residual num percentual livre. A base ligada é recalculada pelos itens
/// liquidados e a parcela a deduzir se mantém (RF-06, RF-09, RN-06, RN-07, RN-09, CB-01,
/// CB-02, CB-05, CB-08, CB-09).
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
    let order = dependency_order(items)?;
    let gross = equivalent_gross(net, items, &order, expected_gross)?;
    let scaled = scale_bases(items, gross, expected_gross)?;
    let mut result = breakdown(gross, &scaled, &order).map_err(reverse_error)?;
    absorb_residual(&mut result, net)?;
    Ok(result)
}

/// Valor `(slope × bruto + offset) ÷ den` antes do arredondamento, com `den > 0`. Cada item
/// é afim no bruto, então o reverso tem fórmula fechada exata, sem busca iterativa.
#[derive(Debug, Clone, Copy)]
struct Affine {
    slope: i128,
    offset: i128,
    den: i128,
}

fn gcd(a: i128, b: i128) -> i128 {
    let (mut a, mut b) = (a.unsigned_abs(), b.unsigned_abs());
    while b != 0 {
        (a, b) = (b, a % b);
    }
    // O resultado nunca passa dos operandos, que cabem em `i128`; o 1 é só para não dividir por 0.
    i128::try_from(a).unwrap_or(1).max(1)
}

impl Affine {
    fn gross() -> Self {
        Self {
            slope: 1,
            offset: 0,
            den: 1,
        }
    }

    fn constant(value: i128) -> Self {
        Self {
            slope: 0,
            offset: value,
            den: 1,
        }
    }

    fn typed_base(base: i64, expected_gross: i64) -> Self {
        Self {
            slope: i128::from(base),
            offset: 0,
            den: i128::from(expected_gross),
        }
    }

    fn add_signed(self, other: Self, sign: i128) -> Result<Self, FinanceError> {
        let common = (self.den / gcd(self.den, other.den))
            .checked_mul(other.den)
            .ok_or_else(too_large)?;
        let (left, right) = (common / self.den, common / other.den);
        let combine = |a: i128, b: i128| -> Result<i128, FinanceError> {
            a.checked_mul(left)
                .zip(b.checked_mul(right).and_then(|term| term.checked_mul(sign)))
                .and_then(|(x, y)| x.checked_add(y))
                .ok_or_else(too_large)
        };
        Ok(Self {
            slope: combine(self.slope, other.slope)?,
            offset: combine(self.offset, other.offset)?,
            den: common,
        }
        .reduced())
    }

    fn percent(self, rate_bp: i32, deduction: i64) -> Result<Self, FinanceError> {
        let rate = i128::from(rate_bp);
        let fixed_part = i128::from(deduction)
            .checked_mul(BP_SCALE)
            .and_then(|value| value.checked_mul(self.den))
            .ok_or_else(too_large)?;
        Ok(Self {
            slope: self.slope.checked_mul(rate).ok_or_else(too_large)?,
            offset: self
                .offset
                .checked_mul(rate)
                .and_then(|value| value.checked_sub(fixed_part))
                .ok_or_else(too_large)?,
            den: self.den.checked_mul(BP_SCALE).ok_or_else(too_large)?,
        }
        .reduced())
    }

    fn reduced(self) -> Self {
        let divisor = gcd(gcd(self.slope, self.offset), self.den);
        Self {
            slope: self.slope / divisor,
            offset: self.offset / divisor,
            den: self.den / divisor,
        }
    }
}

fn equivalent_gross(
    net: i64,
    items: &[Adjustment],
    order: &[usize],
    expected_gross: i64,
) -> Result<i64, FinanceError> {
    let mut values: Vec<Affine> = vec![Affine::constant(0); items.len()];
    for &index in order {
        let item = &items[index];
        values[index] = match item.mode {
            AdjustmentMode::Fixed => Affine::constant(i128::from(item.amount.unwrap_or(0))),
            AdjustmentMode::Percent => {
                let mut base = match item.base_amount {
                    Some(typed) if item.base_items.is_empty() => {
                        Affine::typed_base(typed, expected_gross)
                    }
                    _ => Affine::gross(),
                };
                for &at in &item.base_items {
                    base = base.add_signed(values[at], items[at].direction.sign())?;
                }
                base.percent(
                    item.rate_bp.unwrap_or(0),
                    item.deduction_amount.unwrap_or(0),
                )?
            }
        };
    }
    let mut total = Affine::gross();
    for (item, value) in items.iter().zip(&values) {
        total = total.add_signed(*value, item.direction.sign())?;
    }
    let num = i128::from(net)
        .checked_mul(total.den)
        .and_then(|value| value.checked_sub(total.offset))
        .ok_or_else(too_large)?;
    if total.slope <= 0 || num < 0 {
        return Err(no_gross_for_net());
    }
    let doubled = num.checked_mul(2).ok_or_else(too_large)?;
    let slope2 = total.slope.checked_mul(2).ok_or_else(too_large)?;
    let gross = doubled.checked_add(total.slope).ok_or_else(too_large)? / slope2;
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
/// percentual da lista do qual nenhum item depende absorve a diferença para a identidade
/// fechar. O centavo nunca vai para uma base de outro item, para não mudar a base
/// dependente (RN-04, RN-07, RN-09).
fn absorb_residual(result: &mut Breakdown, net: i64) -> Result<(), FinanceError> {
    let residual = net.checked_sub(result.net_amount).ok_or_else(too_large)?;
    if residual != 0 {
        let referenced: Vec<usize> = result
            .items
            .iter()
            .flat_map(|item| item.adjustment.base_items.iter().copied())
            .collect();
        let index = result
            .items
            .iter()
            .enumerate()
            .rposition(|(at, item)| {
                item.adjustment.mode == AdjustmentMode::Percent && !referenced.contains(&at)
            })
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
            base_items: Vec::new(),
            deduction_amount: None,
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
            base_items: Vec::new(),
            deduction_amount: None,
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

    fn linked(
        name: &str,
        rate_bp: i32,
        base_items: &[usize],
        deduction_amount: Option<i64>,
    ) -> Adjustment {
        Adjustment {
            base_items: base_items.to_vec(),
            deduction_amount,
            ..percent(name, Deduction, rate_bp, None)
        }
    }

    fn with_deduction(item: Adjustment, deduction_amount: i64) -> Adjustment {
        Adjustment {
            deduction_amount: Some(deduction_amount),
            ..item
        }
    }

    fn payroll() -> Vec<Adjustment> {
        vec![
            fixed("INSS", Deduction, 98_807),
            linked("IRPF", 2750, &[0], Some(90_873)),
            fixed("Sindical", Deduction, 3_500),
            fixed("Consignados", Deduction, 374_670),
        ]
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

    #[test]
    fn s5_ct01_payroll_with_linked_base_and_deduction() {
        let result = compute_net(1_450_000, &payroll()).unwrap();

        assert_eq!(amounts(&result), vec![98_807, 280_705, 3_500, 374_670]);
        assert_eq!(result.net_amount, 692_318);
    }

    #[test]
    fn s5_rn08_order_does_not_change_net() {
        let items = [
            fixed("Consignados", Deduction, 374_670),
            fixed("Sindical", Deduction, 3_500),
            linked("IRPF", 2750, &[3], Some(90_873)),
            fixed("INSS", Deduction, 98_807),
        ];
        let result = compute_net(1_450_000, &items).unwrap();

        assert_eq!(amounts(&result), vec![374_670, 3_500, 280_705, 98_807]);
        assert_eq!(result.net_amount, 692_318);
    }

    #[test]
    fn s5_ct02_reverse_payroll_returns_gross() {
        let result = gross_for_net(692_318, &payroll(), 1_450_000).unwrap();

        assert_eq!(result.gross_amount, 1_450_000);
        assert_eq!(amounts(&result), vec![98_807, 280_705, 3_500, 374_670]);
        assert_eq!(result.net_amount, 692_318);
    }

    #[test]
    fn s5_fa01_reverse_with_other_net_keeps_deduction() {
        let result = gross_for_net(700_000, &payroll(), 1_450_000).unwrap();

        assert_eq!(result.gross_amount, 1_460_596);
        assert_eq!(amounts(&result), vec![98_807, 283_619, 3_500, 374_670]);
        assert_eq!(result.net_amount, 700_000);
        let irpf = &result.items[1].adjustment;
        assert_eq!(irpf.base_items, vec![0]);
        assert_eq!(irpf.base_amount, None);
        assert_eq!(irpf.deduction_amount, Some(90_873));
    }

    #[test]
    fn s5_ct03_base_linked_to_percent_item() {
        let items = [
            percent("INSS", Deduction, 681, None),
            linked("IRPF", 2750, &[0], Some(90_873)),
        ];
        let result = compute_net(1_450_000, &items).unwrap();
        assert_eq!(amounts(&result), vec![98_745, 280_722]);
        assert_eq!(result.net_amount, 1_070_533);

        let same = gross_for_net(1_070_533, &items, 1_450_000).unwrap();
        assert_eq!(same.gross_amount, 1_450_000);
        assert_eq!(amounts(&same), vec![98_745, 280_722]);

        let other = gross_for_net(1_080_000, &items, 1_450_000).unwrap();
        assert_eq!(other.gross_amount, 1_464_012);
        assert_eq!(amounts(&other), vec![99_699, 284_313]);
    }

    #[test]
    fn s5_ct04_base_linked_to_two_items() {
        let items = [
            fixed("INSS", Deduction, 98_807),
            fixed("Pensão", Deduction, 100_000),
            linked("IRPF", 2750, &[0, 1], Some(90_873)),
        ];
        let result = compute_net(1_450_000, &items).unwrap();

        assert_eq!(amounts(&result), vec![98_807, 100_000, 253_205]);
        assert_eq!(result.net_amount, 997_988);
    }

    #[test]
    fn s5_cb06_chain_follows_dependency_order() {
        let chain = [
            linked("C", 1000, &[1], None),
            linked("B", 2750, &[2], Some(90_873)),
            percent("A", Deduction, 681, None),
        ];
        let result = compute_net(1_450_000, &chain).unwrap();
        assert_eq!(amounts(&result), vec![116_928, 280_722, 98_745]);
        assert_eq!(result.net_amount, 953_605);

        let reverse = gross_for_net(1_000_000, &chain, 1_450_000).unwrap();
        assert_eq!(reverse.gross_amount, 1_527_163);
        assert_eq!(amounts(&reverse), vec![122_666, 300_497, 104_000]);
        assert_eq!(reverse.net_amount, 1_000_000);
    }

    #[test]
    fn s5_rn09_residual_goes_to_free_percent_not_to_a_base() {
        let items = [
            linked("IRPF", 2750, &[1], Some(90_873)),
            percent("INSS", Deduction, 681, None),
        ];
        let result = gross_for_net(1_070_517, &items, 1_450_000).unwrap();
        assert_eq!(result.gross_amount, 1_449_977);
        assert_eq!(amounts(&result), vec![280_717, 98_743]);
        assert_eq!(result.net_amount, 1_070_517);

        let items = [
            percent("INSS", Deduction, 681, None),
            linked("IRPF", 2750, &[0], Some(90_873)),
        ];
        let result = gross_for_net(1_070_517, &items, 1_450_000).unwrap();
        assert_eq!(amounts(&result), vec![98_743, 280_717]);
    }

    #[test]
    fn s5_ct05_self_reference_and_cycle_are_refused() {
        let base_items = "adjustments.base_items";
        assert_eq!(
            issue(validate_adjustments(&[linked("A", 1000, &[0], None)])),
            (base_items, "self_reference")
        );
        assert_eq!(
            issue(validate_adjustments(&[
                linked("A", 1000, &[1], None),
                linked("B", 1000, &[0], None)
            ])),
            (base_items, "cycle")
        );
        assert_eq!(
            issue(validate_adjustments(&[
                linked("A", 1000, &[1], None),
                linked("B", 1000, &[2], None),
                linked("C", 1000, &[0], None)
            ])),
            (base_items, "cycle")
        );
        assert_eq!(
            issue(validate_adjustments(&[
                linked("A", 1000, &[5], None),
                fixed("X", Deduction, 100)
            ])),
            (base_items, "out_of_range")
        );
        assert_eq!(
            issue(validate_adjustments(&[
                fixed("X", Deduction, 100),
                linked("A", 1000, &[0, 0], None)
            ])),
            (base_items, "fields_mismatch")
        );
        assert_eq!(
            issue(compute_net(10_000, &[linked("A", 1000, &[0], None)])),
            (base_items, "self_reference")
        );
    }

    #[test]
    fn s5_link_and_deduction_fields_are_validated() {
        let base_items = "adjustments.base_items";
        let deduction = "adjustments.deduction_amount";
        let other = fixed("Y", Deduction, 100);
        assert_eq!(
            issue(validate_adjustments(&[
                Adjustment {
                    base_items: vec![1],
                    ..fixed("X", Deduction, 100)
                },
                other.clone()
            ])),
            (base_items, "fields_mismatch")
        );
        assert_eq!(
            issue(validate_adjustments(&[
                other,
                Adjustment {
                    base_amount: Some(100_000),
                    ..linked("IRPF", 2750, &[0], None)
                }
            ])),
            (base_items, "fields_mismatch")
        );
        assert_eq!(
            issue(validate_adjustments(&[Adjustment {
                deduction_amount: Some(100),
                ..fixed("X", Deduction, 100)
            }])),
            (deduction, "fields_mismatch")
        );
        for value in [0, -1] {
            assert_eq!(
                issue(validate_adjustments(&[with_deduction(
                    percent("IRPF", Deduction, 2750, None),
                    value
                )])),
                (deduction, "must_be_positive")
            );
        }
        let empty = compute_net(10_000, &[linked("IRPF", 2750, &[], None)]).unwrap();
        assert_eq!(amounts(&empty), vec![2_750]);
    }

    #[test]
    fn s5_cb03_linked_base_not_positive_is_refused() {
        for fixed_amount in [100_000, 150_000] {
            assert_eq!(
                issue(compute_net(
                    100_000,
                    &[
                        fixed("Adiantamento", Deduction, fixed_amount),
                        linked("IRPF", 2750, &[0], None)
                    ]
                )),
                ("adjustments.base_items", "not_positive")
            );
        }
    }

    #[test]
    fn s5_ct06_deduction_above_percent_is_refused() {
        assert_eq!(
            issue(compute_net(
                100_000,
                &[with_deduction(
                    percent("IRPF", Deduction, 2750, None),
                    90_873
                )]
            )),
            ("adjustments.deduction_amount", "exceeds_amount")
        );
        let ok = compute_net(
            100_000,
            &[with_deduction(
                percent("IRPF", Deduction, 2750, None),
                27_500,
            )],
        )
        .unwrap();
        assert_eq!(amounts(&ok), vec![0]);
        assert_eq!(ok.net_amount, 100_000);
    }

    #[test]
    fn s5_cb08_reverse_that_makes_item_negative_is_refused() {
        let items = [with_deduction(
            percent("IRPF", Deduction, 2750, None),
            90_873,
        )];
        for net in [100_000, 50_000] {
            assert_eq!(
                issue(gross_for_net(net, &items, 1_000_000)),
                ("adjustments", "no_gross_for_net")
            );
        }
    }

    #[test]
    fn s5_cb09_fixed_only_reverse_has_no_residual() {
        let items = [
            fixed("INSS", Deduction, 98_807),
            fixed("Sindical", Deduction, 3_500),
        ];
        let result = gross_for_net(100_000, &items, 1).unwrap();

        assert_eq!(result.gross_amount, 202_307);
        assert_eq!(amounts(&result), vec![98_807, 3_500]);
        assert_eq!(result.net_amount, 100_000);
    }

    #[test]
    fn s5_chain_deeper_than_three_links_is_refused() {
        let build = |len: usize| -> Vec<Adjustment> {
            (0..len)
                .map(|i| {
                    if i == 0 {
                        percent("P0", Deduction, 681, None)
                    } else {
                        linked(&format!("P{i}"), 681, &[i - 1], None)
                    }
                })
                .collect()
        };
        let shallow = build(4);
        assert!(validate_adjustments(&shallow).is_ok());
        assert!(gross_for_net(1_000_000_000_000, &shallow, 1_000_000_000_000).is_ok());
        assert_eq!(
            issue(validate_adjustments(&build(5))),
            ("adjustments.base_items", "too_deep")
        );
    }
}
