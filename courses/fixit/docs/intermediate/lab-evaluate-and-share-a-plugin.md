# Evaluate, trial and share a plugin

<sub>**Intermediate** · Optional lab · about 25 minutes · Needs: [Intermediate index](README.md) · Verified against Claude Code v2.1.325 (stable) documentation on 2026-11-25, pilot not yet re-run in a real session</sub>

**Optional engineering lab.** This is the engineering side of Intermediate lesson 5, Connect an outside tool when it earns its place, where you decide whether a connection earns its access. Here you make the same decision about a plugin: what it installs, who loads it, and whether the team should share it. No core lesson or capstone depends on it, so you can skip it. It asks you to read a function's references and a settings file, and explains each one as you meet it.

## Goal

By the end of this lab you can judge a plugin from what it installs before you install it, trial a plugin for this repository only, use code intelligence to see a change's reach before you make it, and share only the plugin the team chose.

## The job

> **Ade:** I'm about to change how the checker decides a link is external. Before I touch `isExternal`, I want to know everything that calls it. People keep saying install a code intelligence plugin, but I don't want ten plugins loaded into every session.

The Millbrook Fixers keep their public pages in a small website repository: your `project/` folder. Its link checker runs on the pages before Maya posts them: `npm run linkcheck -- <folder>` checks a folder, the code is in `src/` and its tests are in `test/`. `src/links.js` holds `isExternal`, which decides that a link leaves the site, and `.claude/settings.json` holds the team's shared settings. This lab starts from its own copy of the repository, so your files from earlier lessons don't carry over.

## You need

