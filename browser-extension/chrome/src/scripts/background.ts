// Define config constant
const config = {
	debug: true,
	FLUCTUS_PROTOCOL: 'fluctus://',
	SUPPORTED_HOSTNAMES:[
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
	STORAGE_KEY_NATIVE_APP_PORT : 'fd_native_app_port',
}

if(!config.debug){
	Object.keys(console).forEach(function(key){
        // allow only logs with error level
       	if(key == 'error') return;
        console[key] = function(){};
	})
}

console.log('Lift off!');

const NO_SERVER_ERROR_NOTIF_ID = "fluctus_says_nope";



// On install or upgrade
chrome.runtime.onInstalled.addListener(() =>{
	chrome.action.disable();

	// Replace all rules for filtering page depending on content
	chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
		// With a new rule
		chrome.declarativeContent.onPageChanged.addRules([
		 	{
		 		
		 		conditions: [
		 			new chrome.declarativeContent.PageStateMatcher({
		 				pageUrl: { hostContains: 'youtube',  pathContains: 'watch' }
		 			}),

					//Vimeo Trigger me!!
					// new chrome.declarativeContent.PageStateMatcher({
		 			// 	pageUrl: { hostContains: 'vimeo' },
		 			// 	css: ['video']
		 			// }),

	 				// // soundcloud Trigger me!!
					// new chrome.declarativeContent.PageStateMatcher({
		 			// 	pageUrl: { hostContains: 'soundcloud' },
		 			// 	css: ['div.waveform__scene']
		 			// }),

		 			// // Twitch Trigger me!!
					// new chrome.declarativeContent.PageStateMatcher({
		 			// 	pageUrl: { urlMatches: 'https://go.twitch.tv/[a-zA-Z0-9_]{4,25}$' },
		 				
		 			// }),
		 			// new chrome.declarativeContent.PageStateMatcher({
		 			// 	pageUrl: { urlMatches: String.raw`https://go.twitch.tv/videos/\d+$` },
		 				
		 			// })
		 		],

		 		// Shows the page_action
		 		actions: [
		 			new chrome.declarativeContent.ShowAction(),
		 		]
		 	}
		]);
	});

	// Add contextMenus
	chrome.contextMenus.create({
		id: 'contextMenu_1',
		// title: chrome.i18n.getMessage("titleOnAction"),
		title: 'Float me..', // TODO: replace with i18n once chrome bug is fixed
		// contexts: ['link', 'selection'],
		contexts: ['all'],
		targetUrlPatterns: [
			// YOUTUBE
			// For clean urls links like in youtube page and etc
			'https://www.youtube.com/watch*',
			// for short url
			'https://youtu.be/*',
			// For dirty urls like in google search results..dirty..
			`https://*/*${encodeURIComponent('www.youtube.com/watch')}*`,


			// // VIMEO
			// 'https://*.vimeo.com/*',
			// // For dirty urls like in google search results..dirty..
			// `https://*/*${encodeURIComponent('vimeo')}*`,

			// // SOUNDCLOUD
			// 'https://*.soundcloud.com/*',
			// // For dirty urls like in google search results..dirty..
			// `https://*/*${encodeURIComponent('soundcloud')}*`,

			// // TWITCH
			// 'https://go.twitch.tv/videos/*',
			// 'https://go.twitch.tv/*',
			// // For dirty urls like in google search results..dirty..
			// `https://*/*${encodeURIComponent('twitch')}*`,
		]
	});


});




/**
 * On btn press lets: 
 * - stop the video, 
 * - get current video ellapsed time, 
 * - get the current url tab 
 * - make a openVideo request 
 */


