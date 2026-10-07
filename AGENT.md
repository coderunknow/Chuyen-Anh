# AGENT.md

## Workflow for every task

1. Before acting, check for and read the entire root `DESIGN_LOG.md`. Treat it as project memory, not unquestionable truth: verify the relevant details against the current files, tests, and workflows.
2. If `DESIGN_LOG.md` is missing, create it with only the user's explicit intent and mark unknowns as unspecified. Tell the user it was created.
3. The current user request overrides older intent, but do not silently resolve a conflict between the log and the repository. Re-check first; if the conflict changes the work, explain it and ask before proceeding on that part.
4. Capture new user decisions accurately. After the task, append a dated, sequential, typed entry to `DESIGN_LOG.md` describing only what was decided, changed, and verified. Preserve user wording where practical; never rewrite or reorder earlier entries. State what was not tested.

## Project context

- The flashcard app's only runtime/deployment file is `index.html`. It contains the markup, styles, JavaScript module, and embedded vocabulary JSON; there is no app API or external data fetch. Learning progress and preferences use browser `localStorage`.
- Vocabulary sync is a deliberate pipeline: edit the fixed-schema table in `Learned_Vocabulary_List.md` → `python scripts/build_vocabulary.py` → `data/vocabulary.json` → `python scripts/embed_vocabulary.py` → `index.html`. The build script preserves existing app-only metadata by ID. Keep JSON and the embedded HTML data block synchronized.
- Do not infer missing vocabulary facts. Unknown text cells are blank; unknown list-valued cells use `[]`. The parser/schema rules are in `scripts/learned_vocabulary.py` and `README.md`.
- The repository also contains exam archives and source-processing workflows under `De-chuyen-Anh-vao-10/`, `scripts/exams/`, and `.github/workflows/exam-*.yml`; these are separate from the flashcard deployment.

## Data edits and checks

After editing `Learned_Vocabulary_List.md`, regenerate the app data and embedded HTML, then validate:

```bash
python scripts/build_vocabulary.py
python scripts/embed_vocabulary.py
python scripts/validate_vocab.py
```

For read-only synchronization checks and tests, run:

```bash
python scripts/build_vocabulary.py --check
python scripts/validate_vocab.py
python scripts/embed_vocabulary.py --check
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/static-app.test.js
```

`node` is used by CI for app-logic tests; production has no frontend bundler or npm build. `.github/workflows/deploy.yml` validates the synchronized data and publishes only `index.html` to GitHub Pages. Consult `README.md` and the relevant workflow before changing these steps.
