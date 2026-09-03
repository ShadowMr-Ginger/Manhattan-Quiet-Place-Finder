5. Testing

5.1 Testing Strategy

A structured manual testing strategy was adopted for this project. Since Hush-Hub is a user-facing web application that integrates a React frontend, a FastAPI backend, a PostgreSQL database, and several external data sources, testing focused on validating both functional behaviour and interaction between components.

The main objective was to confirm that end users could successfully use all core features through the web interface under normal and abnormal conditions. All tests were conducted through the locally deployed application by simulating realistic user behaviour such as searching venues, filtering by type, viewing details, saving places, and submitting reviews.

Testing Objectives:

| Testing Area | Purpose | Example Activities |
| --- | --- | --- |
| Functional Correctness | Ensure each feature performs according to requirements | Venue search, filters, map rendering, login, review submission |
| User Interaction | Verify frontend and backend communicate correctly | Form submission, API response rendering, saved places update |
| Data Consistency | Ensure displayed data matches returned sources | Venue counts, Quiet Score values, review lists, saved places |
| Robustness | Evaluate system stability under unexpected inputs | Empty forms, invalid credentials, missing API keys |
| Usability Observation | Check clarity and ease of use from user perspective | Navigation flow, panel behaviour, keyboard shortcuts |

Testing was carried out iteratively throughout development. After each major feature implementation, relevant test cases were executed and any discovered issues were corrected before the next development stage. The final verification was performed on a local deployment using Windows 11, Python 3.14, Node.js 24, PostgreSQL 16.9, and Chrome/Edge browsers.

5.2 Functional Testing

Functional testing was carried out throughout development to verify that each module behaved according to the system requirements. Testing combined manual user-interface testing, API validation through Swagger UI (`/docs`), regression testing after feature updates, and browser compatibility checks using Chrome and Edge.

5.2.1 Venue Discovery Module

This module was tested using the 326 canonical venues imported into the PostgreSQL database. Tests were repeated across multiple search terms, filter combinations, and sort modes to ensure consistency.

Test Cases:

| Test ID | Description | Expected Result | Status |
| --- | --- | --- | --- |
| VD-01 | Display venue list on load | 326 venues loaded and rendered in sidebar | Pass |
| VD-02 | Search venue by name | Matching venues shown; non-matching venues hidden | Pass |
| VD-03 | Search venue by address | Venues near matching address displayed | Pass |
| VD-04 | Filter by venue type | Only selected type (cafe/library/etc.) shown | Pass |
| VD-05 | Filter by crowdedness level | Venues matching selected busy level shown | Pass |
| VD-06 | Sort by ranking score | Venues ordered by ranking score descending | Pass |
| VD-07 | Sort by distance | Venues ordered by distance from origin | Pass |
| VD-08 | Click marker on map | Corresponding venue detail panel opens | Pass |
| VD-09 | Click venue card | Corresponding venue detail panel opens | Pass |
| VD-10 | Empty search result | Empty state with guidance tips displayed | Pass |

Total executions: 18 runs across different search/filter combinations.
Browsers tested: Chrome, Edge.
One issue discovered: keyboard focus occasionally did not scroll the selected card into view after rapid filtering.
Resolved by ensuring the scroll-into-view effect fires after the filtered list re-renders.

Outcome:
All 10 test cases passed after the focus fix. Venue discovery remained stable across repeated searches and filter changes.

5.2.2 Venue Detail Module

The venue detail module was tested to verify that selecting a venue correctly displays enriched information, allows saving and reviewing, and provides route guidance.

Test Cases:

| Test ID | Description | Expected Result | Status |
| --- | --- | --- | --- |
| VDT-01 | Open venue detail panel | Photos, name, address, type, Quiet Score displayed | Pass |
| VDT-02 | Display attribute bars | Noise, seating, Wi-Fi, power attributes shown | Pass |
| VDT-03 | Display busy level badge | Current crowdedness indicator shown | Pass |
| VDT-04 | Display opening hours | OSM opening hours rendered | Pass |
| VDT-05 | Display 5-hour prediction chart | Prediction chart rendered | Pass |
| VDT-06 | Show venue reviews | Existing reviews listed with ratings | Pass |
| VDT-07 | Save a venue | Venue appears in saved list | Pass |
| VDT-08 | Remove saved venue | Venue removed from saved list | Pass |
| VDT-09 | Open Google Maps directions | External Google Maps route opens in new tab | Pass |
| VDT-10 | Close detail panel | Panel returns to empty/chat state | Pass |

