//! Handlers axum do Financeiro: validação na borda ([project/security-09]),
//! `Idempotency-Key` nas criações e liquidações ([project/api-06]), o gancho de
//! exclusão depois do commit (CB-06) e a conversão de `FinanceError` em
//! `problem+json`.

use std::future::Future;

use axum::extract::{FromRequest, FromRequestParts, Path, Query, Request, State};
use axum::http::request::Parts;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::{Extension, Json};
use chrono::NaiveDate;
use serde::Serialize;
use serde::de::DeserializeOwned;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::finance::application::ports::{
    DateRange, EntityDeletedHook, IdempotencyStore, PayrollLoanFilter, SettlementRequest,
    StoredResponse, TransactionFilter, TransactionRepository, TransferFilter, TransferRepository,
    UndoneSettlement,
};
use crate::finance::application::{
    Env, accounts, categories, payroll_loans, recurring_transactions, summaries, transactions,
    transfers,
};
use crate::finance::domain::adjustment::Adjustment;
use crate::finance::domain::recurring_transaction::OccurrenceSettlement;
use crate::finance::domain::summary::{MAX_PERIOD_DAYS, Period};
use crate::finance::domain::{FieldIssue, FinanceError};
use crate::finance::infrastructure::{
    PgAccounts, PgCategories, PgIdempotency, PgPayrollLoans, PgRecurringTransactions,
    PgTransactions, PgTransfers,
};
use crate::finance::interface::dto::*;
use crate::http::{AppState, CurrentUser};
use crate::shared::error::{ApiError, FieldError, ProblemDetails};
use crate::shared::pagination::{Cursor, PageParams};

/// Maior valor aceito num campo de dinheiro: R$ 10 trilhões em centavos, longe do
/// limite do `i64` mesmo somando muitas movimentações.
const MAX_AMOUNT: i64 = 1_000_000_000_000_000;
const IDEMPOTENCY_HEADER: &str = "idempotency-key";
const IDEMPOTENCY_KEY_MAX: usize = 255;
/// Maior busca aceita na descrição (DEC-005).
const SEARCH_MAX_CHARS: usize = 100;

pub type ApiResult<T> = Result<T, ApiError>;

// Conversões e extratores ---------------------------------------------------

pub fn api_error(error: FinanceError) -> ApiError {
    match error {
        FinanceError::NotFound => ApiError::not_found("not_found"),
        FinanceError::Validation(issues) => {
            ApiError::unprocessable("validation_failed", field_errors(&issues))
        }
        FinanceError::IdempotencyKeyReused
        | FinanceError::CategoryKindMismatch
        | FinanceError::CurrencyMismatch => ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            error.code(),
            "Unprocessable Content",
        ),
        FinanceError::Storage(cause) => ApiError::internal_from(cause.as_ref()),
        other => ApiError::conflict(other.code()),
    }
}

fn field_errors(issues: &[FieldIssue]) -> Vec<FieldError> {
    issues
        .iter()
        .map(|issue| FieldError::new(issue.field, issue.code))
        .collect()
}

fn invalid(field: &'static str, code: &'static str) -> ApiError {
    ApiError::unprocessable("validation_failed", vec![FieldError::new(field, code)])
}

/// Corpo JSON; um corpo inválido vira `422 validation_failed` em `problem+json`.
pub struct Body<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequest<S> for Body<T> {
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        match Json::<T>::from_request(request, state).await {
            Ok(Json(value)) => Ok(Self(value)),
            Err(rejection) => Err(invalid("body", "invalid").with_detail(rejection.body_text())),
        }
    }
}

/// Parâmetros da query; inválidos viram `422 validation_failed`.
pub struct Params<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequestParts<S> for Params<T> {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match Query::<T>::from_request_parts(parts, state).await {
            Ok(Query(value)) => Ok(Self(value)),
            Err(rejection) => Err(invalid("query", "invalid").with_detail(rejection.body_text())),
        }
    }
}

/// Id do caminho; um id malformado é tratado como inexistente.
pub struct Id(pub Uuid);

impl<S: Send + Sync> FromRequestParts<S> for Id {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Path::<Uuid>::from_request_parts(parts, state)
            .await
            .map(|Path(id)| Self(id))
            .map_err(|_| ApiError::not_found("not_found"))
    }
}

fn env(state: &AppState) -> Env<'_> {
    Env {
        clock: state.clock.as_ref(),
        ids: state.ids.as_ref(),
    }
}

fn check_amount(field: &'static str, value: i64) -> ApiResult<()> {
    if value.unsigned_abs() > MAX_AMOUNT.unsigned_abs() {
        return Err(invalid(field, "too_large"));
    }
    Ok(())
}

/// Os valores em centavos dos itens passam pelo mesmo limite dos outros campos.
fn check_adjustments(items: &[AdjustmentDto]) -> ApiResult<()> {
    for item in items {
        for value in [item.amount, item.base_amount].into_iter().flatten() {
            check_amount("adjustments", value)?;
        }
    }
    Ok(())
}

/// Os valores da liquidação passam pelo limite de dinheiro; qual dos dois vale depende das
/// parcelas de consignado do período e é decidido na transação (SPEC-006, RF-08).
fn check_settlement_amounts(
    settled_amount: Option<i64>,
    account_amount: Option<i64>,
) -> ApiResult<()> {
    if let Some(value) = settled_amount {
        check_amount("settled_amount", value)?;
    }
    if let Some(value) = account_amount {
        check_amount("account_amount", value)?;
    }
    Ok(())
}

fn adjustments(items: &[AdjustmentDto]) -> Vec<Adjustment> {
    items.iter().cloned().map(Into::into).collect()
}

fn page_limit(params: &PageParams) -> u32 {
    params.limit()
}

/// Hoje em UTC, para o status das gravadas, que não guardam fuso
/// ([project/code-style-06]).
fn today(state: &AppState) -> NaiveDate {
    state.clock.now().date_naive()
}

