# Graph Report - webui  (2026-10-24)

## Corpus Check
- Corpus is ~11,157 words - fits in a single context window. You may not need a graph.

## Summary
- 149 nodes · 349 edges · 9 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Package Dependencies & Manifest
- API Client & Network Layer
- Calendar Views & Day Cards
- TypeScript Configuration
- Priority Management UI
- Calendar Strip & Date Navigation
- Task Comments & Markdown Editor
- Vite & Node Build Config
- Tag Management UI

## God Nodes (most connected - your core abstractions)
1. `App()` - 25 edges
2. `logRequest()` - 22 edges
3. `logResponse()` - 17 edges
4. `compilerOptions` - 16 edges
5. `TaskTag` - 15 edges
6. `react` - 12 edges
7. `Task` - 11 edges
8. `TaskPriority` - 11 edges
9. `lucide-react` - 10 edges
10. `CalendarStrip` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `TaskPriority`  [EXTRACTED]
  src/components/PriorityManager.tsx → src/types.ts
- `Props` --references--> `TaskTag`  [EXTRACTED]
  src/components/TagManager.tsx → src/types.ts
- `App()` --indirect_call--> `syncDownload()`  [INFERRED]
  src/App.tsx → src/api.ts
- `App()` --indirect_call--> `syncUpload()`  [INFERRED]
  src/App.tsx → src/api.ts
- `App()` --calls--> `CalendarStrip`  [EXTRACTED]
  src/App.tsx → src/components/CalendarStrip.tsx

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "Package Dependencies & Manifest"
Cohesion: 0.08
Nodes (29): dependencies, isdayoff-ts@^2.5.1, lucide-react@^1.17.0, marked@^18.0.6, react@^18.2.0, react-dom@^18.2.0, @tanstack/react-table@^8.21.3, devDependencies (+21 more)

### Community 1 - "API Client & Network Layer"
Cohesion: 0.30
Nodes (24): assignTagToTask(), checkRemoteUpdates(), createPriority(), createTag(), createTask(), deletePriority(), deleteTagGlobally(), deleteTask() (+16 more)

### Community 2 - "Calendar Views & Day Cards"
Cohesion: 0.20
Nodes (18): lucide-react, react, Props, DayCard(), escapeHtml(), formatDisplayDate(), formatWeekday(), getOverdueDays() (+10 more)

### Community 3 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 4 - "Priority Management UI"
Cohesion: 0.15
Nodes (13): PriorityEditItem(), PriorityEditItemProps, PriorityItem(), PriorityItemProps, PriorityManager(), Props, CreatePriorityDTO, CreateTaskCommentDTO (+5 more)

### Community 5 - "Calendar Strip & Date Navigation"
Cohesion: 0.31
Nodes (8): addDays(), CalendarStrip, CalendarStripRef, formatLocalDate(), getTodayDate(), getDaysInfo(), getLocalWeekends(), HolidayInfo

### Community 6 - "Task Comments & Markdown Editor"
Cohesion: 0.38
Nodes (8): addTaskComment(), deleteTaskComment(), fetchTaskComments(), MarkdownEditor(), MarkdownEditorProps, renderer, renderMarkdown(), TaskModal()

### Community 7 - "Vite & Node Build Config"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 8 - "Tag Management UI"
Cohesion: 0.38
Nodes (6): Props, TagEditItem(), TagEditItemProps, TagItem(), TagItemProps, TagManager()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Calendar Views & Day Cards` to `Package Dependencies & Manifest`, `API Client & Network Layer`, `Priority Management UI`, `Calendar Strip & Date Navigation`, `Task Comments & Markdown Editor`, `Tag Management UI`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `App()` (e.g. with `syncDownload()` and `syncUpload()`) actually correct?**
  _`App()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Package Dependencies & Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.08266129032258064 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Calendar Views & Day Cards` to `Package Dependencies & Manifest`, `API Client & Network Layer`, `Priority Management UI`, `Task Comments & Markdown Editor`, `Tag Management UI`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Should `TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._