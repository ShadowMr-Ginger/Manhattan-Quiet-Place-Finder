import 'package:geolocator/geolocator.dart';

class LocationUtils {
  /// Calculates the distance between two coordinates and formats it as a string (e.g., '1.2 km' or '800 m')
  static String formatDistance(double startLat, double startLng, double endLat, double endLng) {
    final distanceInMeters = Geolocator.distanceBetween(startLat, startLng, endLat, endLng);
    
    if (distanceInMeters < 1000) {
      return '${distanceInMeters.toStringAsFixed(0)} m';
    } else {
      return '${(distanceInMeters / 1000).toStringAsFixed(1)} km';
    }
  }

  /// Determines if the venue is open right now based on its hours string. Returns null if hours are unknown.
  static bool? isOpenNow(String? hours) {
    if (hours == null || hours.isEmpty) return null; // Unknown open status
    
    final now = DateTime.now();
    final currentDay = now.weekday; // 1=Mon, 7=Sun
    final currentTime = now.hour * 60 + now.minute;

    final daysMap = {'Mo': 1, 'Tu': 2, 'We': 3, 'Th': 4, 'Fr': 5, 'Sa': 6, 'Su': 7};

    final parts = hours.split(';');
    for (final part in parts) {
      final p = part.trim();
      if (p.isEmpty) continue;
      final spaceIdx = p.lastIndexOf(' ');
      
      String timeStr;
      bool dayMatches = false;

      if (spaceIdx == -1) {
        timeStr = p;
        dayMatches = true;
      } else {
        final dayStr = p.substring(0, spaceIdx);
        timeStr = p.substring(spaceIdx + 1);

        final dayGroups = dayStr.split(',');
        for (final group in dayGroups) {
          if (group.contains('-')) {
            final range = group.split('-');
            if (range.length == 2) {
              final startD = daysMap[range[0].trim()] ?? 1;
              final endD = daysMap[range[1].trim()] ?? 7;
              if (startD <= endD) {
                if (currentDay >= startD && currentDay <= endD) dayMatches = true;
              } else {
                if (currentDay >= startD || currentDay <= endD) dayMatches = true;
              }
            }
          } else {
            final d = daysMap[group.trim()];
            if (d == currentDay) dayMatches = true;
          }
        }
      }

      if (dayMatches) {
        if (timeStr == '00:00-24:00' || timeStr == '24/7') return true;
        final times = timeStr.split('-');
        if (times.length == 2) {
          final startParts = times[0].split(':');
          final endParts = times[1].split(':');
          if (startParts.length == 2 && endParts.length == 2) {
            final startT = (int.tryParse(startParts[0]) ?? 0) * 60 + (int.tryParse(startParts[1]) ?? 0);
            final endT = (int.tryParse(endParts[0]) ?? 0) * 60 + (int.tryParse(endParts[1]) ?? 0);
            
            if (startT <= endT) {
              if (currentTime >= startT && currentTime <= endT) return true;
            } else {
              if (currentTime >= startT || currentTime <= endT) return true;
            }
          }
        }
      }
    }
    return false;
  }
}
