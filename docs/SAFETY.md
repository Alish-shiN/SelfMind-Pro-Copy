# Crisis and safety module

SelfMind Pro includes a lightweight safety layer for emotional support content. It is not a medical or emergency system, but it helps surface crisis signals and gives users immediate-help resources.

## What is flagged

The backend scans user-generated text from:

- journal entries;
- AI chat user messages;
- community posts;
- community comments;
- AI quiz answers.

When crisis keywords are detected, the backend stores a `safety_flags` row with source type, source id, severity, matched signals, and a short content excerpt. Journal entries also pass mood score into the safety check, so mood scores of 1-2 can create a high/crisis flag even when the text does not contain explicit crisis keywords.

## User-facing endpoints

```http
GET /api/v1/safety/resources
POST /api/v1/safety/check
GET /api/v1/safety/flags/me
```

`/safety/resources` returns immediate-help resources such as 988 and emergency services. `/safety/check` can be used by the app to pre-check text. `/safety/flags/me` lets a user see their own flagged safety events.

## Mobile behavior

The mobile Home screen exposes a “Need immediate help?” card. The Safety screen shows emergency resources, a short grounding plan, and a simple safety text check. When a journal entry has mood 1-2 or the text check returns high/crisis severity, the app prompts the user to open safety resources immediately after saving.

## Future production work

- Add country-specific hotlines based on user locale.
- Notify moderators/admins about open crisis-level flags.
- Add trusted-person contact configuration.
- Add a worker/webhook pipeline for urgent flags.
- Avoid using keyword detection as diagnosis; keep it as a conservative safety signal only.
