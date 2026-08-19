class AdConfig {
  final bool enabled;
  final String? bannerImage;
  final String? bannerLink;
  final String? interstitialAdUnit;
  final String? rewardedAdUnit;

  AdConfig({
    this.enabled = false,
    this.bannerImage,
    this.bannerLink,
    this.interstitialAdUnit,
    this.rewardedAdUnit,
  });

  factory AdConfig.fromJson(Map<String, dynamic> json) {
    return AdConfig(
      enabled: json['enabled'] as bool? ?? false,
      bannerImage: json['bannerImage'] as String?,
      bannerLink: json['bannerLink'] as String?,
      interstitialAdUnit: json['interstitialAdUnit'] as String?,
      rewardedAdUnit: json['rewardedAdUnit'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'bannerImage': bannerImage,
        'bannerLink': bannerLink,
        'interstitialAdUnit': interstitialAdUnit,
        'rewardedAdUnit': rewardedAdUnit,
      };
}
