//! Relatório em HTML autocontido, renderizado com `maud`: um único `<style>` com as
//! fontes em `data:` e as cores do tema claro, sem script nem recurso externo. A CSP
//! da resposta libera esse `<style>` pelo hash (`html_csp()`), e o formulário `GET`
//! troca o período e os filtros sem JavaScript.

use std::sync::OnceLock;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use maud::{DOCTYPE, Markup, PreEscaped, html};
use sha2::{Digest, Sha256};

use super::palette::TOKENS;
use crate::reports::domain::{
    GoalStatus, LibraryItemType, Report, ReportDocument, ReportFilter, ReportFilters,
};

pub const INTER_REGULAR: &[u8] = include_bytes!("../assets/fonts/inter-regular.ttf");
pub const INTER_SEMIBOLD: &[u8] = include_bytes!("../assets/fonts/inter-semibold.ttf");
pub const OUTFIT_SEMIBOLD: &[u8] = include_bytes!("../assets/fonts/outfit-semibold.ttf");

fn font_face(family: &str, weight: u16, bytes: &[u8]) -> String {
    format!(
        "@font-face{{font-family:'{family}';font-weight:{weight};font-style:normal;font-display:swap;\
         src:url(data:font/ttf;base64,{}) format('truetype');}}\n",
        STANDARD.encode(bytes)
    )
}

