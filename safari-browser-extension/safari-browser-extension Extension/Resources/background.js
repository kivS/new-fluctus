(function() {
    const config = {
        debug: true,
        FLUCTUS_PROTOCOL: 'fluctus://',
        SUPPORTED_HOSTNAMES: [
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
        ],
        NATIVE_APP_INSTALL_URL: 'https://github.com/kivS/Fluctus/releases',
        STORAGE_KEY_NATIVE_APP_PORT: 'fd_native_app_port',
    }

    if (!config.debug) {
        Object.keys(console).forEach(function (key) {
            // allow only logs with error level
            if (key == 'error') return;
            console[key] = function () { };
        })
    }

    console.log('Lift off!');

    const NO_SERVER_ERROR_NOTIF_ID = "fluctus_says_nope";

    // On install or upgrade
    browser.runtime.onInstalled.addListener(() => {
        browser.action.disable();

        // Add contextMenus
        browser.contextMenus.create({
            id: 'contextMenu_1',
            title: 'Float me..',
            contexts: ['all']
        });
    });

    // Listen for messages from content scripts
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "enable_action") {
            browser.action.enable(sender.tab.id);
        }
    });


    browser.action.onClicked.addListener(tab => {
        console.log('page_action clicked..', tab);

        let hostname = getMediaProvider(tab.url);
        console.log('hostname: ', hostname);

        if (!hostname) {
            alertUser("", 'This url is not supported');
            console.error('No hostname found for url:', tab.url);
            return
        }

        let payload = new URL(`${config.FLUCTUS_PROTOCOL}${hostname}`);
        payload.searchParams.set('url', tab.url);
        if (tab.title) payload.searchParams.set('title', tab.title);

        console.log('payload', payload.toString());

        try {
            browser.tabs.update(tab.id, { url: payload.toString() });
        } catch (e) {
            console.error("Error updating tab:", e);
        }


    });


    browser.contextMenus.onClicked.addListener((object_info, tab) => {
        console.log('Context Menu cliked: ', object_info);

        let url = null;

        switch (object_info.mediaType) {
            case 'video':
                url = object_info.srcUrl;
                break;

            default:
                url = object_info.linkUrl || object_info.selectionText;
                break;
        }

        console.log("URL from context menu:", url);


        let hostname = getMediaProvider(url);
        console.log('hostname: ', hostname);

        if (!hostname) {
            alertUser("", 'This url is not supported');
            console.error('No hostname found for url:', url);
            return
        }

        let payload = new URL(`${config.FLUCTUS_PROTOCOL}${hostname}`);
        payload.searchParams.set('url', url);

        console.log('payload', payload.toString());

        try {
            browser.tabs.update(tab.id, { url: payload.toString() });
        } catch (e) {
            console.error("Error updating tab:", e);
        }

    });


    /**
     * Handle notifications click event
     */
    browser.notifications.onClicked.addListener(notif => {
        console.log('notification clicked:', notif);

        // clear notification
        browser.notifications.clear(notif);
    })


    function getMediaProvider(url) {
        console.log('Get video type of: ', url);
        if(!url) return null;

        const mediaProvider = config.SUPPORTED_HOSTNAMES.find(host => {
            return host.alts.some(alt => {
                // build reg rexp to match host in url
                let match_exp = RegExp(`(?:https:\/\/)?(?:www\.)?${alt}(?:.+)?`, 'g');

                console.log('Match RegExp: ', match_exp);

                let matched_val = url.match(match_exp);
                console.log('Match result: ', matched_val);

                return matched_val != null;
            })
        })

        return mediaProvider?.name ?? null
    }


    /**
     * Send notification to the user
     * @param  notification_id
     * @param  message
     */
    function alertUser(notification_id, message) {
        browser.notifications.create(notification_id, {
            "type": "basic",
            "iconUrl": browser.runtime.getURL('icons/icon-64.png'),
            "title": "Fluctus",
            "message": message

        }, notif => {
            console.log('Created notification:', notif);

            if (notif == NO_SERVER_ERROR_NOTIF_ID) return;

            const autoClearTimeOut = setTimeout(() => {
                browser.notifications.clear(notif);
                clearTimeout(autoClearTimeOut);
            }, 2500)

        });
    }
})();