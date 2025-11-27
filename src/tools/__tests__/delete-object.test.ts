import type { TodoistApi } from '@doist/todoist-api-typescript'
import { jest } from '@jest/globals'
import {
    extractTextContent,
    setupFetchErrorMock,
    setupFetchMock,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { deleteObject } from '../delete-object.js'

// Mock the Todoist API (not actually used since delete uses fetch directly)
const mockTodoistApi = {} as unknown as jest.Mocked<TodoistApi>

const { FIND_PROJECTS, FIND_TASKS_BY_DATE, DELETE_OBJECT } = ToolNames

describe(`${DELETE_OBJECT} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('deleting projects', () => {
        it('should delete a project by ID', async () => {
            // Delete uses direct REST API (fetch) due to SDK bug workaround
            setupFetchMock([])

            const result = await deleteObject.execute(
                { type: 'project', id: '6cfCcrrCFg2xP94Q' },
                mockTodoistApi,
            )

            // Verify fetch was called with correct endpoint
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.todoist.com/rest/v2/projects/6cfCcrrCFg2xP94Q',
                expect.objectContaining({
                    method: 'DELETE',
                }),
            )

            const textContent = extractTextContent(result)
            expect(textContent).toMatchSnapshot()
            expect(textContent).toContain('Deleted project: id=6cfCcrrCFg2xP94Q')
            expect(textContent).toContain(`Use ${FIND_PROJECTS} to see remaining projects`)
            expect(result.structuredContent).toEqual({
                deletedEntity: {
                    type: 'project',
                    id: '6cfCcrrCFg2xP94Q',
                },
                success: true,
            })
        })

        it('should propagate project deletion errors', async () => {
            // Delete uses direct REST API (fetch) due to SDK bug workaround
            setupFetchErrorMock(400, 'Cannot delete project with tasks')

            await expect(
                deleteObject.execute({ type: 'project', id: 'project-with-tasks' }, mockTodoistApi),
            ).rejects.toThrow('Todoist API error: 400 Cannot delete project with tasks')
        })
    })

    describe('deleting sections', () => {
        it('should delete a section by ID', async () => {
            // Delete uses direct REST API (fetch) due to SDK bug workaround
            setupFetchMock([])

            const result = await deleteObject.execute(
                { type: 'section', id: 'section-123' },
                mockTodoistApi,
            )

            // Verify fetch was called with correct endpoint
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.todoist.com/rest/v2/sections/section-123',
                expect.objectContaining({
                    method: 'DELETE',
                }),
            )

            const textContent = extractTextContent(result)
            expect(textContent).toMatchSnapshot()
            expect(textContent).toContain('Deleted section: id=section-123')
            expect(textContent).toContain(
                `Use ${ToolNames.FIND_SECTIONS} to see remaining sections`,
            )
            expect(result.structuredContent).toEqual({
                deletedEntity: { type: 'section', id: 'section-123' },
                success: true,
            })
        })

        it('should propagate section deletion errors', async () => {
            // Delete uses direct REST API (fetch) due to SDK bug workaround
            setupFetchErrorMock(404, 'Section not found')

            await expect(
                deleteObject.execute(
                    { type: 'section', id: 'non-existent-section' },
                    mockTodoistApi,
                ),
            ).rejects.toThrow('Todoist API error: 404 Section not found')
        })
    })

    describe('deleting tasks', () => {
        it('should delete a task by ID', async () => {
            // Delete uses direct REST API (fetch) due to SDK bug workaround
            setupFetchMock([])

            const result = await deleteObject.execute(
                { type: 'task', id: '8485093748' },
                mockTodoistApi,
            )

            // Verify fetch was called with correct endpoint
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.todoist.com/rest/v2/tasks/8485093748',
                expect.objectContaining({
                    method: 'DELETE',
                }),
            )

            const textContent = extractTextContent(result)
            expect(textContent).toMatchSnapshot()
            expect(textContent).toContain('Deleted task: id=8485093748')
            expect(textContent).toContain(`Use ${FIND_TASKS_BY_DATE} to see remaining tasks`)
            expect(result.structuredContent).toEqual({
                deletedEntity: { type: 'task', id: '8485093748' },
                success: true,
            })
        })

        it('should propagate task deletion errors', async () => {
            // Delete uses direct REST API (fetch) due to SDK bug workaround
            setupFetchErrorMock(404, 'Task not found')

            await expect(
                deleteObject.execute({ type: 'task', id: 'non-existent-task' }, mockTodoistApi),
            ).rejects.toThrow('Todoist API error: 404 Task not found')
        })

        it('should handle permission errors', async () => {
            // Delete uses direct REST API (fetch) due to SDK bug workaround
            setupFetchErrorMock(403, 'Insufficient permissions to delete task')

            await expect(
                deleteObject.execute({ type: 'task', id: 'restricted-task' }, mockTodoistApi),
            ).rejects.toThrow('Todoist API error: 403 Insufficient permissions to delete task')
        })
    })

    describe('type validation', () => {
        it('should handle all supported entity types', async () => {
            // Delete project
            setupFetchMock([])
            await deleteObject.execute({ type: 'project', id: 'proj-1' }, mockTodoistApi)
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.todoist.com/rest/v2/projects/proj-1',
                expect.objectContaining({ method: 'DELETE' }),
            )

            // Delete section
            setupFetchMock([])
            await deleteObject.execute({ type: 'section', id: 'sect-1' }, mockTodoistApi)
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.todoist.com/rest/v2/sections/sect-1',
                expect.objectContaining({ method: 'DELETE' }),
            )

            // Delete task
            setupFetchMock([])
            await deleteObject.execute({ type: 'task', id: 'task-1' }, mockTodoistApi)
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.todoist.com/rest/v2/tasks/task-1',
                expect.objectContaining({ method: 'DELETE' }),
            )
        })
    })
})
