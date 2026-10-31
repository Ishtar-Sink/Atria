//! Exportação dos dados do usuário: JSON único ou ZIP com um CSV por tabela
//! (`<contexto>-<tabela>.csv`, UTF-8 com BOM, vírgula e escape da RFC 4180).

use std::io::{Cursor, Write};

use serde_json::{Map, Value, json};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::reports::application::{ExportBundle, ExportTable};
use crate::reports::domain::ReportError;

const BOM: &str = "\u{feff}";

fn export_error(message: &str) -> ReportError {
    ReportError::Render(format!("exportação: {message}"))
}

/// `{ "exported_at", "owner_id", "contexts": { "<contexto>": { "<tabela>": [ ... ] } } }`.
pub fn export_json(bundle: &ExportBundle) -> Result<Vec<u8>, ReportError> {
    let mut contexts = Map::new();
    for context in &bundle.contexts {
        let mut tables = Map::new();
        for table in &context.tables {
            tables.insert(table.name.clone(), Value::Array(table_objects(table)));
        }
        contexts.insert(context.context.to_owned(), Value::Object(tables));
    }
    let document = json!({
        "exported_at": bundle.exported_at.to_rfc3339(),
        "owner_id": bundle.owner_id,
        "contexts": contexts,
    });
    serde_json::to_vec_pretty(&document).map_err(|_| export_error("JSON"))
}

fn table_objects(table: &ExportTable) -> Vec<Value> {
    table
        .rows
        .iter()
        .map(|row| {
            let object: Map<String, Value> = table
                .columns
                .iter()
                .cloned()
                .zip(row.iter().cloned())
                .collect();
            Value::Object(object)
        })
        .collect()
}

/// Campo CSV: entre aspas quando tem vírgula, aspas ou quebra de linha (RFC 4180).
pub fn csv_field(text: &str) -> String {
    if text.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", text.replace('"', "\"\""))
    } else {
        text.to_owned()
    }
}

/// Texto que uma planilha leria como fórmula ganha um apóstrofo na frente.
fn neutralize_formula(text: &str) -> String {
    if text.starts_with(['=', '+', '-', '@', '\t', '\r']) {
        format!("'{text}")
    } else {
        text.to_owned()
    }
}

fn csv_cell(value: &Value) -> String {
    let text = match value {
        Value::Null => String::new(),
        Value::String(text) => neutralize_formula(text),
        Value::Array(_) | Value::Object(_) => value.to_string(),
        other => other.to_string(),
    };
    csv_field(&text)
}

/// CSV de uma tabela, com BOM e linhas terminadas em CRLF.
pub fn table_csv(table: &ExportTable) -> String {
    let mut out = String::from(BOM);
    let header: Vec<String> = table.columns.iter().map(|c| csv_field(c)).collect();
    out.push_str(&header.join(","));
    out.push_str("\r\n");
    for row in &table.rows {
        let cells: Vec<String> = row.iter().map(csv_cell).collect();
        out.push_str(&cells.join(","));
        out.push_str("\r\n");
    }
    out
}

/// ZIP com um arquivo `<contexto>-<tabela>.csv` por tabela.
pub fn export_csv_zip(bundle: &ExportBundle) -> Result<Vec<u8>, ReportError> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    for context in &bundle.contexts {
        for table in &context.tables {
            let name = format!("{}-{}.csv", context.context, table.name);
            writer
                .start_file(name, options)
                .map_err(|_| export_error("ZIP"))?;
            writer
                .write_all(table_csv(table).as_bytes())
                .map_err(|_| export_error("ZIP"))?;
        }
    }
    let cursor = writer.finish().map_err(|_| export_error("ZIP"))?;
    Ok(cursor.into_inner())
}

#[cfg(test)]
mod tests {
    use std::io::Read;

    use uuid::Uuid;

    use super::*;
    use crate::reports::application::ExportContext;

    fn bundle() -> ExportBundle {
        let mut notes = ExportTable::new("notes", &["id", "title", "body"]);
        notes.rows.push(vec![
            json!("1"),
            json!("Com \"aspas\", vírgula"),
            json!("linha 1\nlinha 2"),
        ]);
        let mut goals = ExportTable::new("goals", &["id", "labels", "deadline"]);
        goals
            .rows
            .push(vec![json!("2"), json!(["casa", "obra"]), Value::Null]);
        let mut tasks = ExportTable::new("tasks", &["id"]);
        tasks.rows.push(vec![json!("3")]);
        ExportBundle {
            exported_at: "2026-11-01T12:00:00Z".parse().unwrap(),
            owner_id: Uuid::from_u128(7),
            contexts: vec![
                ExportContext {
                    context: "notes",
                    tables: vec![notes],
                },
                ExportContext {
                    context: "goals",
                    tables: vec![goals],
                },
                ExportContext {
                    context: "tasks",
                    tables: vec![tasks],
                },
            ],
        }
    }

    #[test]
    fn csv_escapes_quotes_commas_and_newlines() {
        let bundle = bundle();

        let notes = table_csv(&bundle.contexts[0].tables[0]);
        let goals = table_csv(&bundle.contexts[1].tables[0]);

        assert!(notes.starts_with("\u{feff}id,title,body\r\n"));
        assert!(notes.contains("1,\"Com \"\"aspas\"\", vírgula\",\"linha 1\nlinha 2\"\r\n"));
        // A lista de etiquetas sai como o texto JSON da lista, escapado pelo RFC 4180.
        assert!(goals.contains("2,\"[\"\"casa\"\",\"\"obra\"\"]\",\r\n"));
        assert_eq!(csv_field("simples"), "simples");
    }

    #[test]
    fn csv_neutralizes_spreadsheet_formulas_in_text_only() {
        let mut table = ExportTable::new("t", &["a", "b"]);
        table.rows.push(vec![json!("=1+1"), json!(-500)]);

        let csv = table_csv(&table);

        assert!(csv.contains("'=1+1,-500\r\n"));
    }

    #[test]
    fn csv_zip_has_one_file_per_table() {
        let bytes = export_csv_zip(&bundle()).unwrap();

        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut names: Vec<String> = archive
            .file_names()
            .filter_map(Result::ok)
            .map(std::borrow::Cow::into_owned)
            .collect();
        names.sort();

        assert_eq!(
            names,
            vec!["goals-goals.csv", "notes-notes.csv", "tasks-tasks.csv"]
        );
        let mut content = String::new();
        archive
            .by_name("tasks-tasks.csv")
            .unwrap()
            .read_to_string(&mut content)
            .unwrap();
        assert_eq!(content, "\u{feff}id\r\n3\r\n");
    }

    #[test]
    fn json_groups_tables_by_context() {
        let bytes = export_json(&bundle()).unwrap();

        let json: Value = serde_json::from_slice(&bytes).unwrap();

        assert_eq!(json["owner_id"], Uuid::from_u128(7).to_string());
        assert_eq!(json["exported_at"], "2026-11-01T12:00:00+00:00");
        assert_eq!(json["contexts"]["goals"]["goals"][0]["labels"][1], "obra");
        assert_eq!(
            json["contexts"]["notes"]["notes"][0]["title"],
            "Com \"aspas\", vírgula"
        );
    }
}
