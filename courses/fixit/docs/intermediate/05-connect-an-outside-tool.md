# Connect an outside tool when it earns its place

<sub>**Intermediate** · Lesson 5 of 5 · about 25 minutes · Needs: [Bring in a second reviewer](04-bring-in-a-second-reviewer.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-24, pilot not yet re-run in a real session</sub>

## Goal

By the end of this lesson you can decide whether a connection earns its place over a saved file, read what a server can do before you connect it, add it at the right scope with a pinned version, allow only what you need, use it, and handle it being down without guessing.

## The job

> **Dee (library events desk):** Your guide is only as current as the booking PDF you saved. We move groups between rooms at short notice and update the booking system, and nobody remembers to email you. Our system has a connector for assistants. Want to use it?

You can see the March booking you've been relying on in `march/`. A room change that never reaches the guide sends people to the wrong floor. And a connection that can also *cancel* bookings is a risk the group never needed to take.

This lesson starts with the reference kit as it stands after Lesson 4: `fixit/CLAUDE.md`, the public-pages rule, the attendee-guide skill with its reviewer step, the shared settings and the number guard, and the guide-reviewer agent. There's no `.mcp.json` yet. Your own version stays in Lesson 4.

## You need

- In Questerm: nothing. **`bookings` is a simulated server**: it answers from fixed records in your browser, and nothing is sent anywhere. Claude's replies are written in advance. The files it writes, `.mcp.json` and the settings, are real, and the settings decide what Claude may call.
- On your own computer: Claude Code, Node.js for `npx`, and a server you trust. You'd connect to a real system the same way.

## The idea

An MCP server is a program that gives Claude extra tools: here, tools that read the library's booking system. Claude Code starts it, lists its tools in every session, and Claude calls them like its own.

So first, a question: when does connecting Claude to the library's booking system beat saving the booking PDF in the month's folder? Always is too much: a connection is more access, one more thing that can be down, and tool descriptions that cost context in every session. For a one-off event a saved file is simpler. Never is too little: the PDF was true when it was signed, and if the library moves you, it still says Room B. It earns its place when the fact can change after you saved the file, and you make the guide again and again.

## Worked example

1. **Read what the server can do before you connect it.** The library's connector is the npm package `fixers-bookings-mcp`, and version 1.4.2 is the one the library's IT team tested with assistants:

   | Tool | What it does | Changes anything? |
   |---|---|---|
   | `list_bookings` | a venue's bookings between two dates | no |
   | `get_booking` | one booking: room, date, hours, limit, access, last updated | no |
   | `cancel_booking` | cancels a booking by its reference | **yes** |

   Started with `--read-only`, it doesn't offer `cancel_booking`.

   **Who checks servers?** Anthropic doesn't audit or manage MCP servers. Before you connect one, know who publishes it, what its tools can do and what it can see. A server's tool descriptions and results are text Claude reads, so a compromised server could try to steer Claude.

   Then work in `fixit/`, where the kit lives: `cd fixit`.
2. **Add it for the whole project, pinned.** It's a program you run, so type it in the terminal, before you start Claude:

   ```bash
   claude mcp add --scope project bookings -- npx -y fixers-bookings-mcp@1.4.2 --read-only
   ```

   This writes `fixit/.mcp.json`. Open it in the files tab: one server, `bookings`, with the pinned package and `--read-only` in its `args`. **Project** scope means the file is part of the kit, so Sam's sessions get the same server. **Local** scope, the default, would be only you, only here. Pinning `@1.4.2` means everyone runs the version that was reviewed.

   Start Claude in `fixit/` with `claude`. Because the server came from a project file, Claude Code asks before using it. You've read what it runs, so choose to use it. Then type `/mcp`: `bookings` is connected, with two tools, `get_booking` and `list_bookings`.
3. **Use it, and compare with what you had.** Ask: `Look up the March booking with the bookings server and compare it with the signed booking in march/.`

   Claude calls the server's tools like its own. This session is in auto mode, so a lookup like this runs without asking you: read the call in the transcript, the tool and the reference it sends. `get_booking` returns Room B, Saturday 13 March 2027, 10:00 to 13:30, a limit of 40 including organisers, and an access status updated on 2 March: the lift is not yet confirmed. It matches the signed booking on room, date, hours and limit, and adds one thing the PDF doesn't have: the library's own current status, which supports the guide's "being confirmed" line.

## Your turn

1. **Allow only what the job needs.** `--read-only` hides `cancel_booking` today. A later version, or someone removing the flag, could bring it back. In your own words, have Claude change the shared settings so the two reading tools run without asking, and `cancel_booking` is denied outright. Leaving the reading tools to ask each time is fine too: more prompts, the same safety. Allowing `mcp__bookings__*` is not: it covers every tool the server offers, now or later.
2. **A new version appears.** A volunteer changes `.mcp.json` to `fixers-bookings-mcp@latest` to get the bug fixes, and the next session asks you to approve the changed server. Do you approve it? Same name, different code: `@latest` changes under you with nobody reviewing it. And the deny rule covers only the tool you know about. Approving is reviewing: pin the version you reviewed.
3. **The connection is down.** It's Thursday morning. Maya needs March's guide re-checked today, and the bookings server isn't responding: from this step on, `/mcp` shows it as failed. Run `/attendee-guide march` and decide what goes to Maya. Claude says it couldn't re-check the live booking, makes the guide from the files only, and adds an open item to `march/facts.md`. Ask it to use whatever it has, and it still won't fill in the room or access from the flyer, the least reliable source for both. Send the guide, with one line saying what you couldn't re-check.
4. **Put the connection in the procedure.** Have Claude change the skill's first step: if the `bookings` connection is available, look up the session's booking and treat it as the venue's current record; if not, say so, carry on from the files, and add an open item. Then add a line to `KIT.md` on what the connection does and what happens when it's down.

## Check

The Lesson's check reads four things:

- `fixit/.mcp.json` adds the `bookings` server at an exact version of `fixers-bookings-mcp`, started with `--read-only`
- `fixit/.claude/settings.json` denies `mcp__bookings__cancel_booking`, and no rule allows every bookings tool
- the attendee-guide skill looks the booking up through the `bookings` connection before it builds the fact table, and says what to do when the connection is down: carry on from the files and say so, never from a flyer
- `fixit/march/facts.md` has an open item saying the live booking wasn't re-checked, and the March guide keeps the booking's values

The check reads your files, not a record of the calls Claude made: that it called `get_booking` and never tried `cancel_booking` is yours to say.

What only you can judge: whether the connection earns its place for *your* group. It added the library's 2 March lift status. It costs one more server, two tools' descriptions in every session, and one more thing that can be down. Would you keep it for a group that meets once a year?

## On your own computer

Real servers run real code with your permissions. Connect only ones you trust.

1. `claude mcp add --scope project <name> -- <command and args>` writes `.mcp.json`. `--scope local`, the default, keeps it to you, in this project; `--scope user` makes it yours in every project. When names clash, local beats project, and project beats user.
2. `/mcp` shows each server, its status and its tools, and lets you sign in to servers that need it.
3. A project server asks for approval the first time, so a folder someone sends you can't approve its own servers.
4. Many services also have a command-line tool. If one exists, it's often the simpler way in.
5. In the Desktop app, connectors are managed in its settings. Connectors you add in claude.ai are available in Claude Code when you sign in with your claude.ai account.

See [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp), [Configure permissions](https://code.claude.com/docs/en/permissions) and [Security](https://code.claude.com/docs/en/security).

## Technical detail

| Item | What it does | How to verify | Failure case |
|---|---|---|---|
| `.mcp.json` (project scope) | the project's shared server list | `/mcp` lists the server and where it came from | an unpinned package changes under you ([MCP](https://code.claude.com/docs/en/mcp)) |
| Server approval | a project server's first use needs your approval | the question appears at the next start | approving without reading what it runs |
| `mcp__<server>__<tool>` rules | allow, ask or deny one tool of one server | `/permissions` | `mcp__<server>__*` in allow covers future tools too ([Permissions](https://code.claude.com/docs/en/permissions)) |
| Context cost | connected servers add their tool names and descriptions to every session, even unused; tool search defers the full schemas | `/context` | many servers dilute attention |
| Trust | Anthropic doesn't security-audit or manage any MCP server; a tool's results can carry instructions | review the publisher and the tools | a local server runs outside the sandbox with your permissions ([Security](https://code.claude.com/docs/en/security)) |
| Unavailable server | `/mcp` shows it as failed, and Claude can't call its tools | try a call | a reply that pretends the call worked |

In Questerm, `bookings` is simulated: `claude mcp add` writes the real `.mcp.json`, the approval and the settings rules work as Claude Code's do, and the server's answers come from fixed records in your browser. In Your turn step 3 the Lesson switches the server off, so `/mcp` shows it as failed and its calls fail.

In the Desktop app, connectors are managed in its settings. In claude.ai, connectors are turned on per account or organisation, and per chat. The same three questions apply everywhere: who publishes it, what can its tools change, and what do you do when it's down.
