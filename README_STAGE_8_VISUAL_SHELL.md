# Stage 8 — Visual Shell + Mission Control Home (PATCH)

Goal: make the React app look/feel like a real working site *immediately*.

## Adds
- src/features/layout/AppShell.tsx
- src/features/home/HomePage.tsx

## You must wire it (1 file)
Wrap your existing UI with <AppShell> and add a "Home" tab that renders <HomePage/>.

Router example:
- /home -> HomePage
- Add a nav link to /home

Tab-state example:
- activeTab === "home" -> <HomePage/>
