# Contributing to Island Bitcoin Community

Thank you for your interest in contributing to Island Bitcoin Community! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Community](#community)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of background or experience level.

### Expected Behavior

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences
- Accept responsibility and apologize for mistakes

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling, insulting, or derogatory remarks
- Publishing others' private information
- Any conduct that would be inappropriate in a professional setting

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Git
- A GitHub account
- Basic knowledge of React, TypeScript, and Node.js

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/island-bitcoin-community.git
   cd island-bitcoin-community
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/islandbitcoin/island-bitcoin-community.git
   ```

### Install Dependencies

```bash
pnpm install
```

### Set Up Development Environment

```bash
# Copy environment files
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env

# Initialize database
pnpm --filter @island-bitcoin/api db:migrate

# Start development servers
pnpm dev
```

## Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes
- `chore/` - Maintenance tasks

Examples:
- `feature/lightning-payouts`
- `fix/trivia-session-expiry`
- `docs/api-endpoints`

### 2. Make Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @island-bitcoin/web test
pnpm --filter @island-bitcoin/api test

# Run tests in watch mode
pnpm --filter @island-bitcoin/web test:watch
```

### 4. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git add .
git commit -m "feat: add lightning payout feature"
```

#### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or fixes
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(trivia): add difficulty levels
fix(auth): resolve nsec login issue
docs(api): update endpoint documentation
refactor(db): optimize query performance
test(trivia): add session expiry tests
chore(deps): update dependencies
```

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your branch
4. Fill out the PR template
5. Submit the pull request

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types (avoid `any`)
- Use interfaces for object shapes
- Export types from shared packages

```typescript
// Good
interface User {
  pubkey: string;
  createdAt: Date;
}

// Avoid
const user: any = { ... };
```

### React Components

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use proper prop types

```typescript
// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### File Organization

```
src/
├── components/
│   ├── auth/
│   │   ├── LoginButton.tsx
│   │   └── LoginButton.test.tsx
│   └── games/
│       ├── BitcoinTrivia.tsx
│       └── BitcoinTrivia.test.tsx
├── hooks/
│   ├── useCurrentUser.ts
│   └── useCurrentUser.test.ts
└── lib/
    ├── utils.ts
    └── utils.test.ts
```

### Naming Conventions

- **Components**: PascalCase (`LoginButton.tsx`)
- **Hooks**: camelCase with `use` prefix (`useCurrentUser.ts`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`User`, `TriviaSession`)

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check linting
pnpm lint

# Fix linting issues
pnpm lint --fix

# Format code
pnpm format
```

## Testing Requirements

### Unit Tests

- Write tests for all new features
- Maintain or improve code coverage
- Use descriptive test names

```typescript
describe('BitcoinTrivia', () => {
  it('should start a new session when user clicks start', async () => {
    // Test implementation
  });

  it('should display error when session fails to start', async () => {
    // Test implementation
  });
});
```

### Integration Tests

- Test API endpoints
- Test database operations
- Test authentication flows

### E2E Tests

- Test critical user flows
- Use Playwright for browser testing
- Run before submitting PR

```bash
# Run E2E tests
pnpm --filter @island-bitcoin/web test:e2e
```

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Tests pass
- [ ] Linting passes
- [ ] Documentation updated
```

### Review Process

1. **Automated Checks**: CI/CD runs tests and linting
2. **Code Review**: Maintainers review your code
3. **Feedback**: Address any requested changes
4. **Approval**: PR is approved by maintainer
5. **Merge**: PR is merged into main branch

### After Merge

- Delete your feature branch
- Pull latest main branch
- Celebrate! 🎉

## Issue Guidelines

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check documentation** for answers
3. **Reproduce the bug** if reporting an issue

### Bug Reports

Include:
- Clear, descriptive title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment details (OS, browser, Node version)

**Template:**
```markdown
**Describe the bug**
A clear description of the bug

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What should happen

**Screenshots**
If applicable

**Environment**
- OS: [e.g., macOS 13.0]
- Browser: [e.g., Chrome 120]
- Node: [e.g., 18.17.0]
```

### Feature Requests

Include:
- Clear, descriptive title
- Problem you're trying to solve
- Proposed solution
- Alternative solutions considered
- Additional context

### Questions

- Use GitHub Discussions for questions
- Check documentation first
- Provide context and details

## Project Structure

Understanding the project structure helps you contribute effectively:

```
island-bitcoin-community/
├── apps/
│   ├── web/              # Frontend React app
│   └── api/              # Backend API server
├── packages/
│   ├── nostr/            # Nostr utilities
│   └── shared/           # Shared types
├── docs/                 # Documentation
├── drizzle/              # Database migrations
└── scripts/              # Build and deployment scripts
```

## Areas for Contribution

### Good First Issues

Look for issues labeled `good first issue`:
- Documentation improvements
- UI/UX enhancements
- Test coverage
- Bug fixes

### High Priority

- Lightning Network integration
- Mobile responsiveness
- Performance optimizations
- Accessibility improvements

### Feature Ideas

- Multi-language support
- Advanced trivia features
- Social features
- Analytics dashboard

## Development Tips

### Hot Reload

Development servers support hot reload:
```bash
pnpm dev  # Changes auto-reload
```

### Debugging

```typescript
// Frontend debugging
console.log('[Component]', data);

// Backend debugging
console.log('[API]', { request, response });
```

### Database Changes

```bash
# Create migration
pnpm --filter @island-bitcoin/api db:generate

# Apply migration
pnpm --filter @island-bitcoin/api db:migrate

# View database
pnpm --filter @island-bitcoin/api db:studio
```

## Getting Help

### Resources

- **Documentation**: [docs/](../docs/)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md)

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Pull Requests**: Code contributions

### Maintainers

- Review PRs within 48 hours
- Provide constructive feedback
- Help contributors succeed

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes
- Project README (for significant contributions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Island Bitcoin Community! Your efforts help build a better Bitcoin ecosystem in the Caribbean. 🌴₿

**Questions?** Open a GitHub Discussion or reach out to maintainers.
