# AGENTS.md

## Limits

Never add limits of any kind unless the owner explicitly asks for them. This includes rate limits, request caps, quotas, throttles, timeouts, truncation, max lengths, item counts and cache size caps.

API parameters such as `max_output_tokens` and `max_steps` on Agent API requests are not limits in this sense. Keep them as the owner set them; do not remove or lower them.
