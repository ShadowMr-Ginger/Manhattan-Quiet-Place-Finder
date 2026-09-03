class WeatherModel {
  final double temp;
  final double feelsLike;
  final int humidity;
  final String description;
  final String icon;
  final double windSpeed;

  WeatherModel({
    required this.temp,
    required this.feelsLike,
    required this.humidity,
    required this.description,
    required this.icon,
    required this.windSpeed,
  });

  factory WeatherModel.fromJson(Map<String, dynamic> json) {
    return WeatherModel(
      temp: (json['temp'] as num?)?.toDouble() ?? 0.0,
      feelsLike: (json['feels_like'] as num?)?.toDouble() ?? 0.0,
      humidity: json['humidity'] ?? 0,
      description: json['description'] ?? '',
      icon: json['icon'] ?? '',
      windSpeed: (json['wind_speed'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
