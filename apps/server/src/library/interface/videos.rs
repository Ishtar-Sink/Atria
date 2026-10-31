//! Handlers de `/videos`: cadastro com miniatura por oEmbed, envio manual e notas.

use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::{Extension, Json};

use super::dto::{
    CreateItemNoteRequest, CreateVideoRequest, ItemNoteList, ItemNoteResponse,
    UpdateItemNoteRequest, UpdateVideoRequest, VideoListQuery, VideoPage, VideoResponse,
};
use super::{
    Upload, ValidJson, ValidQuery, child_extractor, create_note_of, delete_note_of, id_extractor,
    list_notes_of, list_query, update_note_of, video_service,
};
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::library::application::ListQuery;
use crate::library::application::ports::{EntityDeletedHook, ThumbnailFetcher};
use crate::library::application::videos::CreateVideo;
use crate::library::domain::ItemRef;
use crate::library::domain::video::VideoChanges;
use crate::shared::error::{ApiError, ProblemDetails};

/// Tipo de entidade passado ao gancho de exclusão (CB-06).
pub const ENTITY_TYPE: &str = "video";

id_extractor!(VideoId, "video_not_found");
child_extractor!(VideoChild, "video_not_found");

#[utoipa::path(
    get, path = "/api/v1/videos", tag = "library", params(VideoListQuery),
    responses(
        (status = 200, body = VideoPage),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn list_videos(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidQuery(query): ValidQuery<VideoListQuery>,
) -> Result<Json<VideoPage>, ApiError> {
    let watch_status = query.watch_status;
    let query = list_query(
        query.cursor.as_deref(),
        query.limit,
        query.q,
        query.tag,
        query.visibility,
        None,
    )?;
    let query = ListQuery {
        video_status: watch_status,
        ..query
    };
    let page = video_service(&state, None)
        .list(user.user_id, query)
        .await?;
    Ok(Json(VideoPage {
        items: page.items.into_iter().map(VideoResponse::from).collect(),
        next_cursor: page.next_cursor.map(|cursor| cursor.encode()),
    }))
}

#[utoipa::path(
    post, path = "/api/v1/videos", tag = "library", request_body = CreateVideoRequest,
    responses(
        (status = 201, body = VideoResponse),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_video(
    State(state): State<AppState>,
    user: CurrentUser,
    fetcher: Option<Extension<Arc<dyn ThumbnailFetcher>>>,
    ValidJson(body): ValidJson<CreateVideoRequest>,
) -> Result<(StatusCode, Json<VideoResponse>), ApiError> {
    let input = CreateVideo {
        visibility: body.visibility.unwrap_or_default(),
        url: body.url,
        title: body.title,
        channel: body.channel,
        watch_status: body.watch_status.unwrap_or_default(),
        tags: body.tags.unwrap_or_default(),
    };
    let fetcher = fetcher.map(|Extension(fetcher)| fetcher);
    let video = video_service(&state, fetcher)
        .create(user.user_id, input)
        .await?;
    Ok((StatusCode::CREATED, Json(video.into())))
}

#[utoipa::path(
    get, path = "/api/v1/videos/{id}", tag = "library",
    params(("id" = Uuid, Path, description = "Id do vídeo")),
    responses(
        (status = 200, body = VideoResponse),
        (status = 404, body = ProblemDetails, description = "video_not_found"),
    )
)]
pub async fn get_video(
    State(state): State<AppState>,
    user: CurrentUser,
    VideoId(id): VideoId,
) -> Result<Json<VideoResponse>, ApiError> {
    let video = video_service(&state, None).get(user.user_id, id).await?;
    Ok(Json(video.into()))
}

