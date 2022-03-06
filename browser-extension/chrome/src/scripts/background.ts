
// Define config constant
const config = {
	debug: true,
	SUPPORTED_PORTS: [8791,8238,8753],
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

let NATIVE_APP_PORT = null;
const NO_SERVER_ERROR_NOTIF_ID = "fluctus_says_nope";


// get native app default port from storage if not get default one from config
chrome.storage.sync.get(config.STORAGE_KEY_NATIVE_APP_PORT, result =>{

	// get port
	NATIVE_APP_PORT = result[config.STORAGE_KEY_NATIVE_APP_PORT];

	if(!NATIVE_APP_PORT){
		// Set last value of supported ports array as default
		NATIVE_APP_PORT = config.SUPPORTED_PORTS[config.SUPPORTED_PORTS.length-1];

		// Save to storage
		setNativeAppPortToStorage(NATIVE_APP_PORT);
	}

	console.log('Using default native port:', NATIVE_APP_PORT);

});





//*****************************************************
//               Events
//
//*****************************************************

// On install or upgrade
chrome.runtime.onInstalled.addListener(() =>{
	// Replace all rules for filtering page depending on content
	chrome['declarativeContent'].onPageChanged.removeRules(undefined, () => {
		// With a new rule
		chrome['declarativeContent'].onPageChanged.addRules([
		 	{
		 		// Youtube Trigger me!!
		 		conditions: [
		 			// Youtube Trigger me!!
		 			new chrome['declarativeContent'].PageStateMatcher({
		 				pageUrl: { hostContains: 'youtube',  pathContains: 'watch' }
		 			}),

					// Vimeo Trigger me!!
					new chrome['declarativeContent'].PageStateMatcher({
		 				pageUrl: { hostContains: 'vimeo' },
		 				css: ['video']
		 			}),

	 				// soundcloud Trigger me!!
					new chrome['declarativeContent'].PageStateMatcher({
		 				pageUrl: { hostContains: 'soundcloud' },
		 				css: ['div.waveform__scene']
		 			}),

		 			// Twitch Trigger me!!
					new chrome['declarativeContent'].PageStateMatcher({
		 				pageUrl: { urlMatches: 'https://go.twitch.tv/[a-zA-Z0-9_]{4,25}$' },
		 				
		 			}),
		 			new chrome['declarativeContent'].PageStateMatcher({
		 				pageUrl: { urlMatches: String.raw`https://go.twitch.tv/videos/\d+$` },
		 				
		 			})
		 		],

		 		// Shows the page_action
		 		actions: [
		 			new chrome['declarativeContent'].ShowAction()

		 		]
		 	}
		]);
	});

	// Add contextMenus
	chrome.contextMenus.create({
		id: 'contextMenu_1',
		title: chrome.i18n.getMessage("titleOnAction"),
		contexts: ['link', 'selection'],
		targetUrlPatterns: [
			// YOUTUBE
			// For clean urls links like in youtube page and etc
			'https://www.youtube.com/watch*',
			// for short url
			'https://youtu.be/*',
			// For dirty urls like in google search results..dirty..
			`https://*/*${encodeURIComponent('www.youtube.com/watch')}*`,

			// VIMEO
			'https://*.vimeo.com/*',
			// For dirty urls like in google search results..dirty..
			`https://*/*${encodeURIComponent('vimeo')}*`,

			// SOUNDCLOUD
			'https://*.soundcloud.com/*',
			// For dirty urls like in google search results..dirty..
			`https://*/*${encodeURIComponent('soundcloud')}*`,

			// TWITCH
			'https://go.twitch.tv/videos/*',
			'https://go.twitch.tv/*',
			// For dirty urls like in google search results..dirty..
			`https://*/*${encodeURIComponent('twitch')}*`,
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

	// if we're here we already have permission to open this link so let's not waste time and go directly ahead


	// given an url let's go over the alts in config.SUPPORTED_HOSTNAMES and find the matching hostname
	
	let hostname = getMediaProvider(tab.url);
	console.debug('hostname: ', hostname);

	let payload = new URL(`fluctus://${hostname}`);
	payload.searchParams.set('url', tab.url);
	payload.searchParams.set('ninja', 'kiv segrob');
	
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

	chrome.tabs.update(tab.id, { url: 'fluctus://youtube?name=12' });

	// parser for url
	// let parser = parseUrl(object_info.linkUrl || object_info.selectionText);

	// try{
	// 	// get 'cleaned' url & hostname to avoid multiple getMediaProvider calls
	// 	let [hostname, cleaned_url] = getCleanedUrl(parser.href);
		

	// 	if(cleaned_url){

	// 		// Open video request
	// 		openVideoRequest(cleaned_url, null, hostname);
	// 	}

	// }catch(e){
	// 	console.log('url not supported.');
	// }



});



/**
 * Handle notifications click event
 */
chrome.notifications.onClicked.addListener(notif =>{
    console.log('notification clicked:', notif);

    switch (notif) {
        case NO_SERVER_ERROR_NOTIF_ID:
            chrome.tabs.create({ url: config.NATIVE_APP_INSTALL_URL });
            break;        
    }

    // clear notification
    chrome.notifications.clear(notif);
})




//*****************************************************
//			   Native app functions
//
//*****************************************************
/**
 * Send request to native app to open video panel
 * @param  {[string]} url
 * @param  {[integer]} currentTime(optional)
 * @param  {[string]} hostname (optional) - from contextMenu
 */
function openVideoRequest(url, currentTime?, hostname=null){

	let media_provider;

	// if request comes from contextMenu avoid multiple calls to getMediaProvider by passing explicit media_provider
	if(hostname){
		media_provider = hostname;
	
	}else{
		// get media provider(hostname) like youtube, vimeo
		[media_provider] = getMediaProvider(url);
	}


	if(!media_provider){
		alertUser("", chrome.i18n.getMessage('mediaProviderNotSupportedError'));
		return;
	}

	// get payload for start_player request
	const payload = getPayload(media_provider, url, currentTime);
	console.log('Payload to send: ', payload);

	// make sure payload has at least player_type and one more arg like the url of the request
	if(Object.keys(payload).length <= 1){
		alertUser("", chrome.i18n.getMessage('urlNotSupportedError'));
		return;
	}

	// Make request
	fetch(`http://localhost:${NATIVE_APP_PORT}/start_player`,{
		method: 'POST',
		headers: new Headers({"Content-Type": "application/json"}),
		body: JSON.stringify(payload)
	})
	.then(response =>{
		return response.json()
	})
	.then(response_data => {

		console.info('Video start request sent!');

		if(response_data.status != "ok"){
			alertUser("", response_data.status);	
		}	
		
	})
	.catch(err => {
		console.debug('Failed to send request to native app: ', err);

		// If request fails let's reset default native app port, that way we'll have to ping for new port
		NATIVE_APP_PORT = null;
		setNativeAppPortToStorage("");

		// Ping server again
		console.log('Trying to connect again...');
		pingNativeAppServer(url, currentTime);

	});

}



/**
 * Pings app server, selects proper port & resumes previous requests
 * @param requested_video_url  
 * @param requested_video_time 
 */
function pingNativeAppServer(requested_video_url, requested_video_time?){

	// make sure we start by the first port defined in config
	let ping_urls = config.SUPPORTED_PORTS.reverse().map(port =>{
		return [`http://localhost:${port}/ping`, port];
	})

	// return single promise from array of promises looking for the companion app
	Promise.all(ping_urls.map(ping_url => {

		return new Promise((resolve, reject) =>{

			fetch( ping_url[0].toString() )
				.then(response =>{
					if(response.ok){
						// if port is found lets skip all other promises by rejecting 'father promise'
						reject(ping_url[1]);
					}
				})
				.catch(error =>{
					// No server found
					alertUser('', chrome.i18n.getMessage("noAppAtPortError", ping_url[1].toString()) );
					console.warn(`No one behind port ${ping_url[1]}!`);
					resolve('nope');
				})
		})
		

	}))
	.then(responses =>{
		console.log('Companion app not found!');

		// No server found
		alertUser(NO_SERVER_ERROR_NOTIF_ID, chrome.i18n.getMessage("noServerError"));
		
	})
	.catch(port =>{
		console.debug('Companion app found behind port:', port);
		// Cache server port
		NATIVE_APP_PORT = port;
		setNativeAppPortToStorage(port);

		// Send POST request to open video
		openVideoRequest(requested_video_url ,requested_video_time);
	});
}



//*****************************************************
//
//			   Helper functions
//
//*****************************************************

/**
 * Given a media provider like youtube or soundcloud, a url & maybe the video's ellapsed time lets:
 * - build & return payload object 
 * 
 * @param media_provider 
 * @param  url            
 * @param  currentTime   
 */
function getPayload(media_provider, url, currentTime?){

	let payload = {};

	// default - player_type 
	payload['player_type'] = media_provider;

	switch (media_provider) {

		case "youtube":
	
			//  if url is 'short-url' lets replace it with full url
			payload['video_url'] = url.replace('youtu.be/', 'www.youtube.com/watch?v=');
			// video time
			if(currentTime) payload['video_currentTime'] = currentTime;

		break;


		case "vimeo":
			// video url
			payload['video_url'] = url;
			// video time
			if(currentTime) payload['time'] = currentTime;
		break;

		case "soundcloud":
			// url
			payload['url'] = url;
		break;

		case "twitch":
			// get player channel
			let channel_regexp_match = url.match(RegExp('https://go.twitch.tv/([a-zA-Z0-9_]{4,25}$)'));
			console.log('Channel match regexp:', channel_regexp_match);
			if(channel_regexp_match) payload['channel_id'] = channel_regexp_match[1];

			// get video id
			let video_regexp_match = url.match(RegExp(String.raw`https://go.twitch.tv/videos/(\d+$)`));
			console.log('video match regexp:', video_regexp_match);
			if(video_regexp_match) payload['video_id'] = `v${video_regexp_match[1]}`;

		break;
		
	}

	return payload;
}




/**
 * Given an url lets:
 * - go over our supported hosts(eg: youtube, soundcloud)
 * - if url matches supported host.alt lets return host name
 * 
 */
function getMediaProvider(url: string): string | null{
	console.debug('Get video type of: ', url);

	const mediaProvider = config.SUPPORTED_HOSTNAMES.find(host =>{
		return host.alts.some(alt => {
			// build reg rexp to match host in url
			let match_exp = RegExp(String.raw`(?:https:\/\/)?(?:www\.)?${alt}(?:.+)?`, 'g');

			console.debug('Match RegExp: ', match_exp);

			// execute it
			let matched_val = url.match(match_exp);
			console.debug('Match result: ', matched_val);

			return true
		})
	})

	return mediaProvider?.name ?? null
}



/**
 * Given an url or a text with links, return if supported, the valid url & hostname
 *
 * @param  url_candidate
 * @return clean_url_candidate, hostname or error msg
 */
function getCleanedUrl(url_candidate){
	
	// url object
	let url_candidate_obj = parseUrl(url_candidate);
	console.debug('candidate url :', url_candidate_obj);

	const media_provider = getMediaProvider(url_candidate_obj.hostname);

	if(media_provider){
		console.log(`Hostname: ${url_candidate_obj.hostname} is supported!`);
		// If candidate url is already supported lets return it
		const [hostname] = media_provider;
		return [hostname, url_candidate];

	}else{
		console.log(`Hostname: ${url_candidate_obj.hostname} is not supported.. let\s try to retrieve clean url from it`);

		try{

			const [hostname , clean_url_candidate] = getMediaProvider(url_candidate_obj.search);

			if(!clean_url_candidate) throw `No match for dirty url: ${url_candidate_obj.search}`;

			// clean url is supported
			return [hostname, clean_url_candidate];

		}catch(e){
			alertUser("", chrome.i18n.getMessage("urlNotSupportedError"));
		}
	}

}


/**
 * Parses url and returns object with url's various components
 * @param  {[string]} url
 * @return {[object]}     -> Url object
 */
function parseUrl(url){
	let parser = document.createElement('a');
	parser.href = decodeURIComponent(url);

	return parser;
}


/**
 * Save native_app_port to storage
 * @param  {[string]} port
 */
function setNativeAppPortToStorage(port){
	const objToStore = {};

	objToStore[config.STORAGE_KEY_NATIVE_APP_PORT] = port;

	chrome.storage.sync.set(objToStore);

}


/**
 * Send notification to the user
 * @param  notification_id 
 * @param  message        
 */
function alertUser(notification_id, message){
    chrome.notifications.create(notification_id, {
       "type": "basic",
       "iconUrl": chrome.extension.getURL("icons/icon-64.png"),
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
