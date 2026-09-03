User Story Document - Manhattan Quiet Place Finder
Project Name: Manhattan Quiet Place Finder 
Project Description: A web application that helps users in Manhattan, New York find quiet places for studying, working, and relaxing. Features include map browsing, quiet score ratings, transit time estimates, favorites comparison, weather-based suggestions, and more.


1.User Interview
Persona 1: Student at University

Interview Transcript:
Q: How do you usually find good study spots?
A: I used to rely on friend recommendations or just walk into random cafes, but I often run into construction noise, loud music, or no available seats. I tried Yelp, but it doesn't tell you how quiet a place actually is.

Q: Which filters matter most to you? 
A: Free first, then quiet. I filter to show only Public Study Areas and Libraries, excluding cafes that require spending money. Distance also matters -- I do not want to walk more than 10 minutes.

Q: Which features help you the most?
A: The score for the level of quietness, and real-time occupancy. If I know a place is only 20% full right now with a Quiet Score above 85, I will go there immediately. The time-based prediction is also very useful because I usually study in the afternoons, so being able to see if a place will get noisy in an hour saves me from wasting a trip.

Q: Are the time-based features useful to you?
A: I like the Quiet Score over time feature. For example, I know some cafes get noisy after 3 PM when nearby schools let out, so I can avoid them in advance.

Q: Do user reviews and tags help?
A: Very much. If someone says "lots of outlets" or "quiet in the afternoon," that feels more real than official descriptions. Tags also let me quickly understand a place without reading long reviews.

Q: Do you need the compare feature?
A: Yes. I was hesitating between two cafes, and the compare mode let me see at a glance which one is closer, quieter, and better rated. The recommendation summary said "A is quieter but B is closer," which saved me a lot of decision time.

Q: Is the favorites feature useful to you?
A: Very useful. I have bookmarked five cafes and libraries that I visit regularly. Now I just open my profile page and see the list without searching every time.

Q: Anything you think could be improved?
A: I wish I could see how many power outlets each place has -- that is critical for laptop users. Also, if the weather is bad, it would be great to prioritize indoor spots close to the subway.

User Story: 
As a PhD student who needs long periods of focused study time, I want to quickly find quiet, low-occupancy places near my home or campus so that I can work on my dissertation efficiently. I want to bookmark my regular spots and compare multiple candidates side by side, while receiving smart recommendations based on weather and time of day.

Acceptance Criteria:
A.Search results display Quiet Score, real-time occupancy percentage, and distance
B.Support filtering by venue type (library, public study area, cafe, etc.)
C.Support filtering and sorting by Quiet Score, distance, and occupancy level
D.Display current and predicted future Quiet Scores
E.Ability to bookmark places and view the favorites list on the profile page
F.Venue cards display user tags and average ratings
G.Side-by-side comparison of two places with winner highlights
H.Smart venue recommendations based on current time and weather conditions(AI assistant)


Persona 2: Office Worker

Interview Transcript:
Q: How often do you use this app?
A: Almost every morning before I leave home. I check the weather first. If it is raining, I look for indoor cafes near subway exits. If the weather is nice, I might consider a public study area, mainly depends on the environment and decoration of the study area.

Q: Does the weather widget influence your decisions?
A: A lot. New York weather changes quickly. On rainy or snowy days, I do not want to walk far. The smart tip in the weather panel directly tells me "Rainy day -- libraries and indoor coworking spaces are your best bet," which removes the guesswork.

Q: Is the compare feature useful for you? 
A: Useful but not used often. I mainly use it to see the score distribution of three nearby cafes and understand why some score higher. Better location? Or quieter atmosphere?

Q: What else do you think this app could do for business owners? 
A: If there were an owner dashboard where I could update business hours, WiFi passwords, and current seating availability in real time, that would benefit both customers and owners. Right now the data seems static.

Q: Are the transit time estimates accurate enough?
A: The walking and subway estimates work well for me. I do not need minute-perfect accuracy. Knowing whether it is an "8-minute walk" or a "12-minute subway ride" is enough to decide my transportation.

Q: Which filters matter most to you when choosing a workspace?
A: Distance and WiFi quality are my top priorities. I often have video meetings, so a strong internet connection is essential. I also prefer places with moderate occupancy because extremely crowded places can be distracting.

Q: Do you find the occupancy information useful?
A: Yes. If I see a venue is already 90% full, I usually avoid it because I might not find a seat with a power outlet. Real-time occupancy helps me decide before leaving home.

Q: Are user reviews and tags important to you?
A: Definitely. I usually look for tags like "good WiFi," "many outlets," or "comfortable seating." Reviews often reveal practical details that are not shown in the venue description.

Q: Do you use the favorites feature?
A: Yes. I have several cafes and coworking spaces that I visit repeatedly. Saving them to favorites makes it easy to switch between locations depending on my schedule.

Q: Would time-based predictions help you?
A: Yes. Some cafes are quiet in the morning but become crowded around lunch time. If I know occupancy is expected to increase significantly, I can plan my work session somewhere else.

Q: What improvements would you like to see?
A: It would be helpful if venues could display the number of available power outlets and whether phone calls are allowed. That information is important for remote workers.

User Story:
 As a remote worker who needs to work outside several days a week, I want to quickly find suitable workspaces based on daily weather and transit conditions so that I can complete my design projects efficiently. I need to compare WiFi quality and environment ratings across venues, and I want a dark mode option to protect my eyesight.

