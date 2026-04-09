import sys
from pathlib import Path

import duckdb
import pandas as pd

from paths import DB_PATH


def main():
    if len(sys.argv) < 2:
        print("Usage: python src/run_query.py path/to/query.sql")
        sys.exit(1)

    sql_file = Path(sys.argv[1])
    query = sql_file.read_text()

    con = duckdb.connect(str(DB_PATH))
    df = con.execute(query).df()
    con.close()

    pd.set_option("display.max_columns", None)
    print(df)


if __name__ == "__main__":
    main()
