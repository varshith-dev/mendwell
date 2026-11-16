"""Train and honestly evaluate the pump failure-risk model.

Run:  python ml/fetch_data.py && python ml/train.py
Outputs (read by prisma/seed.ts and the Evidence page):
  data/points.json      one record per pump, with an out-of-fold risk score
  data/model_card.json  metrics, ROC, calibration, lift, importances, leakage audit

Design choices that keep the numbers honest
  * Label: status_id == "No" in a single national census (one survey, one year per country),
    so a survey campaign cannot leak into the label.
  * Spatial block cross-validation: pumps are grouped into 0.1 degree cells (about 11 km).
    A cell is never split between train and test, so the model is always scored on places
    it has not seen.
  * Every risk score stored for a pump is out-of-fold: the model that scored a pump never saw it.
  * Features derived from the status itself are excluded (see LEAKAGE_AUDIT).
"""
from __future__ import annotations
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score, roc_curve
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
SEED = 7

COUNTRIES = {
    "sierra_leone": {"name": "Sierra Leone", "code": "SLE", "survey_year": 2016,
                     "source": "Ministry of Water Resources, Sierra Leone: 2016 water point mapping (via WPdx+)"},
    "uganda": {"name": "Uganda", "code": "UGA", "survey_year": 2009,
               "source": "Ministry of Water and Environment, Uganda: 2009 water point inventory (via WPdx+)"},
}
NUMERIC = ["age", "distance_to_primary", "distance_to_secondary", "distance_to_tertiary",
           "distance_to_city", "distance_to_town", "local_population", "served_population",
           "lat_deg", "lon_deg"]
CATEGORICAL = ["tech", "management", "source_type", "installer"]
FEATURES = NUMERIC + CATEGORICAL
# Columns we looked at and rejected. Each one is derived from, or filled in only for, working pumps.
LEAKAGE_AUDIT = {
    "pay_clean": "Payment type is only recorded for pumps in use. Adding it (with the two derived columns below) lifts spatial-CV AUC to about 0.99 in Sierra Leone, so it is a label leak and is excluded. The audit AUC is stored per country in this file.",
    "crucialness": "WPdx+ computes this from the status, so it is excluded.",
    "pressure": "WPdx+ computes this from the status, so it is excluded.",
    "status / status_clean / water_point_history": "Direct restatements of the label, excluded.",
}


def load(key: str) -> pd.DataFrame:
    meta = COUNTRIES[key]
    d = pd.read_csv(RAW / f"wpdx_{key}.csv", low_memory=False)
    d = d.drop_duplicates("wpdx_id").dropna(subset=["lat_deg", "lon_deg"]).reset_index(drop=True)
    d["y"] = (d["status_id"] == "No").astype(int)
    iy = d["install_year"].where((d["install_year"] >= 1930) & (d["install_year"] <= meta["survey_year"]))
    d["install_year_clean"] = iy
    d["age"] = meta["survey_year"] - iy
    cap = d["served_population"].quantile(0.99)
    d["served_population"] = d["served_population"].clip(upper=cap)
    d["tech"] = d["water_tech_clean"].str.replace("Hand Pump - ", "", regex=False).replace({"Hand Pump": "Unspecified"})
    d["management"] = d["management_clean"]
    d["source_type"] = d["water_source_clean"]
    inst = d["installer"].fillna("Unknown")
    top = inst.value_counts().head(15).index
    d["installer"] = inst.where(inst.isin(top), "Other")
    for c in CATEGORICAL:
        d[c] = d[c].fillna("Unknown").astype("category")
    d["cell"] = np.floor(d.lat_deg / 0.1).astype(int).astype(str) + "_" + np.floor(d.lon_deg / 0.1).astype(int).astype(str)
    return d


def new_hgb() -> HistGradientBoostingClassifier:
    return HistGradientBoostingClassifier(
        max_iter=250, learning_rate=0.05, max_depth=4, min_samples_leaf=40,
        l2_regularization=2.0, categorical_features="from_dtype", random_state=SEED,
    )


