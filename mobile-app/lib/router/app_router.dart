import 'package:go_router/go_router.dart';
import '../core/models/venue_model.dart';
import '../main_layout.dart';
import '../features/map/presentation/map_page.dart';
import '../features/spaces/presentation/spaces_list_page.dart';
import '../features/spaces/presentation/place_details_page.dart';
import '../features/chat/presentation/chat_page.dart';
import '../features/profile/presentation/profile_page.dart';
import '../features/profile/presentation/saved_page.dart';
import '../features/profile/presentation/recent_views_page.dart';
import '../features/profile/presentation/my_reviews_page.dart';
import '../features/auth/presentation/signup_page.dart';
import '../features/auth/presentation/forgot_password_page.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/map',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return MainLayout(navigationShell: navigationShell);
      },
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/map',
              builder: (context, state) => const MapPage(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/list',
              builder: (context, state) => const SpacesListPage(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/saved',
              builder: (context, state) => const SavedPage(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/profile',
              builder: (context, state) => const ProfilePage(),
            ),
          ],
        ),
      ],
    ),
    GoRoute(
      path: '/details/:id',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        final initialVenue = state.extra as VenueModel?;
        return PlaceDetailsPage(venueId: id, initialVenue: initialVenue);
      },
    ),
    GoRoute(
      path: '/chat',
      builder: (context, state) => const ChatPage(),
    ),
    GoRoute(
      path: '/recent',
      builder: (context, state) => const RecentViewsPage(),
    ),
    GoRoute(
      path: '/my-reviews',
      builder: (context, state) => const MyReviewsPage(),
    ),
    GoRoute(
      path: '/signup',
      builder: (context, state) => const SignupPage(),
    ),
    GoRoute(
      path: '/forgot-password',
      builder: (context, state) => const ForgotPasswordPage(),
    ),
  ],
);
