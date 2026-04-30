class AnalyzerEngine:
    POSITIVE_WORDS = {
        "happy", "good", "great", "calm", "better", "joy", "grateful", "relaxed",
        "рад", "счастлив", "хорошо", "лучше", "спокойно", "благодарен"
    }

    NEGATIVE_WORDS = {
        "sad", "bad", "tired", "anxious", "stress", "stressed", "angry", "upset",
        "грустно", "плохо", "устал", "тревожно", "стресс", "злюсь", "одиноко"
    }

    STRESS_WORDS = {
        "deadline", "pressure", "overwhelmed", "stress", "stressed",
        "дедлайн", "давление", "перегруз", "стресс", "напряжение"
    }

    ANXIETY_WORDS = {
        "anxious", "worried", "fear", "panic",
        "тревога", "переживаю", "боюсь", "паника", "страшно"
    }

    JOY_WORDS = {
        "happy", "joy", "excited", "grateful", "love",
        "рад", "счастлив", "вдохновлен", "благодарен", "люблю"
    }

    CALM_WORDS = {
        "calm", "peaceful", "relaxed",
        "спокойно", "тихо", "умиротворенно", "расслабленно"
    }

    SADNESS_WORDS = {
        "sad", "lonely", "empty", "cry",
        "грустно", "одиноко", "пусто", "плакал", "плакала"
    }

    ANGER_WORDS = {
        "angry", "mad", "furious",
        "злой", "злюсь", "бесит", "раздражен"
    }

    def analyze(self, title: str, content: str, mood_score: int) -> dict:
        text = f"{title} {content}".lower()

        positive_hits = sum(word in text for word in self.POSITIVE_WORDS)
        negative_hits = sum(word in text for word in self.NEGATIVE_WORDS)

        if mood_score >= 7 or positive_hits > negative_hits:
            sentiment_label = "positive"
        elif mood_score <= 4 or negative_hits > positive_hits:
            sentiment_label = "negative"
        else:
            sentiment_label = "neutral"

        emotion_scores = {
            "stress": sum(word in text for word in self.STRESS_WORDS),
            "anxiety": sum(word in text for word in self.ANXIETY_WORDS),
            "joy": sum(word in text for word in self.JOY_WORDS),
            "calm": sum(word in text for word in self.CALM_WORDS),
            "sadness": sum(word in text for word in self.SADNESS_WORDS),
            "anger": sum(word in text for word in self.ANGER_WORDS),
        }

        emotion_label = max(emotion_scores, key=emotion_scores.get)

        if all(score == 0 for score in emotion_scores.values()):
            if mood_score >= 8:
                emotion_label = "joy"
            elif mood_score >= 6:
                emotion_label = "calm"
            elif mood_score <= 3:
                emotion_label = "sadness"
            elif mood_score <= 5:
                emotion_label = "stress"
            else:
                emotion_label = "neutral"

        confidence_score = self._calculate_confidence(
            mood_score=mood_score,
            positive_hits=positive_hits,
            negative_hits=negative_hits,
            emotion_scores=emotion_scores,
        )

        short_summary = self._generate_summary(sentiment_label, emotion_label)
        recommendation = self._generate_recommendation(sentiment_label, emotion_label)

        return {
            "sentiment_label": sentiment_label,
            "emotion_label": emotion_label,
            "confidence_score": confidence_score,
            "short_summary": short_summary,
            "recommendation": recommendation,
        }

    def _calculate_confidence(
        self,
        mood_score: int,
        positive_hits: int,
        negative_hits: int,
        emotion_scores: dict,
    ) -> float:
        signal_strength = positive_hits + negative_hits + max(emotion_scores.values(), default=0)

        if signal_strength >= 3:
            return 0.9
        if signal_strength == 2:
            return 0.8
        if signal_strength == 1:
            return 0.7
        if mood_score in [1, 2, 9, 10]:
            return 0.75
        return 0.6

    def _generate_summary(self, sentiment_label: str, emotion_label: str) -> str:
        summaries = {
            ("positive", "joy"): "Your entry reflects a positive emotional state with signs of joy and emotional uplift.",
            ("positive", "calm"): "Your entry suggests emotional stability and a calm inner state.",
            ("negative", "stress"): "Your entry shows signs of emotional pressure and stress.",
            ("negative", "anxiety"): "Your entry reflects worry and emotional tension.",
            ("negative", "sadness"): "Your entry suggests low mood and emotional heaviness.",
            ("negative", "anger"): "Your entry contains signs of frustration or anger.",
            ("neutral", "calm"): "Your entry appears emotionally balanced with a mostly stable tone.",
        }
        return summaries.get(
            (sentiment_label, emotion_label),
            f"Your entry indicates a {sentiment_label} emotional tone with signs of {emotion_label}."
        )

    def _generate_recommendation(self, sentiment_label: str, emotion_label: str) -> str:
        recommendations = {
            "joy": "Try to capture what contributed to this positive state so you can return to it later.",
            "calm": "This may be a good moment for reflection, gratitude, or a small mindful routine.",
            "stress": "Take a short pause, breathe slowly, and focus on one manageable next step.",
            "anxiety": "Try grounding yourself in the present moment and write down what feels most urgent.",
            "sadness": "Be gentle with yourself today and consider reaching out to someone you trust.",
            "anger": "Pause before reacting, and try to identify what specifically triggered this feeling.",
            "neutral": "Take a moment to reflect on what influenced your day and how your mood shifted.",
        }
        return recommendations.get(
            emotion_label,
            "Take a few quiet minutes to reflect on your emotional state and what may support you next."
        )