def spatial_oof(d: pd.DataFrame, feats: list[str], k: int = 5, model_fn=new_hgb):
    oof = np.zeros(len(d))
    folds = np.zeros(len(d), dtype=int)
    for i, (tr, te) in enumerate(GroupKFold(k).split(d, d.y, d.cell)):
        m = model_fn().fit(d.iloc[tr][feats], d.y.iloc[tr])
        oof[te] = m.predict_proba(d.iloc[te][feats])[:, 1]
        folds[te] = i
    return oof, folds


def logistic_oof(d: pd.DataFrame, k: int = 5):
    feats = ["age", "tech"]
    pre = ColumnTransformer([
        ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), ["age"]),
        ("cat", OneHotEncoder(handle_unknown="ignore"), ["tech"]),
    ])
    oof = np.zeros(len(d))
    for tr, te in GroupKFold(k).split(d, d.y, d.cell):
        m = make_pipeline(pre, LogisticRegression(max_iter=500)).fit(d.iloc[tr][feats], d.y.iloc[tr])
        oof[te] = m.predict_proba(d.iloc[te][feats])[:, 1]
    return oof


def lift_table(y: np.ndarray, p: np.ndarray):
    order = np.argsort(-p)
    ys = y[order]
    n = len(y)
    base = y.mean()
    out = []
    for frac in [0.05, 0.1, 0.2, 0.3, 0.5]:
        top = ys[: int(n * frac)]
        out.append({"top_fraction": frac, "broken_rate": float(top.mean()),
                    "lift": float(top.mean() / base), "share_of_all_broken_found": float(top.sum() / y.sum())})
    return out


def reliability(y: np.ndarray, p: np.ndarray, bins: int = 10):
    q = np.quantile(p, np.linspace(0, 1, bins + 1))
    q[-1] += 1e-9
    out = []
    for lo, hi in zip(q[:-1], q[1:]):
        m = (p >= lo) & (p < hi)
        if m.sum():
            out.append({"mean_predicted": float(p[m].mean()), "observed": float(y[m].mean()), "n": int(m.sum())})
    return out


def roc_points(y, p, n=60):
    fpr, tpr, _ = roc_curve(y, p)
    idx = np.unique(np.linspace(0, len(fpr) - 1, n).astype(int))
    return [{"fpr": float(fpr[i]), "tpr": float(tpr[i])} for i in idx]


