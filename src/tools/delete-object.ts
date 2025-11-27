import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TodoistTool } from '../todoist-tool.js'
import { formatNextSteps } from '../utils/response-builders.js'
import { ToolNames } from '../utils/tool-names.js'

const {
    FIND_PROJECTS,
    GET_OVERVIEW,
    FIND_SECTIONS,
    FIND_TASKS,
    FIND_TASKS_BY_DATE,
    FIND_COMMENTS,
} = ToolNames

const ArgsSchema = {
    type: z
        .enum(['project', 'section', 'task', 'comment'])
        .describe('The type of entity to delete.'),
    id: z.string().min(1).describe('The ID of the entity to delete.'),
}

const deleteObject = {
    name: ToolNames.DELETE_OBJECT,
    description: 'Delete a project, section, task, or comment by its ID.',
    parameters: ArgsSchema,
    async execute(args, _client) {
        // WORKAROUND: Use direct REST API to avoid SDK bugs
        const deleteViaAPI = async (type: string, id: string) => {
            let endpoint = ''
            switch (type) {
                case 'project':
                    endpoint = `https://api.todoist.com/rest/v2/projects/${id}`
                    break
                case 'section':
                    endpoint = `https://api.todoist.com/rest/v2/sections/${id}`
                    break
                case 'task':
                    endpoint = `https://api.todoist.com/rest/v2/tasks/${id}`
                    break
                case 'comment':
                    endpoint = `https://api.todoist.com/rest/v2/comments/${id}`
                    break
            }

            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${process.env.TODOIST_API_KEY}`,
                },
            })

            if (!response.ok && response.status !== 204) {
                throw new Error(`Todoist API error: ${response.status} ${response.statusText}`)
            }
        }

        await deleteViaAPI(args.type, args.id)

        const textContent = generateTextContent({
            type: args.type,
            id: args.id,
        })

        return getToolOutput({
            textContent,
            structuredContent: {
                deletedEntity: {
                    type: args.type,
                    id: args.id,
                },
                success: true,
            },
        })
    },
} satisfies TodoistTool<typeof ArgsSchema>

function generateTextContent({
    type,
    id,
}: {
    type: 'project' | 'section' | 'task' | 'comment'
    id: string
}): string {
    const summary = `Deleted ${type}: id=${id}`

    // Recovery-focused next steps based on what was deleted
    const nextSteps: string[] = []

    switch (type) {
        case 'project':
            // Help user understand impact and navigate remaining work
            nextSteps.push(`Use ${FIND_PROJECTS} to see remaining projects`)
            nextSteps.push('Note: All tasks and sections in this project were also deleted')
            nextSteps.push(`Use ${GET_OVERVIEW} to review your updated project structure`)
            break

        case 'section':
            // Guide user to reorganize remaining sections and tasks
            nextSteps.push(`Use ${FIND_SECTIONS} to see remaining sections in the project`)
            nextSteps.push('Note: Tasks in this section were also deleted')
            nextSteps.push(`Use ${FIND_TASKS} with projectId to see unorganized tasks`)
            break

        case 'task':
            // Help user stay focused on remaining work
            nextSteps.push(`Use ${FIND_TASKS_BY_DATE} to see remaining tasks for today`)
            nextSteps.push(`Use ${GET_OVERVIEW} to check if this affects any dependent tasks`)
            nextSteps.push('Note: Any subtasks of this task were also deleted')
            break

        case 'comment':
            // Help user understand comment deletion impact
            nextSteps.push(`Use ${FIND_COMMENTS} to see remaining comments on the task/project`)
            nextSteps.push('Note: Comment attachments were also deleted')
            break
    }

    const next = formatNextSteps(nextSteps)
    return `${summary}\n${next}`
}

export { deleteObject }
