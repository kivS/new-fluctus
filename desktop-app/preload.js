const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('watchLater', {
    list: () => ipcRenderer.invoke('watch-later:list'),
    backfillYoutubeTitles: () => ipcRenderer.invoke('watch-later:backfill-youtube-titles'),
    open: (id) => ipcRenderer.invoke('watch-later:open', id),
    remove: (id) => ipcRenderer.invoke('watch-later:remove', id),
    saveCurrent: () => ipcRenderer.invoke('watch-later:save-current'),
    saveFocused: () => ipcRenderer.invoke('watch-later:save-focused')
})

const CAST_ICON_PATH = 'M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z'
const CAST_CONTROLS_IDLE_MS = 2500

function isYoutubePlayerPage() {
    return /(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname) && location.pathname.startsWith('/embed/')
}

function getCurrentYoutubeVideoId() {
    // The title link follows the video that's playing, including inside playlists
    const titleLink = document.querySelector('.ytp-title-link')
    if (titleLink?.href) {
        try {
            const videoId = new URL(titleLink.href).searchParams.get('v')
            if (videoId) return videoId
        } catch (error) { /* fall back to the embed url */ }
    }

    return location.pathname.split('/')[2] || null
}

// Youtube pages enforce Trusted Types and a strict CSP, so the controls are
// built with DOM APIs and inline CSSOM styles only (no innerHTML, no <style>).
function createElement(tagName, style, text) {
    const element = document.createElement(tagName)
    Object.assign(element.style, style)
    if (text) element.textContent = text
    return element
}

function injectCastControls() {
    const container = createElement('div', {
        position: 'fixed',
        right: '12px',
        bottom: '64px',
        zIndex: '2147483647',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '6px',
        fontFamily: 'Roboto, Arial, sans-serif',
        fontSize: '13px',
        transition: 'opacity 0.2s',
        opacity: '0',
        pointerEvents: 'none'
    })

    const menu = createElement('div', {
        display: 'none',
        minWidth: '180px',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        padding: '6px 0',
        borderRadius: '8px',
        background: 'rgba(28, 28, 28, 0.95)',
        color: '#fff',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
    })

    const button = createElement('button', {
        width: '36px',
        height: '36px',
        padding: '7px',
        border: 'none',
        borderRadius: '50%',
        background: 'rgba(0, 0, 0, 0.6)',
        cursor: 'pointer'
    })
    button.title = 'Cast to TV'

    const svgNamespace = 'http://www.w3.org/2000/svg'
    const icon = document.createElementNS(svgNamespace, 'svg')
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.setAttribute('width', '22')
    icon.setAttribute('height', '22')
    const iconPath = document.createElementNS(svgNamespace, 'path')
    iconPath.setAttribute('d', CAST_ICON_PATH)
    iconPath.setAttribute('fill', '#fff')
    icon.appendChild(iconPath)
    button.appendChild(icon)

    container.append(menu, button)
    document.body.appendChild(container)

    let isMenuOpen = false
    let isSearching = false
    let hideTimer = null

    const setVisible = (visible) => {
        container.style.opacity = visible ? '1' : '0'
        container.style.pointerEvents = visible ? 'auto' : 'none'
    }

    const showControls = () => {
        setVisible(true)
        clearTimeout(hideTimer)
        hideTimer = setTimeout(() => {
            if (!isMenuOpen) setVisible(false)
        }, CAST_CONTROLS_IDLE_MS)
    }

    const closeMenu = () => {
        isMenuOpen = false
        menu.style.display = 'none'
        showControls()
    }

    const addMenuText = (text, color = '#aaa') => {
        menu.appendChild(createElement('div', { padding: '8px 14px', color }, text))
    }

    const addMenuItem = (label, detail, onClick) => {
        const item = createElement('div', { padding: '8px 14px', cursor: 'pointer' })
        item.appendChild(createElement('div', {}, label))
        if (detail) item.appendChild(createElement('div', { fontSize: '11px', color: '#aaa' }, detail))
        item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255, 255, 255, 0.1)' })
        item.addEventListener('mouseleave', () => { item.style.background = 'transparent' })
        item.addEventListener('click', (event) => {
            event.stopPropagation()
            onClick()
        })
        menu.appendChild(item)
    }

    const castTo = async (device) => {
        const video = document.querySelector('video')
        menu.replaceChildren()
        addMenuText(`Sending to ${device.name}…`)

        const result = await ipcRenderer.invoke('cast:play', {
            deviceId: device.id,
            videoId: getCurrentYoutubeVideoId(),
            currentTime: video?.currentTime || 0
        })

        menu.replaceChildren()
        if (result.ok) {
            video?.pause()
            addMenuText(`Playing on ${result.deviceName}`, '#fff')
            setTimeout(closeMenu, 2000)
        } else {
            addMenuText(result.message, '#ff8a80')
            addMenuItem('Try again', null, () => castTo(device))
        }
    }

    const searchDevices = async () => {
        if (isSearching) return
        isSearching = true
        menu.replaceChildren()
        addMenuText('Searching for TVs…')

        const result = await ipcRenderer.invoke('cast:discover')
        isSearching = false
        menu.replaceChildren()

        if (!result.ok) {
            addMenuText(result.message, '#ff8a80')
            if (result.canOpenSettings) {
                addMenuItem('Open Local Network settings', null, () => ipcRenderer.invoke('cast:open-network-settings'))
            }
        } else if (result.devices.length === 0) {
            addMenuText('No TVs found on this network. Make sure the TV is on.')
        } else {
            addMenuText('Cast to')
            result.devices.forEach((device) => addMenuItem(device.name, device.model, () => castTo(device)))
        }

        addMenuItem('Search again', null, searchDevices)
    }

    button.addEventListener('click', (event) => {
        event.stopPropagation()

        if (isMenuOpen) {
            closeMenu()
            return
        }

        isMenuOpen = true
        menu.style.display = 'block'
        setVisible(true)
        searchDevices()
    })

    container.addEventListener('mousedown', (event) => event.stopPropagation())
    document.addEventListener('mousemove', showControls)
    document.documentElement.addEventListener('mouseleave', () => {
        if (!isMenuOpen) setVisible(false)
    })
    document.addEventListener('click', () => {
        if (isMenuOpen) closeMenu()
    })
}

window.addEventListener('DOMContentLoaded', () => {
    if (isYoutubePlayerPage()) {
        injectCastControls()
    }

    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }
})
