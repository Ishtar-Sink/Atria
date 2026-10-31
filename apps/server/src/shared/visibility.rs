//! Marcação de visibilidade de toda entidade (RF-21). A marcação sozinha não dá
//! acesso a ninguém (RN-17): o compartilhamento é decidido em outro lugar.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize, sqlx::Type, ToSchema,
)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "text", rename_all = "snake_case")]
pub enum Visibility {
    #[default]
    Personal,
    Shared,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::test_support::test_pool;

    #[test]
    fn serializes_as_personal_or_shared() {
        assert_eq!(
            serde_json::to_value(Visibility::Personal).unwrap(),
            "personal"
        );
        assert_eq!(serde_json::to_value(Visibility::Shared).unwrap(), "shared");
        assert_eq!(
            serde_json::from_str::<Visibility>("\"shared\"").unwrap(),
            Visibility::Shared
        );
    }

    #[test]
    fn rejects_unknown_visibility() {
        assert!(serde_json::from_str::<Visibility>("\"public\"").is_err());
        assert!(serde_json::from_str::<Visibility>("\"Shared\"").is_err());
    }

    #[test]
    fn defaults_to_personal() {
        assert_eq!(Visibility::default(), Visibility::Personal);
    }

    #[tokio::test]
    async fn round_trips_through_postgres() {
        let database = test_pool().await;
        let pool = database.pool().clone();
        sqlx::query(
            "CREATE TABLE items (id INT PRIMARY KEY, visibility TEXT NOT NULL \
             CHECK (visibility IN ('personal', 'shared')))",
        )
        .execute(&pool)
        .await
        .unwrap();
        for (id, visibility) in [(1, Visibility::Personal), (2, Visibility::Shared)] {
            sqlx::query("INSERT INTO items (id, visibility) VALUES ($1, $2)")
                .bind(id)
                .bind(visibility)
                .execute(&pool)
                .await
                .unwrap();
        }

        let raw: Vec<String> = sqlx::query_scalar("SELECT visibility FROM items ORDER BY id")
            .fetch_all(&pool)
            .await
            .unwrap();
        let typed: Vec<Visibility> = sqlx::query_scalar("SELECT visibility FROM items ORDER BY id")
            .fetch_all(&pool)
            .await
            .unwrap();

        assert_eq!(raw, ["personal", "shared"]);
        assert_eq!(typed, [Visibility::Personal, Visibility::Shared]);
    }
}
