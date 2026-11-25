# Fix-It Beginner pilot

A second course, selected explicitly, beside the guide's own: the Beginner level's six lessons (b-1, b-2, b-6, b-4, b-5 and the capstone) built around the Millbrook Fixers' repair workshop, for learners with no terminal, Git or programming background. The guide's default course in `course/` is unchanged and stays the default.

The folder mirrors the guide's own layout:

| Path | Holds |
|---|---|
| `course/manifest.json`, `course/steps/` | the lessons, as `course/` holds the default course's |
| `docs/beginner/` | the lesson pages and the level index |
| `practice-template/checks/lessons/` | each lesson's Check, beside the guide's shared check modules (`../command.mjs`, `../repo.mjs`) |
| `practice-template/project/` | the files every pilot lesson starts with |
| `practice-template/lessons/<id>/project/` | the files only that lesson starts with, so no lesson ships another's answer |
| `solutions/<id>/` | the author's solution, never in a learner's starting files |
| `test/`, `tools/` | the pilot's own tests (`node --test courses/fixit/test/`), among them the checks of its sequence (`sequence.test.mjs`); the script that writes its Check index (`node courses/fixit/tools/index.mjs`); and the guide's shared course rules run on this course (`node courses/fixit/tools/course-rules.mjs`), which skip the rules written for the developer course alone |

Questerm selects it with `QSIM_COURSE=fixit`, which assembles a guide tree with this course in place of the default one. The Local app (`npm run learn`) does not run it: it still reads `course/`.