chrome.action.onClicked.addListener( tab => {
	console.debug('page_action clicked..', tab);
	
	let hostname = getMediaProvider(tab.url);
	console.debug('hostname: ', hostname);

	if(!hostname){
		// alertUser("", chrome.i18n.getMessage('urlNotSupportedError'));
		alertUser("", 'This url is not supported'); // TODO: replace with i18n once chrome bug is fixed
		console.error('No hostname found for url:', tab.url);
		return
	}

	let payload = new URL(`${config.FLUCTUS_PROTOCOL}${hostname}`);
	payload.searchParams.set('url', tab.url);
	if (tab.title) payload.searchParams.set('title', tab.title);
	
	console.debug('payload', payload);

	chrome.tabs.update(tab.id, { url: payload.toString() });

	// pause current video
	// chrome.scripting.executeScript(null, {code: "document.getElementsByTagName('video')[0].pause()"});

	// get current video time
	// new Promise((resolve) => {
	// 	chrome.scripting.executeScript(null, {code: "document.getElementsByTagName('video')[0].currentTime"}, result =>{
	// 		resolve(parseInt(result[0]));
	// 	});

	// }).then(currentTime =>{
	// 		console.debug('current video time: ', currentTime);

	// 		if(NATIVE_APP_PORT){
	// 			// Send POST request to open video with current video time
	// 			openVideoRequest(tab.url, currentTime);

	// 		}else{
	// 			// PING NATIVE APP
	// 			pingNativeAppServer(tab.url, currentTime);

	// 		}

	// })

});


/**
 * On text selected/ or item and mouse right-click(context menu) lets:
 * - get linkUrl in case item is a link or get the selected text
 * -  
 */
chrome.contextMenus.onClicked.addListener((object_info, tab) =>{
	console.debug('Context Menu cliked: ', object_info);

	let url = null;

	switch (object_info.mediaType) {
		case 'video':
			url = object_info.srcUrl;
			break;
	
		default:
			url = object_info.linkUrl || object_info.selectionText;
			break;
	}


	let hostname = getMediaProvider(url);
	console.debug('hostname: ', hostname);

	if (!hostname) {
		// alertUser("", chrome.i18n.getMessage('urlNotSupportedError'));
		alertUser("", 'This url is not supported'); // TODO: replace with i18n once chrome bug is fixed
		console.error('No hostname found for url:', url);
		return
	}

	let payload = new URL(`${config.FLUCTUS_PROTOCOL}${hostname}`);
	payload.searchParams.set('url', url);
	
	console.debug('payload', payload);

	chrome.tabs.update(tab.id, { url: payload.toString() });

});



/**
 * Handle notifications click event
 */
chrome.notifications.onClicked.addListener(notif =>{
    console.log('notification clicked:', notif);

    // switch (notif) {
    //     case NO_SERVER_ERROR_NOTIF_ID:
    //         chrome.tabs.create({ url: config.NATIVE_APP_INSTALL_URL });
    //         break;        
    // }

    // clear notification
    chrome.notifications.clear(notif);
})





/**
 * Given an url lets:
 * - go over our supported hosts(eg: youtube, soundcloud)
 * - if url matches supported host.alt lets return the host name
 * 
 */
function getMediaProvider(url: string): string | null{
	console.debug('Get video type of: ', url);

	const mediaProvider = config.SUPPORTED_HOSTNAMES.find(host =>{
		return host.alts.some(alt => {
			// build reg rexp to match host in url
			let match_exp = RegExp(String.raw`(?:https:\/\/)?(?:www\.)?${alt}(?:.+)?`, 'g');

			console.debug('Match RegExp: ', match_exp);

			let matched_val = url.match(match_exp);
			console.debug('Match result: ', matched_val);

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
function alertUser(notification_id, message){
    chrome.notifications.create(notification_id, {
       "type": "basic",
	   "iconUrl": chrome.runtime.getURL('icons/icon-64.png'),
       "title": "Fluctus",
       "message": message

    }, notif =>{
    	console.log('Created notification:', notif);

    	// for no server error, the user should have time!
    	if(notif == NO_SERVER_ERROR_NOTIF_ID) return;

    	// automatically clear notification after 2.5 seconds
    	const autoClearTimeOut = setTimeout(() =>{
    	    chrome.notifications.clear(notif);
    	    clearTimeout(autoClearTimeOut);
    	}, 2500)

    });
}
