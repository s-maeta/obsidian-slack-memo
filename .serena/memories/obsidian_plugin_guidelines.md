# Obsidian Plugin Development Guidelines

## Plugin Architecture Patterns

### Main Plugin Class
- Extend Obsidian's `Plugin` class
- Implement `onload()` and `onunload()` lifecycle methods
- Use `this.addCommand()` for command palette integration
- Use `this.addSettingTab()` for settings UI

### Settings Management
- Use `this.loadData()` and `this.saveData()` for persistence
- Settings stored in `.obsidian/plugins/plugin-name/data.json`
- Implement default settings with proper TypeScript typing
- Validate settings on load

### UI Components
- Use Obsidian's built-in UI components (Modal, Setting, Notice)
- Follow Obsidian's design patterns and styling
- Ensure compatibility with different themes
- Test with both light and dark themes

### File System Operations
- Use `this.app.vault` API for file operations
- Respect user's vault structure and permissions
- Handle file conflicts gracefully
- Use proper path normalization

## Best Practices

### Performance
- Use async/await for file operations
- Implement proper debouncing for user input
- Avoid blocking the main thread
- Use efficient data structures for large datasets

### Error Handling
- Always handle file system errors
- Provide meaningful error messages to users
- Log errors for debugging but don't spam console
- Implement graceful degradation

### Security
- Never expose sensitive data in logs
- Encrypt tokens and credentials
- Validate all user inputs
- Follow OAuth best practices

### User Experience
- Provide clear feedback for long-running operations
- Use progress indicators where appropriate
- Implement undo functionality where possible
- Respect user preferences and settings

## Plugin Manifest Requirements
- Proper versioning (semantic versioning)
- Clear description and author information
- Appropriate minimum Obsidian version
- Correct plugin ID (unique and descriptive)

## Testing Considerations
- Mock Obsidian API for unit tests
- Test with different vault structures
- Verify plugin works with Obsidian updates
- Test installation and uninstallation

## Distribution
- Follow Obsidian's plugin submission guidelines
- Provide clear documentation
- Include screenshots and usage examples
- Maintain backwards compatibility when possible

## Common Pitfalls to Avoid
- Don't modify files outside the vault
- Don't assume specific vault structure
- Don't hardcode file paths
- Don't ignore plugin lifecycle events
- Don't block the UI thread with heavy operations