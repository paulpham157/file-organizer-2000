# BYOK / setup UX follow-ups (2026-06-09)

Context: GitHub issue — README advertised in-plugin BYOK (paste OpenAI/Claude/Gemini key) but shipped plugin only exposes cloud license key + Advanced self-host URL. README corrected in this commit.

## Done

- [x] Rewrite README setup section: Cloud vs self-hosted vs Ollama paths
- [x] Clarify license key ≠ provider API key
- [x] Fix SELF-HOSTING.md plugin steps (tab names, remove nonexistent Test Connection button)
- [x] Fix README troubleshooting (no Test Connection button; Debug Mode for logs)

## Open — plugin UX

- [ ] Add **Setup mode** selector on General tab: Cloud | Self-hosted | Local (Ollama)
- [ ] When Self-hosted is selected, surface Server URL on General (not buried in Advanced)
- [ ] Link to SELF-HOSTING.md from in-plugin settings with one-click copy of env var examples
- [ ] De-emphasize or hide "Open Dashboard" / cloud sign-up when user picks self-hosted
- [ ] Onboarding wizard: offer self-hosted path alongside "Skip for now"

## Open — docs

- [ ] Audit notecompanion.ai/docs for same "paste your API key" wording
- [ ] Update Obsidian Community Plugin listing description if it repeats BYOK-in-plugin claim
- [ ] Align `tutorials/faq.md` lifetime "your own OpenAI API key" wording with self-host flow

## Open — product (optional)

- [ ] True in-plugin BYOK: provider picker + API key + model + base URL (feature request)
- [ ] Remove Catalyst gate for Local LLM if BYOK/local is a core promise
- [ ] Add "Test connection" button in Advanced when self-hosting is enabled

## GitHub issue reply

Copy/paste for the issue:

---

Hi — thank you for the detailed report, and sorry for the frustrating experience.

You're correct: the README previously described **"Bring your own keys (paste your API key)"** as an in-plugin option, but the **released Obsidian plugin does not have a screen to paste OpenAI / Claude / Gemini keys**. That README wording was misleading, and we've updated it to match how the product actually works.

**How BYOK works today**

"Bring your own keys" means **self-hosting the Note Companion backend** and configuring provider keys on the **server** (not in Obsidian):

1. Deploy the backend — see [SELF-HOSTING.md](https://github.com/Nexus-JPF/note-companion/blob/master/SELF-HOSTING.md)
2. Set keys in the server `.env` (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MODEL_PROVIDER`, `MODEL_NAME`)
3. In Obsidian: **Settings → Note Companion → Advanced → Enable Self-Hosting** → set your **Server URL**
4. With `ENABLE_USER_MANAGEMENT=false` (default for self-hosting), no cloud account or license is required

The **License Key** field in plugin settings is for **Note Companion Cloud** access only.

**About sign-in / Google**

The in-plugin sign-up uses email/password. If you opened **Open Dashboard** or visited notecompanion.ai, the web app offers Google sign-in via Clerk — that's for the cloud service, not for BYOK setup, and it isn't required for self-hosting.

**What we're doing next**

- README and self-hosting docs are updated to describe the three paths clearly (Cloud / Self-hosted / Local Ollama)
- We're tracking plugin UX improvements (setup mode selector, surfacing self-host config outside Advanced) in our backlog

If you want **in-plugin BYOK without running a backend**, that's a valid feature request — it isn't in the current release. If you're open to self-hosting, the steps above should get you unblocked.

Thanks again for calling this out.

---
