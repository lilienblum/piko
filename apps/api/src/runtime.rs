use anyhow::{Context, Result};
use std::{
    fs::{File, OpenOptions},
    path::Path,
};

/// The returned file must outlive every connection to the data directory.
pub fn lock_data_directory(path: &Path) -> Result<File> {
    std::fs::create_dir_all(path)?;
    let lock = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path.join("piko.lock"))?;
    lock.try_lock().with_context(|| format!(
        "Piko data directory {} is already in use or cannot be locked; run one API process per data directory and stop it before replacement",
        path.display()
    ))?;
    Ok(lock)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exclusive_owner_can_be_replaced_after_release() {
        let dir = tempfile::tempdir().unwrap();
        let owner = lock_data_directory(dir.path()).unwrap();
        assert!(lock_data_directory(dir.path()).is_err());
        drop(owner);
        assert!(lock_data_directory(dir.path()).is_ok());
    }
}
