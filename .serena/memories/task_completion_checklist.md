# Task Completion Checklist

## When a Task is Completed

### 1. Code Quality Verification
- [ ] Run `npm run lint` - Check for code quality issues
- [ ] Run `npm run lint:fix` - Auto-fix any fixable issues
- [ ] Run `npm run format` - Ensure consistent code formatting
- [ ] Manually review code for logic and readability

### 2. Testing Requirements
- [ ] Run `npm run test` - Execute all unit tests
- [ ] Ensure all tests pass
- [ ] Add new tests for new functionality
- [ ] Update existing tests if behavior changed
- [ ] Check test coverage is adequate (aim for >80%)

### 3. Build Verification
- [ ] Run `npm run build` - Ensure project builds successfully
- [ ] Check that no build errors or warnings occur
- [ ] Verify that the built plugin loads in Obsidian (for plugin-specific tasks)

### 4. Documentation Updates
- [ ] Update README.md if public API changed
- [ ] Update JSDoc comments for new/modified public functions
- [ ] Update task completion status in docs/tasks/obsidian-slack-sync-tasks.md
- [ ] Add any new configuration or usage examples

### 5. Git and Version Control
- [ ] Stage relevant changes with `git add`
- [ ] Commit with descriptive message following convention:
  - feat: new feature
  - fix: bug fix
  - docs: documentation changes
  - style: code style changes
  - refactor: code refactoring
  - test: test changes
  - chore: build/config changes

### 6. Integration Testing (for major features)
- [ ] Test the feature in actual Obsidian environment
- [ ] Verify settings are saved and loaded correctly
- [ ] Test error scenarios and edge cases
- [ ] Ensure no conflicts with other plugins

### 7. Performance Check (for performance-critical tasks)
- [ ] Profile memory usage if applicable
- [ ] Verify async operations don't block UI
- [ ] Check API rate limiting compliance

## Task-Specific Checklists

### For UI Components
- [ ] Test responsive behavior
- [ ] Verify accessibility (keyboard navigation, screen readers)
- [ ] Test with different Obsidian themes
- [ ] Validate form inputs and error states

### For API Integration
- [ ] Test with valid and invalid tokens
- [ ] Handle network errors gracefully
- [ ] Verify rate limiting behavior
- [ ] Test pagination if applicable

### For Data Processing
- [ ] Test with various message formats
- [ ] Verify file saving in different locations
- [ ] Test duplicate detection
- [ ] Validate Markdown output quality

## Before Moving to Next Task
- [ ] Mark current task as completed in task tracking
- [ ] Review dependencies for next task
- [ ] Ensure all completion criteria are met
- [ ] Update project status if milestone reached