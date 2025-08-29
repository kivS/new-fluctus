const api = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);

api.action.onClicked.addListener(tab => {
    console.log('Current URL:', tab.url);

    const encodedUrl = encodeURIComponent(tab.url);
    const newUrl = `fluctus://youtube?url=${encodedUrl}`;

    // Attempt to update the current tab's URL
    api.tabs.update(tab.id, { url: newUrl }).catch(error => {
        console.error('Error updating tab URL:', error);
        // Fallback to creating a new tab if updating fails (though this is what we want to avoid)
        // api.tabs.create({ url: newUrl });
    });
});
