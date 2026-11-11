import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import GitPanel from './GitPanel'
import { getGitBranches, getGitLog, getGitRemotes, gitCommit, type GitStatusEntry } from './api'

vi.mock('./api', async importOriginal => ({
  ...await importOriginal<typeof import('./api')>(),
  getGitBranches: vi.fn(),
  getGitLog: vi.fn(),
  getGitRemotes: vi.fn(),
  gitCommit: vi.fn(),
}))

const untracked = (path: string): GitStatusEntry => ({ path, index: '?', worktree: '?' })

describe('Git commit selection', () => {
  beforeEach(() => {
    vi.mocked(getGitBranches).mockResolvedValue({ isRepo: true, current: 'main', branches: ['main'] })
    vi.mocked(getGitRemotes).mockResolvedValue({ isRepo: true, remotes: [] })
    vi.mocked(getGitLog).mockResolvedValue({ isRepo: true, commits: [] })
    vi.mocked(gitCommit).mockResolvedValue({ committed: true, hash: 'abc1234' })
  })
  afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks() })

  it('keeps unchecked files across refreshes and handles changed entries', async () => {
    const entries = [untracked('.terraform-version'), untracked('modules-registry.tf'), untracked('tf.plan')]
    const props = { dirPath: '/project', isRepo: true, entries, onRefresh: vi.fn() }
    const { rerender } = render(<GitPanel {...props} refreshKey={0} />)
    await screen.findByRole('option', { name: 'main (current)' })
    const plan = screen.getByRole('checkbox', { name: /tf\.plan/ })
    fireEvent.click(plan)
    expect(plan).not.toBeChecked()
    rerender(<GitPanel {...props} refreshKey={1} />)
    expect(plan).not.toBeChecked()
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument()
    rerender(<GitPanel {...props} entries={[entries[0], entries[2], untracked('new.tf')]} refreshKey={2} />)
    expect(screen.getByRole('checkbox', { name: /tf\.plan/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /new\.tf/ })).toBeChecked()
    fireEvent.change(screen.getByLabelText('Commit message'), { target: { value: 'test' } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Commit 2 of 3' }))
    await waitFor(() => expect(gitCommit).toHaveBeenCalledWith('/project', 'test', ['.terraform-version', 'new.tf']))
    await screen.findByText('Committed abc1234')
    await act(async () => rerender(<GitPanel {...props} entries={[entries[2]]} refreshKey={3} />))
    expect(screen.getByRole('checkbox', { name: /tf\.plan/ })).not.toBeChecked()
  })

  it('does not fall back to committing everything if an excluded file disappears from status', async () => {
    const entries = [untracked('module.tf'), untracked('tf.plan')]
    const props = { dirPath: '/project', isRepo: true, onRefresh: vi.fn() }
    const { rerender } = render(<GitPanel {...props} entries={entries} refreshKey={0} />)
    await screen.findByRole('option', { name: 'main (current)' })
    fireEvent.click(screen.getByRole('checkbox', { name: /tf\.plan/ }))
    rerender(<GitPanel {...props} entries={[entries[0]]} refreshKey={1} />)
    fireEvent.change(screen.getByLabelText('Commit message'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Commit 1 change' }))
    await waitFor(() => expect(gitCommit).toHaveBeenCalledWith('/project', 'test', ['module.tf']))
  })

  it('prevents a commit when no files are selected', async () => {
    const entries = [untracked('one.tf'), untracked('two.tf')]
    render(<GitPanel dirPath="/project" isRepo entries={entries} refreshKey={0} onRefresh={() => {}} />)
    await screen.findByRole('option', { name: 'main (current)' })
    fireEvent.change(screen.getByLabelText('Commit message'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /one\.tf/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /two\.tf/ }))
    expect(screen.getByRole('button', { name: 'Commit 0 of 2' })).toBeDisabled()
    expect(gitCommit).not.toHaveBeenCalled()
  })
})
