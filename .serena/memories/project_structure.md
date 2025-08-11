# Project Structure

## Current Structure
```
obsidian-slack-memo/
├── .serena/                    # Serena configuration
├── docs/                       # Documentation
│   ├── spec/                   # Requirements documentation
│   │   └── obsidian-slack-sync-requirements.md
│   ├── design/                 # Design documentation
│   │   └── obsidian-slack-sync/
│   │       ├── architecture.md
│   │       ├── interfaces.ts
│   │       ├── dataflow.md
│   │       ├── api-endpoints.md
│   │       └── settings-structure.md
│   └── tasks/                  # Implementation tasks
│       └── obsidian-slack-sync-tasks.md
```

## Planned Structure (After Implementation)
```
obsidian-slack-memo/
├── src/                        # Source code
│   ├── main.ts                 # Plugin entry point
│   ├── settings.ts             # Settings management
│   ├── slack/                  # Slack API integration
│   │   ├── client.ts           # Slack API client
│   │   ├── auth.ts             # OAuth authentication
│   │   └── types.ts            # Slack API types
│   ├── processors/             # Message processing
│   │   ├── markdown-converter.ts
│   │   ├── file-saver.ts
│   │   └── sync-manager.ts
│   ├── ui/                     # User interface
│   │   ├── settings-tab.ts
│   │   ├── status-bar.ts
│   │   └── modals/
│   └── utils/                  # Utility functions
│       ├── date-utils.ts
│       └── validation.ts
├── tests/                      # Test files
│   ├── __mocks__/              # Mock implementations
│   └── unit/                   # Unit tests
├── dist/                       # Built files
├── manifest.json               # Plugin manifest
├── package.json                # NPM configuration
├── tsconfig.json               # TypeScript configuration
├── .eslintrc.js               # ESLint configuration
├── .prettierrc                # Prettier configuration
├── jest.config.js             # Jest configuration
└── esbuild.config.js          # ESBuild configuration
```

## Key Files and Their Purpose

### Core Plugin Files
- `src/main.ts`: Main plugin class, extends Obsidian's Plugin class
- `manifest.json`: Plugin metadata (name, version, description, etc.)
- `package.json`: Dependencies and npm scripts

### Configuration Files
- `tsconfig.json`: TypeScript compiler options
- `.eslintrc.js`: Code quality rules
- `.prettierrc`: Code formatting rules
- `jest.config.js`: Test configuration
- `esbuild.config.js`: Build configuration

### Documentation Structure
- `docs/spec/`: Requirements and specifications
- `docs/design/`: Technical design documents
- `docs/tasks/`: Implementation task breakdown
- `README.md`: Project overview and setup instructions (to be created)

## File Naming Patterns
- TypeScript files: `kebab-case.ts`
- Test files: `*.test.ts`
- Configuration files: Standard names (package.json, tsconfig.json, etc.)
- Documentation: `kebab-case.md`