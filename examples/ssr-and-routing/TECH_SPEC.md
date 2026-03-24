# TODO App Technical Specification

## Core Objective

Build a minimalist, single-page application (SPA) for task management focusing on "Projects" (task lists) and "Tasks", using Stewie (repo root). Any server-side data should render properly on the server and hydrate on the client.

UX Mocks available relative to this document: `./UX_MOCKS.png`

## Data Models

- Project: `{ id: string, name: string, taskCount: number }`

- Task: `{ id: string, projectId: string, title: string, description: string, dueDate: Date | null, isCompleted: boolean }`

## View Definitions

Each view represents a route in the web app, used for client-side navigation and rendering, as well as server-side rendering per route.

### 1. Project List (Dashboard)

- **Route**: `/`

- **Purpose**: High-level overview of all lists.

- **UI**: A responsive grid of "Project Cards".

- **Details**: Each card displays the project name and a count of active tasks.

- **Actions**:

  - Click card to navigate to Project Details.

  - Floating Action Button (FAB) or "New Project" card to navigate to Create Project.

### 2. Project Details

- **Route**: `/project/{projectId}`

- **Purpose**: Focused view of a specific list.

- **UI**:

  - Header: Project Name with a "Back" button to Dashboard.

  - List: Vertical stack of "Task Cards".

- **Details**: Task cards show the `title` and a small `due date` badge if applicable.

- **Actions**:

  - Click task to navigate to Edit Task.

  - "Add Task" button at the bottom or top to navigate to Add New Task.

### 3. Create Project View

- **Route**: `/project/create`

- **Purpose**: Input for new list creation.

- **UI**: Simple form card.

- **Fields**: Project Name (Required).

- **Actions**: "Create" (Save and return to Dashboard), "Cancel".

### 4. Add New Task View

- **Route**: `/project/{projectId}/task/create`

- **Purpose**: Entry for new tasks within a specific project.

- **UI**: Form card.

- **Fields**:

  - `Title` (Text, Required)

  - `Description` (Textarea, Optional)

  - `Due Date` (Date Picker, Optional)

- **Actions**: "Create" (Save and return to Project Details), "Cancel".

### 5. Edit Task View

- **Route**: `/project/{projectId}/task/{taskId}`

- **Purpose**: Modification of existing task data.

- **UI**: Prefilled form card (same layout as Add Task).

- **Actions**: "Save Changes", "Delete Task", "Cancel".

## Styling

### Color Palette

- **Primary**: #6366f1 (Indigo)

- **Background**: #f8fafc (Light Slate)

- **Text**: #1e293b (Slate 900)

- **Border**: #e2e8f0 (Slate 200)

### Design Tokens

- **Primary Color**: #6366f1 (Indigo)

- **Corner Radius**: 12px

- **Shadows**: Soft, layered (e.g., `shadow-sm` and `shadow-lg` on hover).

- **Typography**: Sans-serif (Inter or System UI).

### Key Class Names

- `.card`: The base container for projects and tasks.

- `.btn-primary`: Action buttons for "Create" and "Save".

- `.input-group`: Styled form containers.

- `.badge`: For due dates and status indicators.

## View Transitions

- **Slide Transition**: Use a subtle horizontal slide when moving from Project List -> Project Details to imply hierarchy.

- **Fade & Scale**: Use a "scale-up" effect for the Create/Edit modals to make them feel like they are popping over the interface.

- **Staggered Lists**: When opening Project Details, animate the task cards with a slight delay so they appear to ripple in one by one.
