//! Arquivos do Acervo: tipo detectado pelo conteúdo e limites de tamanho
//! ([project/security-10]). O `Content-Type` enviado pelo cliente nunca é usado.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::error::LibraryError;

pub const PDF_MAX_BYTES: usize = 50 * 1024 * 1024;
pub const IMAGE_MAX_BYTES: usize = 5 * 1024 * 1024;
/// Miniatura buscada por oEmbed.
pub const THUMBNAIL_MAX_BYTES: usize = 2 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileKind {
    Pdf,
    Image,
}

impl FileKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pdf => "pdf",
            Self::Image => "image",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "pdf" => Some(Self::Pdf),
            "image" => Some(Self::Image),
            _ => None,
        }
    }

    pub fn max_bytes(self) -> usize {
        match self {
            Self::Pdf => PDF_MAX_BYTES,
            Self::Image => IMAGE_MAX_BYTES,
        }
    }
}

/// Tipo reconhecido pela assinatura do conteúdo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DetectedFile {
    pub kind: FileKind,
    pub content_type: &'static str,
    pub extension: &'static str,
}

const PDF: DetectedFile = DetectedFile {
    kind: FileKind::Pdf,
    content_type: "application/pdf",
    extension: "pdf",
};
const PNG: DetectedFile = DetectedFile {
    kind: FileKind::Image,
    content_type: "image/png",
    extension: "png",
};
const JPEG: DetectedFile = DetectedFile {
    kind: FileKind::Image,
    content_type: "image/jpeg",
    extension: "jpg",
};
const WEBP: DetectedFile = DetectedFile {
    kind: FileKind::Image,
    content_type: "image/webp",
    extension: "webp",
};

/// Reconhece PDF (`%PDF-`), PNG, JPEG (`FF D8 FF`) e WebP (`RIFF....WEBP`).
pub fn detect(bytes: &[u8]) -> Option<DetectedFile> {
    if bytes.starts_with(b"%PDF-") {
        return Some(PDF);
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some(PNG);
    }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some(JPEG);
    }
    if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some(WEBP);
    }
    None
}

/// Confere o conteúdo contra o tipo esperado pela rota e o tamanho do tipo.
pub fn validate_upload(bytes: &[u8], expected: FileKind) -> Result<DetectedFile, LibraryError> {
    if bytes.len() > expected.max_bytes() {
        return Err(LibraryError::FileTooLarge);
    }
    match detect(bytes) {
        Some(found) if found.kind == expected => Ok(found),
        _ => Err(LibraryError::UnsupportedFileType),
    }
}

/// Metadados do arquivo; o conteúdo fica no storage, sob `storage_key`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryFile {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub kind: FileKind,
    pub content_type: String,
    pub size_bytes: i64,
    pub sha256: String,
    pub storage_key: String,
    pub created_at: DateTime<Utc>,
}

impl LibraryFile {
    /// Chave gerada pelo servidor, nunca vinda do cliente.
    pub fn storage_key_for(owner_id: Uuid, id: Uuid) -> String {
        format!("library/{owner_id}/{id}")
    }

    /// Nome do arquivo na resposta, gerado pelo servidor (`<id>.pdf`).
    pub fn download_name(&self) -> String {
        let extension = match self.content_type.as_str() {
            "application/pdf" => "pdf",
            "image/png" => "png",
            "image/jpeg" => "jpg",
            "image/webp" => "webp",
            _ => "bin",
        };
        format!("{}.{extension}", self.id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png() -> Vec<u8> {
        vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0]
    }

    #[test]
    fn pdf_is_detected_by_magic_bytes() {
        let found = detect(b"%PDF-1.7\n...").unwrap();

        assert_eq!(found.kind, FileKind::Pdf);
        assert_eq!(found.content_type, "application/pdf");
        assert!(validate_upload(b"%PDF-1.4", FileKind::Pdf).is_ok());
    }

    #[test]
    fn non_pdf_is_rejected_even_with_pdf_content_type() {
        // O tipo declarado pelo cliente não entra na conta: só o conteúdo.
        assert!(matches!(
            validate_upload(b"<html>fake.pdf</html>", FileKind::Pdf),
            Err(LibraryError::UnsupportedFileType)
        ));
        assert!(matches!(
            validate_upload(&png(), FileKind::Pdf),
            Err(LibraryError::UnsupportedFileType)
        ));
        assert!(matches!(
            validate_upload(b"%PDF-1.4", FileKind::Image),
            Err(LibraryError::UnsupportedFileType)
        ));
        assert!(matches!(
            validate_upload(b"", FileKind::Pdf),
            Err(LibraryError::UnsupportedFileType)
        ));
    }

    #[test]
    fn png_jpeg_and_webp_are_detected_by_magic_bytes() {
        let mut webp = b"RIFF\x24\0\0\0WEBPVP8 ".to_vec();
        webp.extend_from_slice(&[0; 8]);

        assert_eq!(detect(&png()).unwrap().content_type, "image/png");
        assert_eq!(
            detect(&[0xFF, 0xD8, 0xFF, 0xE0, 0, 0])
                .unwrap()
                .content_type,
            "image/jpeg"
        );
        assert_eq!(detect(&webp).unwrap().content_type, "image/webp");
        assert!(detect(b"RIFF\0\0\0\0WAVEfmt ").is_none());
        assert!(detect(b"GIF89a").is_none());
    }

    #[test]
    fn pdf_over_50_mib_is_rejected() {
        let mut ok = b"%PDF-".to_vec();
        ok.resize(PDF_MAX_BYTES, 0);
        let mut big = ok.clone();
        big.push(0);

        assert!(validate_upload(&ok, FileKind::Pdf).is_ok());
        assert!(matches!(
            validate_upload(&big, FileKind::Pdf),
            Err(LibraryError::FileTooLarge)
        ));
    }

    #[test]
    fn image_over_5_mib_is_rejected() {
        let mut ok = png();
        ok.resize(IMAGE_MAX_BYTES, 0);
        let mut big = ok.clone();
        big.push(0);

        assert!(validate_upload(&ok, FileKind::Image).is_ok());
        assert!(matches!(
            validate_upload(&big, FileKind::Image),
            Err(LibraryError::FileTooLarge)
        ));
    }

    #[test]
    fn download_name_is_generated_from_id_and_type() {
        let file = LibraryFile {
            id: Uuid::from_u128(7),
            owner_id: Uuid::from_u128(1),
            kind: FileKind::Pdf,
            content_type: "application/pdf".to_owned(),
            size_bytes: 8,
            sha256: String::new(),
            storage_key: String::new(),
            created_at: "2026-11-01T12:00:00Z".parse().unwrap(),
        };

        assert_eq!(file.download_name(), format!("{}.pdf", Uuid::from_u128(7)));
        assert!(
            LibraryFile::storage_key_for(Uuid::from_u128(1), Uuid::from_u128(7))
                .starts_with("library/")
        );
    }
}
