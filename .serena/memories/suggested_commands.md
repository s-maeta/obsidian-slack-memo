# Suggested Commands for Development

## Essential Daily Commands

### Start Development
```bash
# Start development with hot reload (once implemented)
npm run dev
```

### Code Quality Checks (Run before committing)
```bash
# Check code style and quality
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Run tests
npm run test

# Build the plugin
npm run build
```

### Installation and Setup (First time)
```bash
# Install all dependencies
npm install

# Set up development environment
npm run setup  # (if implemented)
```

## Git Workflow
```bash
# Check what files changed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: implement OAuth authentication for Slack"

# Push to remote
git push
```

## Testing Commands
```bash
# Run all tests
npm run test

# Run tests in watch mode during development
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm run test src/slack/client.test.ts
```

## Build and Release
```bash
# Production build
npm run build

# Copy plugin to Obsidian vault for testing
npm run install-plugin  # (custom script)

# Create release package
npm run release  # (if implemented)
```

## Debugging and Troubleshooting
```bash
# Check versions
node --version
npm --version
npx tsc --version

# Clean build artifacts
npm run clean  # (if implemented)

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for outdated dependencies
npm outdated

# Audit for security issues
npm audit
```

## File System Operations (macOS)
```bash
# Search for files
find . -name "*.ts" -not -path "./node_modules/*"

# Search in file contents
grep -r "SlackMessage" src/

# Using ripgrep (faster alternative)
rg "SlackMessage" src/

# List files with details
ls -la

# Show directory tree structure
tree -I node_modules
```

## Obsidian Plugin Development Specific
```bash
# Open Obsidian vault with the plugin
open -a Obsidian /path/to/test/vault

# Check Obsidian console for plugin logs
# (Done through Obsidian's developer tools)

# Hot reload the plugin
# (Requires Obsidian Hot Reload plugin)
```

## Most Important Commands to Remember
1. `npm run lint` - Check code quality
2. `npm run test` - Run tests
3. `npm run build` - Build the plugin
4. `git status` - Check git status
5. `npm run dev` - Start development mode