/// Com os dois limites, `from` não passa de `to`.
fn check_range(from: Option<NaiveDate>, to: Option<NaiveDate>) -> ApiResult<DateRange> {
    if let (Some(start), Some(end)) = (from, to)
        && start > end
    {
        return Err(invalid("from", "after_to"));
    }
    Ok(DateRange { from, to })
}

/// Busca aparada, de 1 a `SEARCH_MAX_CHARS` caracteres; sem `q`, nenhum filtro.
fn search(q: Option<&str>) -> ApiResult<Option<String>> {
    let Some(text) = q else {
        return Ok(None);
    };
    let trimmed = text.trim();
    if trimmed.is_empty() || trimmed.chars().count() > SEARCH_MAX_CHARS {
        return Err(invalid("q", "length"));
    }
    Ok(Some(trimmed.to_owned()))
}

fn page_after(params: &PageParams) -> ApiResult<Option<Uuid>> {
    params
        .cursor()
        .map(|cursor| cursor.map(|c| c.id))
        .map_err(|_| invalid("cursor", "invalid"))
}

/// Corta a página no limite pedido e monta o cursor da próxima, se houver.
fn paginate<T>(
    mut items: Vec<T>,
    limit: u32,
    cursor: impl Fn(&T) -> Cursor,
) -> (Vec<T>, Option<String>) {
    let limit = limit as usize;
    if items.len() <= limit {
        return (items, None);
    }
    items.truncate(limit);
    let next = items.last().map(|last| cursor(last).encode());
    (items, next)
}

fn id_cursor(id: Uuid) -> Cursor {
    Cursor::new(String::new(), id)
}

async fn notify_deleted(
    hook: Option<&EntityDeletedHook>,
    owner_id: Uuid,
    entity_type: &'static str,
    ids: &[Uuid],
) {
    let Some(hook) = hook else {
        return;
    };
    for id in ids {
        hook(owner_id, entity_type, *id).await;
    }
}

// Idempotência --------------------------------------------------------------

fn idempotency_key(headers: &HeaderMap) -> ApiResult<Option<String>> {
    let Some(value) = headers.get(IDEMPOTENCY_HEADER) else {
        return Ok(None);
    };
    let key = value
        .to_str()
        .map_err(|_| invalid("idempotency_key", "invalid"))?;
    let valid = !key.is_empty()
        && key.len() <= IDEMPOTENCY_KEY_MAX
        && key.bytes().all(|byte| byte.is_ascii_graphic());
    if !valid {
        return Err(invalid("idempotency_key", "invalid"));
    }
    Ok(Some(key.to_owned()))
}

fn request_hash(scope: &str, request: &impl Serialize) -> ApiResult<String> {
    let body = serde_json::to_vec(request).map_err(|error| ApiError::internal_from(&error))?;
    let mut hasher = Sha256::new();
    hasher.update(scope.as_bytes());
    hasher.update([0u8]);
    hasher.update(&body);
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

/// Executa a criação uma única vez por `Idempotency-Key`: a mesma chave com o mesmo
/// corpo devolve a resposta gravada; com outro corpo, `422 idempotency_key_reused`.
async fn idempotent<F, Fut>(
    state: &AppState,
    owner_id: Uuid,
    headers: &HeaderMap,
    scope: String,
    request: &impl Serialize,
    run: F,
) -> ApiResult<Response>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = ApiResult<(StatusCode, serde_json::Value)>>,
{
    let Some(key) = idempotency_key(headers)? else {
        let (status, body) = run().await?;
        return Ok((status, Json(body)).into_response());
    };
    let hash = request_hash(&scope, request)?;
    let store = PgIdempotency::new(state.pool.clone());
    if let Some(stored) = store.find(owner_id, &key).await.map_err(api_error)? {
        if stored.request_hash != hash {
            return Err(api_error(FinanceError::IdempotencyKeyReused));
        }
        let status = StatusCode::from_u16(stored.status).unwrap_or(StatusCode::OK);
        return Ok((status, Json(stored.body)).into_response());
    }
    let (status, body) = run().await?;
    let stored = StoredResponse {
        request_hash: hash,
        status: status.as_u16(),
        body,
    };
    store
        .save(owner_id, &key, &stored, state.clock.now())
        .await
        .map_err(api_error)?;
    Ok((status, Json(stored.body)).into_response())
}

fn to_json(value: impl Serialize) -> ApiResult<serde_json::Value> {
    serde_json::to_value(value).map_err(|error| ApiError::internal_from(&error))
}

// Contas --------------------------------------------------------------------

#[utoipa::path(get, path = "/api/v1/accounts", tag = "finance", params(PageParams),
    responses((status = 200, body = AccountPage), (status = 401, body = ProblemDetails)))]
pub async fn list_accounts(
    State(state): State<AppState>,
    user: CurrentUser,
    Params(page): Params<PageParams>,
) -> ApiResult<Json<AccountPage>> {
    let limit = page_limit(&page);
    let repo = PgAccounts::new(state.pool.clone());
    let items = accounts::list(
        &repo,
        env(&state),
        user.user_id,
        page_after(&page)?,
        limit + 1,
    )
    .await
    .map_err(api_error)?;
    let (items, next_cursor) = paginate(items, limit, |a| id_cursor(a.id));
    Ok(Json(AccountPage {
        items: items.into_iter().map(Into::into).collect(),
        next_cursor,
    }))
}

#[utoipa::path(post, path = "/api/v1/accounts", tag = "finance", request_body = CreateAccountRequest,
    responses((status = 201, body = AccountResponse), (status = 422, body = ProblemDetails)))]
pub async fn create_account(
    State(state): State<AppState>,
    user: CurrentUser,
    Body(body): Body<CreateAccountRequest>,
) -> ApiResult<(StatusCode, Json<AccountResponse>)> {
    let input = accounts::NewAccount {
        name: body.name,
        visibility: body.visibility.unwrap_or_default(),
    };
    let repo = PgAccounts::new(state.pool.clone());
    let account = accounts::create(&repo, env(&state), user.user_id, input)
        .await
        .map_err(api_error)?;
    Ok((StatusCode::CREATED, Json(account.into())))
}

