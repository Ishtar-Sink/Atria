//! PostgreSQL real em container para os testes de integração ([project/testing-02]).
//!
//! Um container por máquina, reaproveitado entre execuções para não acumular
//! containers; cada teste recebe um banco novo, cujo dono é o papel `atria_app`,
//! sem superusuário e sem `BYPASSRLS`, como em produção. O banco é apagado quando o
//! `TestDatabase` sai de escopo, e os que sobraram de processos mortos são varridos
//! na subida do container.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{Connection, PgConnection, PgPool};
use testcontainers::runners::AsyncRunner;
use testcontainers::{ContainerAsync, ImageExt, ReuseDirective};
use testcontainers_modules::postgres::Postgres;
use tokio::sync::OnceCell;
use uuid::Uuid;

pub const APP_ROLE: &str = "atria_app";
const APP_PASSWORD: &str = "atria_app";
const SUPERUSER: &str = "postgres";
const DATABASE_PREFIX: &str = "test_";
/// Idade mínima de um banco de teste para a varredura apagá-lo: protege os bancos de
/// outra execução em andamento ao mesmo tempo.
const STALE_AFTER: Duration = Duration::from_secs(10 * 60);
/// O `/dev/shm` padrão do Docker (64 MiB) não comporta muitos bancos abertos.
const SHM_SIZE: u64 = 512 * 1024 * 1024;

struct Server {
    host: String,
    port: u16,
    // Mantido vivo pelo processo inteiro.
    _container: ContainerAsync<Postgres>,
}

static SERVER: OnceCell<Server> = OnceCell::const_new();

async fn server() -> &'static Server {
    SERVER.get_or_init(start_server).await
}

async fn start_server() -> Server {
    let container = Postgres::default()
        .with_tag("17-alpine")
        .with_container_name("atria-server-tests-postgres")
        .with_reuse(ReuseDirective::Always)
        .with_shm_size(SHM_SIZE)
        .start()
        .await
        .expect("o Docker precisa estar disponível para os testes de integração");
    let host = container
        .get_host()
        .await
        .expect("host do container")
        .to_string();
    let port = container
        .get_host_port_ipv4(5432)
        .await
        .expect("porta do container");
    let server = Server {
        host,
        port,
        _container: container,
    };
    create_app_role(&server).await;
    let mut conn = superuser_connection(&server).await;
    sweep_stale_databases(&mut conn).await;
    server
}

fn options(server: &Server, user: &str, password: &str, database: &str) -> PgConnectOptions {
    PgConnectOptions::new()
        .host(&server.host)
        .port(server.port)
        .username(user)
        .password(password)
        .database(database)
}

async fn superuser_connection(server: &Server) -> PgConnection {
    PgConnection::connect_with(&options(server, SUPERUSER, SUPERUSER, "postgres"))
        .await
        .expect("conexão de superusuário")
}

async fn create_app_role(server: &Server) {
    let mut conn = superuser_connection(server).await;
    // Idempotente: o container é reaproveitado e outros processos de teste podem
    // criar o papel ao mesmo tempo.
    let sql = format!(
        "DO $$ BEGIN \
           CREATE ROLE {APP_ROLE} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '{APP_PASSWORD}'; \
         EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$"
    );
    sqlx::raw_sql(&sql)
        .execute(&mut conn)
        .await
        .expect("criar o papel atria_app");
}

/// Banco de teste com o pool conectado como `atria_app`; o banco é apagado no `Drop`.
pub struct TestDatabase {
    pool: PgPool,
    name: String,
}

impl TestDatabase {
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub fn name(&self) -> &str {
        &self.name
    }
}

impl Drop for TestDatabase {
    fn drop(&mut self) {
        // `close()` marca o pool como fechado já na chamada; o futuro não é aguardado
        // porque o `Drop` não é assíncrono, e o `FORCE` encerra as conexões que sobrarem.
        drop(self.pool.close());
        let Some(server) = SERVER.get() else {
            return;
        };
        let options = options(server, SUPERUSER, SUPERUSER, "postgres");
        let sql = format!("DROP DATABASE IF EXISTS {} WITH (FORCE)", self.name);
        // Runtime própria numa thread: o `Drop` pode rodar dentro da runtime do teste,
        // que não aceita outro `block_on`.
        let outcome = std::thread::spawn(move || {
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .map_err(|error| error.to_string())?;
            runtime.block_on(async move {
                let mut conn = PgConnection::connect_with(&options)
                    .await
                    .map_err(|error| error.to_string())?;
                sqlx::raw_sql(&sql)
                    .execute(&mut conn)
                    .await
                    .map_err(|error| error.to_string())?;
                Ok::<(), String>(())
            })
        })
        .join();
        match outcome {
            Ok(Ok(())) => {}
            Ok(Err(error)) => eprintln!("falha ao apagar o banco de teste {}: {error}", self.name),
            Err(_) => eprintln!("falha ao apagar o banco de teste {}", self.name),
        }
    }
}

