//! Domínio de tarefas: sem axum, sem sqlx e sem HTTP ([project/architecture-03]).

pub mod error;
pub mod occurrence;
pub mod schedule;
pub mod task;

pub use error::TasksError;
pub use occurrence::CompletionLog;
pub use schedule::{Schedule, Segment};
pub use task::{CompletionTarget, Task};
