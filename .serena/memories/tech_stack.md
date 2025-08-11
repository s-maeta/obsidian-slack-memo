# Technology Stack

## Core Technologies
- **Language**: TypeScript 5.x
- **Framework**: Obsidian Plugin API
- **Runtime**: Node.js 18.x
- **Package Manager**: npm/yarn
- **Bundler**: ESBuild

## Development Dependencies
- **Linting**: ESLint (code quality)
- **Formatting**: Prettier (code formatting)
- **Testing**: Jest (unit testing)
- **Build**: ESBuild (bundler)

## External APIs
- **Slack Web API**: For fetching messages, channels, and user information
- **OAuth 2.0**: For Slack authentication

## Architecture Pattern
- **Event-Driven Architecture**: Suitable for Obsidian's plugin system
- **Plugin Architecture**: Follows Obsidian's plugin development patterns

## Data Storage
- **Plugin Settings**: Obsidian Plugin Data API (data.json)
- **Message Storage**: Obsidian Vault (Markdown files)
- **No External Database**: Uses channel-specific timestamps for sync management

## Key Dependencies (Expected)
- Obsidian API
- Slack Web API Client
- date-fns (date processing)

## Supported Platforms
- Desktop: Windows, macOS, Linux (where Obsidian runs)
- Mobile: iOS, Android (through Obsidian mobile app)