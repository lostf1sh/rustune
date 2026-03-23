use std::collections::HashSet;

use crate::settings::AppSettings;

const PRESET_SEPARATORS: &[&str] = &[" featuring ", " feat. ", " feat ", " ft. ", " ft ", " x "];
const PRESET_EXTRA_SEPARATORS: &[&str] = &[" / ", ", ", "; ", ";"];

pub fn separators_for_settings(settings: &AppSettings) -> Vec<String> {
    let mut separators: Vec<String> = PRESET_SEPARATORS
        .iter()
        .map(|sep| (*sep).to_string())
        .collect();

    separators.extend(PRESET_EXTRA_SEPARATORS.iter().map(|sep| (*sep).to_string()));

    separators.extend(settings.custom_artist_separators.iter().cloned());

    let mut seen = HashSet::new();
    separators
        .into_iter()
        .filter(|sep| seen.insert(sep.to_lowercase()))
        .collect()
}

/// Parse a raw artist string into individual artist names.
/// Returns at least one entry (the original trimmed string if no separators found).
pub fn parse_artists(raw: &str, settings: &AppSettings) -> Vec<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    let mut parts: Vec<String> = vec![trimmed.to_string()];

    for sep in separators_for_settings(settings) {
        let mut new_parts = Vec::new();
        for part in &parts {
            split_by_separator(part, &sep, &mut new_parts);
        }
        parts = new_parts;
    }

    // Deduplicate while preserving order
    let mut seen = HashSet::new();
    parts
        .into_iter()
        .filter(|p| {
            let key = p.to_lowercase();
            seen.insert(key)
        })
        .collect()
}

/// Recursively split a string by a separator (case-insensitive), collecting all pieces.
fn split_by_separator(input: &str, sep: &str, out: &mut Vec<String>) {
    let lower = input.to_lowercase();
    let sep_lower = sep.to_lowercase();

    if let Some(pos) = lower.find(&sep_lower) {
        let left = input[..pos].trim();
        let right = input[pos + sep.len()..].trim();

        if !left.is_empty() {
            out.push(left.to_string());
        }
        // Right side may contain more of the same separator
        if !right.is_empty() {
            split_by_separator(right, sep, out);
        }
    } else {
        let trimmed = input.trim();
        if !trimmed.is_empty() {
            out.push(trimmed.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_artist() {
        assert_eq!(
            parse_artists("Pink Floyd", &AppSettings::default()),
            vec!["Pink Floyd"]
        );
    }

    #[test]
    fn test_feat() {
        let result = parse_artists("Drake feat. Rihanna", &AppSettings::default());
        assert_eq!(result, vec!["Drake", "Rihanna"]);
    }

    #[test]
    fn test_comma_multiple() {
        let result = parse_artists("Artist A, Artist B, Artist C", &AppSettings::default());
        assert_eq!(result, vec!["Artist A", "Artist B", "Artist C"]);
    }

    #[test]
    fn test_semicolon() {
        let result = parse_artists("Artist A; Artist B; Artist C", &AppSettings::default());
        assert_eq!(result, vec!["Artist A", "Artist B", "Artist C"]);
    }

    #[test]
    fn test_preset_preserves_ampersand() {
        let result = parse_artists("Simon & Garfunkel", &AppSettings::default());
        assert_eq!(result, vec!["Simon & Garfunkel"]);
    }

    #[test]
    fn test_custom_ampersand_separator() {
        let mut custom = AppSettings::default();
        custom.custom_artist_separators = vec![" & ".to_string()];
        let result = parse_artists("Drake & drake", &custom);
        assert_eq!(result, vec!["Drake"]);
    }

    #[test]
    fn test_empty() {
        assert!(parse_artists("", &AppSettings::default()).is_empty());
        assert!(parse_artists("  ", &AppSettings::default()).is_empty());
    }

    #[test]
    fn test_custom_separator() {
        let mut custom = AppSettings::default();
        custom.custom_artist_separators = vec![" + ".to_string()];
        let result = parse_artists("A + B", &custom);
        assert_eq!(result, vec!["A", "B"]);
    }
}
