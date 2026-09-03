import 'package:flutter/material.dart';

class FilterProvider extends ChangeNotifier {
  final Set<String> _selectedTags = {};

  Set<String> get selectedTags => _selectedTags;

  void toggleTag(String tag) {
    if (_selectedTags.contains(tag)) {
      _selectedTags.remove(tag);
    } else {
      _selectedTags.add(tag);
    }
    notifyListeners();
  }

  void clearTags() {
    _selectedTags.clear();
    notifyListeners();
  }

  void clearAll() {
    _selectedTags.clear();
    notifyListeners();
  }

  List<String>? _visibleVenueIds;
  List<String>? get visibleVenueIds => _visibleVenueIds;

  void setVisibleVenueIds(List<String> ids) {
    // Check if the list actually changed to prevent infinite rebuild loops
    if (_visibleVenueIds != null && _visibleVenueIds!.length == ids.length) {
      bool isSame = true;
      for (int i = 0; i < ids.length; i++) {
        if (_visibleVenueIds![i] != ids[i]) {
          isSame = false;
          break;
        }
      }
      if (isSame) return; // No change, do not notify!
    }

    _visibleVenueIds = ids;
    notifyListeners();
  }
}
