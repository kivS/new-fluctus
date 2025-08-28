(function() {
    const SUPPORTED_HOSTNAMES = [
        {
            'name': 'youtube',
            'alts': ['youtube', 'youtu.be']
        },
        {
            'name': 'vimeo',
            'alts': ['vimeo']
        },
        {
            'name': 'soundcloud',
            'alts': ['soundcloud']
        },
        {
            'name': 'twitch',
            'alts': ['twitch', 'go.twitch']
        },
        {
            'name': 'raw-mp4',
            'alts': ['mp4']

        }
    ];

    function getMediaProvider(url) {
        const mediaProvider = SUPPORTED_HOSTNAMES.find(host => {
            return host.alts.some(alt => {
                const match_exp = new RegExp(`(?:https:\/\/)?(?:www\.)?${alt}(?:.+)?`, 'g');
                return url.match(match_exp) != null;
            });
        });

        return mediaProvider ? mediaProvider.name : null;
    }

    if (getMediaProvider(window.location.href)) {
        browser.runtime.sendMessage({ action: "enable_action" });
    }
})();