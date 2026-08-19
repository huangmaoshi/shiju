import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

class AdBanner extends StatelessWidget {
  final String? imageUrl;
  final String? linkUrl;
  final VoidCallback? onTap;

  const AdBanner({
    super.key,
    this.imageUrl,
    this.linkUrl,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: CachedNetworkImage(
            imageUrl: imageUrl!,
            height: 80,
            width: double.infinity,
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(
              height: 80,
              color: Colors.grey[200],
            ),
            errorWidget: (_, __, ___) => Container(
              height: 80,
              color: Colors.grey[200],
              child: const Icon(Icons.error_outline),
            ),
          ),
        ),
      ),
    );
  }
}
