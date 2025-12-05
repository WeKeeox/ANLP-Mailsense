from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from mail_classifier import EmailClassifier


# --- Pydantic Schema for Request Body ---
class EmailInput(BaseModel):
    email_text: str


try:
    print("Initializing EmailClassifier (Loading models only once)...")
    classifier = EmailClassifier(model_dir="model_assets")
    print("Model loading successful.")
except FileNotFoundError as e:
    print(f"CRITICAL ERROR: Failed to load machine learning assets on startup: {e}")
    # Set to None so the API endpoint can check for initialization failure
    classifier = None

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Email Categorization Pipeline",
    description="Sequential classification (Spam/NoSpam) followed by 10-label categorization.",
)

# --- CORS Middleware Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (for development)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods including OPTIONS, POST, GET, etc.
    allow_headers=["*"],  # Allows all headers
)


# --- API Endpoint ---
@app.post("/classify", response_model=Dict[str, Any])
async def classify_email(input: EmailInput):
    """
    Endpoint to receive an email and run it through the sequential classification pipeline.
    """
    if classifier is None:
        return {
            "error": "Server failed to load machine learning assets on startup."
        }, 500

    try:
        result = classifier.classify(input.email_text)
        return result
    except Exception as e:
        # Good practice to handle exceptions and return a proper error message
        return {"error": f"An error occurred during classification: {str(e)}"}


# --- How to Run ---
# Save the code as 'app.py' and run:
# uvicorn app:app --reload

# Test with a POST request to http://127.0.0.1:8002/classify
# Body: {"email_text": "Your account has been hacked! Click this suspicious link now."}
