from app.core.config import settings
from app.services.openai_client import client


class AIChatEngine:
    def generate_reply(self, user_message: str, context: dict | None = None) -> str:
        average_mood = context.get("average_mood") if context else None
        latest_emotion = context.get("latest_emotion") if context else None

        system_prompt = """
You are a supportive emotional wellness assistant inside a journaling app.

Rules:
- Be supportive, calm, and reflective.
- Do not diagnose.
- Do not claim to be a therapist or doctor.
- Do not provide medical treatment instructions.
- Encourage grounding, reflection, and reaching out for trusted human support when needed.
- If the user expresses self-harm or suicide intent, strongly encourage immediate real-world help and emergency/crisis support.
- Keep responses concise and empathetic.
"""

        context_text = f"""
User context:
- Recent average mood: {average_mood}
- Latest detected emotion: {latest_emotion}
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

