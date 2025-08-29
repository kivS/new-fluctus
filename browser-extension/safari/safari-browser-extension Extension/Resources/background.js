const api = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);

api.action.onClicked.addListener(tab => {
    console.log('hello');
});