/// Banco novo e vazio, com um pool conectado como `atria_app`.
pub async fn test_pool() -> TestDatabase {
    let server = server().await;
    let name = format!("{DATABASE_PREFIX}{}", Uuid::now_v7().simple());
    let mut conn = superuser_connection(server).await;
    sqlx::raw_sql(&format!("CREATE DATABASE {name} OWNER {APP_ROLE}"))
        .execute(&mut conn)
        .await
        .expect("criar o banco de teste");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect_with(options(server, APP_ROLE, APP_PASSWORD, &name))
        .await
        .expect("pool do banco de teste");
    TestDatabase { pool, name }
}

/// Apaga os bancos de teste mais antigos que `STALE_AFTER`, pelo instante do UUID v7
/// do nome. Sem `FORCE`: um banco ainda em uso fica para a próxima varredura.
async fn sweep_stale_databases(conn: &mut PgConnection) {
    let names: Vec<String> =
        match sqlx::query_scalar("SELECT datname FROM pg_database WHERE datname LIKE 'test\\_%'")
            .fetch_all(&mut *conn)
            .await
        {
            Ok(names) => names,
            Err(error) => {
                eprintln!("falha ao listar os bancos de teste: {error}");
                return;
            }
        };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    for name in names {
        let Some(created) = database_created_at(&name) else {
            continue;
        };
        if now.saturating_sub(created) < STALE_AFTER {
            continue;
        }
        // Erro esperado quando o banco ainda está em uso: fica para a próxima vez.
        let _ = sqlx::raw_sql(&format!("DROP DATABASE IF EXISTS {name}"))
            .execute(&mut *conn)
            .await;
    }
}

/// Instante (desde a época Unix) do UUID v7 no nome `test_<uuid>`.
fn database_created_at(name: &str) -> Option<Duration> {
    let uuid = Uuid::try_parse(name.strip_prefix(DATABASE_PREFIX)?).ok()?;
    let (seconds, nanos) = uuid.get_timestamp()?.to_unix();
    Some(Duration::new(seconds, nanos))
}

/// Pool de superusuário no banco `postgres`, para tarefas de preparação.
pub async fn admin_pool() -> PgPool {
    let server = server().await;
    PgPoolOptions::new()
        .max_connections(2)
        .connect_with(options(server, SUPERUSER, SUPERUSER, "postgres"))
        .await
        .expect("pool de superusuário")
}

/// Pool que aponta para um servidor sem banco, para testar a indisponibilidade.
pub fn unreachable_pool() -> PgPool {
    let options = PgConnectOptions::new()
        .host("127.0.0.1")
        .port(1)
        .username(APP_ROLE)
        .password(APP_PASSWORD)
        .database("atria");
    PgPoolOptions::new()
        .acquire_timeout(std::time::Duration::from_millis(500))
        .connect_lazy_with(options)
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::{NoContext, Timestamp};

    async fn database_exists(name: &str) -> bool {
        let admin = admin_pool().await;
        sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)",
        )
        .bind(name)
        .fetch_one(&admin)
        .await
        .expect("consulta ao pg_database")
    }

    fn database_name_at(seconds_ago: u64) -> String {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
        let instant = now - Duration::from_secs(seconds_ago);
        let uuid = Uuid::new_v7(Timestamp::from_unix(
            NoContext,
            instant.as_secs(),
            instant.subsec_nanos(),
        ));
        format!("{DATABASE_PREFIX}{}", uuid.simple())
    }

    #[tokio::test]
    async fn test_database_is_dropped_when_guard_drops() {
        let database = test_pool().await;
        let name = database.name().to_owned();
        sqlx::query("SELECT 1")
            .execute(database.pool())
            .await
            .unwrap();
        assert!(database_exists(&name).await);

        drop(database);

        assert!(
            !database_exists(&name).await,
            "o banco {name} continua no servidor"
        );
    }

    #[tokio::test]
    async fn stale_test_databases_are_swept() {
        let server = server().await;
        let stale = database_name_at(60 * 60);
        let fresh = database_name_at(0);
        let mut conn = superuser_connection(server).await;
        for name in [&stale, &fresh] {
            sqlx::raw_sql(&format!("CREATE DATABASE {name}"))
                .execute(&mut conn)
                .await
                .unwrap();
        }

        sweep_stale_databases(&mut conn).await;

        let stale_exists = database_exists(&stale).await;
        let fresh_exists = database_exists(&fresh).await;
        sqlx::raw_sql(&format!("DROP DATABASE IF EXISTS {fresh}"))
            .execute(&mut conn)
            .await
            .unwrap();
        assert!(!stale_exists, "o banco antigo devia ter sido varrido");
        assert!(fresh_exists, "o banco recente não pode ser varrido");
    }
}
