// Seed data for the Work Queue example.
//
// Stable layer: this file does not change when Stewie APIs change.
// Tests, loaders, and the initial repo state all import from here.

import type { Project, Task } from '../types.js';

export const seedProjects: Project[] = [
  {
    id: 'proj_1',
    name: 'Platform Migration',
    description: 'Migrate the legacy monolith to a services architecture.',
    status: 'active',
    color: '#6366f1',
    createdAt: '2026-01-15T09:00:00Z'
  },
  {
    id: 'proj_2',
    name: 'Design System',
    description: 'Build a shared component library for all product teams.',
    status: 'active',
    color: '#0ea5e9',
    createdAt: '2026-02-01T10:00:00Z'
  },
  {
    id: 'proj_3',
    name: 'Q2 Growth Campaign',
    description: 'User acquisition campaign — landing pages, email, and paid ads.',
    status: 'active',
    color: '#10b981',
    createdAt: '2026-03-10T08:00:00Z'
  }
];

export const seedTasks: Task[] = [
  // Platform Migration tasks
  {
    id: 'task_1',
    projectId: 'proj_1',
    title: 'Audit existing API surface',
    description: 'Document all public endpoints and their callers before migration begins.',
    status: 'done',
    priority: 'high',
    dueDate: '2026-02-10'
  },
  {
    id: 'task_2',
    projectId: 'proj_1',
    title: 'Set up staging environment',
    description: 'Provision the new infrastructure stack in the staging account.',
    status: 'done',
    priority: 'high',
    dueDate: '2026-02-20'
  },
  {
    id: 'task_3',
    projectId: 'proj_1',
    title: 'Migrate authentication service',
    description: 'Move auth logic to the new identity service, preserving session tokens.',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2026-04-30'
  },
  {
    id: 'task_4',
    projectId: 'proj_1',
    title: 'Write migration runbook',
    description: 'Document the cutover procedure for on-call engineers.',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-05-15'
  },
  {
    id: 'task_5',
    projectId: 'proj_1',
    title: 'Load test new stack',
    description: 'Run k6 load tests against staging; baseline and compare to prod.',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-05-20'
  },

  // Design System tasks
  {
    id: 'task_6',
    projectId: 'proj_2',
    title: 'Define token system',
    description: 'Colors, spacing, radius, and typography tokens in a shared JSON file.',
    status: 'done',
    priority: 'high',
    dueDate: '2026-02-28'
  },
  {
    id: 'task_7',
    projectId: 'proj_2',
    title: 'Build Button component',
    description: 'Primary, secondary, ghost, destructive variants. Size md and sm.',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2026-04-20'
  },
  {
    id: 'task_8',
    projectId: 'proj_2',
    title: 'Build Input and Textarea',
    description: 'Form field primitives with error state, helper text, and label wiring.',
    status: 'todo',
    priority: 'high',
    dueDate: '2026-04-28'
  },
  {
    id: 'task_9',
    projectId: 'proj_2',
    title: 'Document Storybook setup',
    description: 'Add Storybook stories for each component, covering all variants and states.',
    status: 'todo',
    priority: 'low',
    dueDate: null
  },

  // Q2 Growth Campaign tasks
  {
    id: 'task_10',
    projectId: 'proj_3',
    title: 'Write landing page copy',
    description: 'Hero headline, subhead, three feature sections, and social proof block.',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2026-04-22'
  },
  {
    id: 'task_11',
    projectId: 'proj_3',
    title: 'Design landing page',
    description: 'Figma mockup aligned to brand tokens; desktop and mobile breakpoints.',
    status: 'todo',
    priority: 'high',
    dueDate: '2026-04-25'
  },
  {
    id: 'task_12',
    projectId: 'proj_3',
    title: 'Set up UTM tracking',
    description: 'Wire up analytics for all campaign traffic sources.',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-05-01'
  }
];