#[utoipa::path(get, path = "/api/v1/accounts/{id}", tag = "finance", params(("id" = Uuid, Path)),
    responses((status = 200, body = AccountResponse), (status = 404, body = ProblemDetails)))]
pub async fn get_account(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
) -> ApiResult<Json<AccountResponse>> {
    let repo = PgAccounts::new(state.pool.clone());
    let account = accounts::get(&repo, env(&state), user.user_id, id)
        .await
        .map_err(api_error)?;
    Ok(Json(account.into()))
}

#[utoipa::path(patch, path = "/api/v1/accounts/{id}", tag = "finance", params(("id" = Uuid, Path)),
    request_body = UpdateAccountRequest,
    responses((status = 200, body = AccountResponse), (status = 404, body = ProblemDetails),
        (status = 422, body = ProblemDetails)))]
pub async fn update_account(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
    Body(body): Body<UpdateAccountRequest>,
) -> ApiResult<Json<AccountResponse>> {
    let patch = accounts::AccountPatch {
        name: body.name,
        visibility: body.visibility,
    };
    let repo = PgAccounts::new(state.pool.clone());
    let account = accounts::update(&repo, env(&state), user.user_id, id, patch)
        .await
        .map_err(api_error)?;
    Ok(Json(account.into()))
}

/// Exclui a conta; com movimentações, move tudo para `move_to` (RF-05, RF-06). 409 para a
/// conta padrão ou sem destino; 422 para destino inválido ou de outra moeda.
#[utoipa::path(delete, path = "/api/v1/accounts/{id}", tag = "finance",
    params(("id" = Uuid, Path), DeleteAccountQuery),
    responses((status = 204), (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn delete_account(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    Id(id): Id,
    Params(query): Params<DeleteAccountQuery>,
) -> ApiResult<StatusCode> {
    let repo = PgAccounts::new(state.pool.clone());
    let deleted_transfers = accounts::delete(&repo, env(&state), user.user_id, id, query.move_to)
        .await
        .map_err(api_error)?;
    notify_deleted(
        hook.as_ref().map(|h| &h.0),
        user.user_id,
        "transfer",
        &deleted_transfers,
    )
    .await;
    notify_deleted(hook.as_ref().map(|h| &h.0), user.user_id, "account", &[id]).await;
    Ok(StatusCode::NO_CONTENT)
}

// Categorias ----------------------------------------------------------------

#[utoipa::path(get, path = "/api/v1/categories", tag = "finance", params(CategoryQuery),
    responses((status = 200, body = CategoryPage), (status = 422, body = ProblemDetails)))]
pub async fn list_categories(
    State(state): State<AppState>,
    user: CurrentUser,
    Params(query): Params<CategoryQuery>,
) -> ApiResult<Json<CategoryPage>> {
    let page = PageParams {
        cursor: query.cursor,
        limit: query.limit,
    };
    let limit = page_limit(&page);
    let repo = PgCategories::new(state.pool.clone());
    let kind = query.kind.map(Into::into);
    let items = categories::list(
        &repo,
        env(&state),
        user.user_id,
        kind,
        page_after(&page)?,
        limit + 1,
    )
    .await
    .map_err(api_error)?;
    let (items, next_cursor) = paginate(items, limit, |c| id_cursor(c.id));
    Ok(Json(CategoryPage {
        items: items.into_iter().map(Into::into).collect(),
        next_cursor,
    }))
}

#[utoipa::path(post, path = "/api/v1/categories", tag = "finance", request_body = CreateCategoryRequest,
    responses((status = 201, body = CategoryResponse), (status = 422, body = ProblemDetails)))]
pub async fn create_category(
    State(state): State<AppState>,
    user: CurrentUser,
    Body(body): Body<CreateCategoryRequest>,
) -> ApiResult<(StatusCode, Json<CategoryResponse>)> {
    let input = categories::NewCategory {
        name: body.name,
        kind: body.kind.into(),
        color: body.color,
        visibility: body.visibility.unwrap_or_default(),
    };
    let repo = PgCategories::new(state.pool.clone());
    let category = categories::create(&repo, env(&state), user.user_id, input)
        .await
        .map_err(api_error)?;
    Ok((StatusCode::CREATED, Json(category.into())))
}

#[utoipa::path(get, path = "/api/v1/categories/{id}", tag = "finance", params(("id" = Uuid, Path)),
    responses((status = 200, body = CategoryResponse), (status = 404, body = ProblemDetails)))]
pub async fn get_category(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
) -> ApiResult<Json<CategoryResponse>> {
    use crate::finance::application::ports::CategoryRepository;
    let repo = PgCategories::new(state.pool.clone());
    let category = repo.get(user.user_id, id).await.map_err(api_error)?;
    Ok(Json(category.into()))
}

#[utoipa::path(patch, path = "/api/v1/categories/{id}", tag = "finance", params(("id" = Uuid, Path)),
    request_body = UpdateCategoryRequest,
    responses((status = 200, body = CategoryResponse), (status = 404, body = ProblemDetails),
        (status = 422, body = ProblemDetails)))]
pub async fn update_category(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
    Body(body): Body<UpdateCategoryRequest>,
) -> ApiResult<Json<CategoryResponse>> {
    let patch = categories::CategoryPatch {
        name: body.name,
        color: body.color,
        visibility: body.visibility,
    };
    let repo = PgCategories::new(state.pool.clone());
    let category = categories::update(&repo, env(&state), user.user_id, id, patch)
        .await
        .map_err(api_error)?;
    Ok(Json(category.into()))
}

