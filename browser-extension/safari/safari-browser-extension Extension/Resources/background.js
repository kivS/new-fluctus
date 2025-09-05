const api = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);

// Basic config and supported hosts (aligned with Chrome extension)
const config = {
  FLUCTUS_PROTOCOL: 'fluctus://',
  SUPPORTED_HOSTNAMES: [
    { name: 'youtube',    alts: ['youtube', 'youtu.be'] },
    { name: 'vimeo',      alts: ['vimeo'] },
    { name: 'soundcloud', alts: ['soundcloud'] },
    { name: 'twitch',     alts: ['twitch', 'go.twitch'] },
    { name: 'raw-mp4',    alts: ['mp4'] }
  ]
};

function getMediaProvider(url) {
  try {
    const found = config.SUPPORTED_HOSTNAMES.find(host =>
      host.alts.some(alt => {
        const re = new RegExp(String.raw`(?:https:\/\/)?(?:www\.)?${alt}(?:.+)?`, 'i');
        return re.test(url || '');
      })
    );
    return found ? found.name : null;
  } catch (e) {
    console.error('getMediaProvider error:', e);
    return null;
  }
}

function buildFluctusUrl(provider, url, title) {
  const payload = new URL(`${config.FLUCTUS_PROTOCOL}${provider}`);
  if (url) payload.searchParams.set('url', url);
  if (title) payload.searchParams.set('title', title);
  return payload.toString();
}

function openInCurrentTab(tabId, url) {
  try {
    const p = api.tabs.update(tabId, { url });
    // In MV3 Safari polyfill, this may not return a real Promise
    if (p && typeof p.catch === 'function') {
      p.catch(err => console.error('tabs.update error:', err));
    }
  } catch (err) {
    console.error('tabs.update threw:', err);
  }
}

// Create context menu for links
function createContextMenus() {
  if (!api || !api.contextMenus || !api.contextMenus.create) return;
  try {
    const rocket = (typeof String.fromCodePoint === 'function')
      ? String.fromCodePoint(0x1F680)
      : '\uD83D\uDE80';
    api.contextMenus.create({
      id: 'fluctus_link_float',
      title: `${rocket} Float me..`,
      contexts: ['link']
    });
  } catch (e) {
    // ignore duplicate create errors
    console.debug('contextMenus.create error (likely duplicate):', e);
  }
}

// Create menus on install/update and on startup
if (api && api.runtime && api.runtime.onInstalled) {
  api.runtime.onInstalled.addListener(() => createContextMenus());
}
createContextMenus();

// Handle context menu clicks on links
if (api && api.contextMenus && api.contextMenus.onClicked) {
  api.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) return;
    const linkUrl = info.linkUrl || '';
    const provider = getMediaProvider(linkUrl);
    if (!provider) {
      console.error('Unsupported link URL for Fluctus:', linkUrl);
      return;
    }
    const newUrl = buildFluctusUrl(provider, linkUrl);
    openInCurrentTab(tab.id, newUrl);
  });
}

// Toolbar button click (matches Chrome behavior using provider detection)
api.action.onClicked.addListener(tab => {
  if (!tab || !tab.id) return;
  const provider = getMediaProvider(tab.url || '');
  if (!provider) {
    console.error('Unsupported page URL for Fluctus:', tab.url);
    return;
  }
  const newUrl = buildFluctusUrl(provider, tab.url, tab.title);
  openInCurrentTab(tab.id, newUrl);
});
