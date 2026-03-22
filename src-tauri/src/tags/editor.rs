use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::PictureType;
use lofty::tag::Accessor;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumArt {
    pub data: String,
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagInfo {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub disc_number: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagUpdate {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub disc_number: Option<u32>,
}

pub fn get_album_art(path: &str) -> Result<Option<AlbumArt>, String> {
    let tagged = lofty::read_from_path(path).map_err(|e| e.to_string())?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    if let Some(tag) = tag {
        let picture = tag
            .pictures()
            .iter()
            .find(|p| p.pic_type() == PictureType::CoverFront)
            .or_else(|| tag.pictures().first());

        if let Some(pic) = picture {
            use base64::Engine;
            let data = base64::engine::general_purpose::STANDARD.encode(pic.data());
            let mime_type = pic
                .mime_type()
                .map(|m| m.to_string())
                .unwrap_or_else(|| "image/jpeg".to_string());
            return Ok(Some(AlbumArt { data, mime_type }));
        }
    }

    Ok(None)
}

pub fn read_tags(path: &str) -> Result<TagInfo, String> {
    let tagged = lofty::read_from_path(path).map_err(|e| e.to_string())?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    if let Some(tag) = tag {
        Ok(TagInfo {
            title: tag.title().map(|s| s.to_string()),
            artist: tag.artist().map(|s| s.to_string()),
            album: tag.album().map(|s| s.to_string()),
            album_artist: tag
                .get_string(&lofty::tag::ItemKey::AlbumArtist)
                .map(|s| s.to_string()),
            genre: tag.genre().map(|s| s.to_string()),
            year: tag.year(),
            track_number: tag.track(),
            disc_number: tag.disk(),
        })
    } else {
        Ok(TagInfo {
            title: None,
            artist: None,
            album: None,
            album_artist: None,
            genre: None,
            year: None,
            track_number: None,
            disc_number: None,
        })
    }
}

pub fn write_tags(path: &str, update: &TagUpdate) -> Result<(), String> {
    let mut tagged = lofty::read_from_path(path).map_err(|e| e.to_string())?;

    let tag = match tagged.primary_tag_mut() {
        Some(t) => t,
        None => {
            let tag_type = tagged
                .primary_tag()
                .map(|t| t.tag_type())
                .unwrap_or(lofty::tag::TagType::Id3v2);
            tagged.insert_tag(lofty::tag::Tag::new(tag_type));
            tagged.primary_tag_mut().unwrap()
        }
    };

    // Set or clear each field
    match &update.title {
        Some(v) if !v.is_empty() => tag.set_title(v.clone()),
        _ => tag.remove_title(),
    }
    match &update.artist {
        Some(v) if !v.is_empty() => tag.set_artist(v.clone()),
        _ => tag.remove_artist(),
    }
    match &update.album {
        Some(v) if !v.is_empty() => tag.set_album(v.clone()),
        _ => tag.remove_album(),
    }
    match &update.genre {
        Some(v) if !v.is_empty() => tag.set_genre(v.clone()),
        _ => tag.remove_genre(),
    }
    if let Some(y) = update.year {
        tag.set_year(y);
    }
    if let Some(t) = update.track_number {
        tag.set_track(t);
    }
    if let Some(d) = update.disc_number {
        tag.set_disk(d);
    }
    if let Some(ref aa) = update.album_artist {
        if !aa.is_empty() {
            tag.insert_text(lofty::tag::ItemKey::AlbumArtist, aa.clone());
        } else {
            tag.remove_key(&lofty::tag::ItemKey::AlbumArtist);
        }
    }

    use lofty::config::WriteOptions;
    tagged
        .save_to_path(path, WriteOptions::default())
        .map_err(|e| format!("Failed to save tags: {}", e))?;

    Ok(())
}
