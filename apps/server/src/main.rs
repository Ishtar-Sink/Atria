#![forbid(unsafe_code)]
#![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used, clippy::panic))]

// Parte do núcleo só é usada pelos testes, então o binário não acusa código sem uso.
#[cfg_attr(not(test), allow(dead_code, unused_imports))]
mod http;
#[cfg_attr(not(test), allow(dead_code, unused_imports))]
mod shared;
#[cfg_attr(not(test), allow(dead_code, unused_imports))]
mod storage;

mod auth;
mod finance;
mod goals;
mod journal;
mod library;
mod links;
mod notes;
mod projects;
mod reminders;
mod reports;
mod search;
mod tasks;

use std::net::SocketAddr;
use std::process::ExitCode;
use std::sync::Arc;

use sqlx::PgPool;
use tracing_subscriber::EnvFilter;

use crate::http::{AppState, Config};
use crate::shared::clock::SystemClock;
use crate::shared::crypto::FieldCipher;
use crate::shared::ids::UuidV7Ids;
use crate::storage::local::LocalFileStorage;

const USAGE: &str = "uso: atria-server [serve|migrate|openapi]";

#[derive(Debug, thiserror::Error)]
enum StartupError {
    #[error("falha ao conectar no banco")]
    Database(#[from] shared::db::DbError),
    #[error("falha ao aplicar as migrações")]
    Migration(#[from] http::contexts::MigrationError),
    #[error("falha ao ler a chave de criptografia")]
    Cipher(#[from] shared::crypto::CipherError),
    #[error("falha ao montar o cliente HTTP")]
    HttpClient(#[from] reqwest::Error),
    #[error("falha ao abrir o endereço do servidor")]
    Io(#[from] std::io::Error),
}

#[tokio::main]
async fn main() -> ExitCode {
    let command = std::env::args().nth(1);
    // O contrato é gerado sem configuração nem banco (CI e `@atria/contracts`).
    if command.as_deref() == Some("openapi") {
        println!("{}", http::openapi::openapi_json());
        return ExitCode::SUCCESS;
    }
    init_tracing();
    let config = match Config::from_env() {
        Ok(config) => config,
        Err(error) => {
            // Só o nome da variável vai para o log, nunca o valor ([project/security-12]).
            tracing::error!(variable = error.variable(), "configuração inválida");
            return ExitCode::from(1);
        }
    };
    match command.as_deref() {
        Some("migrate") => exit_with(migrate(&config).await),
        None | Some("serve") => exit_with(serve(config).await),
        Some(_) => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}

fn init_tracing() {
    let level = std::env::var("ATRIA_LOG_LEVEL").unwrap_or_else(|_| "info".to_owned());
    let filter = EnvFilter::try_new(&level).unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(filter)
        .init();
}

fn exit_with(result: Result<(), StartupError>) -> ExitCode {
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            tracing::error!(error = %error, "o servidor parou com erro");
            ExitCode::from(1)
        }
    }
}

async fn migrate(config: &Config) -> Result<(), StartupError> {
    let pool = shared::db::connect(config).await?;
    http::contexts::run_migrations(&pool).await?;
    tracing::info!("migrações aplicadas");
    Ok(())
}

async fn serve(config: Config) -> Result<(), StartupError> {
    let pool = shared::db::connect(&config).await?;
    http::contexts::run_migrations(&pool).await?;
    let state = build_state(pool, config)?;
    let address = state.config.bind_address;
    let app = http::build_router(state.clone(), http::contexts::api_router(&state));
    let dispatcher = tokio::spawn(reminders::run_dispatcher(
        state.clone(),
        http::contexts::web_push_policy(state.pool.clone()),
    ));
    tracing::info!("disparador de lembretes iniciado");
    let listener = tokio::net::TcpListener::bind(address).await?;
    tracing::info!(%address, "servidor no ar");
    let served = axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await;
    dispatcher.abort();
    served?;
    Ok(())
}

fn build_state(pool: PgPool, config: Config) -> Result<AppState, StartupError> {
    let cipher = FieldCipher::from_key_file(&config.encryption_key_file)?;
    let storage = LocalFileStorage::new(config.storage_path.clone());
    let http_client = http::state::build_http_client()?;
    Ok(AppState {
        pool,
        config: Arc::new(config),
        clock: Arc::new(SystemClock),
        ids: Arc::new(UuidV7Ids),
        cipher: Arc::new(cipher),
        storage: Arc::new(storage),
        http_client,
    })
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if tokio::signal::ctrl_c().await.is_err() {
            std::future::pending::<()>().await;
        }
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
    tracing::info!("desligando o servidor");
}
