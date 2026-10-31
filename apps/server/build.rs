// Cada contexto nasce numa tarefa própria: o `main.rs` só compila o módulo
// quando a pasta dele já existe, para o crate compilar em qualquer ordem de entrega.
const CONTEXTS: [&str; 12] = [
    "auth",
    "finance",
    "goals",
    "tasks",
    "reminders",
    "notes",
    "journal",
    "library",
    "projects",
    "links",
    "search",
    "reports",
];

fn main() {
    let values = CONTEXTS
        .iter()
        .map(|name| format!("\"{name}\""))
        .collect::<Vec<_>>()
        .join(", ");
    println!("cargo::rustc-check-cfg=cfg(atria_context, values({values}))");
    for name in CONTEXTS {
        if std::path::Path::new("src")
            .join(name)
            .join("mod.rs")
            .exists()
        {
            println!("cargo::rustc-cfg=atria_context=\"{name}\"");
        }
    }
    println!("cargo::rerun-if-changed=src");
    println!("cargo::rerun-if-changed=build.rs");
}
