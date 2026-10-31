//! PDF do relatório, gerado no próprio servidor com o Typst (sem serviço externo): um
//! `World` mínimo com a biblioteca padrão, as três fontes embutidas, o template
//! `report.typ` e o arquivo virtual `data.json`, montado do modelo do relatório.

use std::sync::OnceLock;

use chrono::{Datelike, NaiveDate};
use serde_json::{Value, json};
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Duration};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_pdf::PdfOptions;

use super::html::{INTER_REGULAR, INTER_SEMIBOLD, OUTFIT_SEMIBOLD};
use super::palette::TOKENS;
use crate::reports::domain::{ReportDocument, ReportError};

const TEMPLATE: &str = include_str!("../assets/report.typ");
const BRAND: &str = "Atria";

/// Conteúdo do `data.json` que o template lê: a marca, a paleta e o documento.
pub fn data_json(document: &ReportDocument) -> Value {
    let palette: serde_json::Map<String, Value> = TOKENS
        .iter()
        .map(|(name, color)| ((*name).to_owned(), Value::String((*color).to_owned())))
        .collect();
    json!({
        "brand": BRAND,
        "palette": palette,
        "report": document,
    })
}

fn render_error(message: impl Into<String>) -> ReportError {
    ReportError::Render(message.into())
}

fn fonts() -> &'static [Font] {
    static FONTS: OnceLock<Vec<Font>> = OnceLock::new();
    FONTS.get_or_init(|| {
        [INTER_REGULAR, INTER_SEMIBOLD, OUTFIT_SEMIBOLD]
            .into_iter()
            .flat_map(|bytes| Font::iter(Bytes::new(bytes)))
            .collect()
    })
}

fn library() -> &'static LazyHash<Library> {
    static LIBRARY: OnceLock<LazyHash<Library>> = OnceLock::new();
    LIBRARY.get_or_init(|| LazyHash::new(Library::default()))
}

fn project_file(name: &str) -> Result<FileId, ReportError> {
    let path = VirtualPath::new(name).map_err(|_| render_error("caminho virtual inválido"))?;
    Ok(RootedPath::new(VirtualRoot::Project, path).intern())
}

struct ReportWorld {
    book: LazyHash<FontBook>,
    main_id: FileId,
    data_id: FileId,
    source: Source,
    data: Bytes,
    today: NaiveDate,
}

impl ReportWorld {
    fn new(document: &ReportDocument, today: NaiveDate) -> Result<Self, ReportError> {
        let main_id = project_file("main.typ")?;
        let data_id = project_file("data.json")?;
        let json = serde_json::to_vec(&data_json(document))
            .map_err(|_| render_error("dados do relatório"))?;
        let book = FontBook::from_infos(fonts().iter().map(|font| font.info().clone()));
        Ok(Self {
            book: LazyHash::new(book),
            main_id,
            data_id,
            source: Source::new(main_id, TEMPLATE.to_owned()),
            data: Bytes::new(json),
            today,
        })
    }
}

impl World for ReportWorld {
    fn library(&self) -> &LazyHash<Library> {
        library()
    }

    fn book(&self) -> &LazyHash<FontBook> {
        &self.book
    }

    fn main(&self) -> FileId {
        self.main_id
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main_id {
            Ok(self.source.clone())
        } else {
            Err(FileError::NotFound(id.vpath().get_without_slash().into()))
        }
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        if id == self.data_id {
            Ok(self.data.clone())
        } else {
            Err(FileError::NotFound(id.vpath().get_without_slash().into()))
        }
    }

    fn font(&self, index: usize) -> Option<Font> {
        fonts().get(index).cloned()
    }

    fn today(&self, _offset: Option<Duration>) -> Option<Datetime> {
        let month = u8::try_from(self.today.month()).ok()?;
        let day = u8::try_from(self.today.day()).ok()?;
        Datetime::from_ymd(self.today.year(), month, day)
    }
}

/// Gera o PDF do documento. `today` vem do relógio injetável.
pub fn render_pdf(document: &ReportDocument, today: NaiveDate) -> Result<Vec<u8>, ReportError> {
    let world = ReportWorld::new(document, today)?;
    let compiled = typst::compile(&world).output.map_err(|errors| {
        let first = errors
            .first()
            .map(|error| error.message.to_string())
            .unwrap_or_default();
        render_error(format!("compilação do template: {first}"))
    })?;
    typst_pdf::pdf(&compiled, &PdfOptions::default()).map_err(|errors| {
        let first = errors
            .first()
            .map(|error| error.message.to_string())
            .unwrap_or_default();
        render_error(format!("exportação do PDF: {first}"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::reports::domain::sample_reports;

    fn today() -> NaiveDate {
        "2026-11-01".parse().unwrap()
    }

    fn contains(haystack: &[u8], needle: &str) -> bool {
        haystack
            .windows(needle.len())
            .any(|window| window == needle.as_bytes())
    }

    #[test]
    fn pdf_starts_with_pdf_header() {
        let reports = sample_reports();

        let pdf = render_pdf(&reports[0].document(), today()).unwrap();

        assert!(pdf.starts_with(b"%PDF-"));
        assert!(pdf.len() > 1_000);
    }

    #[test]
    fn pdf_embeds_identity_fonts() {
        let reports = sample_reports();

        let pdf = render_pdf(&reports[0].document(), today()).unwrap();

        assert!(contains(&pdf, "Outfit"), "faltou a fonte dos títulos");
        assert!(contains(&pdf, "Inter"), "faltou a fonte do texto");
    }

    #[test]
    fn pdf_renders_every_report_kind() {
        let reports = sample_reports();
        assert_eq!(reports.len(), 9);

        for report in reports {
            let pdf = render_pdf(&report.document(), today())
                .unwrap_or_else(|error| panic!("{:?}: {error}", report.kind()));

            assert!(pdf.starts_with(b"%PDF-"), "{:?}", report.kind());
        }
    }

    #[test]
    fn data_json_carries_palette_and_filters() {
        let reports = sample_reports();
        let document = reports[1].document();

        let data = data_json(&document);

        assert_eq!(data["brand"], "Atria");
        assert_eq!(data["palette"]["primary"], "#6d28d9");
        assert_eq!(data["report"]["id"], "fin-cat");
        assert_eq!(data["report"]["filters"][0]["value"], "Mercado");
    }
}
