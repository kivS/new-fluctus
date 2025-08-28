Safari Web Extension (Fluctus)

How to build and run:

- Open `safari-browser-extension/safari-browser-extension.xcodeproj` in Xcode.
- In the scheme selector, choose the app target `safari-browser-extension` (not just the extension).
- Run (⌘R). Xcode launches the host app and prompts to enable the extension.
- In Safari: Preferences → Extensions → enable “Fluctus”.
- Navigate to a supported page (e.g., a YouTube watch page). The toolbar button enables and the context menu shows “Float me..”.
- Click the button or use the context menu to open the `fluctus://` link.

Notes:

- The extension uses Manifest V3 and the WebExtensions `browser.*` APIs.
- Action enabling is driven by a content script that detects supported sites.
- Notifications require the provided icons at `Extension/Resources/images/`.
- If Safari prompts about opening the custom `fluctus://` URL, allow it to hand off to the app.
