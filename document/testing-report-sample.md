5.Testing
5.1 Testing Strategy
A structured manual testing strategy was adopted for this project, in line with the module requirements. Since the system is a user-facing web application integrating multiple APIs and database services, testing focused on validating both functional behaviour and interaction between components.
The main objective was to confirm that end users could successfully use all core features through the web interface under normal and abnormal conditions.
All tests were conducted through the deployed web application by simulating realistic user behaviour such as searching routes, checking bike availability, logging into accounts, and saving favourites.
Testing Objectives:
Testing Area	Purpose	Example Activities
Functional Correctness	Ensure each feature performs according to requirements	Route generation, login, weather display
User Interaction		Verify frontend and backend communicate correctly	Form submission, API response rendering
Data Consistency	Ensure displayed data matches returned sources	Bike station counts, forecast values
Robustness	Evaluate system stability under unexpected inputs	Empty forms, invalid locations
Usability Observation	Check clarity and ease of use from user perspective	Navigation flow, button behaviour

Testing was carried out iteratively throughout development rather than only at the end of the project. After each major feature implementation, relevant test cases were executed and any discovered issues were corrected before the next development stage.
5.2 Functional Testing
Functional testing was carried out throughout development to verify that each module behaved according to the system requirements. Testing combined manual user-interface testing, API validation, regression testing after each feature update, and browser compatibility checks using Chrome and Edge.
5.2.1 Bike Information Module
This module was tested using live data from the JCDecaux Dublin Bikes API. Tests were repeated over several days and different time periods to ensure consistency.
Test Cases: 
Test ID			Description	Expected Result	Status
BI-01	View current bike availability	Correct station markers and values displayed	Pass
BI-02	Refresh station data	Values update within 5 seconds	Pass
BI-03	Display hourly forecast	Forecast chart loads correctly	Pass
BI-04	Display weekly averages	Historical averages shown correctly	Pass
BI-05	Invalid API response simulation	Error message displayed	Pass

Total executions: 14 runs
Browsers tested: Chrome, Edge
One issue discovered: delayed marker refresh when API latency exceeded 3 seconds
Resolved via asynchronous loading optimisation (GitHub commit history)
Outcome:
All 5 test cases passed after optimization. Final refresh performance averaged under 2 seconds.
5.2.2 Weather Module
The weather module was tested against OpenWeather API responses to ensure displayed data matched returned JSON values.
Test Cases: 
Test ID		Description	Expected Result	Status
WM-01	Display current weather	Temperature and condition accurate	Pass
WM-02	View hourly forecast	24-hour forecast shown correctly	Pass
WM-03	View daily forecast	7-day forecast displayed	Pass
WM-04	Missing weather icon data	Default icon displayed	Pass
WM-05	API timeout scenario	User warning shown	Pass

Total executions: 12 runs
Data compared manually with raw API JSON responses
One formatting bug found in temperature rounding
Fixed and retested successfully
Outcome:
All weather functionalities operated correctly after bug fixes, with accurate and stable data presentation.

5.2.3 Route Planning Module
The route planning module was tested to verify route generation accuracy, map rendering, and user input validation. Testing used multiple Dublin locations with different distances to ensure the routing service returned consistent results.
Test Cases: 
Test ID		Description	Expected Result	Status
RP-01	Input valid origin and destination	Route generated successfully	Pass
RP-02	Display route on map	Polyline and directions shown correctly	Pass
RP-03	Use nearby locations	Short route generated accurately	Pass
RP-04	Empty input fields	Validation warning displayed	Pass
RP-05	Invalid address input	Error message shown	Pass
RP-06	Swap start/end locations	Route recalculated correctly	Pass

Total executions: 15 test runs
Tested with city centre, suburban, and cross-city journeys
Browsers tested: Chrome and Edge
One issue discovered: route rendering delay when multiple requests were submitted quickly
Fixed by disabling repeated button clicks during request processing
Outcome:
All route-planning functions performed successfully after optimisation. Routes were generated accurately, and invalid inputs were handled with clear user feedback.
5.3 Integration Testing
Integration testing was performed to verify that independent system modules communicated correctly after being combined into a complete application. The objective was to ensure stable data exchange between the frontend interface, backend server logic, external APIs, and the database layer.
Testing was carried out incrementally during development whenever new features were merged into the main branch. A total of 17 integration test scenarios were executed.
5.3.1 Frontend ↔ Backend Communication
This phase tested whether user actions on the web interface correctly triggered backend Flask routes and returned valid responses.
Test Scenarios: 
Test ID		Description	Expected Result	Status
INT-01	Submit login form	User authenticated successfully	Pass
INT-02	Request route generation	Route data returned and displayed	Pass
INT-03	Save favourite station	Success response returned	Pass
INT-04	Invalid form submission	Validation message shown	Pass

Browser Developer Tools used to inspect HTTP requests/responses
JSON responses verified manually
Status codes 200 / 400 / 401 handled correctly
Outcome:
Frontend requests successfully triggered backend logic, and all tested responses were returned correctly.

5.3.2 Backend ↔ External APIs
This phase verified communication between the Flask backend and third-party APIs including bike station data, weather services, and routing services.
Test Scenarios: 
Test ID		Description	Expected Result	Status
INT-05	Retrieve bike station data	JSON data received successfully		Pass
INT-06	Retrieve weather forecast	Weather values parsed correctly	Pass
INT-07	Generate route from API	Route coordinates returned	Pass
INT-08	Simulate API timeout	Error message handled gracefully	Pass

API responses checked using logs and console output
Data compared with official API documentation
Timeout behaviour tested through delayed requests
Outcome:
External services integrated successfully. Minor delays occurred depending on network conditions, but no critical failures were observed.

5.3.3 Backend ↔ Database
This phase tested whether the backend correctly stored, retrieved, updated, and deleted user-related data.
Test Scenarios: 
Test ID		Description	Expected Result	Status
INT-09	Create new user account	Record inserted into database		Pass
INT-10	Retrieve favourites list	Correct records returned	Pass	Pass
INT-11	Delete favourite station	Record removed successfully	Pass
INT-12	Session persistence	User remains logged in	Pass

SQL queries manually verified using database tools
Insert/update/delete operations confirmed
Duplicate user prevention tested
Outcome:
Database integration operated reliably with accurate data persistence and retrieval.

5.4 Limitations
Although testing produced positive results, several limitations remain.
5.4.1 Manual Testing Approach
Most tests were performed manually rather than through automated frameworks such as PyTest or Selenium. While manual testing is effective for user-interface validation, it is slower and less scalable than automated regression testing.
5.4.2 Limited Performance Testing
The application was not tested under heavy concurrent traffic or stress conditions. Therefore, system behaviour with hundreds of simultaneous users remains unknown.
Future work should include:
Load testing using JMeter or Locust
Response time benchmarking
Database scalability testing
5.4.3 Dependency on External APIs
The system relies on third-party APIs for bike availability, weather data, and routing services. If these services experience downtime, latency, or policy changes, application functionality may be affected.
5.5 Conclusion
The testing process confirms that the system meets its functional requirements. All major features operate correctly, and the integration between frontend, backend, and external services is stable. Minor limitations exist due to reliance on external APIs and lack of automated testing, but overall system performance is satisfactory.
