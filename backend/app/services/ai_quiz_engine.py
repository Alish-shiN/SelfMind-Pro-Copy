import json

from app.core.config import settings
from app.services.ai_quiz_config import QUIZ_TYPES, normalize_quiz_type, quiz_title
from app.services.openai_client import client

QUESTION_BANK = {
    "stress": [
        "How often have you felt mentally overloaded during the last few days?",
        "How difficult has it been to relax when thinking about your responsibilities?",
        "How often do your thoughts return to the same stressful issue?",
        "How manageable has your current workload felt?",
        "How often have you noticed tension in your body?",
        "How supported do you feel by your routines or people around you?",
    ],
    "burnout": [
        "How often have you felt emotionally drained after everyday tasks?",
        "How much recovery time have you had between responsibilities?",
        "How often have you felt detached from work or study you usually care about?",
        "How steady has your energy felt across the day?",
        "How realistic have your expectations for yourself felt recently?",
        "How often have you protected time for rest or enjoyable activities?",
    ],
    "emotional_awareness": [
        "How easy has it been to name what you are feeling?",
        "How often have you noticed body cues linked to emotions?",
        "How often have you paused before reacting to a strong feeling?",
        "How clearly can you connect emotions to recent events?",
        "How often have you written or talked about your feelings?",
        "How comfortable do you feel sitting with mixed emotions?",
    ],
    "study_overload": [
        "How often have study tasks felt like too much to organize?",
        "How clear are your top priorities for today?",
        "How often have you taken short breaks during study blocks?",
        "How manageable do upcoming deadlines feel?",
        "How often have distractions made studying harder?",
        "How confident do you feel about asking for help or adjusting your plan?",
    ],
    "motivation": [
        "How easy has it been to start important tasks?",
        "How often have you noticed small wins this week?",
        "How connected do your tasks feel to something meaningful?",
        "How consistent have your routines felt lately?",
        "How often have you avoided tasks because they felt too large?",
        "How confident do you feel about one achievable next step?",
    ],
}

