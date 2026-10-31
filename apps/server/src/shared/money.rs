//! Dinheiro em centavos com o código da moeda, nunca ponto flutuante
//! ([project/code-style-05]).

use std::fmt;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum MoneyError {
    #[error("código de moeda inválido")]
    InvalidCurrency,
    #[error("moedas diferentes")]
    CurrencyMismatch,
    #[error("valor fora do limite")]
    Overflow,
}

/// Código ISO 4217: três letras maiúsculas ASCII.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(try_from = "String", into = "String")]
#[schema(value_type = String, example = "BRL")]
pub struct Currency([u8; 3]);

impl Currency {
    pub fn new(code: &str) -> Result<Self, MoneyError> {
        let bytes: [u8; 3] = code
            .as_bytes()
            .try_into()
            .map_err(|_| MoneyError::InvalidCurrency)?;
        if !bytes.iter().all(u8::is_ascii_uppercase) {
            return Err(MoneyError::InvalidCurrency);
        }
        Ok(Self(bytes))
    }

    pub fn as_str(&self) -> &str {
        std::str::from_utf8(&self.0).unwrap_or("XXX")
    }
}

impl Default for Currency {
    fn default() -> Self {
        Self(*b"BRL")
    }
}

impl fmt::Display for Currency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl TryFrom<String> for Currency {
    type Error = MoneyError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::new(&value)
    }
}

impl From<Currency> for String {
    fn from(value: Currency) -> Self {
        value.as_str().to_owned()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct Money {
    pub amount_cents: i64,
    pub currency: Currency,
}

impl Money {
    pub fn new(amount_cents: i64, currency: Currency) -> Self {
        Self {
            amount_cents,
            currency,
        }
    }

    pub fn checked_add(self, other: Self) -> Result<Self, MoneyError> {
        self.same_currency(other)?;
        let amount = self
            .amount_cents
            .checked_add(other.amount_cents)
            .ok_or(MoneyError::Overflow)?;
        Ok(Self::new(amount, self.currency))
    }

    pub fn checked_sub(self, other: Self) -> Result<Self, MoneyError> {
        self.same_currency(other)?;
        let amount = self
            .amount_cents
            .checked_sub(other.amount_cents)
            .ok_or(MoneyError::Overflow)?;
        Ok(Self::new(amount, self.currency))
    }

    fn same_currency(self, other: Self) -> Result<(), MoneyError> {
        if self.currency == other.currency {
            return Ok(());
        }
        Err(MoneyError::CurrencyMismatch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn brl(cents: i64) -> Money {
        Money::new(cents, Currency::default())
    }

    #[test]
    fn rejects_lowercase_or_invalid_currency() {
        assert_eq!(Currency::new("brl"), Err(MoneyError::InvalidCurrency));
        assert_eq!(Currency::new("BR"), Err(MoneyError::InvalidCurrency));
        assert_eq!(Currency::new("BRLX"), Err(MoneyError::InvalidCurrency));
        assert_eq!(Currency::new("B1L"), Err(MoneyError::InvalidCurrency));
        assert_eq!(Currency::new("USD").unwrap().as_str(), "USD");
        assert!(serde_json::from_str::<Currency>("\"usd\"").is_err());
    }

    #[test]
    fn adds_only_same_currency() {
        let usd = Money::new(100, Currency::new("USD").unwrap());

        assert_eq!(brl(150).checked_add(brl(50)), Ok(brl(200)));
        assert_eq!(brl(150).checked_sub(brl(200)), Ok(brl(-50)));
        assert_eq!(brl(150).checked_add(usd), Err(MoneyError::CurrencyMismatch));
        assert_eq!(brl(150).checked_sub(usd), Err(MoneyError::CurrencyMismatch));
    }

    #[test]
    fn overflow_is_an_error() {
        assert_eq!(brl(i64::MAX).checked_add(brl(1)), Err(MoneyError::Overflow));
        assert_eq!(brl(i64::MIN).checked_sub(brl(1)), Err(MoneyError::Overflow));
    }

    #[test]
    fn serializes_amount_in_cents_and_currency() {
        let json = serde_json::to_value(brl(150_000)).unwrap();

        assert_eq!(
            json,
            serde_json::json!({"amount_cents": 150000, "currency": "BRL"})
        );
        let back: Money = serde_json::from_value(json).unwrap();
        assert_eq!(back, brl(150_000));
    }
}
