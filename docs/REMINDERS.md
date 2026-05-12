# Reminders and notification settings

SelfMind Pro stores reminder preferences per user so the mobile app can schedule local notifications or a backend worker can send push notifications later.

## Reminder types

- `journal` — daily journaling reminder.
- `mood_checkin` — mood check-in reminder.
- `ai_quiz` — AI self-check reminder.

## API endpoints

```http
GET /api/v1/reminders/preferences
PATCH /api/v1/reminders/preferences
POST /api/v1/reminders/push-token
GET /api/v1/reminders/due?current_time=20:00
```

All endpoints require a bearer token and operate on the current user only.

## Example preference update

```json
{
  "reminders_enabled": true,
  "journal_enabled": true,
  "journal_time": "20:00",
  "mood_checkin_enabled": true,
  "mood_checkin_time": "09:00",
  "ai_quiz_enabled": false,
  "ai_quiz_time": "18:00",
  "frequency": "daily",
  "timezone": "Asia/Almaty"
}
```

## Push token registration

The mobile app or future notification worker can store a device token:

```json
{
  "push_token": "ExponentPushToken[...]",
  "push_platform": "expo"
}
```

## Future worker flow

A production worker can periodically query users by reminder time/timezone, build notification payloads from the stored settings, and send them through Expo/APNs/FCM. The current implementation provides the persisted settings and a `/due` helper endpoint for testing due reminder logic.