STANDARD_OPTIONS = ["Never", "Rarely", "Sometimes", "Often", "Almost always"]
LOCALIZED_OPTIONS = {
    "en": STANDARD_OPTIONS,
    "ru": ["Никогда", "Редко", "Иногда", "Часто", "Почти всегда"],
    "kk": ["Ешқашан", "Сирек", "Кейде", "Жиі", "Әрдайым дерлік"],
}
QUESTION_BANK_LOCALIZED = {
    "ru": {
        "stress": [
            "Как часто за последние несколько дней вы чувствовали ментальную перегрузку?",
            "Насколько сложно было расслабиться, думая об обязанностях?",
            "Как часто мысли возвращались к одному и тому же стрессовому вопросу?",
            "Насколько управляемой ощущалась текущая нагрузка?",
            "Как часто вы замечали напряжение в теле?",
            "Насколько вас поддерживают привычки или люди рядом?",
        ],
        "burnout": [
            "Как часто повседневные задачи эмоционально истощали вас?",
            "Сколько времени на восстановление было между обязанностями?",
            "Как часто вы чувствовали отстраненность от учебы или дел, которые обычно важны?",
            "Насколько устойчивой была энергия в течение дня?",
            "Насколько реалистичными казались ожидания к себе в последнее время?",
            "Как часто вы защищали время для отдыха или приятных занятий?",
        ],
        "emotional_awareness": [
            "Насколько легко было назвать то, что вы чувствуете?",
            "Как часто вы замечали телесные сигналы, связанные с эмоциями?",
            "Как часто вы делали паузу перед реакцией на сильное чувство?",
            "Насколько ясно вы связываете эмоции с недавними событиями?",
            "Как часто вы писали или говорили о своих чувствах?",
            "Насколько комфортно вам оставаться с смешанными эмоциями?",
        ],
        "study_overload": [
            "Как часто учебные задачи казались слишком сложными для организации?",
            "Насколько ясны ваши главные приоритеты на сегодня?",
            "Как часто вы делали короткие перерывы во время учебных блоков?",
            "Насколько управляемыми кажутся ближайшие дедлайны?",
            "Как часто отвлечения мешали учебе?",
            "Насколько уверенно вы можете попросить помощи или изменить план?",
        ],
        "motivation": [
            "Насколько легко было начинать важные задачи?",
            "Как часто вы замечали маленькие победы на этой неделе?",
            "Насколько ваши задачи связаны с чем-то значимым?",
            "Насколько стабильными были ваши рутины в последнее время?",
            "Как часто вы избегали задач, потому что они казались слишком большими?",
            "Насколько вы уверены в одном достижимом следующем шаге?",
        ],
    },
    "kk": {
        "stress": [
            "Соңғы бірнеше күнде ойыңыз шамадан тыс жүктелгенін қаншалықты жиі сездіңіз?",
            "Міндеттеріңіз туралы ойлағанда босаңсу қаншалықты қиын болды?",
            "Ойларыңыз бір стресс мәселесіне қаншалықты жиі қайта оралды?",
            "Қазіргі жүктемеңіз қаншалықты басқарылатын болып сезілді?",
            "Денеңіздегі кернеуді қаншалықты жиі байқадыңыз?",
            "Әдеттеріңіз немесе айналаңыздағы адамдар сізді қаншалықты қолдайды?",
        ],
        "burnout": [
            "Күнделікті тапсырмалардан кейін эмоциялық шаршауды қаншалықты жиі сездіңіз?",
            "Міндеттер арасында қалпына келуге қанша уақыт болды?",
            "Әдетте маңызды оқу немесе жұмысқа немқұрайлықты қаншалықты жиі сездіңіз?",
            "Күні бойы энергияңыз қаншалықты тұрақты болды?",
            "Соңғы кезде өзіңізге қоятын күтулер қаншалықты шынайы болды?",
            "Демалысқа немесе ұнайтын істерге уақытты қаншалықты жиі қорғадыңыз?",
        ],
        "emotional_awareness": [
            "Не сезіп тұрғаныңызды атау қаншалықты оңай болды?",
            "Эмоциялармен байланысты дене белгілерін қаншалықты жиі байқадыңыз?",
            "Күшті сезімге жауап берер алдында қаншалықты жиі кідірдіңіз?",
            "Эмоцияларды соңғы оқиғалармен қаншалықты анық байланыстыра аласыз?",
            "Сезімдеріңіз туралы қаншалықты жиі жаздыңыз немесе сөйлестіңіз?",
            "Аралас эмоциялармен отыру сізге қаншалықты жайлы?",
        ],
        "study_overload": [
            "Оқу тапсырмаларын ұйымдастыру тым көп болып қаншалықты жиі сезілді?",
            "Бүгінгі негізгі басымдықтарыңыз қаншалықты анық?",
            "Оқу блоктары кезінде қысқа үзілістерді қаншалықты жиі жасадыңыз?",
            "Алдағы дедлайндар қаншалықты басқарылатын көрінеді?",
            "Алаңдататын нәрселер оқуды қаншалықты жиі қиындатты?",
            "Көмек сұрауға немесе жоспарыңызды өзгертуге қаншалықты сенімдісіз?",
        ],
        "motivation": [
            "Маңызды тапсырмаларды бастау қаншалықты оңай болды?",
            "Осы аптада шағын жетістіктерді қаншалықты жиі байқадыңыз?",
            "Тапсырмаларыңыз мағыналы нәрсемен қаншалықты байланысты?",
            "Соңғы кезде тәртіптеріңіз қаншалықты тұрақты болды?",
            "Тым үлкен болып көрінгендіктен тапсырмалардан қаншалықты жиі қашқақтадыңыз?",
            "Бір қолжетімді келесі қадамға қаншалықты сенімдісіз?",
        ],
    },
}
LANGUAGE_NAMES = {"en": "English", "ru": "Russian", "kk": "Kazakh"}
REVERSED_PROMPTS = {
    "How manageable",
    "How supported",
    "How much recovery",
    "How steady",
    "How realistic",
    "How easy",
    "How clearly",
    "How comfortable",
    "How clear",
    "How confident",
    "How connected",
    "How consistent",
}


