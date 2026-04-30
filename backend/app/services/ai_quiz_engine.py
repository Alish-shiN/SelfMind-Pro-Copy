import json

from app.core.config import settings
from app.services.openai_client import client


class AIQuizEngine:
    def generate_questions(self, quiz_type: str, context: dict | None = None) -> list[dict]:
        try:
            return self._generate_questions_openai(quiz_type, context)
        except Exception:
            return self._fallback_questions(quiz_type)

    def analyze_answers(self, quiz_type: str, questions: list[dict], answers: list[dict], context: dict | None = None) -> dict:
        try:
            return self._analyze_answers_openai(quiz_type, questions, answers, context)
        except Exception:
            return self._fallback_result(answers)

    def _generate_questions_openai(self, quiz_type: str, context: dict | None = None) -> list[dict]:
        prompt = f"""
You are generating an adaptive emotional self-assessment quiz for a journaling app.

Return STRICT JSON ARRAY only.
Generate exactly 6 questions for quiz type: {quiz_type}

Each item must follow:
{{
  "question_index": 1,
  "question_text": "string",
  "answer_type": "scale",
  "options": ["Never", "Rarely", "Sometimes", "Often", "Almost always"]
}}

Rules:
- Supportive, reflective, non-clinical language
- Focus on stress, emotional load, energy, coping, and self-awareness
- No diagnosis
- All questions must be suitable for university-age users
- Use only answer_type = "scale"
"""

        response = client.responses.create(
            model=settings.OPENAI_MODEL,
            input=prompt,
        )

        return json.loads(response.output_text)

    def _analyze_answers_openai(self, quiz_type: str, questions: list[dict], answers: list[dict], context: dict | None = None) -> dict:
        payload = {
            "quiz_type": quiz_type,
            "questions": questions,
            "answers": answers,
            "context": context or {},
        }

        prompt = f"""
You are an emotional reflection assistant.

Analyze this completed self-assessment and return STRICT JSON:
{{
  "overall_score": 0.0,
  "severity_level": "low|moderate|elevated|high",
  "insight": "string",
  "recommendation": "string",
  "practice": "string"
}}

Rules:
- No diagnosis
- Non-clinical language
- recommendation should be short and practical
- practice should be a concrete short exercise
- overall_score should be from 0 to 100

Assessment data:
{json.dumps(payload, ensure_ascii=False)}
"""

        response = client.responses.create(
            model=settings.OPENAI_MODEL,
            input=prompt,
        )

        parsed = json.loads(response.output_text)
        return {
            "overall_score": float(parsed.get("overall_score", 0)),
            "severity_level": parsed.get("severity_level", "moderate"),
            "insight": parsed.get("insight", "Your answers suggest noticeable emotional strain."),
            "recommendation": parsed.get("recommendation", "Try to reduce your load by focusing on one manageable step."),
            "practice": parsed.get("practice", "Take 2 minutes for slow breathing and write one thing that feels most important right now."),
        }

    def _fallback_questions(self, quiz_type: str) -> list[dict]:
        return [
            {
                "question_index": 1,
                "question_text": "How often have you felt mentally overloaded during the last few days?",
                "answer_type": "scale",
                "options": ["Never", "Rarely", "Sometimes", "Often", "Almost always"],
            },
            {
                "question_index": 2,
                "question_text": "How difficult has it been to relax when thinking about your responsibilities?",
                "answer_type": "scale",
                "options": ["Not difficult", "A little", "Moderately", "Very", "Extremely"],
            },
            {
                "question_index": 3,
                "question_text": "How often have you felt that your energy is lower than usual?",
                "answer_type": "scale",
                "options": ["Never", "Rarely", "Sometimes", "Often", "Almost always"],
            },
            {
                "question_index": 4,
                "question_text": "How confident do you feel about handling your current workload?",
                "answer_type": "scale",
                "options": ["Very confident", "Somewhat", "Neutral", "Not very", "Not at all"],
            },
            {
                "question_index": 5,
                "question_text": "How often do your thoughts keep returning to the same stressful issue?",
                "answer_type": "scale",
                "options": ["Never", "Rarely", "Sometimes", "Often", "Almost always"],
            },
            {
                "question_index": 6,
                "question_text": "How supported do you feel right now by your routines or people around you?",
                "answer_type": "scale",
                "options": ["Very supported", "Somewhat", "Neutral", "Not much", "Not at all"],
            },
        ]

    def _fallback_result(self, answers: list[dict]) -> dict:
        numeric_scores = [a.get("score", 0) or 0 for a in answers]
        avg = sum(numeric_scores) / len(numeric_scores) if numeric_scores else 0
        overall = round((avg / 4) * 100, 2)

        if overall < 25:
            severity = "low"
        elif overall < 50:
            severity = "moderate"
        elif overall < 75:
            severity = "elevated"
        else:
            severity = "high"

        return {
            "overall_score": overall,
            "severity_level": severity,
            "insight": "Your answers suggest that your recent stress level deserves attention and reflection.",
            "recommendation": "Try to reduce the day into one or two manageable priorities instead of carrying everything at once.",
            "practice": "Pause for 2 minutes, inhale slowly for 4 counts, exhale for 6 counts, and write down one next step.",
        }