import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { getTfCostAvailability, getTfStateInfo, getTfVersions, listDir, listTfVarFiles, readFileContent, runTerraform, runTerraformStream, saveFileContent } from './api'

vi.mock('./api', async importOriginal => ({
  ...await importOriginal<typeof import('./api')>(),
  getTfCostAvailability: vi.fn(),
  getTfStateInfo: vi.fn(),
  getTfVersions: vi.fn(),
  listDir: vi.fn(),
  listTfVarFiles: vi.fn(),
  readFileContent: vi.fn(),
  runTerraform: vi.fn(),
  runTerraformStream: vi.fn(),
  saveFileContent: vi.fn()
}))

describe('saving a file that exceeds the size limit', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('terracode.tf-project-dir', '/project')
    localStorage.setItem('terracode.sidebar-visibility', JSON.stringify({ left: false, right: false }))
    vi.mocked(listDir).mockResolvedValue([])
    vi.mocked(readFileContent).mockResolvedValue({ path: '/project/main.tf', content: 'terraform {}', mtimeMs: 1 })
    vi.mocked(getTfVersions).mockResolvedValue({ tfenvAvailable: false, installed: [], active: null })
    vi.mocked(getTfStateInfo).mockResolvedValue({ initialized: false, backend: null, localState: null })
    vi.mocked(listTfVarFiles).mockResolvedValue({ files: [] })
    vi.mocked(getTfCostAvailability).mockResolvedValue({ available: false })
    vi.mocked(runTerraform).mockResolvedValue({ command: 'workspace-list', exitCode: 0, timedOut: false, workspaces: [], output: '' })
    vi.mocked(runTerraformStream).mockImplementation(() => () => {})
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
    localStorage.clear()
  })

  it('shows the server error and keeps the unsaved text when a save is rejected', async () => {
    const draft = 'terraform {}\nresource "null_resource" "x" {}'
    localStorage.setItem('terracode.open-tabs', JSON.stringify({ paths: ['/project/main.tf'], active: '/project/main.tf' }))
    vi.mocked(saveFileContent).mockRejectedValue(new Error('Content too large (limit 1024 KB)'))

    render(<App />)
    await screen.findByText('/project/main.tf')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const editor = document.querySelector('textarea.editor-input') as HTMLTextAreaElement
    expect(editor).not.toBeNull()
    fireEvent.change(editor, { target: { value: draft } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(document.querySelector('.file-status.error')).toHaveTextContent('Content too large (limit 1024 KB)')
    })
    // The rejected save must not discard the user's unsaved text.
    const retained = document.querySelector('textarea.editor-input') as HTMLTextAreaElement
    expect(retained.value).toBe(draft)
  })
})
