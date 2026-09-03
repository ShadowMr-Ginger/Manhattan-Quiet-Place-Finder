import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/utils/location_utils.dart';

void main() {
  group('LocationUtils.formatDistance', () {
    test('formats short distances in metres', () {
      expect(LocationUtils.formatDistance(40.0, -73.0, 40.0, -73.0), '0 m');
    });

    test('formats long distances in kilometres', () {
      expect(LocationUtils.formatDistance(0.0, 0.0, 1.0, 0.0), '111.3 km');
    });
  });

  group('LocationUtils.isOpenNow', () {
    test('returns null when opening hours are unknown', () {
      expect(LocationUtils.isOpenNow(null), isNull);
      expect(LocationUtils.isOpenNow(''), isNull);
    });

    test('recognizes always-open formats', () {
      expect(LocationUtils.isOpenNow('24/7'), isTrue);
      expect(LocationUtils.isOpenNow('Mo-Su 00:00-24:00'), isTrue);
    });

    test('returns false for an unrecognized day expression', () {
      expect(LocationUtils.isOpenNow('Unknown 24/7'), isFalse);
    });
  });
}
