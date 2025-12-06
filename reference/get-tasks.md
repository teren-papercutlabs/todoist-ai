# get-tasks

Retrieve full Todoist task objects by ID using the REST v2 API.

## Usage

```bash
todoist get-tasks '{"taskIds": ["1234567890"]}'
```

## Input

- `taskIds` (array, required): One or more task IDs to fetch.

## Output

- JSON object with:
  - `tasks`: Array of raw Todoist REST task objects (includes `content`, `description`, `due`, `priority`, `labels`, `project_id`, `parent_id`, etc.).
  - `errors`: Array of per-task errors with `taskId`, `status` (when available), and `message`.

The CLI prints a pretty-printed JSON block that keeps the `description` field visible.

## Error Handling

- Missing tasks return an entry in `errors` with status `404` instead of failing the whole command.
- Other HTTP errors are reported per task; successful IDs still return in `tasks`.
