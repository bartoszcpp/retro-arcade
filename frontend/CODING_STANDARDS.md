# Coding Standards & Best Practices

This document outlines the strict coding conventions for this project. These standards must be followed by all contributors (including AI assistants) to ensure maintainability, readability, and consistency across the codebase.

## 1. General Rules

- **Language:** English ONLY. This applies to UI text, comments, variable names, commit messages, and `console.log` statements. No Polish words are allowed in the source code.
- **File Naming:** Use `PascalCase` for React components (e.g., `PongGame.tsx`) and `camelCase` or `kebab-case` for standard TypeScript files and utilities (e.g., `server.ts`, `index.ts`).

## 2. React Components

- **Component Syntax:** Use Arrow Functions for all React components. Avoid the `function` keyword.
- **Exports:** Use Named Exports (`export const Component = ...`) rather than `export default`. This enforces consistent naming when importing components across the app.
- **Implicit Returns:** Use implicit returns for simple presentational components where possible (e.g., `export const Component = () => ( <div>...</div> );`).

## 3. TypeScript & Typing

- **Strict Typing:** The `any` keyword is strictly prohibited. If a type is unknown, use `unknown` and assert/narrow it properly, or define the exact shape of the data.
- **Interfaces over Types:** Use `interface` for declaring object shapes (especially state and props). Use `type` only when necessary for unions or mapped types.
- **Prop Types:** Always define an explicit `interface` for React component props (e.g., `interface LobbyProps { ... }`).
- **Centralized Types:** Shared definitions (like API payloads, WebSockets messages, or global game state types) must be kept in a centralized location, such as `src/types/index.ts`.
- **Type Imports:** Always use explicit type imports (e.g., `import type { MyType } from './types';`) to comply with `verbatimModuleSyntax` and ensure clean JavaScript compilation.

## 4. Architecture

- **Component Modularity:** Keep components small and focused on a single responsibility. Do not dump the entire application state and logic into one massive file (like `App.tsx`).
- **Logic Separation:** Separate pure UI rendering from complex business logic. UI components (like `Lobby.tsx` or `Chat.tsx`) should primarily receive state and handlers via props.
