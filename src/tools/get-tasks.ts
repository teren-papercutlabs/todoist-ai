import type { TodoistApi } from '@doist/todoist-api-typescript'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TodoistTool } from '../todoist-tool.js'
import { ToolNames } from '../utils/tool-names.js'

const REST_BASE_URL = 'https://api.todoist.com/rest/v2'

const ArgsSchema = {
    taskIds: z
        .array(z.string().min(1))
        .min(1)
        .describe('One or more Todoist task IDs to retrieve.'),
}

type GetTasksArgs = z.infer<z.ZodObject<typeof ArgsSchema>>

type RestTask = {
    id: string
    content: string
    description?: string | null
    due?: {
        date?: string | null
        string?: string | null
        timezone?: string | null
        is_recurring?: boolean
    } | null
    project_id?: string | null
    section_id?: string | null
    parent_id?: string | null
    labels?: string[]
    priority?: number
    [key: string]: unknown
}

type TaskError = {
    taskId: string
    status?: number
    message: string
}

async function fetchTask(taskId: string, apiKey: string): Promise<{ task?: RestTask; error?: TaskError }> {
    const url = `${REST_BASE_URL}/tasks/${taskId}`
    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
            },
        })

        if (response.status === 404) {
            return { error: { taskId, status: 404, message: 'Task not found' } }
        }

        if (!response.ok) {
            const body = await response.text()
            return {
                error: {
                    taskId,
                    status: response.status,
                    message: body || response.statusText,
                },
            }
        }

        const task = (await response.json()) as RestTask
        return { task }
    } catch (error) {
        return {
            error: {
                taskId,
                message: error instanceof Error ? error.message : 'Unknown error',
            },
        }
    }
}

const getTasks = {
    name: ToolNames.GET_TASKS,
    description: 'Retrieve full Todoist task details by task ID.',
    parameters: ArgsSchema,
    async execute(args: GetTasksArgs, _client: TodoistApi) {
        const { taskIds } = args
        const apiKey = process.env.TODOIST_API_KEY

        if (!apiKey) {
            throw new Error('TODOIST_API_KEY environment variable is required to fetch tasks.')
        }

        const authToken = apiKey as string

        const results = await Promise.all(taskIds.map((taskId) => fetchTask(taskId, authToken)))

        const tasks: RestTask[] = []
        const errors: TaskError[] = []

        results.forEach((result, index) => {
            const requestedId = taskIds[index]!
            if (result.task) {
                tasks.push(result.task)
            } else if (result.error) {
                errors.push(result.error)
            } else {
                errors.push({
                    taskId: requestedId,
                    message: 'Unknown error',
                })
            }
        })

        const output = { tasks, errors }

        return getToolOutput({
            textContent: JSON.stringify(output, null, 2),
            structuredContent: output,
        })
    },
} satisfies TodoistTool<typeof ArgsSchema>

export { getTasks }