#[utoipa::path(delete, path = "/api/v1/categories/{id}", tag = "finance",
    params(("id" = Uuid, Path), DeleteCategoryQuery),
    responses((status = 204), (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn delete_category(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
    Params(query): Params<DeleteCategoryQuery>,
) -> ApiResult<StatusCode> {
    let repo = PgCategories::new(state.pool.clone());
    categories::delete(&repo, env(&state), user.user_id, id, query.replacement_id)
        .await
        .map_err(api_error)?;
    Ok(StatusCode::NO_CONTENT)
}

// Movimentações -------------------------------------------------------------

fn transaction_filter(query: &TransactionQuery) -> ApiResult<TransactionFilter> {
    let range = check_range(query.from, query.to)?;
    Ok(TransactionFilter {
        account_id: query.account_id,
        category_id: query.category_id,
        kind: query.kind.map(Into::into),
        from: range.from,
        to: range.to,
        settled: query.settled,
        repetition: query.repetition.into(),
        q: search(query.q.as_deref())?,
    })
}

fn transaction_after(cursor: Option<&str>) -> ApiResult<Option<(NaiveDate, Uuid)>> {
    let Some(text) = cursor else {
        return Ok(None);
    };
    let cursor = Cursor::decode(text).map_err(|_| invalid("cursor", "invalid"))?;
    let date = cursor
        .sort_key
        .parse::<NaiveDate>()
        .map_err(|_| invalid("cursor", "invalid"))?;
    Ok(Some((date, cursor.id)))
}

#[utoipa::path(get, path = "/api/v1/transactions", tag = "finance", params(TransactionQuery),
    responses((status = 200, body = TransactionPage), (status = 422, body = ProblemDetails)))]
pub async fn list_transactions(
    State(state): State<AppState>,
    user: CurrentUser,
    Params(query): Params<TransactionQuery>,
) -> ApiResult<Json<TransactionPage>> {
    let page = PageParams {
        cursor: None,
        limit: query.limit,
    };
    let limit = page.limit();
    let after = transaction_after(query.cursor.as_deref())?;
    let filter = transaction_filter(&query)?;
    let recurring = PgRecurringTransactions::new(state.pool.clone());
    let repo = PgTransactions::new(state.pool.clone());
    let items = transactions::list(
        &PgPayrollLoans::new(state.pool.clone()),
        &recurring,
        &repo,
        env(&state),
        user.user_id,
        &filter,
        after,
        limit + 1,
    )
    .await
    .map_err(api_error)?;
    let (items, next_cursor) = paginate(items, limit, |item| {
        Cursor::new(item.effective_date().to_string(), item.key())
    });
    let today = today(&state);
    Ok(Json(TransactionPage {
        items: items
            .into_iter()
            .map(|item| TransactionItemResponse::new(item, today))
            .collect(),
        next_cursor,
    }))
}

#[utoipa::path(post, path = "/api/v1/transactions", tag = "finance",
    request_body = CreateTransactionRequest,
    params(("Idempotency-Key" = Option<String>, Header)),
    responses((status = 201, body = CreatedTransactions), (status = 404, body = ProblemDetails),
        (status = 422, body = ProblemDetails)))]
pub async fn create_transactions(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Body(body): Body<CreateTransactionRequest>,
) -> ApiResult<Response> {
    if let Some(amount) = body.expected_amount {
        check_amount("expected_amount", amount)?;
    }
    if let Some(amount) = body.gross_amount {
        check_amount("gross_amount", amount)?;
    }
    check_adjustments(&body.adjustments)?;
    let scope = "POST /transactions".to_owned();
    idempotent(&state, user.user_id, &headers, scope, &body, || async {
        let input = transactions::NewTransaction {
            kind: body.kind.into(),
            account_id: body.account_id,
            category_id: body.category_id,
            description: body.description.clone(),
            expected_amount: body.expected_amount,
            gross_amount: body.gross_amount,
            adjustments: adjustments(&body.adjustments),
            expected_date: body.expected_date,
            visibility: body.visibility.unwrap_or_default(),
        };
        let items = transactions::create(
            &PgAccounts::new(state.pool.clone()),
            &PgCategories::new(state.pool.clone()),
            &PgTransactions::new(state.pool.clone()),
            env(&state),
            user.user_id,
            input,
        )
        .await
        .map_err(api_error)?;
        let today = today(&state);
        let created = CreatedTransactions {
            items: items
                .into_iter()
                .map(|item| TransactionResponse::new(item, today))
                .collect(),
        };
        Ok((StatusCode::CREATED, to_json(created)?))
    })
    .await
}

#[utoipa::path(get, path = "/api/v1/transactions/{id}", tag = "finance", params(("id" = Uuid, Path)),
    responses((status = 200, body = TransactionResponse), (status = 404, body = ProblemDetails)))]
pub async fn get_transaction(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
) -> ApiResult<Json<TransactionResponse>> {
    let repo = PgTransactions::new(state.pool.clone());
    let item = repo.get(user.user_id, id).await.map_err(api_error)?;
    Ok(Json(TransactionResponse::new(item, today(&state))))
}

#[utoipa::path(patch, path = "/api/v1/transactions/{id}", tag = "finance",
    params(("id" = Uuid, Path)), request_body = UpdateTransactionRequest,
    responses((status = 200, body = TransactionResponse), (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn update_transaction(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
    Body(body): Body<UpdateTransactionRequest>,
) -> ApiResult<Json<TransactionResponse>> {
    if let Some(amount) = body.expected_amount {
        check_amount("expected_amount", amount)?;
    }
    if let Some(amount) = body.gross_amount {
        check_amount("gross_amount", amount)?;
    }
    if let Some(items) = &body.adjustments {
        check_adjustments(items)?;
    }
    let patch = transactions::TransactionPatch {
        description: body.description,
        expected_amount: body.expected_amount,
        expected_date: body.expected_date,
        account_id: body.account_id,
        category_id: body.category_id,
        visibility: body.visibility,
        gross_amount: body.gross_amount,
        adjustments: body.adjustments.as_deref().map(adjustments),
    };
    let item = transactions::update(
        &PgAccounts::new(state.pool.clone()),
        &PgCategories::new(state.pool.clone()),
        &PgTransactions::new(state.pool.clone()),
        env(&state),
        user.user_id,
        id,
        patch,
    )
    .await
    .map_err(api_error)?;
    Ok(Json(TransactionResponse::new(item, today(&state))))
}

/// Desfaz a liquidação (DEC-005): 200 com a movimentação prevista de novo, ou 204
/// quando a cópia de uma recorrente é apagada, com o gancho depois do commit.
#[utoipa::path(delete, path = "/api/v1/transactions/{id}/settlement", tag = "finance",
    params(("id" = Uuid, Path)),
    responses((status = 200, body = TransactionResponse), (status = 204),
        (status = 404, body = ProblemDetails), (status = 409, body = ProblemDetails)))]
