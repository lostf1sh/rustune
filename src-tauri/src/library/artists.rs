use std::collections::HashSet;

/// Separators to try, in order. Longer patterns first to avoid partial matches.
const SEPARATORS: &[&str] = &[
    " feat. ", " feat ", " ft. ", " ft ", " & ", " / ", ", ", "; ", ";",
];

/// Parse a raw artist string into individual artist names.
/// Returns at least one entry (the original trimmed string if no separators found).
pub fn parse_artists(raw: &str) -> Vec<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    let mut parts: Vec<String> = vec![trimmed.to_string()];

    for sep in SEPARATORS {
        let mut new_parts = Vec::new();
        for part in &parts {
            split_by_separator(part, sep, &mut new_parts);
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
        assert_eq!(parse_artists("Pink Floyd"), vec!["Pink Floyd"]);
    }

    #[test]
    fn test_feat() {
        let result = parse_artists("Drake feat. Rihanna");
        assert_eq!(result, vec!["Drake", "Rihanna"]);
    }

    #[test]
    fn test_comma_multiple() {
        let result = parse_artists("Artist A, Artist B, Artist C");
        assert_eq!(result, vec!["Artist A", "Artist B", "Artist C"]);
    }

    #[test]
    fn test_mixed_separators() {
        let result = parse_artists("DJ Khaled feat. Drake & Lil Wayne");
        assert_eq!(result, vec!["DJ Khaled", "Drake", "Lil Wayne"]);
    }

    #[test]
    fn test_semicolon() {
        let result = parse_artists("Artist A; Artist B; Artist C");
        assert_eq!(result, vec!["Artist A", "Artist B", "Artist C"]);
    }

    #[test]
    fn test_dedup() {
        let result = parse_artists("Drake & drake");
        assert_eq!(result, vec!["Drake"]);
    }

    #[test]
    fn test_empty() {
        assert!(parse_artists("").is_empty());
        assert!(parse_artists("  ").is_empty());
    }
}
