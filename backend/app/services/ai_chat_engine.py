import json

from app.core.config import settings
from app.services.openai_client import client


class AIChatEngine:
    def generate_reply(self, user_message: str, context: dict | None = None) -> str:
        context_payload = context or {}

        system_prompt = """
You are a personalized reflective assistant inside an emotional wellness journaling app.

Rules:
- Be supportive, calm, and reflective.
- Do not diagnose.
- Do not claim to be a therapist or doctor.
- Do not provide medical treatment instructions.
- Encourage grounding, reflection, and reaching out for trusted human support when needed.
- If the user expresses self-harm or suicide intent, strongly encourage immediate real-world help and emergency/crisis support.
- Keep responses concise and empathetic.

Personalization behavior:
- Use the user's journaling context to make the reply feel specific and continuous over time.
- When relevant, mention gentle patterns such as weekly summaries, mood trends, recurring pressures, or past AI observations.
- Ask one context-aware follow-up question when it would help reflection.
- Offer personalized journaling suggestions or adaptive prompts only when they fit the user's message.
- Avoid overclaiming certainty; describe patterns as "your entries suggest" or "you often seem to mention".
"""

        context_text = f"""
User personalization context as JSON:
{json.dumps(context_payload, ensure_ascii=False, default=str)}
"""

        response = client.responses.create(
            model=settings.OPENAI_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context_text},
                {"role": "user", "content": user_message},
            ],
        )

        return response.output_text.strip()
