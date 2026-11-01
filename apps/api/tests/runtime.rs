use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use std::{
    path::Path,
    process::{Child, Command, Stdio},
    time::{Duration, Instant},
};

struct ApiProcess {
    child: Child,
    origin: String,
    log: tempfile::NamedTempFile,
}
impl ApiProcess {
    fn spawn(data: &Path) -> Self {
        let reservation = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = reservation.local_addr().unwrap();
        drop(reservation);
        let log = tempfile::NamedTempFile::new().unwrap();
        let child = Command::new(env!("CARGO_BIN_EXE_piko"))
            .env_clear()
            .env("PIKO_DATA_DIR", data)
            .env("PIKO_BIND", address.to_string())
            // Exercise env-only token loading too. This absent sink may fail,
            // but must never trigger Tako bootstrap or block API startup/I/O.
            .env(
                "PIKO_CHANGE_URL",
                format!("http://{address}/missing-change-sink"),
            )
            .env("PIKO_CHANGE_TOKEN", "standalone-process-test-token")
            .stdin(Stdio::null())
            .stdout(log.as_file().try_clone().unwrap())
            .stderr(log.as_file().try_clone().unwrap())
            .spawn()
            .unwrap();
        Self {
            child,
            origin: format!("http://{address}"),
            log,
        }
    }
    fn logs(&self) -> String {
        std::fs::read_to_string(self.log.path()).unwrap()
    }
    async fn ready(&mut self, client: &Client) {
        let started = Instant::now();
        while started.elapsed() < Duration::from_secs(10) {
            assert!(
                self.child.try_wait().unwrap().is_none(),
                "API exited before readiness: {}",
                self.logs()
            );
            if let Ok(response) = client.get(format!("{}/health", self.origin)).send().await
                && response.status() == StatusCode::OK
            {
                return;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        panic!("API did not become ready: {}", self.logs());
    }
    async fn json(&self, client: &Client, path: &str, body: Value) -> Value {
        let response = client
            .post(format!("{}{path}", self.origin))
            .header("x-piko-admin", "1")
            .json(&body)
            .send()
            .await
            .unwrap();
        assert!(
            response.status().is_success(),
            "request failed: {}",
            response.status()
        );
        response.json().await.unwrap()
    }
}
impl Drop for ApiProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[tokio::test]
async fn standalone_process_preserves_io_exclusivity_and_commits_across_crash() {
    let data = tempfile::tempdir().unwrap();
    let client = Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap();
    let mut api = ApiProcess::spawn(data.path());
    api.ready(&client).await;

    // A client-controlled Host must never activate Tako's lazy fd bootstrap.
    let response = client
        .get(format!("{}/status", api.origin))
        .header("host", "unexpected.tako")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    for _ in 0..3 {
        assert_eq!(
            client
                .get(format!("{}/health", api.origin))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::OK
        );
    }

    let product = api
        .json(
            &client,
            "/api/products",
            json!({"name":"Crash recovery","kind":"tool","retention_days":30}),
        )
        .await;
    let id = product["id"].as_str().unwrap();
    let key = api
        .json(
            &client,
            &format!("/api/products/{id}/keys"),
            json!({"label":"Crash test"}),
        )
        .await;
    let event = json!({"event_id":"committed-before-kill", "name":"command_run", "source":"cli", "properties":{"duration_ms":42, "success":true}});
    let response = client
        .post(format!("{}/api/ingest", api.origin))
        .bearer_auth(key["key"].as_str().unwrap())
        .json(&event)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.json::<Value>().await.unwrap()["accepted"], 1);

    let mut contender = ApiProcess::spawn(data.path());
    let exit = tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if let Some(status) = contender.child.try_wait().unwrap() {
                break status;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("second API must fail fast rather than wait for a data lock");
    assert!(!exit.success());
    assert!(
        contender.logs().contains("already in use"),
        "{}",
        contender.logs()
    );
    assert_eq!(
        client
            .get(format!("{}/health", api.origin))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::OK
    );

    // Child::kill is SIGKILL on Unix: no cleanup/checkpoint or graceful shutdown.
    api.child.kill().unwrap();
    api.child.wait().unwrap();
    drop(api);
    let mut restarted = ApiProcess::spawn(data.path());
    restarted.ready(&client).await;
    let result = restarted
        .json(
            &client,
            &format!("/api/products/{id}/query"),
            json!({
                "from": (chrono::Utc::now() - chrono::Duration::days(1)).to_rfc3339(),
                "to": (chrono::Utc::now() + chrono::Duration::minutes(1)).to_rfc3339(),
                "measure":"sum", "property":"duration_ms"
            }),
        )
        .await;
    assert_eq!(result["summary"]["total"], 1);
    assert_eq!(result["summary"]["value"], 42.0);
    let response = client
        .post(format!("{}/api/ingest", restarted.origin))
        .bearer_auth(key["key"].as_str().unwrap())
        .json(&event)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.json::<Value>().await.unwrap()["duplicates"], 1);
}
