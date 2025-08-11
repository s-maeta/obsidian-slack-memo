# Development Commands

## Task Completion Workflow
When a task is completed, run these commands in order:

1. **Code Quality Check**:
   ```bash
   npm run lint
   ```

2. **Code Formatting**:
   ```bash
   npm run format
   ```

3. **Run Tests**:
   ```bash
   npm run test
   ```

4. **Build the Plugin**:
   ```bash
   npm run build
   ```

## Development Workflow Commands

### Setup Commands
```bash
# Install dependencies
npm install

# Initial setup for development
npm run dev
```

### Development Commands
```bash
# Start development mode with hot reload
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Plugin Development Specific
```bash
# Copy built plugin to Obsidian plugins directory (for testing)
npm run install-plugin

# Create release build
npm run release
```

## File System Commands (macOS)
```bash
# List files
ls -la

# Find files
find . -name "*.ts" -type f

# Search in files
grep -r "pattern" src/

# Copy files
cp source destination

# Remove files
rm file.txt

# Remove directories
rm -rf directory/
```

## Git Commands
```bash
# Check status
git status

# Add files
git add .

# Commit changes
git commit -m "message"

# Push changes
git push

# Pull latest changes
git pull
```

## Debug Commands
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check TypeScript version
npx tsc --version

# Validate package.json
npm audit
```