# Fluctus
Video and audio media in a floating window

## Tooling

- [Vercel update server for electronjs app](https://github.com/kivS/fluctus-update-server)


## Local Dev

- Install dependencies:
```bash
npm install
```

- Start application:
```bash
npm start
```


## How to deploy


- Run the `make` command to build the application:
```bash
npm run make
```

## Publishing the app to GitHub and deploying to updates

We're only interested in the zip file for auto-update purposes, so it's important to be in the release.
The different arch builds(x64, arm) can be uploaded manually for now.

- First we publish a draft to Github

    ```bash
    npm run publish 
    ```

- Then we edit the draft in the github UI and publish it 

- After that as soon as our [update server](https://fluctus-update-server.vercel.app/) picks the latest release we should be good to receive the update on our app.