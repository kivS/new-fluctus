(function() {
    const api = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    if (!api) {
        try { console.error('WebExtension API not found (browser/chrome).'); } catch (e) {}
    }
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

    if (api && getMediaProvider(window.location.href)) {
        api.runtime.sendMessage({ action: "enable_action" });
    }
})();