- In Questerm, nothing to install: the website repository, Git, Node.js and npm are in the practice workspace.
- On your own computer: Claude Code, Git, Node.js and npm. See [On your own computer](#on-your-own-computer).

## The idea

A plugin bundles parts for Claude Code: skills, commands, agents, hooks, MCP servers or a language server setting. Each part you install loads into every session where the plugin is on, and a plugin you install can run code with your permissions. So read what a plugin installs before you install it.

Where you install it decides who gets it. Each place is a scope:

| Scope | Who gets it | Where Claude Code records it |
|---|---|---|
| user | you, in every project | `~/.claude/settings.json` |
| project | everyone on this repository | `.claude/settings.json`, which you commit |
| local | you, in this repository only | `.claude/settings.local.json`, which Git ignores |

A trial belongs at local scope. Share a plugin at project scope only once the team has chosen it, and share the smallest thing that does the job. Project scope commits the setting that turns the plugin on; each teammate still installs it.

A code intelligence plugin gives Claude a language server, a program that knows your code's structure. It finds where a function is defined and every place that calls it. A text search finds the word, not the callers.

In Questerm, Claude's words are written in advance, and the plugins come from a pinned copy of Anthropic's official marketplace. The language server's answers are computed from your own copy of the code.

## Worked example

1. **Decide first, then install the language server.** A plugin's panel lists a skill, an agent, two hooks and an MCP server. Your team needs only the skill. Decide what you do. In the terminal, install the language server first: a code intelligence plugin says which command starts it, but doesn't include it.

   ```bash
   npm install -g typescript-language-server typescript@6
   ```

   TypeScript stays pinned at version 6, as this course tested it. Check that the terminal finds it:

   ```bash
   command -v typescript-language-server
   ```

   It prints the path of the program. Nothing printed means it isn't on your PATH.
2. **Read the panel, then trial it locally.** Start a session in the `project/` folder:

   ```bash
   claude
   ```

   Claude Code asks whether you trust this folder: it's your practice copy, so read the dialog and accept it. Open the code intelligence plugin's install panel, and don't choose a row yet:

   ```text
   /plugin install typescript-lsp@claude-plugins-official
   ```

   Read **Will install** before you choose: it lists what the plugin adds to your sessions. A plugin you install can run code with your permissions, so read what it installs first. Decide what this one adds. In the panel, choose the row that installs it for you, in this repository only: local scope. Its label ends in (local scope). A local trial lets you judge the plugin before anyone else loads it. Then turn it on in this session:

   ```text
   /reload-plugins --force
   ```

   Claude Code waits for `--force` here, since the new `LSP` tool would cost one request without the prompt cache.
3. **See where the trial lives.** In the shell tab, run `git status --short`: it lists nothing, because Git ignores your local settings. Claude Code keeps `.claude/settings.local.json` at the repository root, the folder above `project/`, and keeps it out of Git. A trial in your local settings never reaches a teammate's machine.

## Your turn

1. **Find every caller before you change anything.** In your own words, ask Claude to use code intelligence to find where `isExternal` in `src/links.js` is defined and every place that calls it, or any function you plan to change. Say what you plan to change, and that nothing should be edited yet. A text search finds the word, not the callers. Then read the references Claude lists: which file does Ade's fix reach?
2. **Trial the recommender the same way.** Trial `claude-code-setup@claude-plugins-official` the same way: read its panel, then install it for you, in this repository only. Its one skill reads the repository and recommends automations; it changes nothing. Start a new session, so it loads the plugin's skill: type `/exit` to leave Claude, then `claude` to start it again.
3. **Ask what the repository is missing.** Ask Claude to recommend Claude Code automations for this repository, without building any:

   ```text
   Recommend Claude Code automations for this repository, but don't set any up.
   ```

   Claude says what the repository already covers and what it lacks, and names the plugins the team could share.
4. **Share only what you chose.** Choose the one the team shares now. Read the panel for the plugin you chose, then install it for everyone on this repository: project scope. You can do it from the shell tab too:

   ```bash
   claude plugin install claude-code-setup@claude-plugins-official --scope project
   ```

   Use the name of the plugin you chose. In the shell tab, commit `.claude/settings.json` alone: your two trials stay in your local settings.

## Check

The lab's check reads three things:

- the committed `.claude/settings.json` turns on one plugin the team chose, `claude-code-setup` or `commit-commands`, and keeps its earlier settings
- that plugin is installed at project scope for this repository, with its files in the plugin cache
- a code intelligence plugin is on at local scope here, installed for this repository, and stays out of the shared settings

The check reads Claude Code's own records: the settings of each scope, and what it installed where. No list you write counts.

What the check can't see: which plugin you picked at Your turn step 4. It accepts either one, and only one; that Step checks your pick before you commit.

What only you can judge: could you tell Ade in one sentence why the team shares this plugin and not the other?

## Try it elsewhere

- **Software:** before you rename a function in your own project, ask for its references through code intelligence, and compare them with a text search for its name.
- **Workplace:** your team wants a browser extension that does everything. List what it reads and changes before anyone installs it, and trial it on one browser profile first.
- **Student:** a note-taking app's add-on wants access to all your notebooks. Which one notebook do you try it on first?

## On your own computer

Install the language server for your language first; the plugin's page says which. Then open `/plugin` and install at local scope first. `claude plugin list` shows what is installed and where; add `--json` for a list a script can read. Project scope commits the setting that turns a plugin on; each teammate still installs it.

The official marketplace is registered when Claude Code starts. If `/plugin install` says the marketplace isn't found, add it with `/plugin marketplace add anthropics/claude-plugins-official`. Community marketplaces aren't reviewed the way the official one is: read a plugin's parts before you install it.

## Technical detail

| Command | What it does | Verify | Failure case | Reference |
|---|---|---|---|---|
| `/plugin install <plugin>@<marketplace>` | shows what a plugin installs, then installs it at the scope you choose | `/plugin` lists it with its scope | a server the plugin starts that isn't on your PATH is listed under Errors | [Plugins](https://code.claude.com/docs/en/plugins/overview) |
| `claude plugin install <plugin>@<marketplace> --scope project` | installs it and turns it on in `.claude/settings.json` | `claude plugin list` | turning it on doesn't download it: each teammate installs it | [Plugin reference](https://code.claude.com/docs/en/plugins/cli-reference) |
| `/reload-plugins --force` | loads a new plugin's parts into the session | the `LSP` tool answers | without `--force`, a plugin that adds a tool stays pending | [Plugin reference](https://code.claude.com/docs/en/plugins/cli-reference) |
| The plugin's risk | "a plugin you install can run code with your user privileges" | read its parts first | community marketplaces aren't reviewed like the official one | [Plugins](https://code.claude.com/docs/en/plugins/overview) |

## Go further

- [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence): language choices, server setup and troubleshooting.
