import 'dart:ui' as ui;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
class MarkerGenerator {
  /// Generates a custom BitmapDescriptor marker from a Canvas drawing.
  /// Mimics the circular colored pins with icons and scores from the mockup.
  static Future<BitmapDescriptor> createCustomMarker({
    required String score,
    required Color backgroundColor,
    required IconData iconData,
  }) async {
    const double size = 120.0;
    final double scale = kIsWeb ? 0.4 : 1.0;
    final double scaledSize = size * scale;

    final ui.PictureRecorder pictureRecorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(pictureRecorder);
    canvas.scale(scale, scale);

    final Paint paint = Paint()..color = backgroundColor;
    const double radius = size / 2;

    // Draw shadow
    canvas.drawCircle(
      const Offset(radius, radius + 4),
      radius - 4,
      Paint()
        ..color = Colors.black.withOpacity(0.3)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );

    // Draw background circle
    canvas.drawCircle(const Offset(radius, radius), radius - 4, paint);

    // Draw Icon using TextPainter and MaterialIcons font
    final TextPainter iconPainter = TextPainter(textDirection: TextDirection.ltr);
    iconPainter.text = TextSpan(
      text: String.fromCharCode(iconData.codePoint),
      style: TextStyle(
        fontSize: size * 0.4,
        fontFamily: iconData.fontFamily ?? 'MaterialIcons',
        package: iconData.fontPackage,
        color: Colors.white,
      ),
    );
    iconPainter.layout();
    iconPainter.paint(
      canvas,
      Offset(
        radius - iconPainter.width / 2,
        radius - iconPainter.height / 2 - 10,
      ),
    );

    // Draw Score Text below the icon
    final TextPainter textPainter = TextPainter(textDirection: TextDirection.ltr);
    textPainter.text = TextSpan(
      text: score,
      style: const TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.bold,
        color: Colors.white,
      ),
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(
        radius - textPainter.width / 2,
        radius - textPainter.height / 2 + 20,
      ),
    );

    final ui.Image image = await pictureRecorder.endRecording().toImage(scaledSize.toInt(), scaledSize.toInt());
    final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    final Uint8List uint8List = byteData!.buffer.asUint8List();

    return BitmapDescriptor.fromBytes(uint8List);
  }

  /// Generates a custom cluster marker showing the count of aggregated venues
  static Future<BitmapDescriptor> createClusterMarker(int count) async {
    final double scale = kIsWeb ? 0.4 : 1.0;

    // Determine gradient properties based on cluster count
    double baseSize;
    Color clusterColor;
    double fontSize;
    double shadowBlur;
    double opacity;
    bool drawOuterGlow = false;

    if (count < 10) {
      baseSize = 110.0;
      clusterColor = const Color(0xFF10B981); // Emerald
      opacity = 0.85;
      fontSize = 36.0;
      shadowBlur = 10.0;
    } else if (count < 50) {
      baseSize = 140.0;
      clusterColor = const Color(0xFF3B82F6); // Tech Blue
      opacity = 0.9;
      fontSize = 48.0;
      shadowBlur = 14.0;
    } else if (count < 100) {
      baseSize = 170.0;
      clusterColor = const Color(0xFF4F46E5); // Indigo
      opacity = 1.0;
      fontSize = 56.0;
      shadowBlur = 18.0;
    } else {
      baseSize = 200.0;
      clusterColor = const Color(0xFFF97316); // Vibrant Orange
      opacity = 1.0;
      fontSize = 64.0;
      shadowBlur = 24.0;
      drawOuterGlow = true;
    }

    final double scaledSize = baseSize * scale;

    final ui.PictureRecorder pictureRecorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(pictureRecorder);
    canvas.scale(scale, scale);

    final Paint paint = Paint()..color = clusterColor.withOpacity(opacity);
    final double radius = baseSize / 2;

    // Draw shadow
    canvas.drawCircle(
      Offset(radius, radius + 6),
      radius - 6,
      Paint()
        ..color = Colors.black.withOpacity(0.4)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, shadowBlur),
    );

    // Draw outer glow for massive clusters
    if (drawOuterGlow) {
      canvas.drawCircle(
        Offset(radius, radius),
        radius, // Extend beyond the main circle
        Paint()
          ..color = clusterColor.withOpacity(0.3)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 20),
      );
    }

    // Draw background circle
    canvas.drawCircle(Offset(radius, radius), radius - 6, paint);
    
    // Draw white stroke
    canvas.drawCircle(
      Offset(radius, radius), 
      radius - 6, 
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = count >= 50 ? 6 : 4,
    );

    // Draw count text
    final TextPainter textPainter = TextPainter(textDirection: TextDirection.ltr);
    textPainter.text = TextSpan(
      text: count.toString(),
      style: TextStyle(
        fontSize: fontSize,
        fontWeight: FontWeight.w800,
        color: Colors.white,
      ),
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(
        radius - textPainter.width / 2,
        radius - textPainter.height / 2,
      ),
    );

    final ui.Image image = await pictureRecorder.endRecording().toImage(scaledSize.toInt(), scaledSize.toInt());
    final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    final Uint8List uint8List = byteData!.buffer.asUint8List();

    return BitmapDescriptor.fromBytes(uint8List);
  }
}
