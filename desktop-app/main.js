const { app, BrowserWindow, Menu, Tray, globalShortcut } = require('electron')
const path = require('path')

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
