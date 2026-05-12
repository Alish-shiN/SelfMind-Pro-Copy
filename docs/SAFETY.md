# Crisis and safety module

SelfMind Pro includes a lightweight safety layer for emotional support content. It is not a medical or emergency system, but it helps surface crisis signals and gives users immediate-help resources.

## What is flagged

The backend scans user-generated text from:

- journal entries;
- AI chat user messages;
- community posts;
- community comments;
- AI quiz answers.

When crisis keywords are detected, the backend stores a `safety_flags` row with source type, source id, severity, matched signals, and a short content excerpt.

## User-facing endpoints

```http
GET /api/v1/safety/resources
POST /api/v1/safety/check
GET /api/v1/safety/flags/me
```

`/safety/resources` returns immediate-help resources such as 988 and emergency services. `/safety/check` can be used by the app to pre-check text. `/safety/flags/me` lets a user see their own flagged safety events.

## Mobile behavior

The mobile Home screen exposes a “Need immediate help?” card. The Safety screen shows emergency resources and a simple safety text check.

## Future production work

- Add country-specific hotlines based on user locale.
- Notify moderators/admins about open crisis-level flags.
- Add trusted-person contact configuration.
- Add a worker/webhook pipeline for urgent flags.
- Avoid using keyword detection as diagnosis; keep it as a conservative safety signal only.