pub async fn undo_settlement(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    Id(id): Id,
) -> ApiResult<Response> {
    let repo = PgTransactions::new(state.pool.clone());
    let outcome = transactions::undo_settlement(&repo, env(&state), user.user_id, id)
        .await
        .map_err(api_error)?;
    match outcome {
        UndoneSettlement::Reopened(item) => {
            let response = TransactionResponse::new(*item, today(&state));
            Ok((StatusCode::OK, Json(response)).into_response())
        }
        UndoneSettlement::CopyDeleted(copy_id) => {
            notify_deleted(
                hook.as_ref().map(|h| &h.0),
                user.user_id,
                "transaction",
                &[copy_id],
            )
            .await;
            Ok(StatusCode::NO_CONTENT.into_response())
        }
    }
}

#[utoipa::path(delete, path = "/api/v1/transactions/{id}", tag = "finance",
    params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ProblemDetails)))]
pub async fn delete_transaction(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    Id(id): Id,
) -> ApiResult<StatusCode> {
    let repo = PgTransactions::new(state.pool.clone());
    transactions::delete(&repo, env(&state), user.user_id, id)
        .await
        .map_err(api_error)?;
    notify_deleted(
        hook.as_ref().map(|h| &h.0),
        user.user_id,
        "transaction",
        &[id],
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(post, path = "/api/v1/transactions/{id}/settlement", tag = "finance",
    params(("id" = Uuid, Path), ("Idempotency-Key" = Option<String>, Header)),
    request_body = SettleTransactionRequest,
    responses((status = 200, body = TransactionResponse), (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn settle_transaction(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Id(id): Id,
    Body(body): Body<SettleTransactionRequest>,
) -> ApiResult<Response> {
    check_settlement_amounts(body.settled_amount, body.account_amount)?;
    if let Some(items) = &body.adjustments {
        check_adjustments(items)?;
    }
    let scope = format!("POST /transactions/{id}/settlement");
    idempotent(&state, user.user_id, &headers, scope, &body, || async {
        let request = SettlementRequest {
            settled_amount: body.settled_amount,
            account_amount: body.account_amount,
            settled_at: body.settled_at,
            adjustments: body.adjustments.as_deref().map(adjustments),
        };
        let repo = PgTransactions::new(state.pool.clone());
        let item = transactions::settle(&repo, env(&state), user.user_id, id, request)
            .await
            .map_err(api_error)?;
        let response = TransactionResponse::new(item, today(&state));
        Ok((StatusCode::OK, to_json(response)?))
    })
    .await
}

/// Prévia da liquidação pelo líquido: bruto e itens recalculados, sem gravar (RF-09, decisão 13).
#[utoipa::path(post, path = "/api/v1/transactions/settlement-preview", tag = "finance",
    request_body = SettlementPreviewRequest,
    responses((status = 200, body = BreakdownDto), (status = 422, body = ProblemDetails)))]
pub async fn preview_settlement(
    _user: CurrentUser,
    Body(body): Body<SettlementPreviewRequest>,
) -> ApiResult<Json<BreakdownDto>> {
    check_amount("settled_amount", body.settled_amount)?;
    check_amount("expected_gross_amount", body.expected_gross_amount)?;
    check_adjustments(&body.adjustments)?;
    let breakdown = transactions::preview_settlement(
        body.settled_amount,
        &adjustments(&body.adjustments),
        body.expected_gross_amount,
    )
    .map_err(api_error)?;
    Ok(Json(breakdown.into()))
}

// Consignados ---------------------------------------------------------------

#[utoipa::path(get, path = "/api/v1/payroll-loans", tag = "finance", params(PayrollLoanQuery),
    responses((status = 200, body = PayrollLoanPage), (status = 422, body = ProblemDetails)))]
pub async fn list_payroll_loans(
    State(state): State<AppState>,
    user: CurrentUser,
    Params(query): Params<PayrollLoanQuery>,
) -> ApiResult<Json<PayrollLoanPage>> {
    let page = PageParams {
        cursor: query.cursor,
        limit: query.limit,
    };
    let limit = page_limit(&page);
    let filter = PayrollLoanFilter {
        income_id: query.income_id,
        income_recurrence_id: query.income_recurrence_id,
    };
    let items = payroll_loans::list(
        &PgPayrollLoans::new(state.pool.clone()),
        &PgTransactions::new(state.pool.clone()),
        &PgRecurringTransactions::new(state.pool.clone()),
        user.user_id,
        filter,
        page_after(&page)?,
        limit + 1,
    )
    .await
    .map_err(api_error)?;
    let (items, next_cursor) = paginate(items, limit, |view| id_cursor(view.loan.id));
    Ok(Json(PayrollLoanPage {
        items: items.into_iter().map(Into::into).collect(),
        next_cursor,
    }))
}

/// Cadastra o consignado numa entrada aberta; o primeiro da pessoa cria a categoria
/// "Empréstimo" (RF-02 a RF-05).
#[utoipa::path(post, path = "/api/v1/payroll-loans", tag = "finance",
    params(("Idempotency-Key" = Option<String>, Header)),
    request_body = CreatePayrollLoanRequest,
    responses((status = 201, body = PayrollLoanResponse), (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn create_payroll_loan(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Body(body): Body<CreatePayrollLoanRequest>,
) -> ApiResult<Response> {
    check_amount("installment_amount", body.installment_amount)?;
    let scope = "POST /payroll-loans".to_owned();
    idempotent(&state, user.user_id, &headers, scope, &body, || async {
        let input = payroll_loans::NewPayrollLoan {
            income_id: body.income_id,
            income_recurrence_id: body.income_recurrence_id,
            name: body.name.clone(),
            contract_number: body.contract_number.clone(),
            installment_amount: body.installment_amount,
            total_installments: body.total_installments,
            current_installment: body.current_installment,
            ends_on: body.ends_on,
        };
        let view = payroll_loans::create(
            &PgPayrollLoans::new(state.pool.clone()),
            &PgTransactions::new(state.pool.clone()),
            &PgRecurringTransactions::new(state.pool.clone()),
            env(&state),
            user.user_id,
            input,
        )
        .await
        .map_err(api_error)?;
        Ok((
            StatusCode::CREATED,
            to_json(PayrollLoanResponse::from(view))?,
        ))
    })
    .await
}

#[utoipa::path(get, path = "/api/v1/payroll-loans/{id}", tag = "finance", params(("id" = Uuid, Path)),
    responses((status = 200, body = PayrollLoanResponse), (status = 404, body = ProblemDetails)))]
pub async fn get_payroll_loan(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
) -> ApiResult<Json<PayrollLoanResponse>> {
    let view = payroll_loans::get(
        &PgPayrollLoans::new(state.pool.clone()),
        &PgTransactions::new(state.pool.clone()),
        &PgRecurringTransactions::new(state.pool.clone()),
        user.user_id,
        id,
    )
    .await
    .map_err(api_error)?;
    Ok(Json(view.into()))
}

#[utoipa::path(patch, path = "/api/v1/payroll-loans/{id}", tag = "finance", params(("id" = Uuid, Path)),
    request_body = UpdatePayrollLoanRequest,
    responses((status = 200, body = PayrollLoanResponse), (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn update_payroll_loan(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
    Body(body): Body<UpdatePayrollLoanRequest>,
) -> ApiResult<Json<PayrollLoanResponse>> {
    if let Some(amount) = body.installment_amount {
        check_amount("installment_amount", amount)?;
    }
    let patch = payroll_loans::PayrollLoanPatch {
        name: body.name,
        contract_number: body.contract_number,
        installment_amount: body.installment_amount,
        total_installments: body.total_installments,
        current_installment: body.current_installment,
        ends_on: body.ends_on,
    };
    let view = payroll_loans::update(
        &PgPayrollLoans::new(state.pool.clone()),
        &PgTransactions::new(state.pool.clone()),
        &PgRecurringTransactions::new(state.pool.clone()),
        env(&state),
        user.user_id,
        id,
        patch,
    )
    .await
    .map_err(api_error)?;
    Ok(Json(view.into()))
}

#[utoipa::path(delete, path = "/api/v1/payroll-loans/{id}", tag = "finance", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ProblemDetails)))]
pub async fn delete_payroll_loan(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
) -> ApiResult<StatusCode> {
    let repo = PgPayrollLoans::new(state.pool.clone());
    payroll_loans::delete(&repo, env(&state), user.user_id, id)
        .await
        .map_err(api_error)?;
    Ok(StatusCode::NO_CONTENT)
}

// Transferências ------------------------------------------------------------

#[utoipa::path(get, path = "/api/v1/transfers", tag = "finance", params(TransferQuery),
    responses((status = 200, body = TransferPage), (status = 422, body = ProblemDetails)))]
pub async fn list_transfers(
    State(state): State<AppState>,
    user: CurrentUser,
    Params(query): Params<TransferQuery>,
) -> ApiResult<Json<TransferPage>> {
    let filter = TransferFilter {
        range: check_range(query.from, query.to)?,
        q: search(query.q.as_deref())?,
    };
    let page = PageParams {
        cursor: query.cursor,
        limit: query.limit,
    };
    let limit = page_limit(&page);
    let repo = PgTransfers::new(state.pool.clone());
    let items = transfers::list(&repo, user.user_id, &filter, page_after(&page)?, limit + 1)
        .await
        .map_err(api_error)?;
    let (items, next_cursor) = paginate(items, limit, |t| id_cursor(t.id));
    Ok(Json(TransferPage {
        items: items.into_iter().map(Into::into).collect(),
        next_cursor,
    }))
}

#[utoipa::path(post, path = "/api/v1/transfers", tag = "finance", request_body = CreateTransferRequest,
    params(("Idempotency-Key" = Option<String>, Header)),
    responses((status = 201, body = TransferResponse), (status = 404, body = ProblemDetails),
        (status = 422, body = ProblemDetails)))]
