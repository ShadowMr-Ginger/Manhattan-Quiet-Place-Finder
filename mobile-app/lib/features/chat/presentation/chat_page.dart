import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import '../../../core/services/api/misc_service.dart';
import '../../../core/models/venue_model.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final TextEditingController _controller = TextEditingController();
  static final List<Map<String, dynamic>> _messages = [
    {
      'text': 'Hi! I am your AI assistant. How can I help you find the perfect quiet spot today?',
      'isUser': false,
    }
  ];
  bool _isLoading = false;

  void _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    // Extract history from messages before adding the new message
    final history = _messages
        .where((m) => m['text'] != 'Hi! I am your AI assistant. How can I help you find the perfect quiet spot today?')
        .map((m) => {
              'role': (m['isUser'] as bool) ? 'user' : 'assistant',
              'text': m['text'],
            })
        .toList();

    setState(() {
      _messages.add({'text': text, 'isUser': true});
      _controller.clear();
      _isLoading = true;
    });

    try {
      final response = await MiscService().chat(text, history: history);
      if (mounted) {
        setState(() {
          _messages.add({
            'text': response['reply'],
            'venues': response['venues'],
            'isUser': false,
          });
        });
      }
    } catch (e) {
      print('Chat Error: $e');
      if (mounted) {
        setState(() {
          _messages.add({'text': 'Sorry, I encountered an error. Please try again.', 'isUser': false});
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(
        backgroundColor: context.colors.background,
        elevation: 0,
        leading: Semantics(
          label: 'Back',
          button: true,
          child: IconButton(
            icon: Icon(LucideIcons.arrow_left, color: context.colors.textPrimary),
            onPressed: () => context.pop(),
          ),
        ),
        title: Row(
          children: [
            Icon(LucideIcons.bot, color: Colors.cyan, size: 20),
            SizedBox(width: 8),
            Text(
              'Quiet AI Assistant',
              style: TextStyle(
                color: context.colors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(20),
              itemCount: _messages.length + (_isLoading ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _messages.length) {
                  return const Align(
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: EdgeInsets.only(top: 8.0),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  );
                }
                final msg = _messages[index];
                final List<dynamic>? rawVenues = msg['venues'] as List<dynamic>?;
                final hasVenues = rawVenues != null && rawVenues.isNotEmpty;
                
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16.0),
                  child: Column(
                    crossAxisAlignment: msg['isUser'] ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                    children: [
                      _buildMessageBubble(msg['text'], isUser: msg['isUser']),
                      if (hasVenues) ...[
                        const SizedBox(height: 12),
                        _buildVenueCards(rawVenues),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(String text, {required bool isUser}) {
    return Semantics(
      label: isUser ? 'You said: $text' : 'Assistant said: $text',
      child: ExcludeSemantics(
        child: Align(
          alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            constraints: const BoxConstraints(maxWidth: 280),
            decoration: BoxDecoration(
              color: isUser ? context.colors.primary : context.colors.surface,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: Radius.circular(16),
                bottomLeft: Radius.circular(isUser ? 16 : 4),
                bottomRight: Radius.circular(isUser ? 4 : 16),
              ),
              boxShadow: isUser ? [] : [
                BoxShadow(
                  color: context.colors.shadow,
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Text(
              text,
              style: TextStyle(
                color: isUser ? Colors.white : context.colors.textPrimary,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildVenueCards(List<dynamic> rawVenues) {
    final venues = rawVenues.map((v) => VenueModel.fromJson(v as Map<String, dynamic>)).toList();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: venues.map((venue) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 8.0),
          child: InkWell(
            onTap: () => context.push('/details/${venue.id}', extra: venue),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              decoration: BoxDecoration(
                color: context.colors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: context.colors.divider),
                boxShadow: [
                  BoxShadow(
                    color: context.colors.shadow.withOpacity(0.05),
                    blurRadius: 4,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      venue.name,
                      style: TextStyle(
                        color: context.colors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${venue.quietScore}/100',
                    style: TextStyle(
                      color: context.colors.textSecondary,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: context.colors.surface,
        boxShadow: [
          BoxShadow(
            color: context.colors.shadow,
            blurRadius: 10,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: context.colors.background,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: context.colors.divider),
                ),
                child: TextField(
                  controller: _controller,
                  decoration: InputDecoration(
                    hintText: 'Ask about quiet places...',
                    hintStyle: TextStyle(color: context.colors.textTertiary, fontSize: 14),
                    border: InputBorder.none,
                    filled: false,
                  ),
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Semantics(
              label: 'Send message',
              button: true,
              excludeSemantics: true,
              child: GestureDetector(
                onTap: _sendMessage,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(
                    color: Colors.cyan,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(LucideIcons.send, color: Colors.white, size: 20),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
