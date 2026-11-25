#!/bin/sh
# a-5 lab, in the website's folder, project/, of a new copy whose origin is
# on GitHub: Claude writes the manual link-check workflow at the
# repository's root, where GitHub reads it; it runs once without the secret
# and fails, then green with it. Claude writes the review workflow on a
# branch, which carries the team's skill and the July page; the review fails
# until the skill is on main, then names the July page's step-free claim,
# which Claude fixes on the branch before the merge. Both workflows and the
# secret are torn down. The runs are GitHub's: the check asks for them.
set -eu
mkdir -p ../.github/workflows
cp "$SOLUTION/.github/workflows/linkcheck-report.yml" ../.github/workflows/linkcheck-report.yml
git add ../.github/workflows/linkcheck-report.yml
git commit -m "Report broken links on the sample pages, on demand"
git push
gh workflow run linkcheck-report.yml
gh run watch 1
echo not-a-real-key | gh secret set ANTHROPIC_API_KEY
gh workflow run linkcheck-report.yml
gh run watch 2
git switch -c july-page
cp "$SOLUTION/.github/workflows/claude-review.yml" ../.github/workflows/claude-review.yml
mkdir -p ../.claude/skills/team-review
cp practice/a-5/team-review/SKILL.md ../.claude/skills/team-review/SKILL.md
git add ../.github/workflows/claude-review.yml ../.claude/skills/team-review/SKILL.md
git commit -m "Review every pull request with the team review skill"
git apply practice/a-5/add-july-page.patch
git add samples/july.md
git commit -m "Add the July session's page"
git push -u origin july-page
gh pr create --fill
gh run watch 3
git switch main
mkdir -p ../.claude/skills/team-review
cp practice/a-5/team-review/SKILL.md ../.claude/skills/team-review/SKILL.md
git add ../.claude/skills/team-review/SKILL.md
git commit -m "Add the team review skill"
git push
git switch july-page
git merge --no-edit main
git push
gh run watch 4
cp "$SOLUTION/samples/july.md" samples/july.md
git commit -am "Say Room B is upstairs, not step-free by lift"
git push
gh run watch 5
gh pr merge 1 --merge
git switch main
git pull
git rm ../.github/workflows/linkcheck-report.yml ../.github/workflows/claude-review.yml
git commit -m "Remove the Claude workflows"
git push
gh secret delete ANTHROPIC_API_KEY
