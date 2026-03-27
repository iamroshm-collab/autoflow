# Copilot Working Guidelines

## Core Rules
- Never break existing functionality. If a change is risky, ask first.
- Always explain what you changed and why.
- Make one category of changes at a time — don't batch unrelated fixes.
- If unsure about intent, ask before assuming.
- Preserve all existing types, interfaces, and contracts unless explicitly told to change them.

## Before Every Task
- Read the relevant files before editing them.
- Check if the file is imported elsewhere before renaming or restructuring.
- Check `package.json` before adding any new dependency.
- Never install a package without confirming it doesn't already exist.

## Code Style
- Follow the existing code style and naming conventions in the file you're editing.
- Don't reformat or reorganize code that isn't related to the task.
- Don't remove comments unless they are clearly outdated.
- Keep components, hooks, and utilities in their existing folder structure.

## TypeScript
- Never use `any` unless it already exists in the codebase.
- Don't weaken existing types to make something work.
- If a type needs to be extended, extend it — don't replace it.

## Git / Safety
- Don't delete files without confirming.
- Don't modify `.env`, `.env.local`, or any environment files.
- Don't touch `next.config.ts` without explaining the change first.
- Don't modify `package.json` or `package-lock.json` without listing exactly what changed.

## Performance Changes
- Validate that a performance fix actually improves things — don't optimize prematurely.
- Prefer small, targeted fixes over large refactors.
- Always check if a hook dependency array change could cause infinite loops.

## Testing
- After any fix, list which parts of the app could be affected and should be manually tested.
- If a test file exists for what you changed, update it.
