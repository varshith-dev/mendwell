"""Download hand pump records from the Water Point Data Exchange (WPdx+), an open dataset
published at https://data.waterpointdata.org (Socrata dataset eqje-vguj).

We keep one national census per country so the "survey campaign" cannot leak into the label:
  Sierra Leone: Ministry of Water Resources, 2016 water point mapping
  Uganda:       Ministry of Water and Environment, 2009 (Afridev hand pumps)
No API key is needed. Usage: python ml/fetch_data.py
"""
import csv, io, sys, urllib.parse, urllib.request
from pathlib import Path

BASE = "https://data.waterpointdata.org/resource/eqje-vguj.csv"
COLS = [
    "wpdx_id", "lat_deg", "lon_deg", "report_date", "status_id", "status_clean",
    "water_tech_clean", "water_source_clean", "management_clean", "installer", "install_year",
    "clean_country_name", "clean_adm1", "clean_adm2", "clean_adm3", "is_urban",
    "distance_to_primary", "distance_to_secondary", "distance_to_tertiary",
    "distance_to_city", "distance_to_town", "local_population", "served_population",
    "dataset_title",
    # fetched only for the leakage audit in train.py, never used as model inputs
    "pay_clean", "crucialness", "pressure",
]
JOBS = {
    "sierra_leone": ("Sierra Leone", "Ministry of Water Resources_Sierra Leone_2016"),
    "uganda": ("Uganda", "Ministry of Water and Environment_Uganda_2009"),
}

def main() -> None:
    out_dir = Path(__file__).resolve().parent.parent / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    for key, (country, title) in JOBS.items():
        where = (
            f"clean_country_name='{country}' AND dataset_title='{title}' "
            "AND _water_tech_category='Hand Pump' AND status_id in ('Yes','No')"
        )
        q = urllib.parse.urlencode({"$select": ",".join(COLS), "$where": where, "$limit": 60000})
        url = f"{BASE}?{q}"
        print("fetching", key, "...", flush=True)
        with urllib.request.urlopen(url, timeout=180) as r:
            data = r.read().decode("utf-8")
        rows = list(csv.reader(io.StringIO(data)))
        print(f"  {len(rows) - 1} rows")
        (out_dir / f"wpdx_{key}.csv").write_text(data, encoding="utf-8")

if __name__ == "__main__":
    sys.exit(main())
