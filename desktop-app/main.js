const { app, BrowserWindow, Menu, Tray, globalShortcut, dialog } = require('electron')
const path = require('path')
const { URL } = require('url')

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

function createMediaPlayerWindow(name, options) {

    const win = new BrowserWindow({
        width: 400,
        height: 400,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.loadFile(`${name}.html`, {search: options})
}

function openMediaPlayer(name, options){
    switch (name) {
        case 'youtube':
            createMediaPlayerWindow(name, options)
            break;
        case 'twitch':
            createMediaPlayerWindow(name, options)
            break;
    
        default:
            dialog.showErrorBox('Oops!', `${name} is not supported...`)
            break;
    }
}


// create menu
const appMenu = Menu.buildFromTemplate([
    {
        label: 'Saved list',
        accelerator: "Alt+Shift+o",
        click: () => {
            console.log('clicky poopy')
            createWindow()
        }
    },
    {
        type: 'separator',
    },
    {
        label: `Version: ${app.getVersion()}`,
        click: () => {
            // shell.openItem(config.RELEASE_PAGE_URL)
            console.log('hmm')
        }
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
