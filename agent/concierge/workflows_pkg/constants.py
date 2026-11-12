"""Verified workspace, calendar, Notion, and Telnyx identifiers for Cato Labs workflows."""

from __future__ import annotations

from mistralai.workflows.plugins.mistralai.connectors import connector

PRIMARY_MODEL = "zai-glm-5-3-flash"

CATO_BRAND = "Cato Labs"
CATO_SITE_URL = "https://catolabs.com"
OWNER_EMAIL = "tim@oubliai.com"
PUBLIC_EMAIL = "hi@cato-labs.com"

# Calendar source of truth: Zoho Calendar (weekdays 09:00–17:00 PT, 45-minute slots)
DISCOVERY_TIMEZONE = "America/Los_Angeles"
DISCOVERY_DURATION_MINUTES = 45
DISCOVERY_START_HOUR = 9
DISCOVERY_END_HOUR = 17

ZOHO_CALUID = "765d77d880ca45f69f3b173610baa6e1"

# Notion data source (collection) IDs in owner's workspace
NOTION_LEADS_DS_ID = "41387450-12a9-80cc-af7f-000bbb9074e0"
NOTION_LEADS_COLLECTION = f"collection://{NOTION_LEADS_DS_ID}"

NOTION_MEETINGS_DS_ID = "41387450-12a9-80a9-98d8-000b2b5f42ba"
NOTION_MEETINGS_COLLECTION = f"collection://{NOTION_MEETINGS_DS_ID}"

NOTION_DOCS_DS_ID = "41387450-12a9-8013-b1de-000ba94865e1"
NOTION_DOCS_COLLECTION = f"collection://{NOTION_DOCS_DS_ID}"

# Telnyx voice & meeting scribe assistant identifiers
TELNYX_FROM_NUMBER = "+17608769757"
HANDOFF_TO_NUMBER = "+13852015802"
TELNYX_CATO_ASSISTANT_ID = "assistant-1c4e9ef4-21dd-477b-846e-17bcbda7f5ce"
TELNYX_CATO_TEXML_APP_ID = "3091249725559538854"

# Connector bindings (OAuth2 user-scoped credentials via on_behalf_of=True on hardened deployments)
zoho_connector = connector("zohomcp_mail_calendar_campaigns_fca1")
gcal_connector = connector("google_calendar")
notion_connector = connector("notion")
telnyx_connector = connector("fastmcp_telnyx_mcp_a353")
