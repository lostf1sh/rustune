use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsLine {
    pub time_ms: i64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsResult {
    pub synced: Option<Vec<LyricsLine>>,
    pub plain: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LrcLibResponse {
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
}

/// Raw result before parsing, for caching purposes.
pub struct LrcLibRawResult {
    pub synced_lyrics_raw: Option<String>,
    pub plain_lyrics: Option<String>,
}

pub async fn fetch_lyrics_raw(
    title: &str,
    artist: &str,
    album: &str,
    duration_secs: f64,
) -> Result<LrcLibRawResult, String> {
    let client = reqwest::Client::new();
    let duration = duration_secs.round() as i64;

    let resp = client
        .get("https://lrclib.net/api/get")
        .query(&[
            ("track_name", title),
            ("artist_name", artist),
            ("album_name", album),
        ])
        .query(&[("duration", &duration.to_string())])
        .header("User-Agent", "Rustune/0.1.0")
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !resp.status().is_success() {
        return Ok(LrcLibRawResult {
            synced_lyrics_raw: None,
            plain_lyrics: None,
        });
    }

    let data: LrcLibResponse = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(LrcLibRawResult {
        synced_lyrics_raw: data.synced_lyrics,
        plain_lyrics: data.plain_lyrics,
    })
}

pub fn parse_lrc(lrc: &str) -> Vec<LyricsLine> {
    let mut lines = Vec::new();

    for line in lrc.lines() {
        let line = line.trim();
        if !line.starts_with('[') {
            continue;
        }

        // Parse [mm:ss.xx] or [mm:ss.xxx]
        if let Some(bracket_end) = line.find(']') {
            let timestamp = &line[1..bracket_end];
            let text = line[bracket_end + 1..].trim().to_string();

            if let Some(time_ms) = parse_timestamp(timestamp) {
                lines.push(LyricsLine { time_ms, text });
            }
        }
    }

    lines.sort_by_key(|l| l.time_ms);
    lines
}

fn parse_timestamp(ts: &str) -> Option<i64> {
    let parts: Vec<&str> = ts.split(':').collect();
    if parts.len() != 2 {
        return None;
    }

    let minutes: i64 = parts[0].parse().ok()?;
    let sec_parts: Vec<&str> = parts[1].split('.').collect();
    let seconds: i64 = sec_parts[0].parse().ok()?;
    let millis: i64 = if sec_parts.len() > 1 {
        let frac = sec_parts[1];
        match frac.len() {
            1 => frac.parse::<i64>().ok()? * 100,
            2 => frac.parse::<i64>().ok()? * 10,
            3 => frac.parse::<i64>().ok()?,
            _ => frac[..3].parse::<i64>().ok()?,
        }
    } else {
        0
    };

    Some(minutes * 60_000 + seconds * 1000 + millis)
}
