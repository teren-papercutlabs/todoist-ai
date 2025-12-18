#!/usr/bin/env node
import { TodoistApi } from '@doist/todoist-api-typescript'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { z } from 'zod'
// biome-ignore lint/performance/noNamespaceImport: tool mapping requires namespace import
import * as tools from './index.js'

// Type definitions
interface McpContentItem {
    type: string
    text?: string
}

interface McpResult {
    content?: McpContentItem[]
}

interface Tool {
    description: string
    parameters: Record<string, z.ZodTypeAny>
    // biome-ignore lint/suspicious/noExplicitAny: tools have varying typed args
    execute: (args: any, client: TodoistApi) => Promise<McpResult>
}

/**
 * Get Todoist API key from token store
 * Token location: ~/.config/claude-assistant/tokens/{user}/todoist.json
 */
function getTodoistApiKey(): string | null {
    const username = process.env.CLAUDE_ASSISTANT_USER || 'teren'
    const tokenPath = join(
        homedir(),
        '.config',
        'claude-assistant',
        'tokens',
        username,
        'todoist.json',
    )

    if (!existsSync(tokenPath)) {
        return null
    }

    try {
        const tokenData = JSON.parse(readFileSync(tokenPath, 'utf-8'))
        return tokenData.access_token || null
    } catch {
        return null
    }
}

const TODOIST_API_KEY = getTodoistApiKey()
const TODOIST_BASE_URL = process.env.TODOIST_BASE_URL

if (!TODOIST_API_KEY) {
    const username = process.env.CLAUDE_ASSISTANT_USER || 'teren'
    console.error(`Error: No Todoist token for user "${username}"`)
    console.error(`Expected: ~/.config/claude-assistant/tokens/${username}/todoist.json`)
    process.exit(1)
}

// Tool name mapping (command names to tool objects)
const toolMap: Record<string, Tool> = {
    'add-tasks': tools.addTasks,
    'complete-tasks': tools.completeTasks,
    'get-tasks': tools.getTasks,
    'update-tasks': tools.updateTasks,
    'find-tasks': tools.findTasks,
    'find-tasks-by-date': tools.findTasksByDate,
    'find-completed-tasks': tools.findCompletedTasks,
    'add-projects': tools.addProjects,
    'update-projects': tools.updateProjects,
    'find-projects': tools.findProjects,
    'add-sections': tools.addSections,
    'update-sections': tools.updateSections,
    'find-sections': tools.findSections,
    'add-comments': tools.addComments,
    'update-comments': tools.updateComments,
    'find-comments': tools.findComments,
    'find-activity': tools.findActivity,
    'get-overview': tools.getOverview,
    'delete-object': tools.deleteObject,
    'user-info': tools.userInfo,
    'find-project-collaborators': tools.findProjectCollaborators,
    'manage-assignments': tools.manageAssignments,
    search: tools.search,
    fetch: tools.fetch,
}

function showUsage() {
    console.log(`
Todoist CLI - Execute Todoist operations via command line

Usage:
  todoist <command> '<json-args>'
  todoist help <command>
  todoist list

Commands:
  Task Management:
    add-tasks                Create one or more tasks
    complete-tasks           Mark tasks as complete
    get-tasks                Retrieve full details for specific tasks by ID
    update-tasks             Update existing tasks
    find-tasks               Search for tasks
    find-tasks-by-date       Find tasks by date range
    find-completed-tasks     Get completed tasks

  Project Management:
    add-projects             Create projects
    update-projects          Update projects
    find-projects            Search for projects

  Section Management:
    add-sections             Create sections in projects
    update-sections          Update sections
    find-sections            Find sections

  Comments:
    add-comments             Add comments to tasks/projects
    update-comments          Update comments
    find-comments            Find comments

  Other:
    get-overview             Get markdown overview of projects/tasks
    delete-object            Delete projects/sections/tasks/comments
    user-info                Get user information
    find-activity            Get activity logs
    find-project-collaborators  Find project collaborators
    manage-assignments       Bulk assign/unassign/reassign tasks
    search                   Search across tasks and projects
    fetch                    Fetch full content by ID

Examples:
  todoist add-tasks '{"tasks":[{"content":"Review PR","priority":"p1"}]}'
  todoist complete-tasks '{"ids":["123456"]}'
  todoist find-tasks '{"searchText":"meeting"}'
  todoist help add-tasks
`)
}

