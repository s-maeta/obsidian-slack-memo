# Code Style and Conventions

## Code Style Tools
- **ESLint**: For code quality and consistency enforcement
- **Prettier**: For automated code formatting
- **TypeScript**: Strict typing enabled

## File Organization
```
src/
├── main.ts           # Plugin entry point
├── settings.ts       # Settings management
├── slack/           # Slack API integration
├── processors/      # Message processing logic
├── ui/             # User interface components
└── utils/          # Utility functions
```

## Naming Conventions
- **Files**: kebab-case (e.g., `slack-client.ts`)
- **Classes**: PascalCase (e.g., `SlackSyncPlugin`)
- **Interfaces**: PascalCase with Interface prefix if needed (e.g., `PluginSettings`)
- **Functions/Methods**: camelCase (e.g., `fetchMessages`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_SYNC_INTERVAL`)
- **Type Definitions**: PascalCase (e.g., `SyncStatus`)

## TypeScript Guidelines
- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use proper return type annotations
- Implement proper error handling with Result types
- Use async/await over Promises for better readability

## Comment Style
- Use JSDoc for public APIs
- Inline comments for complex logic explanation
- No redundant comments for self-explanatory code

## Import Organization
1. Node.js built-in modules
2. External dependencies
3. Obsidian API imports
4. Internal imports (relative paths)

## Error Handling
- Use Result<T, E> pattern for operations that can fail
- Implement proper logging for debugging
- User-friendly error messages for UI

## Testing Conventions
- Unit tests in `__tests__` directories
- Test files named `*.test.ts`
- Use descriptive test names with "should" statements
- Mock external dependencies (Slack API, Obsidian API)