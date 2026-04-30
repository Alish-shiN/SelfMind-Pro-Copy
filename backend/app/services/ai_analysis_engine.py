import json

from app.core.config import settings
from app.services.openai_client import client


class AIAnalysisEngine:
    def analyze(self, title: str, content: str, mood_score: int) -> dict:
        prompt = f"""
You are an emotional support analysis assistant for a journaling app.

Analyze the following journal entry and return STRICT JSON with this exact structure:
{{
  "sentiment_label": "positive|neutral|negative",
  "emotion_label": "joy|calm|stress|anxiety|sadness|anger|neutral",
  "confidence_score": 0.0,
  "short_summary": "string",
  "recommendation": "string"
}}

Rules:
- Do not provide diagnosis.
- Use supportive, non-clinical language.
- confidence_score must be between 0.0 and 1.0.
- short_summary must be concise.
- recommendation must be short, supportive, and practical.

Journal entry:
Title: {title}
Mood score: {mood_score}
Content: {content}
"""

        response = client.responses.create(
            model=settings.OPENAI_MODEL,
            input=prompt,
        )

        raw_text = response.output_text.strip()

        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            parsed = {
                "sentiment_label": "neutral",
                "emotion_label": "neutral",
                "confidence_score": 0.5,
                "short_summary": "The entry reflects a mixed or unclear emotional tone.",
                "recommendation": "Take a quiet moment to reflect on what affected your mood today.",
            }

        return {
            "sentiment_label": parsed.get("sentiment_label", "neutral"),
            "emotion_label": parsed.get("emotion_label", "neutral"),
            "confidence_score": float(parsed.get("confidence_score", 0.5)),
            "short_summary": parsed.get(
                "short_summary",
                "The entry reflects a mixed or unclear emotional tone.",
            ),
            "recommendation": parsed.get(
                "recommendation",
                "Take a quiet moment to reflect on what affected your mood today.",
            ),
        }