pub async fn create_transfer(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Body(body): Body<CreateTransferRequest>,
) -> ApiResult<Response> {
    check_amount("amount", body.amount)?;
    let scope = "POST /transfers".to_owned();
    idempotent(&state, user.user_id, &headers, scope, &body, || async {
        let input = transfers::NewTransfer {
            from_account_id: body.from_account_id,
            to_account_id: body.to_account_id,
            amount: body.amount,
            transferred_on: body.transferred_on,
            description: body.description.clone(),
            visibility: body.visibility.unwrap_or_default(),
        };
        let transfer = transfers::create(
            &PgAccounts::new(state.pool.clone()),
            &PgTransfers::new(state.pool.clone()),
            env(&state),
            user.user_id,
            input,
        )
        .await
        .map_err(api_error)?;
        Ok((
            StatusCode::CREATED,
            to_json(TransferResponse::from(transfer))?,
        ))
    })
    .await
}

#[utoipa::path(get, path = "/api/v1/transfers/{id}", tag = "finance", params(("id" = Uuid, Path)),
    responses((status = 200, body = TransferResponse), (status = 404, body = ProblemDetails)))]
pub async fn get_transfer(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
) -> ApiResult<Json<TransferResponse>> {
    let repo = PgTransfers::new(state.pool.clone());
    let found = repo.get(user.user_id, id).await.map_err(api_error)?;
    Ok(Json(found.into()))
}

