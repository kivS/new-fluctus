const path = require("path")
const { setMachOUuid } = require("./scripts/set-macho-uuid")

const APP_BUNDLE_ID = "software.kiv.fluctus"

module.exports = {
    hooks: {
        // Runs before signing, on the freshly extracted Electron binary
        packageAfterExtract: async (_forgeConfig, buildPath, _electronVersion, platform) => {
            if (platform !== "darwin") return
            setMachOUuid(path.join(buildPath, "Electron.app/Contents/MacOS/Electron"), APP_BUNDLE_ID)
        }
    },
    packagerConfig: {
        name: "Fluctus",
        executableName: "fluctus",
        icon: "images/icons/icon.icns",
        appBundleId: APP_BUNDLE_ID,
        appCategoryType: "public.app-category.utilities",
        extendInfo: {
            NSLocalNetworkUsageDescription: "Fluctus looks for smart TVs on your network so you can cast videos to them."
        },
        protocols: [
            {
                name: "Fluctus Launch Protocol",
                schemes: [
                    "fluctus"
                ]
            }
        ],
        osxSign: {
            identity: "Developer ID Application: Vik Borges (3XHWAYK6RW)",
            "hardened-runtime": true,
            entitlements: "entitlements.plist",
            "entitlements-inherit": "entitlements.plist",
            "signature-flags": "library",
            "gatekeeper-assess": false,
            // Timestamping hits Apple's server for every file and is only needed
            // for notarized releases, so local installs (bin/deploy) skip it
            optionsForFile: () => (process.env.FLUCTUS_LOCAL_BUILD ? { timestamp: "none" } : {})
        }
    },
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {
                name: "fluctus"
            }
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: [
                "darwin"
            ]
        },
        {
            name: "@electron-forge/maker-dmg",
            config: {
                format: "ULFO"
            }
        },
        {
            name: "@electron-forge/maker-deb",
            config: {}
        },
        {
            name: "@electron-forge/maker-rpm",
            config: {}
        }
    ],
    publishers: [
        {
            name: "@electron-forge/publisher-github",
            config: {
                repository: {
                    owner: "kivs",
                    name: "new-fluctus"
                },
                draft: true,
                prerelease: false
            }
        }
    ]
}
