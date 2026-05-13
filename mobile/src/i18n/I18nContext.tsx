import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'en' | 'ru' | 'kk';

type TranslationKey = keyof typeof translations.en;

type LanguageContextValue = {
  language: AppLanguage;
  ready: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
};

const LANGUAGE_KEY = 'selfmind:language';

const languageNames: Record<AppLanguage, string> = {
  en: 'English',
  ru: 'Русский',
  kk: 'Қазақша',
};

export const supportedLanguages = [
  { key: 'en' as const, label: languageNames.en },
  { key: 'ru' as const, label: languageNames.ru },
  { key: 'kk' as const, label: languageNames.kk },
];

const translations = {
  en: {
    language: 'Language', english: 'English', russian: 'Russian', kazakh: 'Kazakh',
    back: 'Back', save: 'Save', cancel: 'Cancel', retry: 'Retry', clear: 'Clear', loading: 'Loading…',
    email: 'Email', username: 'Username', password: 'Password', signIn: 'Sign in', signOut: 'Sign out', createAccount: 'Create Account',
    welcome: 'Welcome!', mindfulSelfCare: 'Mindful self-care', enterEmail: 'enter your email here', forgotPassword: 'Forgot Password?', orConnectWith: 'Or Connect With', missingFields: 'Missing fields', signInFailed: 'Sign in failed', createAccountTitle: 'Create account', joinSteps: 'Join SelfMind Pro in a few steps.', chooseUsername: 'choose a username', passwordHint: 'at least 8 characters', checkInput: 'Check input', registrationFailed: 'Registration failed.',
    homeGreetingPrefix: 'Hi,', advice: 'Advice :', startJournalingAdvice: 'Start journaling to receive personalized insights and advice.', needHelp: 'Need immediate help?', crisisResources: 'Open crisis resources and safety support.',
    currentMood: 'Current Mood', noDataYet: 'No data yet', searchHistory: 'Search your history', searchHistorySubtitle: 'Find past journal entries, insights, moods, and saved reflections.', openArchive: 'Open archive', moodAnalytics: 'Mood Analytics', latestInsight: 'Latest Insight', confidence: 'Confidence', recentJournalEntries: 'Recent Journal Entries', startJourney: 'Start your journey', startJourneySub: 'Write your first journal entry to unlock mood insights and personalized advice.',
    aiDiary: 'AI Diary ✨', yourThoughts: 'Your thoughts,', entries: 'entries', noEntriesYet: 'No entries yet', noEntriesSub: 'Tap the + button to write your first journal entry. AI will analyze your mood automatically.', privateEntry: 'Private entry', publicEntry: 'Public entry', mood: 'Mood', title: 'Title', content: 'Content', tags: 'Tags', aiAnalysis: '🧠 AI Analysis', noAnalysis: 'No analysis available.', missingEntryFields: 'Please fill in title and content.', deleteEntry: 'Delete Entry', deleteEntryConfirm: 'Are you sure you want to delete this entry?',
    archiveTitle: 'Archive & Search', archiveSubtitle: 'Find journals, insights, moods, and saved reflections.', searchPlaceholder: 'Search titles, entries, insights, moods, or tags', journals: 'Journals', insights: 'Insights', favorites: 'Favorites', filters: 'Filters', startDate: 'Start YYYY-MM-DD', endDate: 'End YYYY-MM-DD', moodOrEmotion: 'Mood score or emotion', tagsComma: 'Tags, comma separated', favoritesOnly: 'Favorites only', newest: 'newest', oldest: 'oldest', startSearchingArchive: 'Start searching your archive', startSearchingArchiveSub: 'Type a word or change a filter to search private journal entries, insights, moods, and tags.', noFavorites: 'You have not saved any favorites yet', noFavoritesSub: 'Use the star on archive results to save reflections you want to revisit.', noEntriesFound: 'No entries found', tryChangingFilters: 'Try changing your filters', result: 'result', results: 'results', recommendation: 'Recommendation', insight: 'Insight', journal: 'Journal',
    aiQuiz: 'AI Quiz', chooseQuiz: 'Choose a self-reflection quiz', chooseQuizSub: 'Pick the area you want to understand today. Nothing starts until you tap start.', noCompletedQuizzes: 'No completed quizzes yet. Start your first quiz when you feel ready.', startFirstQuiz: 'Start your first quiz', startSelectedQuiz: 'Start selected quiz', availableQuizTypes: 'Available quiz types', quizHistory: 'Quiz history', noQuizHistoryYet: 'No quiz history yet', noQuizHistorySub: 'Complete your first quiz to see score trends, recommendations, and action plans here.', submitQuiz: 'Submit quiz', interpretation: 'Interpretation', trendComparison: 'Trend comparison', recommendations: 'Recommendations', microPractices: 'Micro-practices', personalizedActionPlan: 'Personalized action plan', reflectionPrompt: 'Reflection prompt', suggestedGoal: 'Suggested goal', createThisGoal: 'Create this goal', retakeQuiz: 'Retake quiz', backToQuizLanding: 'Back to quiz landing',
    profile: 'Profile', account: 'Account', memberSince: 'Member since', reflectionTools: 'Reflection tools', archiveSearch: 'Archive & Search', archiveSearchDesc: 'Find past journals, insights, moods, and saved reflections', personalizationPrefs: 'Personalization / AI & Reflection Preferences', aiTone: 'AI tone', reflectionFormat: 'Reflection format', goals: 'Goals', editPersonalization: 'Edit personalization preferences', privacyCenter: 'Privacy Center', openPrivacyCenter: 'Open privacy center', reminders: 'Reminders', allReminders: 'All reminders', dailyJournal: 'Daily journal', moodCheckIn: 'Mood check-in', aiSelfCheck: 'AI self-check', enabled: 'Enabled', paused: 'Paused',
    privacyTitle: 'SelfMind Pro Privacy Center', exportData: 'Export data', exportInsights: 'Export insights archive', deleteAccount: 'Delete account + all data', allowAiInsights: 'Allow AI insights to personalize future support', journalPrivateDefault: 'Journal private by default', anonymousCommunityDefault: 'Anonymous community by default',
  },
  ru: {
    language: 'Язык', english: 'Английский', russian: 'Русский', kazakh: 'Казахский',
    back: 'Назад', save: 'Сохранить', cancel: 'Отмена', retry: 'Повторить', clear: 'Очистить', loading: 'Загрузка…',
    email: 'Эл. почта', username: 'Имя пользователя', password: 'Пароль', signIn: 'Войти', signOut: 'Выйти', createAccount: 'Создать аккаунт',
    welcome: 'Добро пожаловать!', mindfulSelfCare: 'Осознанная забота о себе', enterEmail: 'введите эл. почту', forgotPassword: 'Забыли пароль?', orConnectWith: 'Или войдите через', missingFields: 'Заполните поля', signInFailed: 'Не удалось войти', createAccountTitle: 'Создать аккаунт', joinSteps: 'Присоединяйтесь к SelfMind Pro за несколько шагов.', chooseUsername: 'выберите имя пользователя', passwordHint: 'минимум 8 символов', checkInput: 'Проверьте ввод', registrationFailed: 'Регистрация не удалась.',
    homeGreetingPrefix: 'Привет,', advice: 'Совет :', startJournalingAdvice: 'Начните вести дневник, чтобы получать персональные инсайты и советы.', needHelp: 'Нужна срочная помощь?', crisisResources: 'Откройте ресурсы кризисной поддержки.',
    currentMood: 'Текущее настроение', noDataYet: 'Данных пока нет', searchHistory: 'Поиск по истории', searchHistorySubtitle: 'Найдите записи, инсайты, настроения и сохранённые размышления.', openArchive: 'Открыть архив', moodAnalytics: 'Аналитика настроения', latestInsight: 'Последний инсайт', confidence: 'Уверенность', recentJournalEntries: 'Недавние записи', startJourney: 'Начните путь', startJourneySub: 'Напишите первую запись, чтобы открыть аналитику настроения и советы.',
    aiDiary: 'AI Дневник ✨', yourThoughts: 'Ваши мысли,', entries: 'записей', noEntriesYet: 'Записей пока нет', noEntriesSub: 'Нажмите +, чтобы создать первую запись. AI автоматически проанализирует настроение.', privateEntry: 'Личная запись', publicEntry: 'Публичная запись', mood: 'Настроение', title: 'Заголовок', content: 'Текст', tags: 'Теги', aiAnalysis: '🧠 AI-анализ', noAnalysis: 'Анализ недоступен.', missingEntryFields: 'Заполните заголовок и текст.', deleteEntry: 'Удалить запись', deleteEntryConfirm: 'Вы уверены, что хотите удалить запись?',
    archiveTitle: 'Архив и поиск', archiveSubtitle: 'Ищите дневники, инсайты, настроения и сохранённые размышления.', searchPlaceholder: 'Поиск по заголовкам, записям, инсайтам, настроениям или тегам', journals: 'Дневники', insights: 'Инсайты', favorites: 'Избранное', filters: 'Фильтры', startDate: 'Начало ГГГГ-ММ-ДД', endDate: 'Конец ГГГГ-ММ-ДД', moodOrEmotion: 'Оценка или эмоция', tagsComma: 'Теги через запятую', favoritesOnly: 'Только избранное', newest: 'новые', oldest: 'старые', startSearchingArchive: 'Начните поиск по архиву', startSearchingArchiveSub: 'Введите слово или измените фильтр для поиска по личным записям, инсайтам, настроениям и тегам.', noFavorites: 'У вас пока нет избранного', noFavoritesSub: 'Нажмите звезду у результата, чтобы сохранить размышление.', noEntriesFound: 'Записи не найдены', tryChangingFilters: 'Попробуйте изменить фильтры', result: 'результат', results: 'результатов', recommendation: 'Рекомендация', insight: 'Инсайт', journal: 'Дневник',
    aiQuiz: 'AI Тест', chooseQuiz: 'Выберите тест для саморефлексии', chooseQuizSub: 'Выберите тему. Тест не начнётся, пока вы не нажмёте старт.', noCompletedQuizzes: 'Завершённых тестов пока нет. Начните первый тест, когда будете готовы.', startFirstQuiz: 'Начать первый тест', startSelectedQuiz: 'Начать выбранный тест', availableQuizTypes: 'Доступные тесты', quizHistory: 'История тестов', noQuizHistoryYet: 'Истории тестов пока нет', noQuizHistorySub: 'Завершите первый тест, чтобы увидеть тренды, рекомендации и планы действий.', submitQuiz: 'Отправить тест', interpretation: 'Интерпретация', trendComparison: 'Сравнение тренда', recommendations: 'Рекомендации', microPractices: 'Микро-практики', personalizedActionPlan: 'Персональный план действий', reflectionPrompt: 'Вопрос для размышления', suggestedGoal: 'Предложенная цель', createThisGoal: 'Создать цель', retakeQuiz: 'Пройти снова', backToQuizLanding: 'Назад к тестам',
    profile: 'Профиль', account: 'Аккаунт', memberSince: 'С нами с', reflectionTools: 'Инструменты рефлексии', archiveSearch: 'Архив и поиск', archiveSearchDesc: 'Найдите дневники, инсайты, настроения и сохранённые размышления', personalizationPrefs: 'Персонализация / AI и рефлексия', aiTone: 'Тон AI', reflectionFormat: 'Формат рефлексии', goals: 'Цели', editPersonalization: 'Изменить персонализацию', privacyCenter: 'Центр приватности', openPrivacyCenter: 'Открыть центр приватности', reminders: 'Напоминания', allReminders: 'Все напоминания', dailyJournal: 'Ежедневный дневник', moodCheckIn: 'Проверка настроения', aiSelfCheck: 'AI самопроверка', enabled: 'Включено', paused: 'Пауза',
    privacyTitle: 'Центр приватности SelfMind Pro', exportData: 'Экспорт данных', exportInsights: 'Экспорт архива инсайтов', deleteAccount: 'Удалить аккаунт и данные', allowAiInsights: 'Разрешить AI-инсайты для персонализации', journalPrivateDefault: 'Дневник личный по умолчанию', anonymousCommunityDefault: 'Анонимность в сообществе по умолчанию',
  },
  kk: {
    language: 'Тіл', english: 'Ағылшын', russian: 'Орыс', kazakh: 'Қазақ',
    back: 'Артқа', save: 'Сақтау', cancel: 'Бас тарту', retry: 'Қайталау', clear: 'Тазалау', loading: 'Жүктелуде…',
    email: 'Эл. пошта', username: 'Пайдаланушы аты', password: 'Құпиясөз', signIn: 'Кіру', signOut: 'Шығу', createAccount: 'Аккаунт жасау',
    welcome: 'Қош келдіңіз!', mindfulSelfCare: 'Саналы өз-өзіңе қамқорлық', enterEmail: 'эл. поштаңызды енгізіңіз', forgotPassword: 'Құпиясөзді ұмыттыңыз ба?', orConnectWith: 'Немесе арқылы қосылыңыз', missingFields: 'Өрістер бос', signInFailed: 'Кіру сәтсіз', createAccountTitle: 'Аккаунт жасау', joinSteps: 'SelfMind Pro-ға бірнеше қадамда қосылыңыз.', chooseUsername: 'пайдаланушы атын таңдаңыз', passwordHint: 'кемінде 8 таңба', checkInput: 'Енгізуді тексеріңіз', registrationFailed: 'Тіркелу сәтсіз.',
    homeGreetingPrefix: 'Сәлем,', advice: 'Кеңес :', startJournalingAdvice: 'Жеке инсайттар мен кеңестер алу үшін күнделік жаза бастаңыз.', needHelp: 'Шұғыл көмек керек пе?', crisisResources: 'Дағдарыс қолдауы ресурстарын ашыңыз.',
    currentMood: 'Қазіргі көңіл-күй', noDataYet: 'Әзірге дерек жоқ', searchHistory: 'Тарихтан іздеу', searchHistorySubtitle: 'Бұрынғы жазбаларды, инсайттарды, көңіл-күйді және сақталған ойларды табыңыз.', openArchive: 'Архивті ашу', moodAnalytics: 'Көңіл-күй аналитикасы', latestInsight: 'Соңғы инсайт', confidence: 'Сенімділік', recentJournalEntries: 'Соңғы күнделік жазбалары', startJourney: 'Жолды бастаңыз', startJourneySub: 'Көңіл-күй инсайттары мен жеке кеңестер үшін алғашқы жазбаңызды жазыңыз.',
    aiDiary: 'AI күнделік ✨', yourThoughts: 'Ойларыңыз,', entries: 'жазба', noEntriesYet: 'Әзірге жазба жоқ', noEntriesSub: '+ түймесін басып алғашқы жазбаңызды жазыңыз. AI көңіл-күйіңізді автоматты талдайды.', privateEntry: 'Жеке жазба', publicEntry: 'Ашық жазба', mood: 'Көңіл-күй', title: 'Тақырып', content: 'Мәтін', tags: 'Тегтер', aiAnalysis: '🧠 AI талдау', noAnalysis: 'Талдау жоқ.', missingEntryFields: 'Тақырып пен мәтінді толтырыңыз.', deleteEntry: 'Жазбаны жою', deleteEntryConfirm: 'Бұл жазбаны жойғыңыз келе ме?',
    archiveTitle: 'Архив және іздеу', archiveSubtitle: 'Күнделіктерді, инсайттарды, көңіл-күйді және сақталған ойларды іздеңіз.', searchPlaceholder: 'Тақырып, жазба, инсайт, көңіл-күй немесе тег іздеу', journals: 'Күнделіктер', insights: 'Инсайттар', favorites: 'Таңдаулылар', filters: 'Сүзгілер', startDate: 'Басы ЖЖЖЖ-АА-КК', endDate: 'Соңы ЖЖЖЖ-АА-КК', moodOrEmotion: 'Баға немесе эмоция', tagsComma: 'Тегтер, үтірмен', favoritesOnly: 'Тек таңдаулылар', newest: 'жаңа', oldest: 'ескі', startSearchingArchive: 'Архивтен іздеуді бастаңыз', startSearchingArchiveSub: 'Жеке жазбалар, инсайттар, көңіл-күй және тегтер бойынша іздеу үшін сөз енгізіңіз немесе сүзгіні өзгертіңіз.', noFavorites: 'Әзірге таңдаулылар жоқ', noFavoritesSub: 'Қайта қарағыңыз келген ойды сақтау үшін жұлдызшаны басыңыз.', noEntriesFound: 'Жазбалар табылмады', tryChangingFilters: 'Сүзгілерді өзгертіп көріңіз', result: 'нәтиже', results: 'нәтиже', recommendation: 'Ұсыныс', insight: 'Инсайт', journal: 'Күнделік',
    aiQuiz: 'AI сауалнама', chooseQuiz: 'Өзін-өзі түсінуге арналған сауалнаманы таңдаңыз', chooseQuizSub: 'Бүгін түсінгіңіз келетін бағытты таңдаңыз. Бастау түймесін баспайынша ештеңе басталмайды.', noCompletedQuizzes: 'Әзірге аяқталған сауалнама жоқ. Дайын болғанда алғашқы сауалнаманы бастаңыз.', startFirstQuiz: 'Алғашқы сауалнаманы бастау', startSelectedQuiz: 'Таңдалған сауалнаманы бастау', availableQuizTypes: 'Қолжетімді сауалнамалар', quizHistory: 'Сауалнама тарихы', noQuizHistoryYet: 'Сауалнама тарихы жоқ', noQuizHistorySub: 'Трендтер, ұсыныстар және әрекет жоспарларын көру үшін алғашқы сауалнаманы аяқтаңыз.', submitQuiz: 'Жіберу', interpretation: 'Түсіндірме', trendComparison: 'Тренд салыстыру', recommendations: 'Ұсыныстар', microPractices: 'Микро-тәжірибелер', personalizedActionPlan: 'Жеке әрекет жоспары', reflectionPrompt: 'Ойлануға сұрақ', suggestedGoal: 'Ұсынылған мақсат', createThisGoal: 'Осы мақсатты жасау', retakeQuiz: 'Қайта өту', backToQuizLanding: 'Сауалнамаларға қайту',
    profile: 'Профиль', account: 'Аккаунт', memberSince: 'Қосылған күні', reflectionTools: 'Рефлексия құралдары', archiveSearch: 'Архив және іздеу', archiveSearchDesc: 'Күнделіктер, инсайттар, көңіл-күй және сақталған ойларды табыңыз', personalizationPrefs: 'Жекелендіру / AI және рефлексия', aiTone: 'AI тоны', reflectionFormat: 'Рефлексия форматы', goals: 'Мақсаттар', editPersonalization: 'Жекелендіруді өзгерту', privacyCenter: 'Құпиялылық орталығы', openPrivacyCenter: 'Құпиялылық орталығын ашу', reminders: 'Еске салғыштар', allReminders: 'Барлық еске салғыштар', dailyJournal: 'Күнделікті күнделік', moodCheckIn: 'Көңіл-күйді тексеру', aiSelfCheck: 'AI өзіндік тексеріс', enabled: 'Қосулы', paused: 'Тоқтатылған',
    privacyTitle: 'SelfMind Pro құпиялылық орталығы', exportData: 'Деректерді экспорттау', exportInsights: 'Инсайт архивін экспорттау', deleteAccount: 'Аккаунт пен деректерді жою', allowAiInsights: 'AI инсайттарын жекелендіруге рұқсат ету', journalPrivateDefault: 'Күнделік әдепкіде жеке', anonymousCommunityDefault: 'Қоғамдастықта әдепкіде анонимділік',
  },
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function normalizeLanguage(value: string | null): AppLanguage {
  return value === 'ru' || value === 'kk' ? value : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (!cancelled) {
        setLanguageState(normalizeLanguage(saved));
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
    setLanguageState(next);
  }, []);

  const t = useCallback((key: TranslationKey) => {
    const dictionary = (language === 'ru'
      ? translations.ru
      : language === 'kk'
        ? translations.kk
        : translations.en) as Record<TranslationKey, string>;
    const fallback = translations.en as Record<TranslationKey, string>;
    return dictionary[key] || fallback[key] || key;
  }, [language]);

  const value = useMemo(() => ({ language, ready, setLanguage, t }), [language, ready, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation must be used within LanguageProvider');
  return context;
}