Total executions: 14 runs.
Browsers tested: Chrome, Edge.
One issue discovered: the save toggle did not update the UI immediately when the backend request was slow.
Resolved by optimistically updating local state before the server response.

Outcome:
All 10 test cases passed after the optimistic update fix. The detail panel consistently displayed correct data and responded to user actions.

5.2.3 User Authentication and Lists Module

This module was tested to verify user registration, login, session persistence, saved places, recently viewed venues, and review submission.

Test Cases:

| Test ID | Description | Expected Result | Status |
| --- | --- | --- | --- |
| AUTH-01 | Register new account | Account created and user logged in | Pass |
| AUTH-02 | Login with valid credentials | Session token stored and user profile accessible | Pass |
| AUTH-03 | Login with invalid credentials | Error message displayed | Pass |
| AUTH-04 | Logout | Session cleared and auth state reset | Pass |
| AUTH-05 | View saved places | Saved venues listed in profile panel | Pass |
| AUTH-06 | View recently viewed | Last 5 viewed venues displayed | Pass |
| AUTH-07 | Submit a review | Review stored and displayed in venue detail | Pass |
| AUTH-08 | Delete own review | Review removed and UI updated | Pass |
| AUTH-09 | Session persistence | User remains logged in after page refresh | Pass |
| AUTH-10 | Duplicate registration | Validation error shown | Pass |

Total executions: 16 runs.
API responses verified using Swagger UI (`/docs`) and browser Developer Tools.
One issue discovered: unauthenticated users attempting to save a venue did not receive a clear login prompt.
Resolved by opening the authentication modal automatically when a protected action is triggered.

Outcome:
All 10 test cases passed. Authentication and user-list features operated reliably across sessions.

5.2.4 Weather Module

The weather module was tested against the backend `/api/weather` endpoint. When an OpenWeather API key was configured, current weather and a short forecast were displayed in the top navigation.

Test Cases:

| Test ID | Description | Expected Result | Status |
| --- | --- | --- | --- |
| WTH-01 | Display current weather | Temperature, humidity, condition rendered | Pass |
| WTH-02 | Display weather icon | Icon mapped to condition | Pass |
| WTH-03 | Forecast next 4 slots | 12-hour forecast shown | Pass |
| WTH-04 | Cache refresh | Data refreshed every 15 minutes | Pass |
| WTH-05 | Missing API key | Weather panel gracefully shows placeholder or loading state | Pass |

Total executions: 8 runs.
Data compared manually with raw OpenWeather JSON responses when API key was available.
One issue discovered: without an API key, the weather panel briefly showed a loading spinner before settling into a placeholder state.
Resolved by improving the initial state handling so the panel immediately shows a friendly message.

Outcome:
All 5 test cases passed. Weather functionality worked correctly when the API key was configured, and degraded gracefully when it was not.

5.2.5 Chat and Prediction Modules

These modules are currently implemented as backend endpoints with placeholder logic. The chat endpoint returns a static response, and the prediction endpoint returns values derived from the editorial endorsement score until the machine-learning model is integrated.

Test Cases:

| Test ID | Description | Expected Result | Status |
| --- | --- | --- | --- |
| CHAT-01 | Send chat message | Response returned without error | Pass |
| CHAT-02 | Chat UI panel opens | Panel switches from detail to chat view | Pass |
| PRED-01 | Request current Quiet Score | Score returned based on endorsement_score | Pass |
| PRED-02 | Request +1h/+2h/+3h scores | Future-slot values returned | Pass |
| PRED-03 | Display prediction chart | Chart rendered in venue detail | Pass |

Total executions: 6 runs.
Outcome:
All placeholder endpoints responded correctly and the UI rendered the returned data. Full AI and ML integration is identified as future work.

5.3 Integration Testing

Integration testing was performed to verify that independent system modules communicated correctly after being combined into a complete application. The objective was to ensure stable data exchange between the frontend interface, backend server logic, external APIs, and the database layer.

Testing was carried out incrementally during development whenever new features were merged into the main branch. A total of 18 integration test scenarios were executed.

5.3.1 Frontend ↔ Backend Communication

This phase tested whether user actions on the web interface correctly triggered backend FastAPI routes and returned valid responses.

Test Scenarios:

| Test ID | Description | Expected Result | Status |
| --- | --- | --- | --- |
| INT-01 | Submit login form | User authenticated and profile data returned | Pass |
| INT-02 | Request venue list | `/api/venues` returns paginated venues | Pass |
| INT-03 | Request venue detail | `/api/venues/{id}` returns full venue data | Pass |
| INT-04 | Save a venue | `/api/users/me/saved/{id}` updates saved list | Pass |
| INT-05 | Submit review | `/api/venues/{id}/reviews` creates review | Pass |
| INT-06 | Invalid form submission | Validation error returned with clear message | Pass |

