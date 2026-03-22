use lofty::file::TaggedFileExt;
use lofty::picture::PictureType;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumArt {
    pub data: String,
    pub mime_type: String,
}

pub fn get_album_art(path: &str) -> Result<Option<AlbumArt>, String> {
    let tagged = lofty::read_from_path(path).map_err(|e| e.to_string())?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    if let Some(tag) = tag {
        // Try front cover first, then any picture
        let picture = tag
            .pictures()
            .iter()
            .find(|p| p.pic_type() == PictureType::CoverFront)
            .or_else(|| tag.pictures().first());

        if let Some(pic) = picture {
            use base64::Engine;
            let data = base64::engine::general_purpose::STANDARD.encode(pic.data());
            let mime_type = pic.mime_type().map(|m| m.to_string()).unwrap_or_else(|| "image/jpeg".to_string());
            return Ok(Some(AlbumArt { data, mime_type }));
        }
    }

    Ok(None)
}