Acceptance Criteria:
A.Weather panel displays current weather and provides smart venue recommendations(AI assistant)
B.Photos of the quiet places
C.Need to check the route. Can hyperlink to Google Map. 
D.Venue detail panel displays WiFi signal strength and operating hours, user tags, review content, and ratings.


Persona 3: Tourist

Interview Transcript:

Q: What do you pay attention to when you first open the app? 
A: The map. I do not know Manhattan street names well, but seeing the markers on the map tells me how far a place is from my hotel. The marker colors also let me tell at a glance whether it is a cafe or a library.

Q: Have you ever gotten zero search results? 
A: Once. I set my filters too strictly and nothing showed up. But the empty state page was very friendly. It had animations and tips, and it suggested I loosen my filters.

Q: Do photo carousels help you choose a place?
A: Very much. I want to see what the inside of a cafe looks like -- whether it has big windows, whether the seating is comfortable. Photos are much more intuitive than text descriptions.

Q: Do you use the recently viewed feature? 
A: Yes. I visited a nice library a few days ago and forgot the name. I found it in my recently viewed list.

Q: Which filters are most useful for you?
A: Distance from my hotel is the most important. I also prefer places with high ratings and good photos because I am unfamiliar with the area and need visual guidance.

Q: Do occupancy and Quiet Score affect your decisions?
A: Yes. If I want to relax or answer emails, I prefer places with lower occupancy and higher Quiet Scores. It helps me avoid unexpectedly crowded locations.

Q: Are user reviews and tags helpful?
A: Very helpful. I especially pay attention to comments from other tourists. Tags like "tourist-friendly," "quiet atmosphere," or "great view" immediately catch my attention.

Q: Do you use the compare feature?
A: Sometimes. When several places are near my hotel, comparing ratings, distance, and Quiet Scores side by side helps me make a quick decision.

Q: Would weather-based recommendations be useful?
A: Yes. When it rains, I would like the app to suggest indoor locations nearby. It saves time because I do not know the city well.

Q: Is the favorites feature useful during your trip?
A: Yes. During a week-long stay, I often revisit places I liked. Saving them to favorites helps me find them again without searching.

Q: What improvements would you like to see?
A: It would be useful to display nearby landmarks and public transportation options. As a tourist, I often navigate using landmarks rather than street names.

User Story: 
As a tourist unfamiliar with Manhattan, I want to quickly find quiet places near my hotel for temporary work or relaxation through an intuitive map and visual cues. I want to see venue photos, occupancy status, and receive friendly guidance when my filters are too strict.

Acceptance Criteria:
A.Map markers display different colors by venue type and support click interaction
B.Venue cards and detail panels display real photo carousels
C.Friendly animated empty state with guidance when filters return no results
D.Recently viewed list supports quick revisits




2.Feature Specification
Following the user interviews and persona analysis, the functional requirements of the system were identified by examining the recurring needs and pain points expressed by the target users. Students emphasized the importance of finding quiet, low-occupancy study spaces, remote workers highlighted the need for weather-aware recommendations and reliable workspace information, while tourists required intuitive navigation and visual guidance in unfamiliar environments.

To address these requirements, a set of core features was defined for the application. Each feature is designed to support one or more user personas and contribute to a more efficient venue discovery experience. The following tables present the feature descriptions, the personas they address, and their development priority based on the MoSCoW prioritization framework.


Number	Feature	Description	Related Persona(s)	Priority
1	Map View	Displays all available quiet places on an interactive map, helping users understand location distribution and proximity to their current position, hotel, home, or workplace.	Tourist, Student, Office Worker	Must Have
2	Place Markers	Uses different marker colors and icons to distinguish venue types (e.g., library, public study area, cafe), allowing users to identify suitable locations at a glance.	Tourist, Student	Must Have
3	Quiet Score	Provides a numerical score representing the noise level and suitability for focused work or study. Higher scores indicate quieter environments.	Student, Tourist, Office Worker	Must Have
4	Filters & Sorting Methods	Allows users to filter and sort venues by criteria such as venue type, Quiet Score, distance, occupancy level, ratings, and amenities.	Student, Tourist, Office Worker	Must Have
5	Quiet Score Prediction	Displays predicted future Quiet Scores based on historical trends and real-time data, helping users avoid places that may become noisy later.	Student, Office Worker	Must Have
6	Toggle Favorite	Enables users to save frequently visited venues and access them quickly from their profile or favorites list.	Student, Tourist, Office Worker	Could Have
7	Venue Cards	Presents key venue information including Quiet Score, occupancy level, ratings, distance, tags, and operating hours in a concise format.	Student, Tourist, Office Worker	Must Have
8	Venue Photos	Displays photo galleries showing venue interiors, seating arrangements, lighting, and overall atmosphere to support decision-making.	Tourist, Office Worker	Could Have
9	Comparison	Allows side-by-side comparison of multiple venues based on metrics such as Quiet Score, distance, ratings, occupancy, and WiFi quality.	Student, Office Worker, Tourist	Could Have
10	Route Service	Provides navigation support through integrated map services (e.g., Google Maps) and estimates travel time by walking or public transit.	Tourist, Office Worker	Could Have
11	Weather Panel	Displays current weather conditions and forecasts to help users select appropriate indoor or outdoor work/study locations.	Office Worker, Tourist	Could Have
12	Smart Venue Recommendation	Uses contextual factors such as weather, time of day, occupancy, and user preferences to recommend the most suitable venues.	Student, Office Worker, Tourist	Could Have
13	Recently Viewed	Maintains a history of recently viewed venues, allowing users to quickly revisit places they have explored before.	Tourist	Could Have