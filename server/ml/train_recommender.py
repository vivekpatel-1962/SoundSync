"""
Simple Multiple Linear Regression Recommender

What this script does (beginner friendly):
- We take song metadata (title, artist, duration) and the list of songs a user liked.
- We turn song metadata into simple numeric features:
  * duration_seconds
  * title_length (number of characters)
  * artist_length (number of characters)
- We assign a target label (y): 1 if the user liked the song, else 0.
- We split the data into training and testing sets (to simulate real ML workflow).
- We train a Multiple Linear Regression model to predict a "preference score".
- We evaluate on the test set (using MSE and R^2) just for learning purposes.
- We then score ALL songs and recommend the top songs the user hasn't liked yet.

Input/Output protocol:
- This script reads a JSON blob from stdin with shape:
  {
    "userId": "u1",
    "songs": [ {"id": "s1", "title": "..", "artist": "..", "duration": 200}, ... ],
    "likes": ["s1", "s3"],
    "top_k": 10
  }
- It writes JSON to stdout like:
  {
    "recommended_ids": ["s2", "s4", ...],
    "metrics": {"mse": 0.12, "r2": 0.53}
  }

Dependencies (install using pip):
- numpy
- pandas
- scikit-learn

Run manually for testing:
  python server/ml/train_recommender.py < payload.json
"""

import json
import sys
from typing import List, Dict

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create simple numeric features from song metadata."""
    # Ensure duration is numeric
    df["duration_seconds"] = pd.to_numeric(df.get("duration"), errors="coerce").fillna(0)
    # Simple text length features
    df["title_length"] = df["title"].fillna("").astype(str).str.len()
    df["artist_length"] = df["artist"].fillna("").astype(str).str.len()
    return df[["duration_seconds", "title_length", "artist_length"]]


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"error": f"Failed to parse stdin JSON: {e}"}))
        return 1

    songs: List[Dict] = payload.get("songs", [])
    likes: List[str] = payload.get("likes", [])
    top_k: int = int(payload.get("top_k", 10))

    if not isinstance(songs, list) or len(songs) == 0:
        print(json.dumps({"error": "No songs provided"}))
        return 1

    # Build DataFrame
    df = pd.DataFrame(songs)
    # Target: 1 if liked else 0
    df["liked"] = df["id"].isin(set(likes)).astype(int)

    # Features
    X = build_features(df)
    y = df["liked"]

    # If user hasn't liked anything yet, do not fabricate recommendations
    if y.sum() == 0:
        print(json.dumps({
            "recommended_ids": [],
            "metrics": {"mse": None, "r2": None},
            "note": "User hasn't liked any songs yet."
        }))
        return 0

    # Train/Test split (beginner-friendly default)
    # test_size=0.2 means 80% training and 20% testing
    X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
        X, y, np.arange(len(df)), test_size=0.2, random_state=42
    )

    # Model: Multiple Linear Regression
    model = LinearRegression()
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mse = float(mean_squared_error(y_test, y_pred))
    r2 = float(r2_score(y_test, y_pred))

    # Score all songs
    all_scores = model.predict(X)
    df_scores = pd.DataFrame({
        "id": df["id"],
        "score": all_scores,
        "liked": df["liked"],
    })

    # Exclude already liked songs and pick top_k
    recs_df = df_scores[df_scores["liked"] == 0].sort_values("score", ascending=False)
    recommended_ids = recs_df["id"].head(top_k).tolist()

    print(json.dumps({
        "recommended_ids": recommended_ids,
        "metrics": {"mse": mse, "r2": r2}
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
