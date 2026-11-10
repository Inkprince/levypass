# CLAUDE.md

The project rules live in AGENTS.md so every coding agent reads the same file.

@AGENTS.md

## Claude Code notes

- Start each session by reading `tasks/todo.md` and running `git status`. Work the next unchecked task.
- `docs/forge-platform-guide.pdf` is 13 pages of images. Use `docs/forge-platform.md` instead and
  open the PDF only to settle a doubt.
- Load only the PRD section a task cites, not the whole file.
- The bank and Huawei APIs cannot be reached from this machine. To try a real call, use the
  throwaway curl pod in `docs/forge-platform.md`. Do not print `GATEWAY_KEY` into the transcript.
- When a task is done, tick it in `tasks/todo.md` and add one line on how it was verified.
