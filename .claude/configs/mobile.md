# Mobile App Configuration

## Technology Stack
- **Framework**: Expo (React Native) with managed workflow
- **Navigation**: Expo Router (file-based, tabs + stack)
- **Language**: TypeScript (same as web frontend)
- **State Management**: TanStack Query (server) + Zustand (client)
- **Forms**: React Hook Form + Zod
- **Styling**: nativewind (Tailwind CSS for RN)
- **Charts**: victory-native + react-native-svg
- **Auth**: HTTP Basic Auth, credentials in expo-secure-store
- **Build**: EAS Build for APK generation

## Navigation Structure
- Bottom tabs: Dashboard, Transactions, Debts, More
- More tab links to: Accounts, Categories, Tags, People, Settings
- Create/Edit forms as modal stack screens

## Code Sharing from Web Frontend
Copy verbatim: types/, api/query-keys.ts, lib/currency.ts, stores/filter-store.ts
Copy with edits: api/client.ts (configurable base URL), api/use-*.ts (replace toast)
Rewrite: all UI components, navigation, charts

## API Layer
- Configurable base URL (entered on first launch)
- HTTP Basic Auth on every request
- Same REST endpoints as web frontend

## Phase 1 Scope
- All features EXCEPT PDF import
- Backup export/restore included

## Phase 2 (later)
- PDF import with expo-document-picker
