import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/providers/filter_provider.dart';

void main() {
  late FilterProvider provider;
  late int notificationCount;

  setUp(() {
    provider = FilterProvider();
    notificationCount = 0;
    provider.addListener(() => notificationCount++);
  });

  test('toggles tags and notifies listeners', () {
    provider.toggleTag('library');

    expect(provider.selectedTags, {'library'});
    expect(notificationCount, 1);

    provider.toggleTag('library');

    expect(provider.selectedTags, isEmpty);
    expect(notificationCount, 2);
  });

  test('clearAll resets selected tags with one notification', () {
    provider.toggleTag('cafe');
    provider.toggleTag('wifi');
    notificationCount = 0;

    provider.clearAll();

    expect(provider.selectedTags, isEmpty);
    expect(notificationCount, 1);
  });

  test('does not notify when visible venue ids are unchanged', () {
    provider.setVisibleVenueIds(['one', 'two']);
    expect(notificationCount, 1);

    provider.setVisibleVenueIds(['one', 'two']);
    expect(notificationCount, 1);

    provider.setVisibleVenueIds(['two', 'one']);
    expect(provider.visibleVenueIds, ['two', 'one']);
    expect(notificationCount, 2);
  });
}
