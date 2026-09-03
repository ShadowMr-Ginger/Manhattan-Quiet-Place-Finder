5. Testing

5.1 Testing Strategy
Manual, iterative testing was conducted on the Manhattan Quiet Place Finder frontend prototype across Chrome, Edge, and Firefox. Tests covered functional correctness, component integration, browser compatibility, and responsive behavior. All data is mock; no backend is required.

5.2 Functional & Integration Testing

| ID | Module | Description | Expected Result | Status |
|----|--------|-------------|-----------------|--------|
| SF-01 | Search & Filter | Search by name or address | Matching places listed | Pass |
| SF-02 | Search & Filter | Empty or no-match query | Empty state shown | Pass |
| SF-03 | Search & Filter | Type + quiet score filter + sort by distance/score | Results updated correctly | Pass |
| MAP-01 | Map | Click marker selects place | Detail panel opens | Pass |
| MAP-02 | Map | Google Maps with API key / fallback stylized map | Correct map rendered | Pass |
| PD-01 | Place Details | View quiet score, occupancy, hours, tags | Data shown correctly | Pass |
| PD-02 | Place Details | Quiet score prediction chart | 5-hour chart rendered | Pass |
| PD-03 | Place Details | Favorite / save toggle | Profile updated | Pass |
| CMP-01 | Compare | Toggle compare mode and select 2 places | Compare panel opens | Pass |
| CMP-02 | Compare | Remove place from compare | Panel updates | Pass |
| CH-01 | AI Chat | Send keyword message (cafe/library/coworking/quiet) | Relevant mock reply shown | Pass |
| CH-02 | AI Chat | Send generic message | Default reply shown | Pass |
| PR-01 | Profile | Open profile modal | Favorites and saved places listed | Pass |
| UI-01 | UI / UX | Theme toggle | Dark/light switch works | Pass |
| UI-02 | UI / UX | Keyboard shortcuts (/, Esc, c, d, ?) | Correct actions triggered | Pass |
| INT-01 | Integration | Sidebar → Map → Detail panel state sync | State consistent | Pass |
| INT-02 | Integration | localStorage persistence for favorites/saved | Data retained across reloads | Pass |
| INT-03 | Compatibility | Chrome, Edge, Firefox | Layout and interactions stable | Pass |
| INT-04 | Responsiveness | Desktop (1024px+) and mobile viewports | Layout adapts | Pass |

5.3 Outcome
All 19 test cases passed. The prototype delivers core features—search, filtering, map interaction, place details, comparison, AI chat, and profile—successfully. Identified future work: full mobile responsiveness, real backend API, and live AI integration.
