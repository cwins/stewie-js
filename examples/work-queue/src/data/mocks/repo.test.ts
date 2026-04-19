// Tests for the in-memory repository.
//
// The repository is stateful (module-level), so each test resets to seed state.
// This makes tests independent and predictable.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  getTasksForProject,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getStats,
  getTaskCountsForProject,
  _resetToSeed
} from './repo.js';
import { seedTasks } from './seed.js';

beforeEach(() => {
  _resetToSeed();
});

describe('getProjects', () => {
  it('returns all active projects by default', () => {
    const projects = getProjects();
    expect(projects).toHaveLength(3);
    expect(projects.every((p) => p.status === 'active')).toBe(true);
  });

  it('returns correct project ids from seed', () => {
    const ids = getProjects().map((p) => p.id);
    expect(ids).toContain('proj_1');
    expect(ids).toContain('proj_2');
    expect(ids).toContain('proj_3');
  });
});

describe('getProject', () => {
  it('returns a project by id', () => {
    const project = getProject('proj_1');
    expect(project).toBeDefined();
    expect(project!.name).toBe('Platform Migration');
  });

  it('returns undefined for unknown id', () => {
    expect(getProject('does_not_exist')).toBeUndefined();
  });
});

describe('createProject', () => {
  it('adds a new project and returns it', () => {
    const project = createProject({ name: 'Test', description: 'Desc', color: '#000' });
    expect(project.id).toMatch(/^proj_/);
    expect(project.status).toBe('active');
    expect(getProject(project.id)).toBeDefined();
  });

  it('new project appears in getProjects()', () => {
    createProject({ name: 'New', description: '', color: '#fff' });
    expect(getProjects()).toHaveLength(4);
  });
});

describe('updateProject', () => {
  it('updates project fields', () => {
    updateProject('proj_1', { name: 'Renamed' });
    expect(getProject('proj_1')!.name).toBe('Renamed');
  });

  it('throws for unknown project', () => {
    expect(() => updateProject('bad_id', { name: 'X' })).toThrow();
  });
});

describe('getTasksForProject', () => {
  it('returns tasks for proj_1', () => {
    const tasks = getTasksForProject('proj_1');
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.projectId === 'proj_1')).toBe(true);
  });

  it('returns empty array for unknown project', () => {
    expect(getTasksForProject('no_project')).toHaveLength(0);
  });
});

describe('createTask', () => {
  it('adds a task with status todo by default', () => {
    const task = createTask({
      projectId: 'proj_1',
      title: 'New task',
      description: '',
      priority: 'low',
      dueDate: null
    });
    expect(task.status).toBe('todo');
    expect(getTask(task.id)).toBeDefined();
  });
});

describe('updateTask', () => {
  it('updates task status', () => {
    updateTask('task_4', { status: 'done' });
    expect(getTask('task_4')!.status).toBe('done');
  });

  it('throws for unknown task', () => {
    expect(() => updateTask('bad_id', { status: 'done' })).toThrow();
  });
});

describe('deleteTask', () => {
  it('removes the task', () => {
    deleteTask('task_1');
    expect(getTask('task_1')).toBeUndefined();
  });

  it('is a no-op for unknown id', () => {
    const before = getTasksForProject('proj_1').length;
    deleteTask('no_such_task');
    expect(getTasksForProject('proj_1').length).toBe(before);
  });
});

describe('getStats', () => {
  it('returns correct totals from seed', () => {
    const stats = getStats();
    expect(stats.totalProjects).toBe(3);
    expect(stats.totalTasks).toBe(seedTasks.length);
    expect(stats.todoCount + stats.inProgressCount + stats.doneCount).toBe(stats.totalTasks);
  });

  it('updates after task creation', () => {
    const before = getStats().todoCount;
    createTask({ projectId: 'proj_1', title: 'X', description: '', priority: 'low', dueDate: null });
    expect(getStats().todoCount).toBe(before + 1);
  });
});

describe('getTaskCountsForProject', () => {
  it('returns correct counts for proj_1', () => {
    const counts = getTaskCountsForProject('proj_1');
    const tasks = getTasksForProject('proj_1');
    expect(counts.total).toBe(tasks.length);
    expect(counts.todo + counts.inProgress + counts.done).toBe(counts.total);
  });
});
