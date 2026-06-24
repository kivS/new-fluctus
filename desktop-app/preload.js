const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('watchLater', {
    list: () => ipcRenderer.invoke('watch-later:list'),
    backfillYoutubeTitles: () => ipcRenderer.invoke('watch-later:backfill-youtube-titles'),
    open: (id) => ipcRenderer.invoke('watch-later:open', id),
    remove: (id) => ipcRenderer.invoke('watch-later:remove', id),
    saveCurrent: () => ipcRenderer.invoke('watch-later:save-current'),
    saveFocused: () => ipcRenderer.invoke('watch-later:save-focused')
})

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }
})