#[utoipa::path(delete, path = "/api/v1/transfers/{id}", tag = "finance", params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ProblemDetails)))]
pub async fn delete_transfer(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    Id(id): Id,
) -> ApiResult<StatusCode> {
    let repo = PgTransfers::new(state.pool.clone());
    transfers::delete(&repo, env(&state), user.user_id, id)
        .await
        .map_err(api_error)?;
    notify_deleted(hook.as_ref().map(|h| &h.0), user.user_id, "transfer", &[id]).await;
    Ok(StatusCode::NO_CONTENT)
}

// Recorrências --------------------------------------------------------------

#[utoipa::path(get, path = "/api/v1/recurring-transactions", tag = "finance", params(PageParams),
    responses((status = 200, body = RecurringTransactionPage)))]
pub async fn list_recurring_transactions(
    State(state): State<AppState>,
    user: CurrentUser,
    Params(page): Params<PageParams>,
) -> ApiResult<Json<RecurringTransactionPage>> {
    let limit = page_limit(&page);
    let repo = PgRecurringTransactions::new(state.pool.clone());
    let items = recurring_transactions::list(&repo, user.user_id, page_after(&page)?, limit + 1)
        .await
        .map_err(api_error)?;
    let (items, next_cursor) = paginate(items, limit, |r| id_cursor(r.id));
    let now = state.clock.now();
    Ok(Json(RecurringTransactionPage {
        items: items
            .into_iter()
            .map(|item| RecurringTransactionResponse::new(item, now))
            .collect(),
        next_cursor,
    }))
}

#[utoipa::path(post, path = "/api/v1/recurring-transactions", tag = "finance",
    request_body = CreateRecurringTransactionRequest,
    params(("Idempotency-Key" = Option<String>, Header)),
    responses((status = 201, body = RecurringTransactionResponse),
        (status = 404, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn create_recurring_transaction(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Body(body): Body<CreateRecurringTransactionRequest>,
) -> ApiResult<Response> {
    if let Some(amount) = body.expected_amount {
        check_amount("expected_amount", amount)?;
    }
    if let Some(amount) = body.gross_amount {
        check_amount("gross_amount", amount)?;
    }
    check_adjustments(&body.adjustments)?;
    let scope = "POST /recurring-transactions".to_owned();
    idempotent(&state, user.user_id, &headers, scope, &body, || async {
        let input = recurring_transactions::NewRecurringTransaction {
            kind: body.kind.into(),
            account_id: body.account_id,
            category_id: body.category_id,
            expected_amount: body.expected_amount,
            gross_amount: body.gross_amount,
            adjustments: adjustments(&body.adjustments),
            description: body.description.clone(),
            rule: body.rule.clone(),
            visibility: body.visibility.unwrap_or_default(),
        };
        let created = recurring_transactions::create(
            &PgAccounts::new(state.pool.clone()),
            &PgCategories::new(state.pool.clone()),
            &PgRecurringTransactions::new(state.pool.clone()),
            env(&state),
            user.user_id,
            input,
        )
        .await
        .map_err(api_error)?;
        let response = RecurringTransactionResponse::new(created, state.clock.now());
        Ok((StatusCode::CREATED, to_json(response)?))
    })
    .await
}

#[utoipa::path(get, path = "/api/v1/recurring-transactions/{id}", tag = "finance",
    params(("id" = Uuid, Path)),
    responses((status = 200, body = RecurringTransactionResponse),
        (status = 404, body = ProblemDetails)))]
pub async fn get_recurring_transaction(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
) -> ApiResult<Json<RecurringTransactionResponse>> {
    use crate::finance::application::ports::RecurringTransactionRepository;
    let repo = PgRecurringTransactions::new(state.pool.clone());
    let recurring = repo.get(user.user_id, id).await.map_err(api_error)?;
    Ok(Json(RecurringTransactionResponse::new(
        recurring,
        state.clock.now(),
    )))
}

#[utoipa::path(patch, path = "/api/v1/recurring-transactions/{id}", tag = "finance",
    params(("id" = Uuid, Path)), request_body = UpdateRecurringTransactionRequest,
    responses((status = 200, body = RecurringTransactionResponse),
        (status = 404, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn update_recurring_transaction(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
    Body(body): Body<UpdateRecurringTransactionRequest>,
) -> ApiResult<Json<RecurringTransactionResponse>> {
    if let Some(amount) = body.expected_amount {
        check_amount("expected_amount", amount)?;
    }
    if let Some(amount) = body.gross_amount {
        check_amount("gross_amount", amount)?;
    }
    if let Some(items) = &body.adjustments {
        check_adjustments(items)?;
    }
    let patch = recurring_transactions::RecurringTransactionPatch {
        account_id: body.account_id,
        expected_amount: body.expected_amount,
        category_id: body.category_id,
        description: body.description,
        rule: body.rule,
        gross_amount: body.gross_amount,
        adjustments: body.adjustments.as_deref().map(adjustments),
    };
    let updated = recurring_transactions::change(
        &PgAccounts::new(state.pool.clone()),
        &PgCategories::new(state.pool.clone()),
        &PgRecurringTransactions::new(state.pool.clone()),
        env(&state),
        user.user_id,
        id,
        patch,
    )
    .await
    .map_err(api_error)?;
    Ok(Json(RecurringTransactionResponse::new(
        updated,
        state.clock.now(),
    )))
}

/// Exclui a recorrente e a ocorrência aberta; as cópias liquidadas ficam como pontuais (RF-01, RN-01).
#[utoipa::path(delete, path = "/api/v1/recurring-transactions/{id}", tag = "finance",
    params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ProblemDetails)))]
