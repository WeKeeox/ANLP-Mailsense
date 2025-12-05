import os
import pickle
import re
import sys
from typing import Any, Dict, List, Union

# Import NLTK components for preprocessing
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer


# --- Compatibility shim for pickled vectorizers ---
# Some of the saved sklearn vectorizers reference a top-level function named
# `identity_tokenizer` that was created in a __main__ context when training.
# When loading under uvicorn (which uses the module name `__mp_main__`), pickle
# looks for `identity_tokenizer` in that module and fails with
# "Can't get attribute 'identity_tokenizer' on <module '__mp_main__' ...>".
#
# To make loading robust, we provide an equivalent identity tokenizer here and
# register it under the expected module so pickle can resolve the reference.
def identity_tokenizer(tokens):
    """Return tokens unchanged (used when data is pre-tokenized)."""
    return tokens


# Ensure uvicorn's multiprocessing main module can resolve the symbol
try:
    mp_main = sys.modules.get("__mp_main__")
    if mp_main is not None and not hasattr(mp_main, "identity_tokenizer"):
        setattr(mp_main, "identity_tokenizer", identity_tokenizer)
except Exception:
    # Non-fatal: if this fails, normal import/module resolution may still work
    pass


class EmailClassifier:
    """
    A sequential email classification pipeline: Spam filter -> Multilabel classifier.
    Loads models and vectorizers only once upon initialization.
    """

    MULTILABEL_CLASSES = [
        "Business",
        "Reminders",
        "Events & Invitations",
        "Finance & Bills",
        "Travel & Bookings",
        "Customer Support",
        "Newsletters",
        "Personal",
        "Job Application",
        "Promotions",
    ]

    def __init__(self, model_dir: str = "model_assets"):
        """Initializes the classifier by loading all necessary assets and NLTK resources."""
        self.model_dir = model_dir

        # 1. Download NLTK resources needed for preprocessing
        print("Downloading necessary NLTK data...")
        try:
            nltk.download('punkt')
            nltk.download('punkt_tab')
            nltk.download('stopwords')
            nltk.download('wordnet')
        except Exception as e:
            print(
                f"Warning: Could not download NLTK data: {e}. Check network connection or permissions."
            )

        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words("english"))

        # 2. Load ML Assets
        print(f"Loading ML assets from {self.model_dir}...")
        self._load_pipeline_assets()
        print("Classifier initialized successfully.")

    def _load_pipeline_assets(self):
        """Loads all four pickled models and vectorizers."""
        try:
            with open(os.path.join(self.model_dir, "spam_vectorizer.pkl"), "rb") as f:
                self.spam_vec = pickle.load(f)
            with open(os.path.join(self.model_dir, "spam_model.pkl"), "rb") as f:
                self.spam_clf = pickle.load(f)
            with open(
                os.path.join(self.model_dir, "multilabel_vectorizer.pkl"), "rb"
            ) as f:
                self.ml_vec = pickle.load(f)
            with open(os.path.join(self.model_dir, "multilabel_model.pkl"), "rb") as f:
                self.ml_clf = pickle.load(f)
        except FileNotFoundError as e:
            # Raise an error if any asset is missing, crucial for deployment
            raise FileNotFoundError(
                f"Required model asset not found: {e.filename}. "
                "Ensure your model_assets directory exists and contains all four .pkl files."
            ) from e

    def _preprocess_email(self, text: str) -> List[str]:
        """
        Processes a single email string into a list of cleaned, lemmatized tokens.
        This must match the preprocessing used when the vectorizers were fitted.
        """
        if not isinstance(text, str):
            return []

        text = text.lower()
        # Replace non-alphanumeric characters with space
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        # tokenize
        tokens = nltk.word_tokenize(text)
        # remove stopwords & very short tokens
        tokens = [t for t in tokens if t not in self.stop_words and len(t) > 2]
        # lemmatize
        lemmas = [self.lemmatizer.lemmatize(t) for t in tokens]

        # Returns a list of tokens/lemmas, which the TfidfVectorizer
        # (configured with token_pattern=None) expects.
        return lemmas

    def classify(self, email_text: str) -> Dict[str, Any]:
        """Runs the sequential Spam -> Multilabel classification pipeline."""

        email_tokens = self._preprocess_email(email_text)

        # --- Stage 1: Spam Classification ---
        # The input to transform must be a list containing the token list
        X_spam = self.spam_vec.transform([email_tokens])

        # Predict Spam/No-Spam (0=No-Spam, 1=Spam)
        spam_prediction = self.spam_clf.predict(X_spam)[0]

        if spam_prediction == 1:
            return {"primary_classification": "Spam", "detailed_labels": []}

        # --- Stage 2: Multilabel Classification (If No-Spam) ---

        # Transform using multilabel-specific vectorizer
        X_multilabel = self.ml_vec.transform([email_tokens])

        # Predict the binary label matrix (1x10)
        y_pred_proba = self.ml_clf.predict_proba(X_multilabel)

        THRESHOLD = 0.30
        # Convert probabilities to binary decisions by threshold
        y_pred_bin_thresh = (y_pred_proba >= THRESHOLD).astype(int)

        # Ensure at least one label per sample: if none pass the threshold, pick the highest-probability label
        import numpy as np
        row_sums = y_pred_bin_thresh.sum(axis=1)
        no_label_rows = np.where(row_sums == 0)[0]
        if len(no_label_rows) > 0:
            top_indices = np.argmax(y_pred_proba[no_label_rows], axis=1)
            for r, c in zip(no_label_rows, top_indices):
                y_pred_bin_thresh[r, c] = 1

        # Convert binary prediction back to human-readable labels
        predicted_labels = [
            self.MULTILABEL_CLASSES[i] for i, val in enumerate(y_pred_bin_thresh[0]) if val == 1
        ]

        return {
            "primary_classification": "No-Spam",
            "detailed_labels": predicted_labels,
        }