def bootstrap_auc_ci(y, p, groups, n=200):
    """Block bootstrap over spatial cells, so the interval respects spatial clustering."""
    rng = np.random.default_rng(SEED)
    cells = np.unique(groups)
    idx_by = {c: np.where(groups == c)[0] for c in cells}
    vals = []
    for _ in range(n):
        pick = rng.choice(cells, size=len(cells), replace=True)
        ii = np.concatenate([idx_by[c] for c in pick])
        if len(np.unique(y[ii])) == 2:
            vals.append(roc_auc_score(y[ii], p[ii]))
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def main() -> None:
    points, card = [], {"countries": {}, "leakage_audit": LEAKAGE_AUDIT, "features": FEATURES,
                        "cv": "5-fold GroupKFold on 0.1 degree grid cells (about 11 km), no cell split across folds",
                        "model": "HistGradientBoostingClassifier (max_depth 4, 250 iterations, L2 2.0)"}
    frames = {}
    for key, meta in COUNTRIES.items():
        d = load(key)
        frames[key] = d
        oof, folds = spatial_oof(d, FEATURES)
        base_lr = logistic_oof(d)
        # leakage audit: the same model with pay_clean added
        audit = d.copy()
        audit["pay_clean"] = audit["pay_clean"].fillna("Unknown").astype("category")
        audit_oof, _ = spatial_oof(audit, FEATURES + ["pay_clean", "crucialness", "pressure"])
        audit_auc = float(roc_auc_score(d.y, audit_oof))
        auc = roc_auc_score(d.y, oof)
        lo, hi = bootstrap_auc_ci(d.y.values, oof, d.cell.values)
        # permutation importance on one held-out fold, scored by AUC
        te = np.where(folds == 0)[0]
        tr = np.where(folds != 0)[0]
        m0 = new_hgb().fit(d.iloc[tr][FEATURES], d.y.iloc[tr])
        pi = permutation_importance(m0, d.iloc[te][FEATURES], d.y.iloc[te], scoring="roc_auc",
                                    n_repeats=8, random_state=SEED)
        imp = sorted(({"feature": f, "auc_drop": float(v), "std": float(s)}
                      for f, v, s in zip(FEATURES, pi.importances_mean, pi.importances_std)),
                     key=lambda r: -r["auc_drop"])
        by = d.assign(oof=oof).groupby("clean_adm1").apply(
            lambda g: pd.Series({"n": len(g), "broken_rate": g.y.mean(),
                                 "auc": roc_auc_score(g.y, g.oof) if g.y.nunique() == 2 else np.nan}),
            include_groups=False).reset_index()
        card["countries"][key] = {
            "name": meta["name"], "code": meta["code"], "survey_year": meta["survey_year"], "source": meta["source"],
            "n_pumps": int(len(d)), "n_broken": int(d.y.sum()), "broken_rate": float(d.y.mean()),
            "n_spatial_cells": int(d.cell.nunique()),
            "leakage_audit_auc_with_pay_crucialness_pressure": audit_auc,
            "metrics": {
                "auc": float(auc), "auc_ci95": [lo, hi],
                "average_precision": float(average_precision_score(d.y, oof)),
                "brier": float(brier_score_loss(d.y, oof)),
                "brier_prevalence_only": float(brier_score_loss(d.y, np.full(len(d), d.y.mean()))),
                "baseline_age_tech_logistic_auc": float(roc_auc_score(d.y, base_lr)),
            },
            "lift": lift_table(d.y.values, oof),
            "reliability": reliability(d.y.values, oof),
            "roc": roc_points(d.y.values, oof),
            "importance": imp,
            "by_region": [{"region": r.clean_adm1, "n": int(r.n), "broken_rate": float(r.broken_rate),
                           "auc": None if pd.isna(r.auc) else float(r.auc)} for r in by.itertuples()],
        }
        print(f"  leakage audit AUC with pay/crucialness/pressure added: {audit_auc:.3f}")
        print(f"{meta['name']}: n={len(d)} broken={d.y.mean():.3f} AUC={auc:.3f} [{lo:.3f},{hi:.3f}] "
              f"AP={average_precision_score(d.y, oof):.3f} baseline LR AUC={roc_auc_score(d.y, base_lr):.3f}")
        for r in lift_table(d.y.values, oof)[:3]:
            print("   top", r["top_fraction"], "->", round(r["broken_rate"], 3), "lift", round(r["lift"], 2))
        for rec, p in zip(d.itertuples(), oof):
            points.append({
                "id": rec.wpdx_id, "country": key, "lat": round(rec.lat_deg, 6), "lon": round(rec.lon_deg, 6),
                "adm1": rec.clean_adm1, "adm2": rec.clean_adm2, "adm3": None if pd.isna(rec.clean_adm3) else rec.clean_adm3,
                "tech": str(rec.tech), "management": str(rec.management), "source": str(rec.source_type),
                "installYear": None if pd.isna(rec.install_year_clean) else int(rec.install_year_clean),
                "served": int(0 if pd.isna(rec.served_population) else rec.served_population),
                "broken": int(rec.y), "risk": round(float(p), 4),
            })

    # Transfer test: train on Sierra Leone, score Uganda, using only features both countries share.
    shared = ["age", "distance_to_primary", "distance_to_secondary", "distance_to_tertiary",
              "distance_to_city", "distance_to_town", "local_population", "served_population"]
    a, b = frames["sierra_leone"], frames["uganda"]
    m = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05, max_depth=4, random_state=SEED).fit(a[shared], a.y)
    card["transfer"] = {
        "trained_on": "Sierra Leone", "tested_on": "Uganda", "features": shared,
        "auc": float(roc_auc_score(b.y, m.predict_proba(b[shared])[:, 1])),
        "note": "Cross-country transfer is weak: pump models, climate and maintenance regimes differ, so each country needs its own model.",
    }
    print("transfer SL->UG AUC", card["transfer"]["auc"])
    (OUT / "points.json").write_text(json.dumps(points, separators=(",", ":")))
    (OUT / "model_card.json").write_text(json.dumps(card, indent=1))
    print("wrote", len(points), "points")


if __name__ == "__main__":
    main()
