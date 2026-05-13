import json

from app.core.config import settings
from app.services.openai_client import client

LANGUAGE_INSTRUCTIONS = {
    "en": "Generate the insight and recommendation in English.",
    "ru": "Generate the insight and recommendation in Russian.",
    "kk": "Generate the insight and recommendation in Kazakh.",
}

FALLBACK_ANALYSIS_TEXT = {
    "en": {
        "short_summary": "The entry reflects a mixed or unclear emotional tone.",
        "recommendation": "Take a quiet moment to reflect on what affected your mood today.",
    },
    "ru": {
        "short_summary": "Запись отражает смешанное или неясное эмоциональное состояние.",
        "recommendation": "Найдите спокойную минуту, чтобы подумать, что сегодня повлияло на ваше настроение.",
    },
    "kk": {
        "short_summary": "Жазба аралас немесе анық емес эмоциялық күйді көрсетеді.",
        "recommendation": "Бүгін көңіл-күйіңізге не әсер еткенін ойлау үшін тыныш сәт бөліңіз.",
    },
}


class AIAnalysisEngine:
    def analyze(
        self, title: str, content: str, mood_score: int, language: str = "en"
    ) -> dict:
        language_instruction = LANGUAGE_INSTRUCTIONS.get(
            language, LANGUAGE_INSTRUCTIONS["en"]
        )
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
- {language_instruction}
- Do not translate the journal entry title or content; only generate AI labels, summary, and recommendation in the requested language.

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

        fallback_text = FALLBACK_ANALYSIS_TEXT.get(
            language, FALLBACK_ANALYSIS_TEXT["en"]
        )
        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            parsed = {
                "sentiment_label": "neutral",
                "emotion_label": "neutral",
                "confidence_score": 0.5,
                "short_summary": fallback_text["short_summary"],
                "recommendation": fallback_text["recommendation"],
            }

        return {
            "sentiment_label": parsed.get("sentiment_label", "neutral"),
            "emotion_label": parsed.get("emotion_label", "neutral"),
            "confidence_score": float(parsed.get("confidence_score", 0.5)),
            "short_summary": parsed.get(
                "short_summary",
                fallback_text["short_summary"],
            ),
            "recommendation": parsed.get(
                "recommendation",
                fallback_text["recommendation"],
            ),
        }
