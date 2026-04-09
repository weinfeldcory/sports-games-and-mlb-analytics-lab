from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "mlb.duckdb"
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SQL_DIR = PROJECT_ROOT / "sql"
VIEWER_DIR = PROJECT_ROOT / "viewer"
VIEWER_DATA_DIR = VIEWER_DIR / "data"