class AIQuizEngine:
    def generate_questions(
        self, quiz_type: str, context: dict | None = None, language: str = "en"
    ) -> list[dict]:
        quiz_type = normalize_quiz_type(quiz_type)
        try:
            return self._generate_questions_openai(quiz_type, context, language)
        except Exception:
            return self._fallback_questions(quiz_type, language)

    def analyze_answers(
        self,
        quiz_type: str,
        questions: list[dict],
        answers: list[dict],
        context: dict | None = None,
    ) -> dict:
        quiz_type = normalize_quiz_type(quiz_type)
        try:
            result = self._analyze_answers_openai(
                quiz_type, questions, answers, context
            )
        except Exception:
            result = self._fallback_result(quiz_type, answers)
        return self._enrich_result(quiz_type, result)

    def _generate_questions_openai(
        self, quiz_type: str, context: dict | None = None, language: str = "en"
    ) -> list[dict]:
        personalization_context = json.dumps(
            context or {}, ensure_ascii=False, default=str
        )
        config = QUIZ_TYPES[quiz_type]
        language_code = language if language in LANGUAGE_NAMES else "en"
        language_name = LANGUAGE_NAMES[language_code]
        options = LOCALIZED_OPTIONS[language_code]

        prompt = f"""
You are generating an adaptive self-reflection quiz for a journaling app.

Return STRICT JSON ARRAY only.
Generate exactly 6 questions for quiz type: {quiz_type} ({config['title']}).
Language: {language_name}. Write every question and answer option in {language_name}.
Personalization context JSON: {personalization_context}

Each item must follow:
{{
  "question_index": 1,
  "question_text": "string",
  "answer_type": "scale",
  "options": {json.dumps(options, ensure_ascii=False)}
}}

Rules:
- Supportive, reflective, non-clinical language
- Focus only on the selected quiz type and practical self-awareness
- No diagnosis and no claims that the app detects medical conditions
- All questions must be suitable for university-age users
- Use only answer_type = "scale"
- Use exactly these localized options for every question: {json.dumps(options, ensure_ascii=False)}
"""

        response = client.responses.create(
            model=settings.OPENAI_MODEL,
            input=prompt,
        )

        return json.loads(response.output_text)

    def _analyze_answers_openai(
        self,
        quiz_type: str,
        questions: list[dict],
        answers: list[dict],
        context: dict | None = None,
    ) -> dict:
        payload = {
            "quiz_type": quiz_type,
            "questions": questions,
            "answers": answers,
            "context": context or {},
        }

        prompt = f"""
You are a supportive self-reflection assistant.

Analyze this completed quiz and return STRICT JSON:
{{
  "overall_score": 0.0,
  "severity_level": "low|moderate|elevated|high",
  "insight": "string",
  "recommendation": "string",
  "practice": "string"
}}

Rules:
- No diagnosis and no medical claims
- Non-clinical, supportive, non-judgmental language
- Tie the interpretation to quiz type: {quiz_type}
- recommendation should be short, practical, and linked to the result level
- practice should be one concrete micro-practice
- overall_score should be from 0 to 100, where higher means more strain/overload or lower current momentum for motivation

Assessment data:
{json.dumps(payload, ensure_ascii=False, default=str)}
"""

        response = client.responses.create(
            model=settings.OPENAI_MODEL,
            input=prompt,
        )

        parsed = json.loads(response.output_text)
        return {
            "overall_score": float(parsed.get("overall_score", 0)),
            "severity_level": parsed.get("severity_level", "moderate"),
            "insight": parsed.get(
                "insight",
                f"Your answers offer a useful snapshot of your {quiz_title(quiz_type).lower()}.",
            ),
            "recommendation": parsed.get(
                "recommendation",
                "Choose one manageable next step and give yourself room to adjust.",
            ),
            "practice": parsed.get(
                "practice", "Take 2 minutes to breathe slowly and write one next step."
            ),
        }

    def _fallback_questions(self, quiz_type: str, language: str = "en") -> list[dict]:
        language_code = language if language in LANGUAGE_NAMES else "en"
        prompts = QUESTION_BANK_LOCALIZED.get(language_code, {}).get(
            quiz_type, QUESTION_BANK.get(quiz_type, QUESTION_BANK["stress"])
        )
        options = LOCALIZED_OPTIONS[language_code]
        questions = []
        for index, prompt in enumerate(prompts, start=1):
            questions.append(
                {
                    "question_index": index,
                    "question_text": prompt,
                    "answer_type": "scale",
                    "options": options,
                }
            )
        return questions

    def _fallback_result(self, quiz_type: str, answers: list[dict]) -> dict:
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
            "insight": self._interpretation(quiz_type, severity),
            "recommendation": self._recommendations(quiz_type, severity)[0],
            "practice": self._micro_practices(quiz_type, severity)[0]["description"],
        }

    def _enrich_result(self, quiz_type: str, result: dict) -> dict:
        score = max(0.0, min(100.0, float(result.get("overall_score", 0))))
        severity = self._normalize_level(result.get("severity_level"), score)
        recommendations = self._recommendations(quiz_type, severity)
        micro_practices = self._micro_practices(quiz_type, severity)
        action_plan = self._action_plan(quiz_type, severity, micro_practices)
        return {
            "overall_score": score,
            "severity_level": severity,
            "insight": result.get("insight")
            or self._interpretation(quiz_type, severity),
            "recommendation": result.get("recommendation") or recommendations[0],
            "practice": result.get("practice") or micro_practices[0]["description"],
            "recommendations": recommendations,
            "micro_practices": micro_practices,
            "action_plan": action_plan,
        }

    def _normalize_level(self, level: str | None, score: float) -> str:
        if level in {"low", "moderate", "elevated", "high"}:
            return level
        if score < 25:
            return "low"
        if score < 50:
            return "moderate"
        if score < 75:
            return "elevated"
        return "high"

    def _interpretation(self, quiz_type: str, level: str) -> str:
        title = quiz_title(quiz_type).lower()
        return (
            f"Your {title} result is {level}. This is a self-reflection snapshot, "
            "not a diagnosis, and it can help you choose one supportive next step."
        )

    def _recommendations(self, quiz_type: str, level: str) -> list[str]:
        recommendations = {
            "stress": {
                "low": [
                    "Maintain the coping habits that are helping you feel steady.",
                    "Keep a short reflection routine so stress patterns stay visible.",
                ],
                "moderate": [
                    "Try short breathing breaks and a quick journal check-in.",
                    "Reduce today to one or two manageable priorities.",
                ],
                "elevated": [
                    "Lower avoidable overload where possible and ask for practical support.",
                    "Use short breaks before stress builds up further.",
                ],
                "high": [
                    "Reduce overload, talk to someone trusted, and consider professional support if you need more help.",
                    "Focus on essentials and give yourself permission to pause.",
                ],
            },
            "burnout": {
                "low": [
                    "Keep protecting balance and recovery time.",
                    "Notice which routines are sustaining your energy.",
                ],
                "moderate": [
                    "Review workload and rest before your energy drops further.",
                    "Schedule a small recovery block today.",
                ],
                "elevated": [
                    "Prioritize recovery and reduce non-essential tasks this week.",
                    "Name one boundary that would make your load more realistic.",
                ],
                "high": [
                    "Prioritize recovery, reduce non-essential tasks, and reach out for support if possible.",
                    "Choose the smallest responsible next step rather than pushing through everything.",
                ],
            },
            "study_overload": {
                "low": [
                    "Keep using planning habits that make studying feel manageable.",
                    "Continue pairing study blocks with short breaks.",
                ],
                "moderate": [
                    "List tasks, choose the top two priorities, and study in short blocks.",
                    "Add breaks before you feel depleted.",
                ],
                "elevated": [
                    "Simplify your plan, reduce task switching, and protect break time.",
                    "Ask for clarification or support on the most confusing task.",
                ],
                "high": [
                    "Write down all tasks, choose only today’s top priorities, and add short breaks after each study block.",
                    "Consider adjusting deadlines or asking for help if the load is unrealistic.",
                ],
            },
            "motivation": {
                "low": [
                    "Use quick wins and small goals to keep momentum visible.",
                    "Track one habit that feels doable this week.",
                ],
                "moderate": [
                    "Break tasks into tiny starts and celebrate completion cues.",
                    "Pair a task with a routine you already do.",
                ],
                "elevated": [
                    "Choose one very small action to rebuild momentum without pressure.",
                    "Make progress visible with a simple checklist.",
                ],
                "high": [
                    "Start with a two-minute task and one quick win today.",
                    "Use gentle accountability or a supportive goal instead of relying on willpower.",
                ],
            },
            "emotional_awareness": {
                "low": [
                    "Keep naming emotions and noticing what helps you understand them.",
                    "Use journaling prompts to deepen self-awareness.",
                ],
                "moderate": [
                    "Try mood labeling and one short reflection prompt each day.",
                    "Notice body cues before choosing a response.",
                ],
                "elevated": [
                    "Pause to name one emotion, one body cue, and one need.",
                    "Use journaling to separate facts, feelings, and next steps.",
                ],
                "high": [
                    "Use gentle mood labeling exercises and write a short reflection before reacting.",
                    "Talk with someone trusted if emotions feel hard to sort through alone.",
                ],
            },
        }
        return recommendations.get(quiz_type, recommendations["stress"])[level]

    def _micro_practices(self, quiz_type: str, level: str) -> list[dict]:
        common = [
            {
                "title": "2-minute breathing exercise",
                "description": "Breathe in slowly for 4 counts and exhale for 6 counts for two minutes.",
                "estimated_time": "2 min",
                "action": None,
            },
            {
                "title": "Short journal reflection",
                "description": "Write three sentences about what feels heavy and one next step.",
                "estimated_time": "3 min",
                "action": "journal",
            },
        ]
        by_type = {
            "study_overload": [
                {
                    "title": "Choose one priority",
                    "description": "List three tasks, then circle the one that matters most today.",
                    "estimated_time": "4 min",
                    "action": "goals",
                },
                {
                    "title": "10-minute reset walk",
                    "description": "Take a short walk before your next study block.",
                    "estimated_time": "10 min",
                    "action": None,
                },
            ],
            "motivation": [
                {
                    "title": "Two-minute start",
                    "description": "Work on one task for only two minutes to lower the starting barrier.",
                    "estimated_time": "2 min",
                    "action": "goals",
                },
                {
                    "title": "Quick win note",
                    "description": "Write one small thing you completed or tried today.",
                    "estimated_time": "2 min",
                    "action": "journal",
                },
            ],
            "emotional_awareness": [
                {
                    "title": "Mood label check",
                    "description": "Name your current mood and one body cue you notice.",
                    "estimated_time": "2 min",
                    "action": "mood",
                },
                {
                    "title": "Gratitude note",
                    "description": "Write one small thing you appreciated today.",
                    "estimated_time": "2 min",
                    "action": "journal",
                },
            ],
            "burnout": [
                {
                    "title": "Screen break",
                    "description": "Step away from screens and stretch gently.",
                    "estimated_time": "5 min",
                    "action": None,
                },
                {
                    "title": "Recovery boundary",
                    "description": "Choose one non-essential task to delay or simplify.",
                    "estimated_time": "3 min",
                    "action": "goals",
                },
            ],
            "stress": [
                {
                    "title": "Log current mood",
                    "description": "Record how you feel right now so patterns become easier to spot.",
                    "estimated_time": "2 min",
                    "action": "mood",
                },
                {
                    "title": "10-minute walk",
                    "description": "Move gently and let your attention settle before the next task.",
                    "estimated_time": "10 min",
                    "action": None,
                },
            ],
        }
        practices = common + by_type.get(quiz_type, by_type["stress"])
        return practices[:4] if level in {"elevated", "high"} else practices[:3]

    def _action_plan(
        self, quiz_type: str, level: str, micro_practices: list[dict]
    ) -> dict:
        steps = {
            "stress": [
                "Name the main pressure you can influence today.",
                "Choose one realistic next step.",
                "Take a short breathing break before switching tasks.",
            ],
            "burnout": [
                "Identify one task that can be reduced, delayed, or shared.",
                "Protect one recovery block today.",
                "Check in with someone supportive if your load feels too heavy.",
            ],
            "emotional_awareness": [
                "Name one emotion without judging it.",
                "Notice one body cue linked to that emotion.",
                "Write one need or next step that emotion may be pointing toward.",
            ],
            "study_overload": [
                "Write down all tasks in one place.",
                "Choose the top 2 priorities for today.",
                "Take one short break after each study block.",
            ],
            "motivation": [
                "Choose one task that can start in two minutes.",
                "Track one small win after you finish.",
                "Connect the task to one value or benefit that matters to you.",
            ],
        }
        prompts = {
            "stress": "What is one pressure I can make 10% easier today?",
            "burnout": "What would meaningful recovery look like in the next 24 hours?",
            "emotional_awareness": "What am I feeling, where do I feel it, and what might I need?",
            "study_overload": "Which two study tasks matter most today, and what can wait?",
            "motivation": "What is the smallest useful action I can take right now?",
        }
        goals = {
            "stress": "Stress reset goal: take 3 breathing breaks this week",
            "burnout": "Recovery goal: protect 2 short rest blocks this week",
            "emotional_awareness": "Awareness goal: label your mood 4 times this week",
            "study_overload": "Study balance goal: take 3 short breaks this week",
            "motivation": "Momentum goal: complete 3 two-minute starts this week",
        }
        return {
            "quiz_type": quiz_type,
            "result_level": level,
            "steps": steps.get(quiz_type, steps["stress"]),
            "micro_practices": micro_practices,
            "reflection_prompt": prompts.get(quiz_type, prompts["stress"]),
            "suggested_goal": goals.get(quiz_type),
            "supportive_message": "This plan is a gentle starting point. Adjust it to fit your real energy and context.",
        }