// Recursively extract schema from Zod types
function extractSchema(zodSchema: z.ZodTypeAny, depth = 0): Record<string, unknown> {
    if (depth > 5) return { type: 'unknown', note: 'max depth reached' }

    // biome-ignore lint/suspicious/noExplicitAny: accessing Zod internals
    const def = zodSchema._def as any
    const typeName = def?.typeName

    // Handle optional wrapper
    if (typeName === 'ZodOptional') {
        const inner = extractSchema(def.innerType, depth)
        return { ...inner, optional: true }
    }

    // Handle array - show item schema
    if (typeName === 'ZodArray') {
        return {
            type: 'array',
            items: extractSchema(def.type, depth + 1),
            description: def.description,
        }
    }

    // Handle object - show all properties
    if (typeName === 'ZodObject') {
        const properties: Record<string, unknown> = {}
        const shape = def.shape()
        for (const [k, v] of Object.entries(shape)) {
            properties[k] = extractSchema(v as z.ZodTypeAny, depth + 1)
        }
        return { type: 'object', properties }
    }

    // Handle enum
    if (typeName === 'ZodEnum') {
        return {
            type: 'enum',
            values: def.values,
            description: def.description,
        }
    }

    // Handle union (e.g., string | number)
    if (typeName === 'ZodUnion') {
        const options = def.options.map((opt: z.ZodTypeAny) => extractSchema(opt, depth + 1))
        return { type: 'union', options }
    }

    // Simple types
    return {
        type: typeName?.replace('Zod', '').toLowerCase() || 'unknown',
        description: def?.description,
    }
}

function showHelp(commandName: string) {
    const tool = toolMap[commandName]

    if (!tool) {
        console.error(`Unknown command: ${commandName}`)
        console.error('Run "todoist list" to see available commands')
        process.exit(1)
    }

    console.log(`\nCommand: ${commandName}`)
    console.log(`Description: ${tool.description}`)
    console.log('\nJSON Schema:')

    // Convert Zod schema to detailed JSON schema representation
    const params = tool.parameters
    const schemaObj: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(params)) {
        schemaObj[key] = extractSchema(value)
    }

    console.log(JSON.stringify(schemaObj, null, 2))
    console.log('\nExample:')
    console.log(`  todoist ${commandName} '<json-args>'`)
}

function listCommands() {
    console.log('\nAvailable commands:\n')
    for (const [cmd, tool] of Object.entries(toolMap)) {
        console.log(`  ${cmd.padEnd(30)} ${tool.description}`)
    }
    console.log('\nRun "todoist help <command>" for detailed schema')
}

async function executeCommand(commandName: string, jsonArgs: string) {
    const tool = toolMap[commandName]

    if (!tool) {
        console.error(`Unknown command: ${commandName}`)
        console.error('Run "todoist list" to see available commands')
        process.exit(1)
    }

    // Parse and validate JSON args
    let parsed: unknown
    try {
        parsed = JSON.parse(jsonArgs)
    } catch (error) {
        console.error('Error: Invalid JSON arguments')
        console.error(error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
    }

    // Validate against Zod schema before execution
    const schema = z.object(tool.parameters)
    const validation = schema.safeParse(parsed)

    if (!validation.success) {
        console.error('Error: Invalid arguments')
        for (const issue of validation.error.issues) {
            const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
            console.error(`  - ${path}: ${issue.message}`)
        }
        console.error(`\nRun "todoist help ${commandName}" for schema`)
        process.exit(1)
    }

    // Initialize Todoist client (API key is guaranteed to exist by check at startup)
    const client = new TodoistApi(TODOIST_API_KEY as string, TODOIST_BASE_URL)

    try {
        // Execute the tool with validated args
        const result = await tool.execute(validation.data, client)

        // Extract and print text content
        if (result.content && result.content.length > 0) {
            const textContent = result.content.find((c) => c.type === 'text')
            if (textContent?.text) {
                console.log(textContent.text)
            } else {
                console.log(JSON.stringify(result, null, 2))
            }
        } else {
            console.log(JSON.stringify(result, null, 2))
        }
        // Exit cleanly after successful execution
        process.exit(0)
    } catch (error) {
        console.error('Error executing command:')
        console.error(error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        showUsage()
        process.exit(0)
    }

    const command = args[0]

    if (!command) {
        showUsage()
        process.exit(0)
    }

    // Handle special commands
    if (command === 'help') {
        if (args.length === 1) {
            showUsage()
        } else {
            const helpCommand = args[1]
            if (!helpCommand) {
                showUsage()
            } else {
                showHelp(helpCommand)
            }
        }
        return
    }

    if (command === 'list') {
        listCommands()
        return
    }

    // Execute regular command
    if (args.length < 2) {
        console.error('Error: Missing JSON arguments')
        console.error(`Usage: todoist ${command} '<json-args>'`)
        console.error(`Run "todoist help ${command}" for schema`)
        process.exit(1)
    }

    const jsonArgs = args[1]
    if (!jsonArgs) {
        console.error('Error: Missing JSON arguments')
        process.exit(1)
    }

    await executeCommand(command, jsonArgs)
}

main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
})
