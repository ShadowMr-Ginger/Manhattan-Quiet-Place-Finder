class ReviewModel {
  final String id;
  final String userId;
  final int rating;
  final String text;
  final String userName;
  final String createdAt;
  final String? venueId;
  final String? venueName;

  ReviewModel({
    required this.id,
    required this.userId,
    required this.rating,
    required this.text,
    this.userName = 'Anonymous',
    required this.createdAt,
    this.venueId,
    this.venueName,
  });

  factory ReviewModel.fromJson(Map<String, dynamic> json) {
    String name = 'Anonymous';
    if (json['user'] != null && json['user']['name'] != null) {
      name = json['user']['name'];
    } else if (json['userName'] != null) {
      name = json['userName'];
    } else if (json['author'] != null) {
      name = json['author'];
    }

    return ReviewModel(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      rating: json['rating'] ?? 0,
      text: json['text'] ?? '',
      userName: name,
      createdAt: json['createdAt'] ?? '',
      venueId: json['venueId']?.toString(),
      venueName: json['venueName'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'rating': rating,
      'text': text,
      'userName': userName,
      'createdAt': createdAt,
      if (venueId != null) 'venueId': venueId,
      if (venueName != null) 'venueName': venueName,
    };
  }
}
