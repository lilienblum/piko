use crate::error::{ApiError, ApiResult};
use reqwest::Url;

fn parse(value: &str) -> ApiResult<(Url, bool)> {
    let wildcard = value.contains("://*.");
    let plain = value.replacen("://*.", "://", 1);
    let invalid = || {
        ApiError::bad(
            "Use an HTTP(S) origin, such as https://example.com or https://*.example.com, without a path, query, or credentials",
        )
    };
    if value.len() > 512
        || plain.contains('*')
        || plain.contains('@')
        || plain
            .split_once("://")
            .and_then(|(_, rest)| rest.split_once('/'))
            .is_some_and(|(_, path)| !path.is_empty())
        || plain.contains('\\')
        || plain.chars().any(char::is_whitespace)
    {
        return Err(invalid());
    }
    let url = Url::parse(&plain).map_err(|_| invalid())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
        || (wildcard && url.domain().is_none_or(|host| !host.contains('.')))
    {
        return Err(invalid());
    }
    Ok((url, wildcard))
}

pub fn normalize(values: &[String]) -> ApiResult<Vec<String>> {
    if values.len() > 16 {
        return Err(ApiError::bad("Use at most 16 allowed origins"));
    }
    let mut result = Vec::new();
    for value in values {
        let (url, wildcard) = parse(value.trim())?;
        let origin = url.origin().ascii_serialization();
        let origin = if wildcard {
            origin.replacen("://", "://*.", 1)
        } else {
            origin
        };
        if !result.contains(&origin) {
            result.push(origin);
        }
    }
    Ok(result)
}

pub fn check(allowed: &[String], origin: Option<&str>) -> ApiResult<()> {
    if allowed.is_empty() {
        return Ok(());
    }
    let matches = origin
        .and_then(|value| parse(value).ok())
        .is_some_and(|(actual, wildcard)| {
            !wildcard
                && allowed.iter().any(|rule| {
                    let Ok((expected, wildcard)) = parse(rule) else {
                        return false;
                    };
                    actual.scheme() == expected.scheme()
                        && actual.port_or_known_default() == expected.port_or_known_default()
                        && if wildcard {
                            actual.host_str().is_some_and(|host| {
                                host.ends_with(&format!(
                                    ".{}",
                                    expected.host_str().unwrap_or_default()
                                ))
                            })
                        } else {
                            actual.host_str() == expected.host_str()
                        }
                })
        });
    if matches {
        Ok(())
    } else {
        Err(ApiError(
            axum::http::StatusCode::FORBIDDEN,
            "This ingestion key requires an allowed Origin header".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn origin_rules_match_boundaries_scheme_and_port() {
        let rules = normalize(&[
            "https://EXAMPLE.com:443/".into(),
            "https://*.example.com".into(),
            "http://localhost:3000".into(),
        ])
        .unwrap();
        for origin in [
            "https://example.com",
            "https://app.example.com",
            "https://a.b.example.com",
            "http://localhost:3000",
        ] {
            assert!(check(&rules, Some(origin)).is_ok(), "{origin}");
        }
        for origin in [
            None,
            Some("null"),
            Some("https://evilexample.com"),
            Some("https://example.com.evil.test"),
            Some("http://example.com"),
            Some("https://example.com:444"),
            Some("http://localhost"),
            Some("https://example.com/path"),
            Some("https://user@example.com"),
            Some("https://*.example.com"),
            Some("https://example.com https://evil.test"),
        ] {
            assert!(check(&rules, origin).is_err(), "{origin:?}");
        }
        assert!(
            check(
                &["https://*.example.com".into()],
                Some("https://example.com")
            )
            .is_err()
        );
        assert!(check(&[], None).is_ok());
        assert_eq!(
            normalize(&["https://example.com/".into(), "https://example.com".into()])
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn rejects_ambiguous_or_overbroad_patterns() {
        for rule in [
            "*",
            "example.com",
            "https://*",
            "https://*.com",
            "https://foo.*.com",
            "https://example.com?x",
            "https://example.com/#x",
            "https://example.com/../",
            "https://*.127.0.0.1",
            "https://example.com\\",
            "https://a\n.com",
        ] {
            assert!(normalize(&[rule.into()]).is_err(), "{rule}");
        }
        assert!(normalize(&vec!["https://example.com".into(); 17]).is_err());
    }
}
