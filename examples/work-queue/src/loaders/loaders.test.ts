// Tests for route loaders.
//
// Loaders are plain async functions — test them directly without a browser.
// Reset the repo before each test so loader results are deterministic.

import { describe, it, expect, beforeEach } from 'vitest';
import { _resetToSeed } from '../data/repo.js';
import { dashboardLoader } from './dashboard.js';
import { projectsLoader } from './projects.js';
import { projectDetailLoader } from './project-detail.js';

beforeEach(() => {
  _resetToSeed();
});

describe('dashboardLoader', () => {
  it('returns 3 active projects from seed', async () => {
    const data = await dashboardLoader();
    expect(data.recentProjects).toHaveLength(3);
  });

  it('returns stats with correct totals', async () => {
    const data = await dashboardLoader();
    expect(data.stats.totalProjects).toBe(3);
    expect(data.stats.totalTasks).toBeGreaterThan(0);
  });
});

describe('projectsLoader', () => {
  it('returns projects with task counts', async () => {
    const data = await projectsLoader();
    expect(data.projects).toHaveLength(3);
    for (const p of data.projects) {
      expect(p.taskCounts).toBeDefined();
      expect(typeof p.taskCounts.total).toBe('number');
    }
  });

  it('task count totals match status breakdown', async () => {
    const data = await projectsLoader();
    for (const p of data.projects) {
      const { todo, inProgress, done, total } = p.taskCounts;
      expect(todo + inProgress + done).toBe(total);
    }
  });
});

describe('projectDetailLoader', () => {
  it('loads a project and its tasks', async () => {
    const data = await projectDetailLoader({ projectId: 'proj_1' });
    expect(data.project.id).toBe('proj_1');
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.tasks.every((t) => t.projectId === 'proj_1')).toBe(true);
  });

  it('throws for unknown project', async () => {
    await expect(projectDetailLoader({ projectId: 'no_such_project' })).rejects.toThrow();
  });
});
