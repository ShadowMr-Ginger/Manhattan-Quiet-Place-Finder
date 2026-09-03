import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('es'),
    Locale('zh')
  ];

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'SETTINGS'**
  String get settings;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @selectLanguage.
  ///
  /// In en, this message translates to:
  /// **'Select Language'**
  String get selectLanguage;

  /// No description provided for @english.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get english;

  /// No description provided for @chinese.
  ///
  /// In en, this message translates to:
  /// **'中文 (Chinese)'**
  String get chinese;

  /// No description provided for @spanish.
  ///
  /// In en, this message translates to:
  /// **'Español (Spanish)'**
  String get spanish;

  /// No description provided for @seeOurWeb.
  ///
  /// In en, this message translates to:
  /// **'See Our Web'**
  String get seeOurWeb;

  /// No description provided for @couldNotLaunchWebsite.
  ///
  /// In en, this message translates to:
  /// **'Could not launch website'**
  String get couldNotLaunchWebsite;

  /// No description provided for @saved.
  ///
  /// In en, this message translates to:
  /// **'SAVED'**
  String get saved;

  /// No description provided for @recentViews.
  ///
  /// In en, this message translates to:
  /// **'RECENT VIEWS'**
  String get recentViews;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get logout;

  /// No description provided for @discovery.
  ///
  /// In en, this message translates to:
  /// **'Discovery'**
  String get discovery;

  /// No description provided for @list.
  ///
  /// In en, this message translates to:
  /// **'List'**
  String get list;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @mapSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search quiet places...'**
  String get mapSearchHint;

  /// No description provided for @mapLibrary.
  ///
  /// In en, this message translates to:
  /// **'Library'**
  String get mapLibrary;

  /// No description provided for @mapCoffee.
  ///
  /// In en, this message translates to:
  /// **'Coffee'**
  String get mapCoffee;

  /// No description provided for @mapCafe.
  ///
  /// In en, this message translates to:
  /// **'Cafe'**
  String get mapCafe;

  /// No description provided for @mapCoworking.
  ///
  /// In en, this message translates to:
  /// **'Coworking Space'**
  String get mapCoworking;

  /// No description provided for @mapRecenter.
  ///
  /// In en, this message translates to:
  /// **'Recenter'**
  String get mapRecenter;

  /// No description provided for @mapBoxSelect.
  ///
  /// In en, this message translates to:
  /// **'Box Select'**
  String get mapBoxSelect;

  /// No description provided for @mapMinQuietScore.
  ///
  /// In en, this message translates to:
  /// **'Max Busyness Score'**
  String get mapMinQuietScore;

  /// No description provided for @mapBusyLevel.
  ///
  /// In en, this message translates to:
  /// **'Busy level'**
  String get mapBusyLevel;

  /// No description provided for @labelQuiet.
  ///
  /// In en, this message translates to:
  /// **'Quiet'**
  String get labelQuiet;

  /// No description provided for @labelModerate.
  ///
  /// In en, this message translates to:
  /// **'Moderate'**
  String get labelModerate;

  /// No description provided for @labelNoisy.
  ///
  /// In en, this message translates to:
  /// **'Noisy'**
  String get labelNoisy;

  /// No description provided for @mapNotCrowded.
  ///
  /// In en, this message translates to:
  /// **'Not Crowded'**
  String get mapNotCrowded;

  /// No description provided for @mapModerate.
  ///
  /// In en, this message translates to:
  /// **'Moderate'**
  String get mapModerate;

  /// No description provided for @mapCrowded.
  ///
  /// In en, this message translates to:
  /// **'Crowded'**
  String get mapCrowded;

  /// No description provided for @mapApplyFilters.
  ///
  /// In en, this message translates to:
  /// **'Apply Filters'**
  String get mapApplyFilters;

  /// No description provided for @listStudySpaces.
  ///
  /// In en, this message translates to:
  /// **'Study Spaces'**
  String get listStudySpaces;

  /// No description provided for @listModeratelyBusy.
  ///
  /// In en, this message translates to:
  /// **'Moderately Busy'**
  String get listModeratelyBusy;

  /// No description provided for @listNoSpaces.
  ///
  /// In en, this message translates to:
  /// **'No spaces found.'**
  String get listNoSpaces;

  /// No description provided for @detailsPowerOutlets.
  ///
  /// In en, this message translates to:
  /// **'Power Outlets'**
  String get detailsPowerOutlets;

  /// No description provided for @detailsGoodCoffee.
  ///
  /// In en, this message translates to:
  /// **'Good Coffee'**
  String get detailsGoodCoffee;

  /// No description provided for @detailsNaturalLight.
  ///
  /// In en, this message translates to:
  /// **'Natural Light'**
  String get detailsNaturalLight;

  /// No description provided for @detailsCozyVibe.
  ///
  /// In en, this message translates to:
  /// **'Cozy Vibe'**
  String get detailsCozyVibe;

  /// No description provided for @detailsStudyFriendly.
  ///
  /// In en, this message translates to:
  /// **'Study Friendly'**
  String get detailsStudyFriendly;

  /// No description provided for @detailsGetDirections.
  ///
  /// In en, this message translates to:
  /// **'Get Directions on Google Maps'**
  String get detailsGetDirections;

  /// No description provided for @detailsWalking.
  ///
  /// In en, this message translates to:
  /// **'Walking'**
  String get detailsWalking;

  /// No description provided for @detailsSubway.
  ///
  /// In en, this message translates to:
  /// **'Subway'**
  String get detailsSubway;

  /// No description provided for @detailsDriving.
  ///
  /// In en, this message translates to:
  /// **'Driving'**
  String get detailsDriving;

  /// No description provided for @listWalkTime.
  ///
  /// In en, this message translates to:
  /// **'15 min walk'**
  String get listWalkTime;

  /// No description provided for @detailsCurrentQuietScore.
  ///
  /// In en, this message translates to:
  /// **'CURRENT BUSYNESS SCORE'**
  String get detailsCurrentQuietScore;

  /// No description provided for @detailsHours.
  ///
  /// In en, this message translates to:
  /// **'HOURS'**
  String get detailsHours;

  /// No description provided for @detailsOpenNow.
  ///
  /// In en, this message translates to:
  /// **'Open now'**
  String get detailsOpenNow;

  /// No description provided for @detailsOccupancy.
  ///
  /// In en, this message translates to:
  /// **'OCCUPANCY'**
  String get detailsOccupancy;

  /// No description provided for @detailsStatus.
  ///
  /// In en, this message translates to:
  /// **'STATUS'**
  String get detailsStatus;

  /// No description provided for @detailsForecastTitle.
  ///
  /// In en, this message translates to:
  /// **'Busyness Score Forecast'**
  String get detailsForecastTitle;

  /// No description provided for @detailsNow.
  ///
  /// In en, this message translates to:
  /// **'Now'**
  String get detailsNow;

  /// No description provided for @detailsIfArriveAt.
  ///
  /// In en, this message translates to:
  /// **'IF YOU ARRIVE AT {time}'**
  String detailsIfArriveAt(String time);

  /// No description provided for @detailsExpected.
  ///
  /// In en, this message translates to:
  /// **'expected'**
  String get detailsExpected;

  /// No description provided for @detailsLegendQuiet.
  ///
  /// In en, this message translates to:
  /// **'Crowded (>80%)'**
  String get detailsLegendQuiet;

  /// No description provided for @detailsLegendModerate.
  ///
  /// In en, this message translates to:
  /// **'Moderate (60-79%)'**
  String get detailsLegendModerate;

  /// No description provided for @detailsLegendNoisy.
  ///
  /// In en, this message translates to:
  /// **'Not Crowded (<60%)'**
  String get detailsLegendNoisy;

  /// No description provided for @detailsReviews.
  ///
  /// In en, this message translates to:
  /// **'Reviews'**
  String get detailsReviews;

  /// No description provided for @detailsRecently.
  ///
  /// In en, this message translates to:
  /// **'Recently'**
  String get detailsRecently;

  /// No description provided for @savedSpacesTitle.
  ///
  /// In en, this message translates to:
  /// **'Saved Spaces'**
  String get savedSpacesTitle;

  /// No description provided for @savedNoSpaces.
  ///
  /// In en, this message translates to:
  /// **'No saved spaces found.'**
  String get savedNoSpaces;

  /// No description provided for @savedDiscover.
  ///
  /// In en, this message translates to:
  /// **'Discover Spaces'**
  String get savedDiscover;

  /// No description provided for @detailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Place Details'**
  String get detailsTitle;

  /// No description provided for @recentViewsTitle.
  ///
  /// In en, this message translates to:
  /// **'Recent Views'**
  String get recentViewsTitle;

  /// No description provided for @recentNoViews.
  ///
  /// In en, this message translates to:
  /// **'No recent views found.'**
  String get recentNoViews;

  /// No description provided for @myReviews.
  ///
  /// In en, this message translates to:
  /// **'My Reviews'**
  String get myReviews;

  /// No description provided for @noReviewsFound.
  ///
  /// In en, this message translates to:
  /// **'No reviews found.'**
  String get noReviewsFound;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'es', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
