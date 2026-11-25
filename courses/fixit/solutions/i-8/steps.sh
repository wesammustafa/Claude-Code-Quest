#!/bin/sh
# i-8 lab: the language server goes on the PATH before its plugin. The code
# intelligence plugin and the recommender are each trialled from their
# /plugin panels at local scope, and the plugin the team chose,
# claude-code-setup, is installed from its panel at project scope: choices in
# Claude Code's panel, which this script can't make. The shared settings that
# install wrote are committed alone, so both trials stay local.
set -eu
npm install -g typescript-language-server typescript@6
command -v typescript-language-server
git add .claude/settings.json
git commit -q -m "Share the Claude Code setup plugin with the team"
