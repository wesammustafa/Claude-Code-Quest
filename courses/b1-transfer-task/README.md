# The B-1 comparison's transfer task

A one-lesson course, selected explicitly, for the B-1 comparison kit in Questerm (`docs/curriculum-redesign/pilot/comparison/`). Both groups play it after their B-1, on the same build, so it measures what each B-1 taught on a job neither lesson showed: a community choir's concert listing, made with the simulated Claude.

It isn't a lesson. Its Check reads only that the sources are unchanged and that the listing says why it's ready, so it gives no hint about which of Claude's claims are wrong; the kit's scoring key judges the listing and the prompts afterwards.

Claude's draft is right about the date, the hall, the programme, the tickets (£10, under-16s free, up from last year's £8) and the step-free entrance, and wrong about two things: it gives the doors time, 7pm, as the start (the performance is 7:30pm), and it says the hearing loop is available (it is being repaired, to be confirmed by 10 April). A Learner who rejects everything Claude says loses the true claims; one who accepts everything keeps the two wrong ones.

| Path | Holds |
|---|---|
| `course/` | the manifest and the lesson's steps |
| `docs/beginner/` | the task page and its index |
| `practice-template/checks/lessons/` | the Check |
| `practice-template/project/concert/` | the request and the three sources |
| `solutions/b-1/` | one listing that would score full marks |
| `test/`, `tools/` | the task's tests (`node --test courses/b1-transfer-task/test/`) and the Check index script |

Questerm selects it with `QSIM_COURSE=b1-transfer-task`.