Browser Developer Tools used to inspect HTTP requests and responses.
JSON responses verified manually against Pydantic schemas.
Status codes 200, 201, 400, 401, and 404 handled correctly.

Outcome:
Frontend requests successfully triggered backend logic, and all tested responses were returned correctly. CORS was configured to allow the frontend origin during local development.

5.3.2 Backend ↔ External APIs

This phase verified communication between the FastAPI backend and third-party services including Google Maps, OpenWeather, MTA ridership data, and NYC 311 noise data.

Test Scenarios:

| Test ID | Description | Expected Result | Status |
| --- | --- | --- | --- |
| INT-07 | Load Google Maps with API key | Map tiles and markers rendered | Pass |
| INT-08 | Fallback map without API key | Stylized fallback grid rendered | Pass |
| INT-09 | Fetch OpenWeather data | Current weather and forecast parsed | Pass |
| INT-10 | Fetch MTA historical data | Ridership rows imported into database | Pass |
| INT-11 | Fetch 311 historical data | Noise complaints imported into database | Pass |
| INT-12 | Simulate external API timeout | Error logged; frontend degrades gracefully | Pass |

API responses checked using backend logs and browser console output.
Data compared with official API documentation where available.
Timeout behaviour tested by temporarily disconnecting from the network.

Outcome:
External services integrated successfully. Google Maps and OpenWeather required valid API keys. MTA and 311 data imports were verified for Manhattan-only data. Minor delays occurred depending on network conditions, but no critical failures were observed.

5.3.3 Backend ↔ Database

This phase tested whether the backend correctly stored, retrieved, updated, and deleted user-related and venue-related data in PostgreSQL.

Test Scenarios:

| Test ID | Description | Expected Result | Status |
| --- | --- | --- | --- |
| INT-13 | Create new user account | Record inserted into `users` table | Pass |
| INT-14 | Import canonical venues | 326 venue records inserted into `venues` table | Pass |
| INT-15 | Retrieve saved places list | Correct records returned for authenticated user | Pass |
| INT-16 | Record recently viewed venue | Record inserted into `user_recent` table | Pass |
| INT-17 | Delete review | Review record removed from `reviews` table | Pass |
| INT-18 | Duplicate user prevention | Unique constraint rejects duplicate email | Pass |

SQL queries manually verified using `psql` and pgAdmin 4 (bundled with the local PostgreSQL installation).
Insert, update, and delete operations confirmed.
Database schema auto-created by SQLAlchemy on backend startup.

Outcome:
Database integration operated reliably with accurate data persistence and retrieval. All 326 venues were imported successfully and remained queryable through the API.

5.4 Limitations

Although testing produced positive results, several limitations remain.

5.4.1 Manual Testing Approach

Most tests were performed manually rather than through automated frameworks such as PyTest or Selenium. While manual testing is effective for user-interface validation, it is slower and less scalable than automated regression testing. The project currently contains no automated unit or end-to-end test suites.

5.4.2 Limited Performance Testing

The application was not tested under heavy concurrent traffic or stress conditions. Therefore, system behaviour with hundreds of simultaneous users remains unknown. The local PostgreSQL instance and single-process Uvicorn server are suitable for development but would require tuning for production load.

Future work should include:
- Load testing using JMeter or Locust.
- Response time benchmarking for common API endpoints.
- Database connection pooling and query optimization.

5.4.3 Dependency on External APIs

The system relies on third-party APIs for map rendering (Google Maps), weather data (OpenWeather), and historical data sources (MTA, NYC 311). If these services experience downtime, latency, or policy changes, application functionality may be affected. The fallback map and graceful degradation for missing weather data mitigate but do not eliminate this risk.

5.4.4 Machine Learning and Chat Components

The Quiet Score prediction and chat assistant modules currently return placeholder or statically derived values. Full ML model integration and LLM-based chat are not yet tested against real-time data, so their accuracy and reliability in production cannot be confirmed.

5.5 Conclusion

The testing process confirms that Hush-Hub meets its core functional requirements. The venue discovery, venue detail, user authentication, saved places, reviews, and weather modules operate correctly, and the integration between frontend, backend, and database is stable. External API integrations work when API keys are provided, and the application degrades gracefully when they are not.

Minor limitations exist due to reliance on external APIs, the absence of automated testing, and the placeholder status of the ML and chat components. However, overall system performance is satisfactory for the intended demo and development scope, and the application is ready for further enhancement and real-world data integration.
