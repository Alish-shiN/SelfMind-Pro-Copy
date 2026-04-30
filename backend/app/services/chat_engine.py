class ChatEngine:
    CRISIS_KEYWORDS = {
        "suicide", "kill myself", "self harm", "end my life",
        "суицид", "убить себя", "покончить с собой", "самоповреждение"
    }

    STRESS_KEYWORDS = {
        "stress", "deadline", "pressure", "overwhelmed",
        "стресс", "дедлайн", "давление", "перегруз"
    }

    SADNESS_KEYWORDS = {
        "sad", "empty", "lonely", "cry",
        "грустно", "пусто", "одиноко", "плачу"
    }

    ANXIETY_KEYWORDS = {
        "anxious", "panic", "worried", "fear",
        "тревожно", "паника", "боюсь", "переживаю"
    }

    POSITIVE_KEYWORDS = {
        "happy", "calm", "better", "good", "great",
        "рад", "спокойно", "лучше", "хорошо", "отлично"
    }

    def generate_reply(self, user_message: str, context: dict | None = None) -> str:
        text = user_message.lower()

        if any(keyword in text for keyword in self.CRISIS_KEYWORDS):
            return (
                "I’m really sorry that you’re going through something this intense. "
                "You deserve immediate support from a trusted person or local emergency/crisis service right now. "
                "Please reach out to someone near you immediately and do not stay alone with this."
            )

        if any(keyword in text for keyword in self.STRESS_KEYWORDS):
            return self._stress_reply(context)

        if any(keyword in text for keyword in self.ANXIETY_KEYWORDS):
            return self._anxiety_reply(context)

        if any(keyword in text for keyword in self.SADNESS_KEYWORDS):
            return self._sadness_reply(context)

        if any(keyword in text for keyword in self.POSITIVE_KEYWORDS):
            return self._positive_reply(context)

        return self._neutral_reply(context)

    def _stress_reply(self, context: dict | None = None) -> str:
        base = (
            "It sounds like you may be carrying a lot of pressure right now. "
            "Try to slow the moment down and focus on just one small next step instead of the whole load."
        )
        return self._append_context_hint(base, context)

    def _anxiety_reply(self, context: dict | None = None) -> str:
        base = (
            "That sounds emotionally tense and overwhelming. "
            "A simple grounding step may help: notice five things you can see, four you can touch, "
            "and then take a slow breath."
        )
        return self._append_context_hint(base, context)

    def _sadness_reply(self, context: dict | None = None) -> str:
        base = (
            "I’m sorry you’re feeling this heaviness. "
            "You do not need to solve everything right now—sometimes naming the feeling and being gentle with yourself is enough for this moment."
        )
        return self._append_context_hint(base, context)

    def _positive_reply(self, context: dict | None = None) -> str:
        base = (
            "I’m glad to hear there may be a lighter moment in your day. "
            "It could help to note what contributed to that feeling so you can return to it later."
        )
        return self._append_context_hint(base, context)

    def _neutral_reply(self, context: dict | None = None) -> str:
        base = (
            "Thank you for sharing that. "
            "Would it help to explore what affected your mood today, or what you need most right now?"
        )
        return self._append_context_hint(base, context)

    def _append_context_hint(self, reply: str, context: dict | None = None) -> str:
        if not context:
            return reply

        average_mood = context.get("average_mood")
        latest_emotion = context.get("latest_emotion")

        extra_parts = []

        if average_mood is not None:
            extra_parts.append(f"Your recent average mood appears to be around {average_mood}.")

        if latest_emotion:
            extra_parts.append(f"Your latest journal analysis suggested signs of {latest_emotion}.")

        if extra_parts:
            return reply + " " + " ".join(extra_parts)

        return reply