pub async fn delete_recurring_transaction(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
) -> ApiResult<StatusCode> {
    let repo = PgRecurringTransactions::new(state.pool.clone());
    recurring_transactions::delete(&repo, env(&state), user.user_id, id)
        .await
        .map_err(api_error)?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(post, path = "/api/v1/recurring-transactions/{id}/settlement", tag = "finance",
    params(("id" = Uuid, Path), ("Idempotency-Key" = Option<String>, Header)),
    request_body = SettleOccurrenceRequest,
    responses((status = 201, body = TransactionResponse), (status = 404, body = ProblemDetails),
        (status = 409, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn settle_occurrence(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Id(id): Id,
    Body(body): Body<SettleOccurrenceRequest>,
) -> ApiResult<Response> {
    check_settlement_amounts(body.settled_amount, body.account_amount)?;
    if let Some(items) = &body.adjustments {
        check_adjustments(items)?;
    }
    let scope = format!("POST /recurring-transactions/{id}/settlement");
    idempotent(&state, user.user_id, &headers, scope, &body, || async {
        let request = OccurrenceSettlement {
            occurrence_date: body.occurrence_date,
            settled_amount: body.settled_amount,
            account_amount: body.account_amount,
            settled_at: body.settled_at,
            adjustments: body.adjustments.as_deref().map(adjustments),
        };
        let repo = PgRecurringTransactions::new(state.pool.clone());
        let copy = recurring_transactions::settle_occurrence(
            &repo,
            env(&state),
            user.user_id,
            id,
            request,
        )
        .await
        .map_err(api_error)?;
        let response = TransactionResponse::new(copy, today(&state));
        Ok((StatusCode::CREATED, to_json(response)?))
    })
    .await
}

#[utoipa::path(post, path = "/api/v1/recurring-transactions/{id}/skip", tag = "finance",
    params(("id" = Uuid, Path), ("Idempotency-Key" = Option<String>, Header)),
    request_body = SkipOccurrenceRequest,
    responses((status = 200, body = RecurringTransactionResponse),
        (status = 404, body = ProblemDetails), (status = 409, body = ProblemDetails),
        (status = 422, body = ProblemDetails)))]
pub async fn skip_occurrence(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Id(id): Id,
    Body(body): Body<SkipOccurrenceRequest>,
) -> ApiResult<Response> {
    let scope = format!("POST /recurring-transactions/{id}/skip");
    idempotent(&state, user.user_id, &headers, scope, &body, || async {
        let repo = PgRecurringTransactions::new(state.pool.clone());
        let recurring = recurring_transactions::skip_occurrence(
            &repo,
            env(&state),
            user.user_id,
            id,
            body.occurrence_date,
        )
        .await
        .map_err(api_error)?;
        let response = RecurringTransactionResponse::new(recurring, state.clock.now());
        Ok((StatusCode::OK, to_json(response)?))
    })
    .await
}

#[utoipa::path(get, path = "/api/v1/recurring-transactions/{id}/settled-transactions",
    tag = "finance", params(("id" = Uuid, Path), PageParams),
    responses((status = 200, body = SettledTransactionPage),
        (status = 404, body = ProblemDetails), (status = 422, body = ProblemDetails)))]
pub async fn list_settled_transactions(
    State(state): State<AppState>,
    user: CurrentUser,
    Id(id): Id,
    Params(page): Params<PageParams>,
) -> ApiResult<Json<SettledTransactionPage>> {
    let limit = page_limit(&page);
    // Cursor da data da ocorrência e do id.
    let after = transaction_after(page.cursor.as_deref())?;
    let repo = PgRecurringTransactions::new(state.pool.clone());
    let items = recurring_transactions::settled_copies(&repo, user.user_id, id, after, limit + 1)
        .await
        .map_err(api_error)?;
    let (items, next_cursor) = paginate(items, limit, |copy| {
        let date = copy.occurrence_date.unwrap_or(copy.expected_date);
        Cursor::new(date.to_string(), copy.id)
    });
    let today = today(&state);
    Ok(Json(SettledTransactionPage {
        items: items
            .into_iter()
            .map(|item| TransactionResponse::new(item, today))
            .collect(),
        next_cursor,
    }))
}

// Resumo do período ---------------------------------------------------------

/// Com os dois limites, no máximo `MAX_PERIOD_DAYS` dias, para limitar a projeção
/// das recorrentes.
fn check_summary_period(query: &SummaryQuery) -> ApiResult<()> {
    check_range(query.from, query.to)?;
    if let (Some(from), Some(to)) = (query.from, query.to)
        && (Period { from, to }).days() > MAX_PERIOD_DAYS
    {
        return Err(invalid("to", "period_too_long"));
    }
    Ok(())
}

#[utoipa::path(get, path = "/api/v1/financial-summaries", tag = "finance", params(SummaryQuery),
    responses((status = 200, body = FinancialSummaryResponse),
        (status = 422, body = ProblemDetails)))]
pub async fn get_financial_summary(
    State(state): State<AppState>,
    user: CurrentUser,
    Params(query): Params<SummaryQuery>,
) -> ApiResult<Json<FinancialSummaryResponse>> {
    check_summary_period(&query)?;
    let sources = summaries::SummarySources {
        accounts: &PgAccounts::new(state.pool.clone()),
        categories: &PgCategories::new(state.pool.clone()),
        transactions: &PgTransactions::new(state.pool.clone()),
        transfers: &PgTransfers::new(state.pool.clone()),
        recurring: &PgRecurringTransactions::new(state.pool.clone()),
        loans: &PgPayrollLoans::new(state.pool.clone()),
    };
    let request = summaries::SummaryRequest {
        from: query.from,
        to: query.to,
    };
    let view = summaries::period(sources, env(&state), user.user_id, request)
        .await
        .map_err(api_error)?;
    Ok(Json(view.into()))
}
