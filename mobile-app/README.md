# Hush-Hub Mobile App

Hush-Hub is a Flutter client for discovering quiet study and work spaces across Manhattan. It combines venue data from the Hush-Hub backend with Google Maps and Google Places to provide map-based discovery, synchronized list browsing, quietness signals, reviews, saved places, and personalized accessibility settings.

<p align="center">
  <img src="https://img.shields.io/badge/Flutter-3.x-02569B?logo=flutter" alt="Flutter 3.x" />
  <img src="https://img.shields.io/badge/Dart-%3E%3D3.2-0175C2?logo=dart" alt="Dart 3.2 or newer" />
  <img src="https://img.shields.io/badge/Platforms-Android%20%7C%20iOS-64748B" alt="Android and iOS" />
  <img src="https://img.shields.io/badge/State-Provider-7C3AED" alt="Provider" />
</p>

## Release downloads and installation

Prebuilt mobile artifacts are available from the [Hush-Hub v1.0.0 GitHub release](https://github.com/eelj457/Hush-Hub/releases/tag/v1.0.0).

- **Android (`HushHub_Mobile_Android.apk`)** — Can be sideloaded on a compatible Android device. The device may require permission to install apps from the browser or file manager used to open the APK.
- **iOS (`HushHub_Mobile_iOS.ipa`)** — Provided as a development build artifact for reference and demonstration. It is not an App Store, TestFlight, Enterprise, or generally distributable Ad Hoc build. It can only be installed on a device permitted by the original development provisioning profile, with Developer Mode enabled. It will not install directly on an arbitrary iPhone.

To run the iOS app on another device, build the source in Xcode using an authorized Apple development team and provisioning profile. General distribution requires a valid Apple Distribution certificate and an App Store, TestFlight, or appropriate Ad Hoc provisioning profile.

## Current features

### Discovery map

- Google Maps discovery experience centered on Manhattan
- Backend venue markers with clustering and platform-aware heatmap support
- Current-location permission handling and map recentering
- Venue-type filters for cafés, libraries, and public study areas
- Live or fallback busyness information for map markers
- Google Places autocomplete alongside matches from the Hush-Hub venue database

The search bar follows two submission paths:

1. An exact match with a backend venue name opens that venue's details page.
2. Any other recognized Google Places result moves the map to that location.

While the user types, local Hush-Hub venues appear under **Our Spaces** and Google Places predictions appear under **Locations**.

### Synchronized map and list

Discovery and List show the same geographic result set. When the map camera stops moving, the app calculates which backend venues are inside the visible map bounds and stores their IDs in `FilterProvider`. The List page watches those IDs and displays only the venues currently visible on the map.

```text
Map camera becomes idle
  -> calculate visible backend venue IDs
  -> FilterProvider.setVisibleVenueIds(...)
  -> rebuild List with the same venues
```

The List page also supports sorting by rating, busyness, and distance. Venue-type filters are shared between Map and List.

### Venue details

- Google Places photos with a fallback image
- Address, opening hours, rating, directions, and venue attributes
- Current busyness and an hourly busyness timeline
- Quiet-profile signals for noise, construction, events, transit, and crowding
- Representative quotes and detailed attribute scores
- Public review browsing
- Authenticated review creation and deletion
- Authenticated save/unsave and recent-view tracking

### Accounts and personalization

- Registration, login, logout, email verification resend, and password reset flows
- Bearer-token authentication for protected backend endpoints
- Saved places, recently viewed places, and personal review history
- English, Simplified Chinese, and Spanish localization
- System, light, dark, high-contrast light, and high-contrast dark themes
- Configurable text scaling persisted with `SharedPreferences`
- Semantics labels and accessible controls across primary interactions

### Quiet AI assistant

Authenticated users can open the chat assistant from Map or List. Responses can include backend venue recommendations that link directly to venue details. The quality and availability of assistant responses depend on the configured backend implementation.

## Main navigation

| Destination | Route | Authentication | Purpose |
|---|---|---:|---|
| Discovery | `/map` | No | Search, filters, map markers, heatmap, and location controls |
| List | `/list` | No | Venues synchronized with the visible map area |
| Saved | `/saved` | Yes | Saved venues with sorting controls |
| Profile | `/profile` | Yes | Account statistics, history, reviews, language, and appearance |
| Venue details | `/details/:id` | No | Venue information, quiet profile, photos, and reviews |
| AI assistant | `/chat` | Yes | Conversational venue recommendations |
| Recent views | `/recent` | Yes | Recently opened venues |
| My reviews | `/my-reviews` | Yes | Reviews created by the current user |

Authentication is enforced in the UI for protected actions and screens. The backend must also enforce authorization for protected API endpoints.

## Technology

| Area | Packages and services |
|---|---|
| Framework | Flutter and Dart |
| State management | `provider` and `ChangeNotifier` |
| Navigation | `go_router` with a stateful indexed shell |
| HTTP client | `dio` |
| Maps | `google_maps_flutter` |
| Map clustering | `google_maps_cluster_manager_2` |
| Places search and photos | Google Places Web Service |
| Location | `geolocator` |
| Localization | Flutter localization generation and `intl` |
| Local preferences | `shared_preferences` |
| UI | Material, Google Fonts, Flutter Lucide, and AutoSizeText |

## Requirements

- Flutter SDK with Dart `>=3.2.0 <4.0.0`
- Git
- A running Hush-Hub backend
- A Google Maps Platform API key
- Android Studio and Java 17 for Android development
- Xcode and CocoaPods for iOS development
- iOS 14 or newer for the iOS target

Check the installed toolchain before setup:

```bash
flutter doctor -v
flutter --version
```

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/eelj457/Hush-Hub.git
cd Hush-Hub/mobile-app
```

### 2. Install Flutter dependencies

```bash
flutter pub get
```

For iOS, install pods if Flutter does not do so automatically:

```bash
cd ios
pod install
cd ..
```

### 3. Configure the environment

Create the local environment file:

```bash
cp .env.example .env
```

The app expects the following values:

| Variable | Required | Description |
|---|---:|---|
| `GOOGLE_MAPS_API_KEY` | Yes | Used by the native Google Maps SDK and Google Places requests |
| `API_BASE_URL` | Yes | Backend base URL for iOS and other non-Android targets; include `/api` |
| `ANDROID_API_BASE_URL` | Recommended | Android-specific backend URL; include `/api` |

Example for a backend running on the development machine at port `8000`:

```dotenv
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
API_BASE_URL=http://127.0.0.1:8000/api
ANDROID_API_BASE_URL=http://10.0.2.2:8000/api
```

`10.0.2.2` is the Android Emulator alias for the host machine. A physical device cannot use the development machine's `localhost`; use an address reachable from that device, such as the development machine's LAN IP. Production builds should use HTTPS.

Enable the required Google Maps Platform APIs for the platforms and services being used. Apply appropriate API and application restrictions to the key.

> `.env` is packaged as a Flutter asset and is therefore included in the application bundle. Do not place server secrets, database credentials, or unrestricted private credentials in it.

### 4. Start the backend

Follow the [backend setup guide](../backend/README.md). From `backend/`, the development server is normally started with:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The mobile app expects the API under `/api`, for example `http://127.0.0.1:8000/api`.

### 5. Run the app

```bash
flutter devices
flutter run -d <device-id>
```

## Platform configuration

### Android

The Android build reads `GOOGLE_MAPS_API_KEY` from `mobile-app/.env` in `android/app/build.gradle.kts` and injects it into the application manifest. Fine and coarse location permissions are already declared.

Local HTTP traffic is currently enabled for development. Use HTTPS and review the Android network policy before production release.

### iOS

The iOS `AppDelegate` reads `GOOGLE_MAPS_API_KEY` from the bundled `.env` asset and initializes `GMSServices`. Location usage descriptions are already present in `Info.plist`.

The current minimum iOS version is 14.0. A valid Apple development team, bundle identifier, certificates, and provisioning profile are required for device and release builds.

## Project structure

```text
mobile-app/
├── android/                         # Android host project and manifest configuration
├── ios/                             # iOS host project, pods, and AppDelegate setup
├── assets/                          # App icons and static assets
├── lib/
│   ├── core/
│   │   ├── config/                  # Environment-backed application configuration
│   │   ├── models/                  # Venue, review, user, weather, and quiet-profile models
│   │   ├── network/                 # Dio client and auth-token interceptor
│   │   ├── providers/               # Filters, visible venues, location, and theme state
│   │   ├── services/                # Backend API, authentication, locale, and Places services
│   │   ├── theme/                   # Normal and high-contrast themes
│   │   ├── utils/                   # Authentication, location, and marker helpers
│   │   └── widgets/                 # Shared venue card and dialog widgets
│   ├── features/
│   │   ├── auth/presentation/       # Login, registration, and password reset
│   │   ├── chat/presentation/       # Quiet AI assistant
│   │   ├── map/presentation/        # Discovery map, search, filters, and synchronization
│   │   ├── profile/presentation/    # Profile, saved places, history, and reviews
│   │   └── spaces/presentation/     # Synchronized list and venue details
│   ├── l10n/                        # ARB sources and generated localization classes
│   ├── main.dart                    # Initialization and root providers
│   └── main_layout.dart             # Persistent bottom navigation
├── test/core/                       # Unit, provider, utility, and widget tests
├── .env.example                     # Environment template
├── l10n.yaml                        # Localization generation configuration
└── pubspec.yaml                     # Dependencies, assets, and app version
```

## State and data flow

The root widget provides five application-wide state objects:

| Provider | Responsibility |
|---|---|
| `AuthProvider` | Session state, current user, login, registration, and logout |
| `LocaleProvider` | Selected language and preference persistence |
| `FilterProvider` | Shared venue-type filters and map-visible venue IDs |
| `LocationProvider` | Permission checks, current position, refresh state, and errors |
| `ThemeProvider` | Theme mode, high contrast, and text scale preferences |

`ApiClient` is a shared Dio client. Before each request it reads `access_token` from `SharedPreferences` and adds `Authorization: Bearer <token>` when a token is available.

## Development commands

Run these commands from `mobile-app/`:

| Command | Purpose |
|---|---|
| `flutter pub get` | Install dependencies |
| `flutter run` | Run on a selected device |
| `flutter gen-l10n` | Regenerate localization classes from ARB files |
| `dart format lib test` | Format Dart source and tests |
| `flutter analyze` | Run Dart and Flutter static analysis |
| `flutter test` | Run all unit and widget tests |
| `flutter test --coverage` | Run tests and write `coverage/lcov.info` |
| `dart run flutter_launcher_icons` | Regenerate launcher icons |

The repository still contains some legacy lint and deprecated-API notices from newer Flutter SDKs. New work should avoid adding analyzer errors or warnings and should reduce existing notices where practical.

## Testing

The test suite uses `flutter_test` and currently covers:

- Model parsing, defaults, derived values, and JSON serialization
- Venue occupancy and opening-hours formatting
- Quiet-profile parsing and busyness thresholds
- Shared filter and visible-venue state notifications
- Theme, locale, and text-scale preference persistence
- Distance and opening-status utilities
- Email confirmation dialog rendering and interactions

Run the suite with:

```bash
flutter test
```

## Building releases

### Android APK

```bash
flutter build apk --release
```

### Android App Bundle

```bash
flutter build appbundle --release
```

### iOS archive / IPA

```bash
flutter build ipa --release
```

The current Android release configuration uses the debug signing key so local release-mode runs work. Replace it with a protected production signing configuration before publishing. The attached GitHub Release IPA is development-provisioned and is not intended for installation on arbitrary devices; broadly distributable iOS builds require valid distribution signing and provisioning in Xcode.

## Localization

Translation source files are located in `lib/l10n/`:

- `app_en.arb`
- `app_zh.arb`
- `app_es.arb`

After editing an ARB file, regenerate localizations:

```bash
flutter gen-l10n
```

Keep the same message keys in all locale files.

## Troubleshooting

### The app reports a missing environment variable

Confirm that `mobile-app/.env` exists, contains all required values, and is listed under `flutter.assets` in `pubspec.yaml`. Restart the app after changing `.env`; hot reload does not reliably reload bundled assets.

### Android cannot reach the local backend

Use `http://10.0.2.2:8000/api` for the standard Android Emulator. For a physical device, use a reachable LAN address and ensure the backend is listening on `0.0.0.0`.

### The map is blank or Places suggestions are missing

Check that the correct Google APIs are enabled, billing is active where required, the key restrictions match the target platform, and the key is present in `.env`. Then perform a full restart or rebuild.

### Location is unavailable

Enable location services on the device, grant the application location permission, and use the Discovery recenter control to retry.

### iOS dependency errors

```bash
flutter clean
flutter pub get
cd ios
pod install
cd ..
```

## Contributing

Before submitting a change:

```bash
dart format lib test
flutter analyze
flutter test
```

Keep environment files and credentials out of version control, add tests for behavior changes, and document new routes, configuration values, or platform requirements in this README.

Repository: [eelj457/Hush-Hub](https://github.com/eelj457/Hush-Hub)