#[utoipa::path(
    patch, path = "/api/v1/videos/{id}", tag = "library", request_body = UpdateVideoRequest,
    params(("id" = Uuid, Path, description = "Id do vídeo")),
    responses(
        (status = 200, body = VideoResponse),
        (status = 404, body = ProblemDetails, description = "video_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_video(
    State(state): State<AppState>,
    user: CurrentUser,
    VideoId(id): VideoId,
    ValidJson(body): ValidJson<UpdateVideoRequest>,
) -> Result<Json<VideoResponse>, ApiError> {
    let changes = VideoChanges {
        url: body.url,
        title: body.title,
        channel: body.channel,
        watch_status: body.watch_status,
        tags: body.tags,
        visibility: body.visibility,
    };
    let video = video_service(&state, None)
        .update(user.user_id, id, changes)
        .await?;
    Ok(Json(video.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/videos/{id}", tag = "library",
    params(("id" = Uuid, Path, description = "Id do vídeo")),
    responses(
        (status = 204, description = "Vídeo excluído"),
        (status = 404, body = ProblemDetails, description = "video_not_found"),
    )
)]
pub async fn delete_video(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    VideoId(id): VideoId,
) -> Result<StatusCode, ApiError> {
    video_service(&state, None).delete(user.user_id, id).await?;
    // Depois do commit: a exclusão do vídeo não depende das ligações (CB-06).
    if let Some(Extension(hook)) = hook {
        hook(user.user_id, ENTITY_TYPE, id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    put, path = "/api/v1/videos/{id}/thumbnail", tag = "library",
    params(("id" = Uuid, Path, description = "Id do vídeo")),
    request_body(content = Vec<u8>, content_type = "application/octet-stream", description = "Imagem PNG, JPEG ou WebP de até 5 MiB"),
    responses(
        (status = 200, body = VideoResponse),
        (status = 404, body = ProblemDetails, description = "video_not_found"),
        (status = 413, body = ProblemDetails, description = "file_too_large"),
        (status = 415, body = ProblemDetails, description = "unsupported_file_type"),
    )
)]
pub async fn put_video_thumbnail(
    State(state): State<AppState>,
    user: CurrentUser,
    VideoId(id): VideoId,
    Upload(bytes): Upload,
) -> Result<Json<VideoResponse>, ApiError> {
    let video = video_service(&state, None)
        .set_thumbnail(user.user_id, id, bytes)
        .await?;
    Ok(Json(video.into()))
}

#[utoipa::path(
    get, path = "/api/v1/videos/{id}/video-notes", tag = "library",
    params(("id" = Uuid, Path, description = "Id do vídeo")),
    responses(
        (status = 200, body = ItemNoteList),
        (status = 404, body = ProblemDetails, description = "video_not_found"),
    )
)]
pub async fn list_video_notes(
    State(state): State<AppState>,
    user: CurrentUser,
    VideoId(id): VideoId,
) -> Result<Json<ItemNoteList>, ApiError> {
    list_notes_of(&state, user.user_id, ItemRef::Video(id)).await
}

#[utoipa::path(
    post, path = "/api/v1/videos/{id}/video-notes", tag = "library",
    request_body = CreateItemNoteRequest,
    params(("id" = Uuid, Path, description = "Id do vídeo")),
    responses(
        (status = 201, body = ItemNoteResponse),
        (status = 404, body = ProblemDetails, description = "video_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_video_note(
    State(state): State<AppState>,
    user: CurrentUser,
    VideoId(id): VideoId,
    ValidJson(body): ValidJson<CreateItemNoteRequest>,
) -> Result<(StatusCode, Json<ItemNoteResponse>), ApiError> {
    create_note_of(&state, user.user_id, ItemRef::Video(id), body).await
}

#[utoipa::path(
    patch, path = "/api/v1/videos/{id}/video-notes/{note_id}", tag = "library",
    request_body = UpdateItemNoteRequest,
    params(
        ("id" = Uuid, Path, description = "Id do vídeo"),
        ("note_id" = Uuid, Path, description = "Id da nota"),
    ),
    responses(
        (status = 200, body = ItemNoteResponse),
        (status = 404, body = ProblemDetails, description = "video_not_found ou item_note_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_video_note(
    State(state): State<AppState>,
    user: CurrentUser,
    VideoChild(id, note_id): VideoChild,
    ValidJson(body): ValidJson<UpdateItemNoteRequest>,
) -> Result<Json<ItemNoteResponse>, ApiError> {
    update_note_of(&state, user.user_id, ItemRef::Video(id), note_id, body).await
}

#[utoipa::path(
    delete, path = "/api/v1/videos/{id}/video-notes/{note_id}", tag = "library",
    params(
        ("id" = Uuid, Path, description = "Id do vídeo"),
        ("note_id" = Uuid, Path, description = "Id da nota"),
    ),
    responses(
        (status = 204, description = "Nota excluída"),
        (status = 404, body = ProblemDetails, description = "video_not_found ou item_note_not_found"),
    )
)]
pub async fn delete_video_note(
    State(state): State<AppState>,
    user: CurrentUser,
    VideoChild(id, note_id): VideoChild,
) -> Result<StatusCode, ApiError> {
    delete_note_of(&state, user.user_id, ItemRef::Video(id), note_id).await
}