const STYLE_RULES: &str = r#"
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;font-size:16px;line-height:1.5}
.page{max-width:60rem;margin:0 auto;padding:1.5rem 1rem 3rem}
.brand{font-family:'Outfit','Inter',sans-serif;font-weight:600;font-size:1.25rem;color:var(--primary);margin:0}
h1,h2{font-family:'Outfit','Inter',sans-serif;font-weight:600;margin:0}
h1{font-size:1.75rem;line-height:1.2;margin-top:.25rem}
h2{font-size:1.125rem}
.sub{color:var(--text-muted);margin:.25rem 0 0}
.meta{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;margin:1rem 0 0;padding:0;list-style:none;color:var(--text-muted);font-size:.9375rem}
.meta strong{color:var(--text);font-weight:600}
form.filters{display:flex;flex-wrap:wrap;gap:.75rem 1rem;align-items:end;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;margin:1.25rem 0}
.field{display:flex;flex-direction:column;gap:.25rem;min-width:11rem;flex:1 1 11rem}
.field label{font-size:.875rem;font-weight:600;color:var(--text-muted)}
.field input,.field select{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--border-strong);border-radius:8px;padding:.5rem .625rem;min-height:2.5rem}
.field input:focus-visible,.field select:focus-visible,button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.actions{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
button,.button{font:inherit;font-weight:600;border-radius:8px;border:1px solid var(--primary);padding:.5rem 1rem;min-height:2.5rem;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
button{background:var(--primary);color:var(--primary-on)}
.button{background:var(--surface);color:var(--primary)}
details{background:var(--surface);border:1px solid var(--border);border-radius:12px;margin:1rem 0;padding:0}
summary{cursor:pointer;padding:.875rem 1rem;list-style-position:inside}
summary h2{display:inline}
.body{padding:0 1rem 1rem}
dl.stats{display:flex;flex-wrap:wrap;gap:1rem 2rem;margin:0 0 1rem}
dl.stats div{min-width:9rem}
dl.stats dt{color:var(--text-muted);font-size:.875rem}
dl.stats dd{margin:0;font-family:'Outfit','Inter',sans-serif;font-weight:600;font-size:1.5rem}
ul.bars{list-style:none;margin:0 0 1rem;padding:0;display:grid;gap:.5rem}
ul.bars li{display:grid;grid-template-columns:minmax(6rem,12rem) 1fr auto;gap:.75rem;align-items:center}
ul.bars .label{overflow-wrap:anywhere}
ul.bars .value{font-variant-numeric:tabular-nums;color:var(--text-muted);text-align:right}
progress{width:100%;height:.75rem;appearance:none;-webkit-appearance:none;border:0;border-radius:999px;background:var(--surface-muted);overflow:hidden}
progress::-webkit-progress-bar{background:var(--surface-muted);border-radius:999px}
progress::-webkit-progress-value{background:var(--primary);border-radius:999px}
progress::-moz-progress-bar{background:var(--primary);border-radius:999px}
progress.tone-accent::-webkit-progress-value{background:var(--accent-fill)}
progress.tone-accent::-moz-progress-bar{background:var(--accent-fill)}
progress.tone-success::-webkit-progress-value{background:var(--success)}
progress.tone-success::-moz-progress-bar{background:var(--success)}
progress.tone-warning::-webkit-progress-value{background:var(--warning)}
progress.tone-warning::-moz-progress-bar{background:var(--warning)}
progress.tone-info::-webkit-progress-value{background:var(--info)}
progress.tone-info::-moz-progress-bar{background:var(--info)}
.table-wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
caption{text-align:left;font-weight:600;padding:.25rem 0 .5rem}
th,td{text-align:left;padding:.5rem .625rem;border-bottom:1px solid var(--border)}
thead th{background:var(--surface-muted);font-weight:600}
tbody th{font-weight:400}
.empty{color:var(--text-muted);margin:0}
.note{color:var(--text-muted);font-size:.9375rem}
footer{color:var(--text-muted);font-size:.875rem;margin-top:2rem}
@media (max-width:40rem){ul.bars li{grid-template-columns:1fr auto}ul.bars progress{grid-column:1 / -1;grid-row:2}}
@media print{body{background:#fff}form.filters,.actions{display:none}details{break-inside:avoid}}
"#;

fn build_style() -> String {
    let mut css = String::new();
    css.push_str(&font_face("Inter", 400, INTER_REGULAR));
    css.push_str(&font_face("Inter", 600, INTER_SEMIBOLD));
    css.push_str(&font_face("Outfit", 600, OUTFIT_SEMIBOLD));
    css.push_str(":root{");
    for (name, color) in TOKENS {
        css.push_str(&format!("--{name}:{color};"));
    }
    css.push_str("}\n");
    css.push_str(STYLE_RULES);
    css
}

/// Conteúdo do único `<style>` do documento.
pub fn html_style() -> &'static str {
    static STYLE: OnceLock<String> = OnceLock::new();
    STYLE.get_or_init(build_style)
}

/// CSP da resposta: só o `<style>` do documento, pelo hash, e nada de script.
pub fn html_csp() -> String {
    let digest = Sha256::digest(html_style().as_bytes());
    format!(
        "default-src 'none'; style-src 'sha256-{}'; img-src data:; font-src data:; \
         form-action 'self'; frame-ancestors 'none'",
        STANDARD.encode(digest)
    )
}

/// Parâmetros de consulta dos filtros presentes, para o link do PDF.
fn filter_query(filters: &ReportFilters) -> Vec<(&'static str, String)> {
    let mut params = Vec::new();
    if let Some(from) = filters.period.from {
        params.push(("from", from.to_string()));
    }
    if let Some(to) = filters.period.to {
        params.push(("to", to.to_string()));
    }
    let ids = [
        ("account_id", filters.account_id),
        ("category_id", filters.category_id),
        ("book_id", filters.book_id),
        ("emotion_id", filters.emotion_id),
        ("goal_id", filters.goal_id),
        ("project_id", filters.project_id),
    ];
    for (name, id) in ids {
        if let Some(id) = id {
            params.push((name, id.to_string()));
        }
    }
    if let Some(kind) = filters.item_type {
        params.push(("type", kind.as_str().to_owned()));
    }
    if let Some(status) = filters.goal_status {
        params.push(("goal_status", status.as_str().to_owned()));
    }
    params
}

/// Link relativo ao endereço do relatório; todos os valores são datas, UUIDs ou
/// chaves em minúsculas, sem caracteres que peçam escape.
fn pdf_href(filters: &ReportFilters) -> String {
    let mut href = String::from("?format=pdf");
    for (name, value) in filter_query(filters) {
        href.push('&');
        href.push_str(name);
        href.push('=');
        href.push_str(&value);
    }
    href
}

fn id_value(id: Option<uuid::Uuid>) -> String {
    id.map(|id| id.to_string()).unwrap_or_default()
}

fn field_markup(filter: ReportFilter, filters: &ReportFilters) -> Markup {
    let id_field = |name: &'static str, label: &'static str, value: String| {
        html! {
            div class="field" {
                label for=(name) { (label) " (id)" }
                input type="text" id=(name) name=(name) value=(value) autocomplete="off"
                    inputmode="text" spellcheck="false";
            }
        }
    };
    match filter {
        ReportFilter::Period => html! {
            div class="field" {
                label for="from" { "De" }
                input type="date" id="from" name="from"
                    value=(filters.period.from.map(|d| d.to_string()).unwrap_or_default());
            }
            div class="field" {
                label for="to" { "Até" }
                input type="date" id="to" name="to"
                    value=(filters.period.to.map(|d| d.to_string()).unwrap_or_default());
            }
        },
        ReportFilter::Account => id_field("account_id", "Conta", id_value(filters.account_id)),
        ReportFilter::Category => {
            id_field("category_id", "Categoria", id_value(filters.category_id))
        }
        ReportFilter::Book => id_field("book_id", "Livro", id_value(filters.book_id)),
        ReportFilter::Emotion => id_field("emotion_id", "Emoção", id_value(filters.emotion_id)),
        ReportFilter::Goal => id_field("goal_id", "Meta", id_value(filters.goal_id)),
        ReportFilter::Project => id_field("project_id", "Projeto", id_value(filters.project_id)),
        ReportFilter::Type => html! {
            div class="field" {
                label for="type" { "Tipo" }
                select id="type" name="type" {
                    option value="" selected[filters.item_type.is_none()] { "Todos os tipos" }
                    @for kind in LibraryItemType::ALL {
                        option value=(kind.as_str()) selected[filters.item_type == Some(kind)] {
                            (kind.label())
                        }
                    }
                }
            }
        },
        ReportFilter::GoalStatus => html! {
            div class="field" {
                label for="goal_status" { "Status" }
                select id="goal_status" name="goal_status" {
                    option value="" selected[filters.goal_status.is_none()] { "Todos os status" }
                    @for status in GoalStatus::ALL {
                        option value=(status.as_str()) selected[filters.goal_status == Some(status)] {
                            (status.label())
                        }
                    }
                }
            }
        },
    }
}

fn section_markup(section: &crate::reports::domain::DocSection) -> Markup {
    html! {
        details open {
            summary { h2 { (section.title) } }
            div class="body" {
                @if section.is_empty() {
                    p class="empty" { "Sem dados neste período." }
                }
                @if !section.stats.is_empty() {
                    dl class="stats" {
                        @for stat in &section.stats {
                            div { dt { (stat.label) } dd { (stat.value) } }
                        }
                    }
                }
                @if !section.bars.is_empty() {
                    ul class="bars" {
                        @for bar in &section.bars {
                            li {
                                span class="label" { (bar.label) }
                                progress class=(format!("tone-{}", bar.tone)) max="100"
                                    value=(format!("{:.1}", bar.fraction * 100.0))
                                    aria-label=(format!("{}: {}", bar.label, bar.value_text)) {}
                                span class="value" { (bar.value_text) }
                            }
                        }
                    }
                }
                @if let Some(table) = &section.table {
                    div class="table-wrap" {
                        table {
                            caption { (table.caption) }
                            thead { tr { @for column in &table.columns { th scope="col" { (column) } } } }
                            tbody {
                                @for row in &table.rows {
                                    tr {
                                        @for (index, cell) in row.iter().enumerate() {
                                            @if index == 0 { th scope="row" { (cell) } }
                                            @else { td { (cell) } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Documento HTML completo do relatório, com o formulário dos filtros atuais.
pub fn render_html(report: &Report, filters: &ReportFilters) -> String {
    render_document(&report.document(), report.kind().entry().filters, filters)
}

fn render_document(
    document: &ReportDocument,
    accepted: &[ReportFilter],
    filters: &ReportFilters,
) -> String {
    let markup = html! {
        (DOCTYPE)
        html lang="pt-BR" data-theme="light" {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                meta name="color-scheme" content="light";
                title { (document.title) " · Atria" }
                style { (PreEscaped(html_style())) }
            }
            body {
                main class="page" {
                    p class="brand" { "Atria" }
                    h1 { (document.title) }
                    p class="sub" { (document.module_label) " · " (document.description) }
                    ul class="meta" {
                        @if let Some(period) = &document.period {
                            li { strong { "Período: " } (period.label) }
                        } @else {
                            li { strong { "Estado em " } (document.generated_on) }
                        }
                        @for filter in &document.filters {
                            li { strong { (filter.label) ": " } (filter.value) }
                        }
                    }
                    form class="filters" method="get" {
                        input type="hidden" name="format" value="html";
                        @for filter in accepted { (field_markup(*filter, filters)) }
                        div class="actions" {
                            button type="submit" { "Gerar relatório" }
                            a class="button" href=(pdf_href(filters)) { "Baixar PDF" }
                        }
                    }
                    @for section in &document.sections { (section_markup(section)) }
                    @for note in &document.notes { p class="note" { (note) } }
                    footer { "Gerado em " (document.generated_on) " · cores e fontes do Atria" }
                }
            }
        }
    };
    markup.into_string()
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use uuid::Uuid;

    use super::*;
    use crate::reports::domain::{
        DiffTotals, FinCatReport, FinDiffReport, GoalsProgressReport, Period, StatusCount,
        TasksDoneReport,
    };

    fn date(text: &str) -> NaiveDate {
        text.parse().unwrap()
    }

    fn period() -> Period {
        Period {
            from: date("2026-10-01"),
            to: date("2026-11-01"),
        }
    }

    fn fin_cat(any_period: bool) -> Report {
        Report::FinCat(FinCatReport {
            report: "fin-cat",
            period: period(),
            any_period,
            generated_on: date("2026-11-01"),
            currency: "BRL".to_owned(),
            filters: Vec::new(),
            total_expense: 0,
            categories: Vec::new(),
        })
    }

    fn goals() -> Report {
        Report::GoalsProgress(GoalsProgressReport {
            report: "goals-progress",
            generated_on: date("2026-11-01"),
            filters: Vec::new(),
            goals: Vec::new(),
            by_status: GoalStatus::ALL
                .into_iter()
                .map(|status| StatusCount {
                    status,
                    label: status.label(),
                    count: 0,
                })
                .collect(),
        })
    }

    #[test]
    fn html_report_is_self_contained() {
        let reports = [
            fin_cat(false),
            goals(),
            Report::TasksDone(TasksDoneReport {
                report: "tasks-done",
                generated_on: date("2026-11-01"),
                filters: Vec::new(),
                completed: 1,
                open: 2,
                overdue: 1,
                recurring_notice: crate::reports::domain::RECURRING_NOTICE,
            }),
            Report::FinDiff(FinDiffReport {
                report: "fin-diff",
                period: period(),
                any_period: false,
                generated_on: date("2026-11-01"),
                currency: "BRL".to_owned(),
                filters: Vec::new(),
                totals: DiffTotals::default(),
                months: Vec::new(),
            }),
        ];

        for report in reports {
            let page = render_html(&report, &ReportFilters::default());

            assert!(page.starts_with("<!DOCTYPE html>"));
            assert!(page.contains("lang=\"pt-BR\""));
            assert!(!page.contains("<script"), "sem script");
            assert!(
                !page.contains("http://") && !page.contains("https://"),
                "sem URL externa"
            );
            assert!(!page.contains("style=\""), "sem estilo em linha");
            assert!(page.contains("data:font/ttf;base64,"));
            assert_eq!(page.matches("<style>").count(), 1);
            assert!(page.contains("<details open>"));
        }
    }

    #[test]
    fn html_report_has_period_and_filter_form() {
        let account = Uuid::from_u128(5);
        let filters = ReportFilters {
            account_id: Some(account),
            ..ReportFilters::default()
        };

        let open = render_html(&fin_cat(true), &filters);
        let state = render_html(&goals(), &ReportFilters::default());
        let with_values = render_html(
            &fin_cat(false),
            &ReportFilters {
                period: crate::reports::domain::PeriodRequest {
                    from: Some(date("2026-10-01")),
                    to: Some(date("2026-11-01")),
                },
                category_id: Some(Uuid::from_u128(6)),
                ..filters.clone()
            },
        );

        assert!(open.contains("<form class=\"filters\" method=\"get\">"));
        assert!(open.contains("name=\"from\"") && open.contains("name=\"to\""));
        assert!(open.contains("Qualquer período (01/10/2026 a 01/11/2026)"));
        assert!(open.contains("name=\"account_id\"") && open.contains("name=\"category_id\""));
        assert!(open.contains(&account.to_string()));
        assert!(
            open.contains("href=\"?format=pdf&amp;account_id=")
                || open.contains("href=\"?format=pdf&account_id=")
        );
        assert!(!open.contains("name=\"book_id\""));
        assert!(
            with_values.contains("value=\"2026-10-01\"")
                && with_values.contains("value=\"2026-11-01\"")
        );
        assert!(with_values.contains("from=2026-10-01"));
        assert!(
            !state.contains("name=\"from\""),
            "estado atual não tem período"
        );
        assert!(state.contains("Estado em </strong>01/11/2026"));
        assert!(state.contains("<select id=\"goal_status\" name=\"goal_status\">"));
        for value in ["planned", "in_progress", "completed", "abandoned"] {
            assert!(
                state.contains(&format!("<option value=\"{value}\"")),
                "{value}"
            );
        }
        for label in [
            "Todos os status",
            "Planejada",
            "Em andamento",
            "Concluída",
            "Abandonada",
        ] {
            assert!(state.contains(label), "{label}");
        }
        assert!(!state.contains("value=\"paused\""));
        let lib = render_html(
            &Report::LibStatus(crate::reports::domain::LibStatusReport {
                report: "lib-status",
                generated_on: date("2026-11-01"),
                filters: Vec::new(),
                groups: Vec::new(),
            }),
            &ReportFilters {
                item_type: Some(LibraryItemType::Video),
                ..ReportFilters::default()
            },
        );
        assert!(lib.contains("<select id=\"type\" name=\"type\">"));
        assert!(lib.contains("<option value=\"video\" selected>"));
    }

    #[test]
    fn html_style_hash_matches_csp() {
        let csp = html_csp();
        let page = render_html(&goals(), &ReportFilters::default());
        let style = page
            .split_once("<style>")
            .and_then(|(_, rest)| rest.split_once("</style>"))
            .map(|(body, _)| body)
            .unwrap();
        let expected = format!(
            "'sha256-{}'",
            STANDARD.encode(Sha256::digest(style.as_bytes()))
        );

        assert!(csp.contains(&expected), "{csp}");
        assert!(csp.starts_with("default-src 'none'; style-src 'sha256-"));
        assert!(
            csp.contains(
                "img-src data:; font-src data:; form-action 'self'; frame-ancestors 'none'"
            )
        );
        assert!(!csp.contains("script-src") && !csp.contains("unsafe-inline"));
    }
}
