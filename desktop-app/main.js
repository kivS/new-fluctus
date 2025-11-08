const { app, BrowserWindow, Menu, Tray, globalShortcut, dialog, shell, autoUpdater, session } = require('electron')
const path = require('path')
const { URL } = require('url')
const Sentry = require('@sentry/electron');
const log = require('electron-log');

Object.assign(console, log.functions);

const APP_REFERRER = 'https://software.kiv.fluctus/';
const YOUTUBE_URL_FILTER = [
    'https://*.youtube.com/*',
    'https://*.youtube-nocookie.com/*',
    'https://*.googlevideo.com/*',
    'https://*.ytimg.com/*',
    'https://yt3.ggpht.com/*',
    'https://*.gvt1.com/*'
];

if(app.isPackaged){
    Sentry.init({
        dsn: 'https://b2b4cb9edcc54452aa82e10c405d5f29@o481264.ingest.sentry.io/6247765',
    });
}


if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('fluctus', process.execPath, [path.resolve(process.argv[1])])
    }
} else {
    app.setAsDefaultProtocolClient('fluctus')
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.loadFile('index.html')
}

function createMediaPlayerWindow(name, options, remoteContentOptions) {
    const windowTitle = remoteContentOptions?.windowTitle || name;

    const win = new BrowserWindow({
        width: 400,
        height: 300,
        minWidth: 400,
        minHeight: 300,
        alwaysOnTop: true,
        title: windowTitle,
        center: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    })

    if (remoteContentOptions?.url) {
        win.loadURL(remoteContentOptions.url, remoteContentOptions.loadOptions)
    } else {
        win.loadFile(`${name}.html`, {search: options})
    }

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

function openMediaPlayer(name, options){
    switch (name) {
        case 'youtube':
            openYoutubePlayer(options)
            break;
        case 'twitch':
            createMediaPlayerWindow(name, options)
            break;
        case 'raw-mp4':
            createMediaPlayerWindow('custom_video', options)
            break
    
        default:
            dialog.showErrorBox('Oops!', `${name} is not supported...`)
            break;
    }
}

function openYoutubePlayer(options) {
    const config = buildYoutubeEmbedConfig(options);

    if (config.error) {
        dialog.showErrorBox('Youtube', config.error);
        return;
    }

    createMediaPlayerWindow('youtube', options, config);
}

function buildYoutubeEmbedConfig(rawSearch) {
    const params = new URLSearchParams(rawSearch || '');
    const originalYoutubeUrl = params.get('url');

    if (!originalYoutubeUrl) {
        return { error: 'No Youtube URL provided.' };
    }

    let parsedYoutubeUrl;
    try {
        parsedYoutubeUrl = new URL(originalYoutubeUrl);
    } catch (error) {
        return { error: `Invalid Youtube URL: ${originalYoutubeUrl}` };
    }

    const videoMeta = extractYoutubeMetadata(parsedYoutubeUrl);

    if (!videoMeta.videoId) {
        return { error: 'Unable to detect the Youtube video ID.' };
    }

    const embedUrl = new URL(`https://www.youtube.com/embed/${videoMeta.videoId}`);

    embedUrl.searchParams.set('autoplay', '1');
    embedUrl.searchParams.set('playsinline', '1');
    embedUrl.searchParams.set('modestbranding', '1');
    embedUrl.searchParams.set('rel', '0');
    embedUrl.searchParams.set('enablejsapi', '1');
    embedUrl.searchParams.set('widget_referrer', APP_REFERRER);

    if (videoMeta.listId) {
        embedUrl.searchParams.set('list', videoMeta.listId);
    }

    if (videoMeta.startSeconds > 0) {
        embedUrl.searchParams.set('start', `${videoMeta.startSeconds}`);
    }

    const windowTitle = params.get('title') || 'Youtube';

    return {
        url: embedUrl.toString(),
        windowTitle,
        loadOptions: {
            httpReferrer: APP_REFERRER
        }
    };
}

function extractYoutubeMetadata(url) {
    const hostname = url.hostname.replace(/^www\./, '');
    let videoId = url.searchParams.get('v');

    if (!videoId && hostname === 'youtu.be') {
        videoId = url.pathname.split('/').filter(Boolean)[0] || null;
    }

    if (!videoId && url.pathname.startsWith('/shorts/')) {
        const [, , shortsId] = url.pathname.split('/');
        videoId = shortsId || null;
    }

    const listId = url.searchParams.get('list');
    const startSeconds = parseYoutubeTime(
        url.searchParams.get('video_currentTime') ||
        url.searchParams.get('t') ||
        url.searchParams.get('start')
    );

    return {
        videoId,
        listId,
        startSeconds
    };
}

function parseYoutubeTime(value) {
    if (!value) return 0;

    const numericValue = Number(value);
    if (!Number.isNaN(numericValue) && numericValue >= 0) {
        return Math.floor(numericValue);
    }

    const pattern = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/i;
    const match = value.match(pattern);

    if (!match) return 0;

    const [, hoursStr, minutesStr, secondsStr] = match;

    const hours = parseInt(hoursStr || '0', 10);
    const minutes = parseInt(minutesStr || '0', 10);
    const seconds = parseInt(secondsStr || '0', 10);

    return (hours * 3600) + (minutes * 60) + seconds;
}


// create menu
const appMenu = Menu.buildFromTemplate([
    // {
    //     label: 'Saved list',
    //     accelerator: "Alt+Shift+o",
    //     click: () => {
    //         console.log('clicky poopy')
    //         createWindow()
    //     }
    // },
    // {
    //     type: 'separator',
    // },
    // {
    //     label: `Force update`,
    //     click: () => {
    //         autoUpdater.checkForUpdates()
    //     }
    // },
    // {
    //     label: 'About',
    //     click: () => {
    //         shell.openExternal('https://vikborges.com')
    //     }
    // },
    //  {
    //     label: 'Test',
    //     click: () => {
    //         createMediaPlayerWindow('custom_video', 'url=https%3A%2F%2Fimg-9gag-fun.9cache.com%2Fphoto%2FaYrDobO_460svav1.mp4')
    //     }
    // },
    {
        type: 'separator',
    },
    {
        label: `Version: ${app.getVersion()}`,
        enabled: false
        // click: () => {
        //     shell.openItem(config.RELEASE_PAGE_URL)
        //     console.log('hmm')
        // }
    },
    {
        type: 'separator',
    },
    {
        label: 'Exit',
        role: 'quit'
    }
]);

let tray = null;

app.whenReady().then(() => {

    // Ensure Youtube embeds receive an identifying Referer header per the new policy
    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: YOUTUBE_URL_FILTER }, (details, callback) => {
        details.requestHeaders['Referer'] = APP_REFERRER;
        callback({ requestHeaders: details.requestHeaders });
    });

    // Handle the protocol. In this case, we choose to show an Error Box.
    app.on('open-url', (event, url) => {
        
        let parsedUrl = new URL(url)
        
        const media_name = parsedUrl.hostname
        const options = parsedUrl.search

        // dialog.showErrorBox('debug!', `options: ${options}`)

        openMediaPlayer(media_name, options)
    })

    // macOS only dock 
    app.dock.setMenu(appMenu)
   
    // Set Tray icon
    tray = new Tray(`${__dirname}/images/icons/19x19.png`);
    tray.setToolTip('Fluctus is waiting..');
    tray.setContextMenu(appMenu);

    // Show start up ballon for windows
    tray.displayBalloon({
        title: 'Start up',
        content: `Fluctus is starting up!`
    });

    tray.on('click', () => {
        // popup menu
        tray.popUpContextMenu(appMenu);
    })

    // open saved list
    globalShortcut.register('Alt+Shift+o', () => {
        console.log('Opening saved list..')
        createWindow();
    })

    if(app.isPackaged) {
        //
        // Process auto updates
        // 
        const server = 'https://fluctus-update-server.vercel.app'

        let url = ''

        if(process.platform === 'darwin' && process.arch === 'arm64') {
            url = `${server}/update/${process.platform}_arm64/${app.getVersion()}`

        }else{
            url = `${server}/update/${process.platform}/${app.getVersion()}`
        }

        console.log(`Checking for updates at ${url}`)
        autoUpdater.setFeedURL({ url })

        autoUpdater.checkForUpdates() // on boot let's see if there's updates
        
        const timeInterval = 24 * 60 * 1000 * 60  // check again every 24 hours
        setInterval(() => {
            console.log('Time for the daily updates check!')
            autoUpdater.checkForUpdates()
        }, timeInterval)


        autoUpdater.on('checking-for-update', () => {
            console.log('checking for update')
        })

        autoUpdater.on('update-available', () => {
            console.log('Update is available')
        })

        autoUpdater.on('update-not-available', () => {
            console.log('Update is not available')
        })

        autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
            console.log(`Update downloaded: ${releaseName} | ${releaseNotes} | ${event}`)
            const dialogOpts = {
                type: 'info',
                buttons: ['Restart', 'Later'],
                title: 'Application Update',
                message: process.platform === 'win32' ? releaseNotes : releaseName,
                detail: 'A new version has been downloaded. Restart the application to apply the updates.'
            }

            dialog.showMessageBox(dialogOpts).then((returnValue) => {
                if (returnValue.response === 0) autoUpdater.quitAndInstall()
            })
        })

        autoUpdater.on('error', message => {
            console.error(`There was a problem updating the application: ${message}`)
            Sentry.captureException(message);
        })
    }

  
})

app.on('will-quit', () => {
    console.log('app about to close...');
    // Unregister all shortcuts.
    globalShortcut.unregisterAll()
})
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
