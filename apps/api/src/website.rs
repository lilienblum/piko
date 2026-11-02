use crate::error::{ApiError, ApiResult};
use reqwest::{Client, Url};
use std::{net::IpAddr, time::Duration};

const MAX_ICON_BYTES: usize = 256 * 1024;

pub fn normalize(value: &str) -> ApiResult<Option<String>> {
    let value = value.trim();
    if value.is_empty() {
        return Ok(None);
    }
    if value.len() > 2048 || value.contains('\\') || value.chars().any(char::is_whitespace) {
        return Err(ApiError::bad("Use a valid HTTP(S) website address"));
    }
    let address = if value.contains("://") {
        value.to_owned()
    } else {
        format!("https://{value}")
    };
    let url =
        Url::parse(&address).map_err(|_| ApiError::bad("Use a valid HTTP(S) website address"))?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || address.contains('@')
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(ApiError::bad(
            "Use an HTTP(S) website without credentials, a query, or a fragment",
        ));
    }
    Ok(Some(url.origin().ascii_serialization()))
}

fn public_address(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let n = u32::from(ip);
            ![
                (0x00000000, 8),
                (0x0a000000, 8),
                (0x64400000, 10),
                (0x7f000000, 8),
                (0xa9fe0000, 16),
                (0xac100000, 12),
                (0xc0000000, 24),
                (0xc0000200, 24),
                (0xc0586300, 24),
                (0xc0a80000, 16),
                (0xc6120000, 15),
                (0xc6336400, 24),
                (0xcb007100, 24),
                (0xe0000000, 3),
            ]
            .iter()
            .any(|(network, bits)| n >> (32 - bits) == network >> (32 - bits))
        }
        IpAddr::V6(ip) => {
            let s = ip.segments();
            s[0] & 0xe000 == 0x2000
                && !(s[0] == 0x2001 && (s[1] < 0x0200 || s[1] == 0x0db8))
                && s[0] != 0x2002
                && !(s[0] == 0x3fff && s[1] < 0x1000)
        }
    }
}

pub fn content_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(b"\x00\x00\x01\x00") {
        Some("image/x-icon")
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some("image/jpeg")
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        Some("image/webp")
    } else {
        None
    }
}

async fn download(client: &Client, url: Url) -> Option<Vec<u8>> {
    let mut response = client.get(url).send().await.ok()?;
    if !response.status().is_success()
        || response
            .content_length()
            .is_some_and(|n| n > MAX_ICON_BYTES as u64)
    {
        return None;
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.ok()? {
        if bytes.len() + chunk.len() > MAX_ICON_BYTES {
            return None;
        }
        bytes.extend_from_slice(&chunk);
    }
    content_type(&bytes)?;
    Some(bytes)
}

async fn fetch(website: &str) -> Option<Vec<u8>> {
    let url = Url::parse(website).ok()?;
    let port = url.port_or_known_default()?;
    if !matches!((url.scheme(), port), ("https", 443) | ("http", 80)) {
        return None;
    }
    let host = url
        .host_str()?
        .trim_start_matches('[')
        .trim_end_matches(']');
    let addresses: Vec<_> = tokio::net::lookup_host((host, port)).await.ok()?.collect();
    if addresses.is_empty() || addresses.iter().any(|addr| !public_address(addr.ip())) {
        return None;
    }
    // Pin the checked addresses: no second DNS lookup, proxies, redirects, cookies, or credentials.
    let client = Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .referer(false)
        .resolve_to_addrs(host, &addresses)
        .connect_timeout(Duration::from_secs(1))
        .timeout(Duration::from_secs(2))
        .user_agent("Piko favicon fetcher")
        .build()
        .ok()?;
    // shortcut: standard icon paths only; add HTML discovery if sites without these need support.
    for path in ["/favicon.ico", "/favicon.png", "/apple-touch-icon.png"] {
        if let Some(bytes) = download(&client, url.join(path).ok()?).await {
            return Some(bytes);
        }
    }
    None
}

pub async fn fetch_icon(website: &str) -> Option<Vec<u8>> {
    tokio::time::timeout(Duration::from_secs(4), fetch(website))
        .await
        .ok()
        .flatten()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn website_normalization_never_stores_credentials_or_query_data() {
        assert_eq!(
            normalize("example.com/path").unwrap().as_deref(),
            Some("https://example.com")
        );
        assert_eq!(
            normalize("HTTP://EXAMPLE.COM:80/").unwrap().as_deref(),
            Some("http://example.com")
        );
        assert_eq!(normalize("").unwrap(), None);
        for value in [
            "https://user:secret@example.com",
            "https://@example.com",
            "https://example.com/?token=secret",
            "https://example.com/#private",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "https://bad host",
        ] {
            assert!(normalize(value).is_err(), "{value}");
        }
    }
    #[test]
    fn fetch_destinations_exclude_private_special_and_translated_addresses() {
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.169.254",
            "100.100.100.200",
            "172.16.0.1",
            "192.168.0.1",
            "0.0.0.0",
            "192.0.0.8",
            "192.0.2.1",
            "198.18.0.1",
            "224.0.0.1",
            "255.255.255.255",
            "::1",
            "::ffff:127.0.0.1",
            "64:ff9b::7f00:1",
            "fc00::1",
            "fe80::1",
            "2002:7f00:1::",
            "2001:db8::1",
            "2001::1",
            "3fff::1",
        ] {
            assert!(!public_address(ip.parse().unwrap()), "{ip}");
        }
        for ip in ["1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"] {
            assert!(public_address(ip.parse().unwrap()), "{ip}");
        }
        assert_eq!(
            content_type(b"<svg xmlns='http://www.w3.org/2000/svg'/>"),
            None
        );
        assert_eq!(content_type(b"<!DOCTYPE html>"), None);
    }
    #[tokio::test]
    async fn private_and_nonstandard_port_sites_are_skipped() {
        for url in [
            "http://127.0.0.1",
            "http://2130706433",
            "http://[::1]",
            "https://example.com:8443",
        ] {
            assert!(fetch_icon(url).await.is_none(), "{url}");
        }
    }
    #[tokio::test]
    async fn download_is_bounded_and_does_not_follow_redirects() {
        use axum::{Router, body::Body, http::Response, routing::get};
        let app = Router::new()
            .route(
                "/icon",
                get(|| async { b"\x00\x00\x01\x00test icon".to_vec() }),
            )
            .route("/html", get(|| async { "<html>not an image</html>" }))
            .route("/large", get(|| async { vec![0u8; MAX_ICON_BYTES + 1] }))
            .route(
                "/redirect",
                get(|| async {
                    Response::builder()
                        .status(302)
                        .header("location", "/icon")
                        .body(Body::empty())
                        .unwrap()
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let root = format!("http://{}", listener.local_addr().unwrap());
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let client = Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();
        assert!(
            download(&client, Url::parse(&format!("{root}/icon")).unwrap())
                .await
                .is_some()
        );
        for path in ["/html", "/large", "/redirect"] {
            assert!(
                download(&client, Url::parse(&format!("{root}{path}")).unwrap())
                    .await
                    .is_none()
            );
        }
        server.abort();
    }
}

#[cfg(test)]
mod live_test {
    #[tokio::test]
    #[ignore = "opt-in HTTPS smoke check against a public website"]
    async fn public_favicon_smoke() {
        let bytes = super::fetch_icon("https://datafa.st")
            .await
            .expect("public favicon should download");
        assert_eq!(super::content_type(&bytes), Some("image/x-icon"));
        assert!(bytes.len() > 100);
    }
}
